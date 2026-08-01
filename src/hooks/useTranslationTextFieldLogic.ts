import React from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { useSearchParams } from "react-router-dom";
import { DEFAULT_SOURCE_LANGUAGE } from "utils/constants";
import { MAPEO_LOCALES, REGIONES_POR_IDIOMA, REGION_A_IDIOMA_BASE, normalizarLocale, filtrarRegiones, localeSoportado, saveRegion } from "../utils/mapeoLocales";
import { useAuth } from "contexts/AuthContext";
import {
  vadCheckInterval,
  silenceHoldCount,
  silenceTimeout
} from "../utils/vadConstants";
import { addPunctuation } from "../utils/punctuationLogic";
import { analyzeAudioFrame } from "../utils/vadMath";
import { useTypewriterPlaceholder } from "./useTypewriterPlaceholder";
import { useAiSpeechToText } from "./useAiSpeechToText";

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
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const vadIntervalRef = React.useRef<number | null>(null);
  const silenceTimerRef = React.useRef<number | null>(null);
  const activeFramesRef = React.useRef<number>(0);
  const silentFramesRef = React.useRef<number>(0);
  const rmsSmoothRef = React.useRef<number>(0);
  const noiseFloorRef = React.useRef<number>(1);
  const floatDataRef = React.useRef<Float32Array | null>(null);
  const byteDataRef = React.useRef<Uint8Array | null>(null);
  const fftDataRef = React.useRef<Uint8Array | null>(null);
  const fftSizeRef = React.useRef<number>(0);
  const currentAnalyserRef = React.useRef<AnalyserNode | null>(null);
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



  // RESET VAD (VOICE ACTIVITY DETECTION) INTERVALS AND CLEAR AUDIO BUFFERS
  const resetVADState = React.useCallback(() => {
    if (vadIntervalRef.current) {
      window.clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    activeFramesRef.current = 0;
    silentFramesRef.current = 0;
    rmsSmoothRef.current = 0;
    noiseFloorRef.current = 1;
    floatDataRef.current = null;
    byteDataRef.current = null;
    fftDataRef.current = null;
    fftSizeRef.current = 0;
    currentAnalyserRef.current = null;
    analyserRef.current = null;
  }, []);



  // STOP MEDIA TRACKS AND CLOSE AUDIO CONTEXT RESOURCES SAFELY
  const teardownAudioResources = React.useCallback(async (
    stream: MediaStream | null,
    audioCtx: AudioContext | null
  ) => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    if (audioCtx) {
      try { await audioCtx.close(); } catch (_) { /* already closed */ }
    }
  }, []);


  React.useEffect(() => {
    return () => {
      resetVADState();
      teardownAudioResources(mediaStreamRef.current, audioContextRef.current);
      SpeechRecognition.abortListening();
    };
  }, [resetVADState, teardownAudioResources]);

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

  const aiStt = useAiSpeechToText(
    React.useCallback((chunk: string) => onChunkRef.current(chunk), []),
    sl
  );

  React.useEffect(() => {
    if (aiStt.isAiStt && listening) {
      SpeechRecognition.stopListening().catch(() => {});
    }
  }, [aiStt.isAiStt, listening]);

  React.useEffect(() => {
    const initDevices = async () => {
      try {
        if (selectedDeviceId) return;

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        const list = await navigator.mediaDevices.enumerateDevices();
        const inputs = list.filter(d => d.kind === 'audioinput');
        if (inputs.length > 0 && !selectedDeviceId) setSelectedDeviceId(inputs[0].deviceId);
      } catch (err) {
      console.warn('No se pudo acceder a dispositivos de audio');
    }
    };

    initDevices();
  }, [selectedDeviceId]);



  // UPDATE TEXT STATE AND SYNCHRONIZE WITH URL SEARCH PARAMETERS
  const setTextParam = React.useCallback((value: string | ((prev: string) => string)) => {
    setText((prevText) => {
      const nextValue = typeof value === "function" ? value(prevText) : value;
      const trimmedValue = nextValue.trim() === "" ? "" : nextValue;
      
      const truncatedValue = trimmedValue.length > MAX_URL_TEXT_LENGTH
        ? trimmedValue.slice(0, MAX_URL_TEXT_LENGTH)
        : trimmedValue;

      setURLSearchParams((params) => {
        if (truncatedValue === "") {
          params.delete("text");
        } else {
          params.set("text", truncatedValue);
        }
        return params;
      });
      
      return trimmedValue;
    });
  }, [setURLSearchParams, MAX_URL_TEXT_LENGTH]);
  setTextParamRef.current = setTextParam;

  React.useEffect(() => {
    if (manualEditRef.current) return;
    if (urlTextParam !== text) {
      setText(urlTextParam);
    }
  }, [urlTextParam, text]);



  // HANDLE DIALECT/REGION SELECTION AND UPDATE USER PREFERENCES
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



  // CLEAR TEXT CONTENT AND RESET SPEECH RECOGNITION STATE
  const clearTextHandler = async () => {
    setTextParam("");
    resetTranscript();
    previousTranscriptRef.current = "";
    if (listening) {
      await SpeechRecognition.stopListening();
      SpeechRecognition.abortListening();
    }
    await cleanupAudioProcessing();
  };



  // HANDLE MANUAL TEXTAREA INPUT WITH DEBOUNCED EDIT TRACKING
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

    if (e.target.value.trim() === "") {
      resetTranscript();
    }
  };



  // TOGGLE SPEECH RECOGNITION AND MANAGE MICROPHONE STATE
  const handleSpeech = async () => {
    try {
      setIsProcessing(true);
      if (listening) {
        await SpeechRecognition.stopListening();
        if (!keepMicOnRef.current) await cleanupAudioProcessing();
      } else {
        if (!keepMicOnRef.current) {
          setIsProcessing(false);
          return;
        }
        if (isMicrophoneAvailable === false) {
          setIsProcessing(false);
          return;
        }
        await setupAudioProcessing(selectedDeviceId);

        const effectiveSl = sr || sl;
        const slSanitizado = effectiveSl.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const idiomaOptimizado = normalizarLocale(MAPEO_LOCALES[slSanitizado] || sl);
        await SpeechRecognition.startListening({
          continuous: true,
          interimResults: true,
          language: idiomaOptimizado
        });
      }
    } catch (error) {
      console.error("Error in speech handler");
    } finally {
      setIsProcessing(false);
    }
  };



  // CLEANUP AUDIO RESOURCES AND STOP RECOGNITION WHEN MIC IS TURNED OFF
  const cleanupAudioProcessing = React.useCallback(async () => {
    try {
      if (!keepMicOnRef.current) {
        resetVADState();
        await teardownAudioResources(mediaStreamRef.current, audioContextRef.current);
        mediaStreamRef.current = null;
        audioContextRef.current = null;
      }
    } catch {
      console.warn('Error during cleanupAudioProcessing');
    }
  }, [resetVADState, teardownAudioResources]);

  const isSettingUpRef = React.useRef<boolean>(false);
  const startVADRef = React.useRef<(() => void) | null>(null);



  // INITIALIZE AUDIO CONTEXT, REQUEST MICROPHONE PERMISSIONS, AND SETUP AUDIO NODES
  const setupAudioProcessing = React.useCallback(async (deviceId: string | null) => {
    const oldAudioCtx = audioContextRef.current;
    const oldStream = mediaStreamRef.current;

    resetVADState();

    await teardownAudioResources(oldStream, oldAudioCtx);
    mediaStreamRef.current = null;
    audioContextRef.current = null;

    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContextClass();
    audioContextRef.current = audioCtx;
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    if (audioContextRef.current !== audioCtx || audioCtx.state === 'closed') return;

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (audioContextRef.current !== audioCtx || audioCtx.state === 'closed') {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      mediaStreamRef.current = stream;

      const source = audioCtx.createMediaStreamSource(stream);
      const compressor = audioCtx.createDynamicsCompressor();
      const gain = audioCtx.createGain();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;

      source.connect(compressor);
      compressor.connect(gain);
      gain.connect(analyser);

      analyserRef.current = analyser;

      startVADRef.current?.();
    } catch (err) {
      console.error('No se pudo inicializar audio');
    }
  }, [resetVADState, teardownAudioResources]);



  // VERIFY OR INITIALIZE AUDIO STREAM BEFORE STARTING SPEECH RECOGNITION
  const ensureAudioStreamActive = React.useCallback(async () => {
    if (isSettingUpRef.current) return;
    isSettingUpRef.current = true;
    try {
      if (!mediaStreamRef.current) {
        await setupAudioProcessing(selectedDeviceId);
      }
    } catch (e) {
      console.warn('No se pudo activar captura de audio');
    } finally {
      isSettingUpRef.current = false;
    }
  }, [selectedDeviceId, setupAudioProcessing]);



  // START VOICE ACTIVITY DETECTION INTERVAL TO ANALYZE AUDIO FRAMES FOR SPEECH OR SILENCE
  const startVAD = React.useCallback(() => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    currentAnalyserRef.current = analyser;

    if (!floatDataRef.current || fftSizeRef.current !== analyser.fftSize) {
      floatDataRef.current = new Float32Array(analyser.fftSize) as Float32Array;
      byteDataRef.current = new Uint8Array(analyser.fftSize) as Uint8Array;
      fftDataRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array;
      fftSizeRef.current = analyser.fftSize;
    }

    const floatData = floatDataRef.current;
    const byteData = byteDataRef.current;
    const fftData = fftDataRef.current;

    vadIntervalRef.current = window.setInterval(() => {
      const analyser = currentAnalyserRef.current;
      if (!analyser || !floatData || !byteData || !fftData) return;

      analyser.getByteTimeDomainData(byteData as any);
      for (let i = 0; i < byteData.length; i++) {
        floatData[i] = (byteData[i] - 128) / 128;
      }

      analyser.getByteFrequencyData(fftData as any);

      const nyquist = analyser.context.sampleRate / 2;
      const binWidth = nyquist / fftData.length;

      const { isVoiceDetected, newSmooth, newNoiseFloor } = analyzeAudioFrame(
        floatData,
        fftData,
        binWidth,
        nyquist,
        rmsSmoothRef.current || 0,
        noiseFloorRef.current
      );

      rmsSmoothRef.current = newSmooth;
      noiseFloorRef.current = newNoiseFloor;

      if (isVoiceDetected) {
        activeFramesRef.current += 1;
        silentFramesRef.current = 0;

        if (silenceTimerRef.current) {
          window.clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } else {
        silentFramesRef.current += 1;
        activeFramesRef.current = 0;

        if (silentFramesRef.current >= silenceHoldCount) {
          if (!silenceTimerRef.current && listening) {
            silenceTimerRef.current = window.setTimeout(() => {
              if (listening && !keepMicOnRef.current) {
                SpeechRecognition.stopListening().catch(() => { });
              }
              silenceTimerRef.current = null;
            }, silenceTimeout);
          }
        }
      }
    }, vadCheckInterval);
  }, [listening]);

  React.useEffect(() => {
    startVADRef.current = startVAD;
  }, [startVAD]);

  const previousTranscriptRef = React.useRef("");

  React.useEffect(() => {
    if (!listening) return;
    if (manualEditRef.current) return;

    if (transcript && transcript !== previousTranscriptRef.current) {
      previousTranscriptRef.current = transcript;

      const punctuated = addPunctuation(transcript);
      const truncated = punctuated.length > MAX_URL_TEXT_LENGTH
        ? punctuated.slice(0, MAX_URL_TEXT_LENGTH)
        : punctuated;

      requestAnimationFrame(() => {
        setTextParam(truncated);
      });
    }
  }, [transcript, setTextParam, listening, MAX_URL_TEXT_LENGTH]);

  React.useEffect(() => {
    if (textareaRef.current && !listening) {
      textareaRef.current.focus();
    }
  }, [listening]);

  React.useEffect(() => {
    if (listening) {
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
      if (browserSupportsSpeechRecognition && isMicrophoneAvailable) {
        ensureAudioStreamActive();
      }
    } else {
      if (listening) {
        SpeechRecognition.stopListening().catch(() => { });
      }
      cleanupAudioProcessing();
    }
  }, [keepMicOn, browserSupportsSpeechRecognition, isMicrophoneAvailable, ensureAudioStreamActive, listening, cleanupAudioProcessing]);

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
    mediaStreamRef,
    ensureAudioStreamActive
  };
};


