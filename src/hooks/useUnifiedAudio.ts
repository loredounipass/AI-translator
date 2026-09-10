import { useState, useRef, useCallback, useEffect } from "react";
import { analyzeAudioFrame } from "../utils/vadMath";
import { vadCheckInterval, silenceHoldCount, silenceTimeout } from "../utils/vadConstants";
import { showAudioErrorNotification, showWarningToast, showInfoToast } from "../components/AppNotifications";

let audioOperationId = 0;

interface UseUnifiedAudioOptions {
  onSilenceTimeout?: () => void;
  enableVad?: boolean;
}

export const useUnifiedAudio = ({ onSilenceTimeout, enableVad = true }: UseUnifiedAudioOptions = {}) => {
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [isMicActive, setIsMicActive] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [systemAudioActive, setSystemAudioActive] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mixAudioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  const onSilenceTimeoutRef = useRef(onSilenceTimeout);
  useEffect(() => {
    onSilenceTimeoutRef.current = onSilenceTimeout;
  }, [onSilenceTimeout]);

  const vadIntervalRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const activeFramesRef = useRef<number>(0);
  const silentFramesRef = useRef<number>(0);
  const rmsSmoothRef = useRef<number>(0);
  const noiseFloorRef = useRef<number>(1);
  const floatDataRef = useRef<Float32Array | null>(null);
  const byteDataRef = useRef<Uint8Array | null>(null);
  const fftDataRef = useRef<Uint8Array | null>(null);


  // LIMPIA LOS INTERVALOS Y VARIABLES DE DETECCIÓN DE VOZ ACTIVA
  const cleanupVAD = useCallback(() => {
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
    setIsVoiceActive(false);
  }, []);


  // DETIENE TODOS LOS FLUJOS DE AUDIO Y LIBERA LOS CONTEXTOS DE AUDIO
  const cleanupStreams = useCallback(() => {
    cleanupVAD();

    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch { }
      audioContextRef.current = null;
    }
    if (mixAudioContextRef.current) {
      try { mixAudioContextRef.current.close(); } catch { }
      mixAudioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;
    }

    setMediaStream(null);
    setIsMicActive(false);
    setSystemAudioActive(false);
  }, [cleanupVAD]);


  // INICIA LA DETECCIÓN DE VOZ ANALIZANDO EL FLUJO DE AUDIO EN INTERVALOS
  // FIX 1: Guard contra AudioContext duplicados - reutiliza existente o crea uno solo
  const startVAD = useCallback((stream: MediaStream, existingCtx?: AudioContext) => {
    if (!enableVad) return;
    cleanupVAD();

    // FIX 1: Si ya existe un AudioContext del mixer, reutilizarlo para evitar
    // múltiples consumers del micrófono que causan eco
    let audioCtx: AudioContext;
    if (existingCtx && existingCtx.state !== "closed") {
      audioCtx = existingCtx;
    } else if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioCtx = audioContextRef.current;
    } else {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      audioCtx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
    }

    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(console.warn);
    }

    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    // FIX 1: No conectar analyser a destination para evitar feedback de audio
    analyserRef.current = analyser;

    const floatData = new Float32Array(analyser.fftSize);
    const byteData = new Uint8Array(analyser.fftSize);
    const fftData = new Uint8Array(analyser.frequencyBinCount);
    floatDataRef.current = floatData;
    byteDataRef.current = byteData;
    fftDataRef.current = fftData;

    vadIntervalRef.current = window.setInterval(() => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteTimeDomainData(byteData as any);
      for (let i = 0; i < byteData.length; i++) {
        floatData[i] = (byteData[i] - 128) / 128;
      }
      analyserRef.current.getByteFrequencyData(fftData as any);

      const nyquist = audioCtx.sampleRate / 2;
      const binWidth = nyquist / fftData.length;

      const { isVoiceDetected, newSmooth, newNoiseFloor } = analyzeAudioFrame(
        floatData, fftData, binWidth, nyquist,
        rmsSmoothRef.current, noiseFloorRef.current
      );

      rmsSmoothRef.current = newSmooth;
      noiseFloorRef.current = newNoiseFloor;

      setIsVoiceActive((prev) => {
        if (prev !== isVoiceDetected) return isVoiceDetected;
        return prev;
      });

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
          if (!silenceTimerRef.current && onSilenceTimeoutRef.current) {
            silenceTimerRef.current = window.setTimeout(() => {
              onSilenceTimeoutRef.current?.();
              silenceTimerRef.current = null;
            }, silenceTimeout);
          }
        }
      }
    }, vadCheckInterval);
  }, [cleanupVAD, enableVad]);


  // INICIA LA CAPTURA DEL MICRÓFONO Y OPCIONALMENTE EL AUDIO DEL SISTEMA
  // FIX 2 & 4: Operación cancelable con ID único para prevenir race conditions
  const startAudio = useCallback(async (captureSystemAudio = false) => {
    const currentOpId = ++audioOperationId;
    cleanupStreams();

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // FIX 4: Si otra operación inició mientras esperábamos, abortar esta
      if (currentOpId !== audioOperationId) {
        micStream.getTracks().forEach(t => t.stop());
        return undefined;
      }

      streamRef.current = micStream;

      let finalStream = micStream;
      let mixerCtx: AudioContext | undefined;

      if (captureSystemAudio) {
        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            audio: {
              sampleRate: 16000,
              channelCount: 1,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            },
            video: true
          });

          // FIX 4: Verificar cancelación después de getDisplayMedia (popup largo)
          if (currentOpId !== audioOperationId) {
            displayStream.getTracks().forEach(t => t.stop());
            micStream.getTracks().forEach(t => t.stop());
            streamRef.current = null;
            return undefined;
          }
          
          const hasAudioTrack = displayStream.getAudioTracks().length > 0;
          if (!hasAudioTrack) {
            showWarningToast("Aviso", "No compartiste el audio del sistema.");
            displayStream.getTracks().forEach(t => t.stop());
          } else {
            displayStreamRef.current = displayStream;
            setSystemAudioActive(true);

            const tracks = displayStream.getTracks();
            if (tracks.length > 0) {
              tracks[0].addEventListener("ended", () => {
                showInfoToast("Información", "Compartición de audio del sistema terminada");
                setSystemAudioActive(false);
              });
            }

            const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
            const mixCtx = new AudioCtx({ sampleRate: 16000 });
            mixAudioContextRef.current = mixCtx;
            mixerCtx = mixCtx;
            if (mixCtx.state === 'suspended') {
              mixCtx.resume().catch(console.warn);
            }
            const dest = mixCtx.createMediaStreamDestination();
            mixCtx.createMediaStreamSource(micStream).connect(dest);
            mixCtx.createMediaStreamSource(displayStream).connect(dest);
            finalStream = dest.stream;
          }
        } catch (err) {
          // FIX 4: Verificar cancelación en catch
          if (currentOpId !== audioOperationId) {
            micStream.getTracks().forEach(t => t.stop());
            streamRef.current = null;
            return undefined;
          }
          console.warn("Error capturando sistema:", err);
          showInfoToast("Cancelado", "Captura de sistema cancelada");
        }
      }

      // FIX 4: Verificación final antes de commit
      if (currentOpId !== audioOperationId) {
        finalStream.getTracks().forEach(t => t.stop());
        if (streamRef.current && streamRef.current !== finalStream) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }
        streamRef.current = null;
        return undefined;
      }

      setMediaStream(finalStream);
      setIsMicActive(true);
      // FIX 2: Pasar el mixerCtx al VAD para reutilizarlo y evitar doble AudioContext
      startVAD(finalStream, mixerCtx);

      return finalStream;
    } catch (err) {
      if (currentOpId !== audioOperationId) return undefined;
      console.error("Error iniciando audio unificado:", err);
      cleanupStreams();
      showAudioErrorNotification("Micrófono denegado", "No se pudo acceder al micrófono.");
      throw err;
    }
  }, [cleanupStreams, startVAD]);


  // DETIENE MANUALMENTE TODOS LOS FLUJOS DE AUDIO ACTIVOS
  const stopAudio = useCallback(() => {
    cleanupStreams();
  }, [cleanupStreams]);


  useEffect(() => {
    return () => {
      cleanupStreams();
    };
  }, [cleanupStreams]);

  return {
    startAudio,
    stopAudio,
    mediaStream,
    isMicActive,
    isVoiceActive,
    systemAudioActive
  };
};
