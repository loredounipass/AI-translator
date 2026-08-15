import React from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { useSearchParams } from "react-router-dom";
import { DEFAULT_SOURCE_LANGUAGE } from "utils/constants";
import { MAPEO_LOCALES, REGIONES_POR_IDIOMA, REGION_A_IDIOMA_BASE, normalizarLocale, filtrarRegiones, localeSoportado, saveRegion } from "../utils/mapeoLocales";
import { useAuth } from "contexts/AuthContext";
import { addPunctuation } from "../utils/punctuationLogic";
import { useTypewriterPlaceholder } from "./useTypewriterPlaceholder";
import { useAiSpeechToText } from "./useAiSpeechToText";
import { useUnifiedAudio } from "./useUnifiedAudio";
import { showAudioErrorNotification } from "../components/AppNotifications";

export const MAX_URL_TEXT_LENGTH = 8000;

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

  const [keepMicOn, setKeepMicOn] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem("keepMicOn") === "true";
    } catch (e) {
      return false;
    }
  });
  const keepMicOnRef = React.useRef<boolean>(keepMicOn);
  const placeholder = useTypewriterPlaceholder(text);

  const setTextParamRef = React.useRef<((value: string | ((prev: string) => string)) => void) | null>(null);
  
  const onChunkRef = React.useRef<(chunk: string) => void>(() => {});
  onChunkRef.current = (chunk: string) => {
    if (setTextParamRef.current) {
      setTextParamRef.current((prevText: string) => {
        return prevText + (prevText ? " " : "") + chunk;
      });
    }
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
        SpeechRecognition.stopListening().catch(() => {});
      }
    },
    enableVad: true
  });

  const aiStt = useAiSpeechToText(
    React.useCallback((chunk: string) => onChunkRef.current(chunk), []),
    sl,
    mediaStream,
    () => {
      if (!keepMicOnRef.current) stopAudio();
    }
  );

  React.useEffect(() => {
    if (aiStt.isAiStt && listening) {
      SpeechRecognition.stopListening().catch(() => {});
    }
  }, [aiStt.isAiStt, listening]);


  // UPDATES THE TEXT STATE AND SYNCHRONIZES WITH THE URL SEARCH PARAMETERS
  const setTextParam = React.useCallback((value: string | ((prev: string) => string)) => {
    setText((prevText) => {
      const nextValue = typeof value === "function" ? value(prevText) : value;
      const isOnlyWhitespace = nextValue.length > 0 && nextValue.trim() === "";
      const finalValue = isOnlyWhitespace ? "" : nextValue;
      
      const truncatedValue = finalValue.length > MAX_URL_TEXT_LENGTH
        ? finalValue.slice(0, MAX_URL_TEXT_LENGTH)
        : finalValue;

      setURLSearchParams((params) => {
        if (truncatedValue === "") {
          params.delete("text");
        } else {
          params.set("text", truncatedValue);
        }
        return params;
      }, { replace: true });
      
      return truncatedValue;
    });
  }, [setURLSearchParams, MAX_URL_TEXT_LENGTH]);
  setTextParamRef.current = setTextParam;

  React.useEffect(() => {
    if (manualEditRef.current) return;
    if (urlTextParam !== text && urlTextParam.trim() !== text.trim()) {
      setText(urlTextParam);
    } else if (urlTextParam === "" && text !== "") {
      setText("");
    }
  }, [urlTextParam, text]);


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
    resetTranscript();
    previousTranscriptRef.current = "";
    if (listening) {
      await SpeechRecognition.stopListening();
      SpeechRecognition.abortListening();
    }
    if (!keepMicOnRef.current && !aiStt.isRecording) {
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
  React.useEffect(() => {
    if (!aiStt.isAiStt) return;

    if (captureSystemAudio) {
      const restart = async () => {
        const wasRecording = aiStt.isRecording;
        if (wasRecording) aiStt.stopRecording();
        stopAudio();
        const stream = await startAudio(true);
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
          if (!keepMicOnRef.current) stopAudio();
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
          if (!mediaStream) {
             await startAudio(false);
          }
          
          const effectiveSl = sr || sl;
          const slSanitizado = effectiveSl.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const idiomaOptimizado = normalizarLocale(MAPEO_LOCALES[slSanitizado] || sl);
          
          textAtMicStartRef.current = text;
          
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

  React.useEffect(() => {
    if (!listening) return;
    if (manualEditRef.current) return;

    if (transcript && transcript !== previousTranscriptRef.current) {
      previousTranscriptRef.current = transcript;

      const punctuated = addPunctuation(transcript);
      const prefix = textAtMicStartRef.current ? textAtMicStartRef.current + " " : "";
      const fullText = prefix + punctuated;
      const truncated = fullText.length > MAX_URL_TEXT_LENGTH
        ? fullText.slice(0, MAX_URL_TEXT_LENGTH)
        : fullText;

      requestAnimationFrame(() => {
        setTextParam(truncated);
      });
    }
  }, [transcript, setTextParam, listening, MAX_URL_TEXT_LENGTH]);

  React.useEffect(() => {
    if (textareaRef.current && !listening && !aiStt.isRecording) {
      textareaRef.current.focus();
    }
  }, [listening, aiStt.isRecording]);

  React.useEffect(() => {
    if (listening && !aiStt.isAiStt) {
      const restartWithNewLang = async () => {
        await SpeechRecognition.stopListening();
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

    if (keepMicOn) {
      if (browserSupportsSpeechRecognition && isMicrophoneAvailable && !mediaStream && !aiStt.isAiStt) {
        startAudio(false).catch(console.warn);
      }
    } else if (!aiStt.isAiStt) {
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
