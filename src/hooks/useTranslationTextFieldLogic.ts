import React from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { useSearchParams } from "react-router-dom";
import { DEFAULT_SOURCE_LANGUAGE } from "utils/constants";
import { MAPEO_LOCALES, REGIONES_POR_IDIOMA, REGION_A_IDIOMA_BASE, normalizarLocale, filtrarRegiones, localeSoportado, saveRegion } from "../utils/mapeoLocales";
import { useAuth } from "contexts/AuthContext";
import { mergeSharedOverlap, computeInterimNext, applyClosingPunctuation } from "../utils/dictationMerge";
import { useTypewriterPlaceholder } from "./useTypewriterPlaceholder";
import { useAiSpeechToText } from "./useAiSpeechToText";
import { useUnifiedAudio } from "./useUnifiedAudio";
import { showAudioErrorNotification, showWarningToast } from "../components/AppNotifications";

export const MAX_URL_TEXT_LENGTH = 8000;
const URL_SYNC_DELAY_MS = 250;

export const useTranslationTextFieldLogic = () => {
  const [searchParams, setURLSearchParams] = useSearchParams();
  const [text, setText] = React.useState(searchParams.get("text") || "");
  const urlTextParam = searchParams.get("text") || "";
  const sl = searchParams.get("sl") || DEFAULT_SOURCE_LANGUAGE;
  const sr = searchParams.get("sr");
  const slBase = REGION_A_IDIOMA_BASE[sl] || sl;
  const regionesActuales = REGIONES_POR_IDIOMA[slBase] || null;
  const regionesFiltradas = regionesActuales ? filtrarRegiones(regionesActuales) : null;
  const regionPorDefecto = regionesFiltradas?.[0]?.code ?? regionesActuales?.[0]?.code;
  const regionActual = sr && REGION_A_IDIOMA_BASE[sr] === slBase && regionesFiltradas?.some(r => r.code === sr)
    ? sr
    : (REGION_A_IDIOMA_BASE[sl] && regionesFiltradas?.some(r => r.code === sl) ? sl : regionPorDefecto);
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = React.useState(false);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition({
    clearTranscriptOnListen: false,
    commands: [
      {
        command: 'clear',
        callback: () => clearTextHandler(),
      }
    ]
  });

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const manualEditRef = React.useRef<boolean>(false);
  const manualEditTimeoutRef = React.useRef<number | null>(null);
  const textAtMicStartRef = React.useRef<string>("");
  const textRef = React.useRef<string>(text);
  textRef.current = text;

  const [keepMicOn, setKeepMicOn] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem("keepMicOn") === "true";
    } catch (e) {
      return false;
    }
  });
  const keepMicOnRef = React.useRef<boolean>(keepMicOn);
  const placeholder = useTypewriterPlaceholder(text);

  const onChunkRef = React.useRef<(chunk: string) => void>(() => { });
  onChunkRef.current = (chunk: string) => {
    const merged = mergeSharedOverlap(textRef.current, chunk);
    if (merged === textRef.current) return;

    // CEILING: STOP CAPTURING INSTEAD OF SILENTLY SWALLOWING SPEECH
    if (merged.length > MAX_URL_TEXT_LENGTH) {
      setTextParam(merged.slice(0, MAX_URL_TEXT_LENGTH));
      if (!limitStopInProgressRef.current) {
        limitStopInProgressRef.current = true;
        showWarningToast("Límite de texto", "Se alcanzó el máximo de caracteres y la grabación se detuvo.");
        Promise.resolve(aiSttRef.current?.stopRecording()).finally(() => {
          limitStopInProgressRef.current = false;
        });
      }
      return;
    }

    setTextParam(merged);
  };

  const {
    startAudio,
    stopAudio,
    mediaStream,
    isMicActive,
    isVoiceActive,
    systemAudioActive
  } = useUnifiedAudio({
    onSilenceTimeout: () => {
      if (listening && !keepMicOnRef.current) {
        SpeechRecognition.stopListening().catch(() => { });
      }
    },
    enableVad: true
  });

  const aiStt = useAiSpeechToText(
    React.useCallback((chunk: string) => onChunkRef.current(chunk), []),
    sl,
    mediaStream
  );
  const aiSttRef = React.useRef(aiStt);
  aiSttRef.current = aiStt;
  const limitStopInProgressRef = React.useRef(false);

  React.useEffect(() => {
    if (aiStt.isAiStt && listening) {
      SpeechRecognition.stopListening().catch(() => { });
    }
  }, [aiStt.isAiStt, listening]);


  // SINGLE SOURCE OF TRUTH: text STATE. THE URL IS A DEFERRED MIRROR.
  const setTextParam = React.useCallback((value: string) => {
    const isOnlyWhitespace = value.length > 0 && value.trim() === "";
    setText(isOnlyWhitespace ? "" : value.slice(0, MAX_URL_TEXT_LENGTH));
  }, []);

  // DEBOUNCED ONE-WAY SYNC (state -> url); REMEMBERS OUR OWN WRITES TO IGNORE THEM BACK
  const lastWrittenUrlRef = React.useRef<string | null>(
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("text")
  );
  const urlSyncTimerRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (urlSyncTimerRef.current) window.clearTimeout(urlSyncTimerRef.current);
    urlSyncTimerRef.current = window.setTimeout(() => {
      urlSyncTimerRef.current = null;
      setURLSearchParams((params) => {
        if (text === "") {
          params.delete("text");
        } else {
          params.set("text", text);
        }
        lastWrittenUrlRef.current = text;
        return params;
      }, { replace: true });
    }, URL_SYNC_DELAY_MS);
    return () => {
      if (urlSyncTimerRef.current) window.clearTimeout(urlSyncTimerRef.current);
    };
  }, [text, setURLSearchParams]);

  // EXTERNAL URL CHANGES ONLY (back/forward, shared link): never overrides while dictating
  const listeningRef = React.useRef(listening);
  listeningRef.current = listening;
  React.useEffect(() => {
    if (manualEditRef.current) return;
    if (urlTextParam === lastWrittenUrlRef.current) return;
    if (listeningRef.current || aiSttRef.current?.isRecording) return;
    lastWrittenUrlRef.current = urlTextParam;
    setText(urlTextParam.length > MAX_URL_TEXT_LENGTH ? urlTextParam.slice(0, MAX_URL_TEXT_LENGTH) : urlTextParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTextParam]);


  // HANDLES REGION CHANGE AND SAVES THE USER PREFERENCE TO THE DATABASE
  const handleChangeRegion = async (value: string) => {
    if (!user) return;
    const locale = MAPEO_LOCALES[value] || value;
    const slBase = REGION_A_IDIOMA_BASE[sl] || sl;
    if (!localeSoportado(locale)) {
      const fallback = regionesActuales?.[0]?.code ?? slBase;
      await saveRegion(slBase, fallback, user.id);
      setURLSearchParams(params => {
        params.set("sr", fallback);
        return params;
      });
      return;
    }
    await saveRegion(slBase, value, user.id);
    setURLSearchParams(params => {
      params.set("sr", value);
      return params;
    });
  };


  // CLEARS ALL TEXT CONTENT AND STOPS ANY ACTIVE RECORDING SESSIONS
  const clearTextHandler = async () => {
    setTextParam("");
    textRef.current = "";
    resetTranscript();
    previousTranscriptRef.current = "";
    textAtMicStartRef.current = "";
    micPrefixLenRef.current = 0;
    if (listening) {
      await SpeechRecognition.stopListening();
      SpeechRecognition.abortListening();
    }
    if (!keepMicOnRef.current && !aiStt.isRecording && !aiStt.isAiStt) {
      stopAudio();
    }
  };


  // MANAGES MANUAL TYPING INPUT IN THE TEXTAREA AND PAUSES TRANSCRIPTION UPDATES
  const handleChangeText = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (manualEditTimeoutRef.current) {
      window.clearTimeout(manualEditTimeoutRef.current);
      manualEditTimeoutRef.current = null;
    }
    manualEditRef.current = true;
    manualEditTimeoutRef.current = window.setTimeout(() => {
      manualEditRef.current = false;
      manualEditTimeoutRef.current = null;
    }, 700);

    setTextParam(e.target.value);

    if (listening) {
      resetTranscript();
      textAtMicStartRef.current = e.target.value;
    } else if (e.target.value.trim() === "") {
      resetTranscript();
    }
  };


  const [captureSystemAudio, setCaptureSystemAudio] = React.useState(false);


  // REINICIA EL AUDIO AL CAMBIAR EL TOGGLE DE CAPTURA DE SISTEMA
  // FIX 3: Cancelación de operaciones previas para evitar race conditions
  const restartOpRef = React.useRef(0);
  React.useEffect(() => {
    if (!aiStt.isAiStt) return;
    const opId = ++restartOpRef.current;

    if (captureSystemAudio) {
      const restart = async () => {
        const wasRecording = aiStt.isRecording;
        if (wasRecording) aiStt.stopRecording();
        stopAudio();
        const stream = await startAudio(true);
        // FIX 3: Si otra operación inició mientras esperábamos, no continuar
        if (opId !== restartOpRef.current) return;
        if (wasRecording && stream) aiStt.startRecording(stream);
      };
      restart().catch(console.error);
    } else {
      if (systemAudioActive && isMicActive) {
        const restart = async () => {
          const wasRecording = aiStt.isRecording;
          if (wasRecording) aiStt.stopRecording();
          stopAudio();
          const stream = await startAudio(false);
          // FIX 3: Verificar cancelación
          if (opId !== restartOpRef.current) return;
          if (wasRecording && stream) aiStt.startRecording(stream);
        };
        restart().catch(console.error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureSystemAudio]);


  // TOGGLES EITHER THE AI STT ENGINE OR THE NATIVE BROWSER SPEECH RECOGNITION
  const handleSpeech = async () => {
    try {
      setIsProcessing(true);

      if (aiStt.isAiStt) {
        if (aiStt.isRecording) {
          aiStt.stopRecording();
        } else {
          if (!mediaStream) {
            const stream = await startAudio(captureSystemAudio);
            aiStt.startRecording(stream);
          } else {
            aiStt.startRecording();
          }
        }
      } else {
        if (listening) {
          await SpeechRecognition.stopListening();
          if (!keepMicOnRef.current) stopAudio();
        } else {
          if (!keepMicOnRef.current) {
            setIsProcessing(false);
            return;
          }
          if (isMicrophoneAvailable === false) {
            setIsProcessing(false);
            return;
          }
          // FIX 5: NO llamar startAudio() para STT nativo.
          // SpeechRecognition del browser abre su propio mic internamente.
          // Abrir otro getUserMedia causa DOBLE stream = ECO.
          // Solo necesitamos startAudio() cuando AI STT necesita MediaRecorder.

          const effectiveSl = sr || sl;
          const slSanitizado = effectiveSl.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const idiomaOptimizado = normalizarLocale(MAPEO_LOCALES[slSanitizado] || sl);

          resetTranscript();
          previousTranscriptRef.current = "";
          textAtMicStartRef.current = text;
          micPrefixLenRef.current = text.length;

          await SpeechRecognition.startListening({
            continuous: true,
            interimResults: true,
            language: idiomaOptimizado
          });
        }
      }
    } catch (error) {
      console.error("Error in speech handler", error);
      showAudioErrorNotification(
        "Error de dictado",
        "Ocurrió un error al iniciar o detener el reconocimiento de voz."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const previousTranscriptRef = React.useRef("");
  const transcriptRef = React.useRef("");
  transcriptRef.current = transcript;
  const micPrefixLenRef = React.useRef(0);
  const wasListeningRef = React.useRef(false);

  // INTERIM DICTATION: NEVER PUNCTUATE, NEVER REWRITE STABLE TEXT.
  // IF THE NEW TRANSCRIPT ONLY EXTENDS WHAT'S ON SCREEN, DON'T TOUCH THE DOM.
  React.useEffect(() => {
    if (!listening) return;
    if (manualEditRef.current) return;

    if (transcript && transcript !== previousTranscriptRef.current) {
      previousTranscriptRef.current = transcript;

      const prefix = textAtMicStartRef.current ? textAtMicStartRef.current + " " : "";
      const fullText = prefix + transcript;

      // null = nothing really changed: skip the write entirely (no flicker)
      const next = computeInterimNext(textRef.current, fullText);
      if (next === null) return;

      if (next.length > MAX_URL_TEXT_LENGTH) {
        showWarningToast("Límite de texto", "Se alcanzó el máximo de caracteres y el dictado se detuvo.");
        SpeechRecognition.stopListening().catch(() => { });
        if (!keepMicOnRef.current) stopAudio();
        setTextParam(next.slice(0, MAX_URL_TEXT_LENGTH));
        return;
      }

      setTextParam(next);
    }
  }, [transcript, listening, stopAudio]);

  // PUNCTUATION IS DEFERRED TO SEGMENT CLOSURE: APPLIED ONCE WHEN LISTENING ENDS
  React.useEffect(() => {
    const justClosed = wasListeningRef.current && !listening && !aiStt.isAiStt;
    wasListeningRef.current = listening;
    if (!justClosed) return;
    if (manualEditRef.current) return;

    const body = transcriptRef.current.trim();
    if (!body) return;

    const finalText = applyClosingPunctuation(
      textRef.current,
      Math.min(micPrefixLenRef.current, textRef.current.length),
      body
    ).slice(0, MAX_URL_TEXT_LENGTH);

    if (finalText !== textRef.current) {
      setTextParam(finalText);
    }
    previousTranscriptRef.current = "";
  }, [listening, aiStt.isAiStt]);

  React.useEffect(() => {
    if (textareaRef.current && !listening && !aiStt.isRecording && !aiStt.isAiStt) {
      textareaRef.current.focus();
    }
  }, [listening, aiStt.isRecording, aiStt.isAiStt]);

  React.useEffect(() => {
    if (listening && !aiStt.isAiStt) {
      const restartWithNewLang = async () => {
        await SpeechRecognition.stopListening();
        resetTranscript();
        previousTranscriptRef.current = "";
        textAtMicStartRef.current = "";
        const effectiveSl = sr || sl;
        const slSanitizado = effectiveSl.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const idiomaOptimizado = normalizarLocale(MAPEO_LOCALES[slSanitizado] || sl);
        await SpeechRecognition.startListening({
          continuous: true,
          interimResults: true,
          language: idiomaOptimizado
        });
      };
      restartWithNewLang().catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sl]);

  React.useEffect(() => {
    keepMicOnRef.current = keepMicOn;
    try {
      localStorage.setItem("keepMicOn", keepMicOn ? "true" : "false");
    } catch (e) { }

    // FIX 5: keepMicOn ya NO arranca startAudio() para STT nativo.
    // SpeechRecognition maneja su propio mic. Arrancar otro causa eco.
    if (!keepMicOn && !aiStt.isAiStt) {
      if (listening) {
        SpeechRecognition.stopListening().catch(() => { });
      }
      stopAudio();
    }
  }, [keepMicOn, browserSupportsSpeechRecognition, isMicrophoneAvailable, startAudio, stopAudio, listening, mediaStream, aiStt.isAiStt]);

  React.useEffect(() => {
    return () => {
      stopAudio();
      SpeechRecognition.abortListening();
    };
  }, [stopAudio]);

  return {
    text,
    aiStt,
    placeholder,
    textareaRef,
    handleChangeText,
    clearTextHandler,
    keepMicOn,
    setKeepMicOn,
    handleSpeech,
    isProcessing,
    listening,
    regionActual,
    handleChangeRegion,
    regionesFiltradas,
    regionesActuales,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
    isMicActive,
    isVoiceActive,
    systemAudioActive,
    startAudio,
    captureSystemAudio,
    setCaptureSystemAudio
  };
};