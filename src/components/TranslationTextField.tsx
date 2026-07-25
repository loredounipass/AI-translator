import React from "react";
import { notification, Select } from "antd";
import CloseIcon from "../assets/CloseIcon";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { useSearchParams } from "react-router-dom";
import MicIcon from "assets/MicIcon";
import PauseIcon from "assets/PauseIcon";
import { DEFAULT_SOURCE_LANGUAGE } from "utils/constants";
import { MAPEO_LOCALES, REGIONES_POR_IDIOMA, REGION_A_IDIOMA_BASE, normalizarLocale, filtrarRegiones, localeSoportado, saveRegion } from "../utils/mapeoLocales";
import {
  vadCheckInterval,
  silenceHoldCount,
  silenceTimeout
} from "../utils/vadConstants";
import { addPunctuation } from "../utils/punctuationLogic";
import { analyzeAudioFrame } from "../utils/vadMath";
import { useTypewriterPlaceholder } from "../hooks/useTypewriterPlaceholder";

const TranslationTextField = () => {
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
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
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

  const MAX_URL_TEXT_LENGTH = 8000;

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
        console.warn('No se pudo acceder a dispositivos de audio', err);
      }
    };

    initDevices();
  }, [selectedDeviceId]);

  const setTextParam = React.useCallback((value: string) => {
    const trimmedValue = value.trim() === "" ? "" : value;
    setText(trimmedValue);

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
  }, [setURLSearchParams, MAX_URL_TEXT_LENGTH]);

  React.useEffect(() => {
    if (manualEditRef.current) return;
    if (urlTextParam !== text) {
      setText(urlTextParam);
    }
  }, [urlTextParam, text]);

  const handleChangeRegion = (value: string) => {
    const locale = MAPEO_LOCALES[value] || value;
    const slBase = REGION_A_IDIOMA_BASE[sl] || sl;
    if (!localeSoportado(locale)) {
      const fallback = regionesActuales?.[0]?.code ?? slBase;
      notification.error({
        message: 'Unsupported Dialect',
        description: `"${locale}" is not supported by your browser. Reverted to Neutral.`,
        placement: 'topRight',
        duration: 4,
      });
      saveRegion(slBase, fallback);
      setURLSearchParams(params => {
        params.set("sr", fallback);
        return params;
      });
      return;
    }
    saveRegion(slBase, value);
    setURLSearchParams(params => {
      params.set("sr", value);
      return params;
    });
  };

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

  const handleSpeech = async () => {
    try {
      setIsProcessing(true);
      if (listening) {
        await SpeechRecognition.stopListening();
        if (!keepMicOnRef.current) await cleanupAudioProcessing();
      } else {
        if (!keepMicOnRef.current) {
          notification.error({ message: 'Microphone Required', description: 'Microphone must be active', placement: 'topRight', duration: 3 });
          setIsProcessing(false);
          return;
        }
        if (isMicrophoneAvailable === false) {
          notification.error({ message: 'Microphone Access', description: 'Please allow microphone access', placement: 'topRight', duration: 3 });
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
      console.error("Error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const cleanupAudioProcessing = React.useCallback(async () => {
    try {
      if (!keepMicOnRef.current) {
        resetVADState();
        await teardownAudioResources(mediaStreamRef.current, audioContextRef.current);
        mediaStreamRef.current = null;
        audioContextRef.current = null;
      }
    } catch (err) {
      console.warn('Error during cleanupAudioProcessing', err);
    }
  }, [resetVADState, teardownAudioResources]);

  const startVADRef = React.useRef<(() => void) | null>(null);

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

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
      console.error('No se pudo inicializar audio:', err);
    }
  }, [resetVADState, teardownAudioResources]);

  const ensureAudioStreamActive = React.useCallback(async () => {
    try {
      if (!mediaStreamRef.current) {
        await setupAudioProcessing(selectedDeviceId);
      }
    } catch (e) {
      console.warn('No se pudo activar captura de audio:', e);
    }
  }, [selectedDeviceId, setupAudioProcessing]);

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
        ? punctuated.slice(-MAX_URL_TEXT_LENGTH)
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

  return (
    <div className="relative flex flex-col flex-1 min-h-0 font-sans font-normal leading-normal">
      <div className="flex-1 relative min-h-0">
        <div
          className={`absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center text-lg text-[#9ca3af] dark:text-slate-500 font-sans pointer-events-none ${!text && placeholder ? 'flex' : 'hidden'}`}
        >
          {placeholder}<span className="inline-block w-2 h-2 bg-[#9ca3af] dark:bg-slate-500 rounded-full ml-1 align-baseline relative -top-0.5 animate-blink" />
        </div>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChangeText}
          placeholder=""
          aria-label="Texto para traducción"
          autoFocus
          spellCheck={false}
          maxLength={MAX_URL_TEXT_LENGTH}
          className="absolute inset-0 w-full h-full bg-white dark:bg-slate-800 border-none outline-none shadow-none text-[#111111] dark:text-slate-100 p-4 pr-10 pb-16 text-lg resize-none transition-colors duration-200 focus:outline-none focus:shadow-none custom-scrollbar"
        ></textarea>
        {text && (
          <button
            className="absolute top-4 right-4 bg-none border-none cursor-pointer p-0 transition-opacity duration-200 text-[#333] dark:text-slate-400 hover:opacity-80 dark:hover:text-slate-200"
            onClick={clearTextHandler}
            aria-label="Limpiar texto"
          >
            <CloseIcon />
          </button>
        )}
      </div>
      <div className="flex shrink-0 pl-3 md:pl-4 pb-1">
        <span className="text-[10px] text-[#999] dark:text-slate-500 opacity-40 leading-none">
          {text.length.toLocaleString()} / {MAX_URL_TEXT_LENGTH.toLocaleString()}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2 flex-wrap pl-3 md:pl-4 pb-2.5">
        {browserSupportsSpeechRecognition ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={keepMicOn}
                aria-label="Toggle keep microphone on"
                onClick={() => setKeepMicOn(prev => !prev)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKeepMicOn(prev => !prev); } }}
                className={`w-11 h-6 rounded-full border-none relative cursor-pointer p-0 transition-colors ${keepMicOn ? 'bg-[#4caf50] dark:bg-green-500' : 'bg-black dark:bg-slate-600'}`}
              >
                <span style={{
                  position: 'absolute',
                  top: 2,
                  left: keepMicOn ? 22 : 2,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.15s',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                }} />
              </button>
              <span className="text-[#333] dark:text-slate-300 text-xs whitespace-nowrap">{keepMicOn ? "Turn off" : "Turn on"}</span>
            </div>
            <button
              onMouseDown={() => { if (!mediaStreamRef.current && keepMicOn) ensureAudioStreamActive(); }}
              onTouchStart={() => { if (!mediaStreamRef.current && keepMicOn) ensureAudioStreamActive(); }}
              onClick={handleSpeech}
              disabled={isProcessing}
              aria-label={listening ? "Detener reconocimiento" : "Iniciar reconocimiento"}
              className="bg-none border-none cursor-pointer p-1 transition-all duration-200 text-[#111] dark:text-slate-300 disabled:cursor-not-allowed disabled:opacity-50 hover:not-disabled:scale-105"
            >
              {listening ? <PauseIcon /> : <MicIcon />}
            </button>
            {regionesActuales && (
              <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold">Dialect</span>
                <Select<string>
                  value={regionActual}
                  onChange={handleChangeRegion}
                  options={(regionesFiltradas ?? regionesActuales).map(r => ({ value: r.code, label: r.nombre }))}
                  popupMatchSelectWidth={false}
                  className="region-select"
                  style={{ width: 100 }}
                />
              </div>
            )}
            {!isMicrophoneAvailable && (
              <span className="text-[#ff4444] text-xs animate-fadeIn whitespace-nowrap">
                Micrófono no detectado
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400">Reconocimiento de voz no soportado</p>
        )}
      </div>
    </div>
  );
};

export default TranslationTextField;
