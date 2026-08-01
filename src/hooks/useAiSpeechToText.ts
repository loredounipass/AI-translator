import { useState, useRef, useCallback, useEffect } from "react";
import { message } from "antd";
import { useApiKey } from "../contexts/ApiKeyContext";
import { analyzeAudioFrame } from "../utils/vadMath";
import { vadCheckInterval } from "../utils/vadConstants";

const STORAGE_KEY = "aiSttEnabled";

// Reuse a single AudioContext for decoding (PERF-04)
const getOfflineAudioContext = () => {
  const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as any;
  return new AudioCtx({ sampleRate: 16000 });
};
let sharedAudioContext: AudioContext | null = null;

const logDev = (...args: any[]) => {
  if (process.env.NODE_ENV === "development") {
    console.log(...args);
  }
};

const errorDev = (...args: any[]) => {
  if (process.env.NODE_ENV === "development") {
    console.error(...args);
  }
};

/**
 * Convert an audio Blob to a mono WAV base64 string.
 * Forces mono downmix, uses efficient base64 encoding, and properly
 * cleans up the temporary AudioContext.
 */
const blobToWavBase64 = async (blob: Blob): Promise<string> => {
  if (!sharedAudioContext) {
    sharedAudioContext = getOfflineAudioContext();
  }
  const audioContext = sharedAudioContext!;
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Always downmix to mono for reliable WAV encoding
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const monoLength = audioBuffer.length;
    const monoData = new Float32Array(monoLength);

    if (numChannels === 1) {
      monoData.set(audioBuffer.getChannelData(0));
    } else {
      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        for (let i = 0; i < monoLength; i++) {
          monoData[i] += channelData[i] / numChannels;
        }
      }
    }

    // Build WAV header + data (mono, 16-bit PCM)
    const dataLength = monoLength * 2;
    const bufferLength = 44 + dataLength;
    const wavBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(wavBuffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    let offset = 44;
    for (let i = 0; i < monoLength; i++) {
      const sample = Math.max(-1, Math.min(1, monoData[i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, int16, true);
      offset += 2;
    }

    // Efficient base64 conversion using chunked approach (PERF-02)
    const bytes = new Uint8Array(wavBuffer);
    const chunkSize = 8192;
    const parts: string[] = [];
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      parts.push(String.fromCharCode.apply(null, Array.from(chunk)));
    }
    return btoa(parts.join(""));
  } catch (err) {
    sharedAudioContext = null;
    throw err;
  }
};

const isFatalError = (errorMsg: string): boolean => {
  const fatalPatterns = [
    "API key", "api key", "401", "403", "Unauthorized", "Forbidden",
    "key requerida",
  ];
  return fatalPatterns.some(p => errorMsg.includes(p));
};

export const useAiSpeechToText = (
  onChunk: (text: string) => void,
  sourceLang: string
) => {
  const [isAiStt, setIsAiStt] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
  });
  const [selectedModel, setSelectedModel] = useState(() => {
    try { return localStorage.getItem("aiSttModel") || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"; } catch { return "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"; }
  });
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [captureSystemAudio, setCaptureSystemAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const mixAudioContextRef = useRef<AudioContext | null>(null);
  const isRequestingSystemAudioRef = useRef<boolean>(false);
  const { getKey } = useApiKey();

  // VAD refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<number | null>(null);
  const rmsSmoothRef = useRef<number>(0);
  const noiseFloorRef = useRef<number>(1);
  const floatDataRef = useRef<Float32Array | null>(null);
  const byteDataRef = useRef<Uint8Array | null>(null);
  const fftDataRef = useRef<Uint8Array | null>(null);
  const prevVoiceActiveRef = useRef<boolean>(false);
  const maxDurationTimeoutRef = useRef<number | null>(null);

  const setAiStt = useCallback((value: boolean) => {
    setIsAiStt(value);
    try { localStorage.setItem(STORAGE_KEY, value ? "true" : "false"); } catch { }
  }, []);

  const handleSetModel = useCallback((model: string) => {
    setSelectedModel(model);
    try { localStorage.setItem("aiSttModel", model); } catch { }
  }, []);

  const toggleAiStt = useCallback(() => setAiStt(!isAiStt), [isAiStt, setAiStt]);

  // --- System audio capture ---
  const cleanupDisplayStream = useCallback(() => {
    if (displayStreamRef.current) {
      const stream = displayStreamRef.current;
      displayStreamRef.current = null;
      stream.getTracks().forEach(t => t.stop());
    }
  }, []);

  const stopSystemAudioCapture = useCallback(() => {
    cleanupDisplayStream();
    setCaptureSystemAudio(false);
  }, [cleanupDisplayStream]);

  const startSystemAudioCapture = useCallback(async () => {
    if (isRequestingSystemAudioRef.current) return;
    isRequestingSystemAudioRef.current = true;
    setError(null);
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

      const hasAudioTrack = displayStream.getAudioTracks().length > 0;

      // If the user stops sharing via the browser UI, turn the toggle off
      const onStreamEnded = () => {
        cleanupDisplayStream();
        setCaptureSystemAudio(false);
        if (hasAudioTrack) {
          message.info("Compartición de audio del sistema terminada");
        }
      };
      displayStream.getTracks().forEach(track => {
        track.addEventListener("ended", onStreamEnded);
      });

      displayStreamRef.current = displayStream;

      if (!hasAudioTrack) {
        message.warning("No compartiste el audio del sistema.");
        cleanupDisplayStream();
        setCaptureSystemAudio(false);
        return;
      }

      setCaptureSystemAudio(true);
    } catch (err) {
      console.warn("Failed to get display media:", err);
      message.info("Captura de sistema cancelada");
      setCaptureSystemAudio(false);
    } finally {
      isRequestingSystemAudioRef.current = false;
    }
  }, [cleanupDisplayStream]);

  const toggleSystemAudio = useCallback(() => {
    if (captureSystemAudio) {
      stopSystemAudioCapture();
    } else {
      startSystemAudioCapture();
    }
  }, [captureSystemAudio, stopSystemAudioCapture, startSystemAudioCapture]);

  // --- Cleanup VAD ---
  const stopVAD = useCallback(() => {
    if (vadIntervalRef.current) {
      window.clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    rmsSmoothRef.current = 0;
    noiseFloorRef.current = 1;
    floatDataRef.current = null;
    byteDataRef.current = null;
    fftDataRef.current = null;
    analyserRef.current = null;
    prevVoiceActiveRef.current = false;
    setIsVoiceActive(false);
  }, []);

  // --- Start VAD on existing stream ---
  const startVAD = useCallback((stream: MediaStream) => {
    stopVAD();

    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const audioCtx: AudioContext = new AudioCtx();
    audioContextRef.current = audioCtx;
    
    // Ensure AudioContext is running (might be suspended if delayed by permissions)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(console.warn);
    }

    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
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
      
      if (prevVoiceActiveRef.current !== isVoiceDetected) {
        prevVoiceActiveRef.current = isVoiceDetected;
        setIsVoiceActive(isVoiceDetected);
      }
    }, vadCheckInterval);
  }, [stopVAD]);

  // --- Stop Recording (user presses stop) => sends audio ---
  const stopRecording = useCallback(() => {
    if (maxDurationTimeoutRef.current) {
      window.clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }
    // Stop VAD first
    stopVAD();
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch { }
      audioContextRef.current = null;
    }

    if (mixAudioContextRef.current) {
      try { mixAudioContextRef.current.close(); } catch { }
      mixAudioContextRef.current = null;
    }

    // Stop MediaRecorder — this triggers ondataavailable with the full recording
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try { recorder.stop(); } catch { /* already stopped */ }
    }

    // Stop all tracks (except display stream, we keep it alive until user stops it via browser UI)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, [stopVAD]);

  // --- Send audio to API (only called when user stops) ---
  const sendAudioChunk = useCallback(async (blob: Blob) => {
    const provider = selectedModel.includes("google") ? "google" : "nvidia";
    const apiKey = getKey(provider);
    logDev("[AI-STT:send] blob size:", blob.size, "mime:", blob.type, "provider:", provider);

    if (!apiKey) {
      message.error(`No API key configured for ${provider}`);
      setError(`No API key for ${provider}`);
      return;
    }

    // Skip very small blobs (likely silence — user pressed stop immediately)
    if (blob.size < 1000) {
      logDev("[AI-STT:send] Skipping tiny blob (no speech detected)");
      return;
    }

    setIsProcessing(true);
    try {
      const base64 = await blobToWavBase64(blob);
      const lang = sourceLang || "multi";

      const res = await fetch("/api/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _type: "asr",
          apiKey,
          provider,
          audio: base64,
          language: lang,
          mime: "audio/wav",
          model: selectedModel,
        }),
      });

      logDev("[AI-STT:send] Response status:", res.status);

      const responseText = await res.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        errorDev("[AI-STT:send] Invalid JSON:", responseText.substring(0, 300));
        message.warning("Error al procesar respuesta del servidor");
        return;
      }

      if (data.text && data.text.trim()) {
        logDev("[AI-STT:send] Transcription:", data.text.substring(0, 100));
        setError(null);
        onChunk(data.text.trim());
      } else {
        let errorMsg = "";
        if (data.error) {
          errorMsg = typeof data.error === 'object' ? data.error.message || JSON.stringify(data.error) : data.error;
        } else if (data.detail) {
          errorMsg = typeof data.detail === 'object' ? JSON.stringify(data.detail) : data.detail;
        } else if (data.message) {
          errorMsg = data.message;
        }

        if (errorMsg && isFatalError(errorMsg)) {
          message.error("Error: " + errorMsg);
          setError(errorMsg);
        }
        // If no text and no fatal error, silently ignore (silence/empty audio)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      errorDev("[AI-STT:send] Error:", errorMessage);

      if (errorMessage.includes("Unable to decode audio data")) {
        // Silent audio chunk — ignore completely
        return;
      }

      if (isFatalError(errorMessage)) {
        message.error("Error: " + errorMessage);
        setError(errorMessage);
      } else {
        message.warning("Fallo temporal de conexión con IA");
      }
    } finally {
      setIsProcessing(false);
    }
  }, [getKey, onChunk, selectedModel, sourceLang]);

  // --- Start Recording (user presses mic) ---
  const startRecording = useCallback(async () => {
    setError(null);
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
      streamRef.current = micStream;

      let finalStream = micStream;

      // If system audio capture is on, mix the already-active display stream
      if (captureSystemAudio) {
        const displayStream = displayStreamRef.current;
        const isStreamActive = displayStream && displayStream.getTracks().some(t => t.readyState === 'live');

        if (isStreamActive) {
          try {
            // Mix the two streams
            const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
            const mixCtx = new AudioCtx({ sampleRate: 16000 });
            mixAudioContextRef.current = mixCtx;

            if (mixCtx.state === 'suspended') {
              mixCtx.resume().catch(console.warn);
            }

            const dest = mixCtx.createMediaStreamDestination();

            mixCtx.createMediaStreamSource(micStream).connect(dest);
            mixCtx.createMediaStreamSource(displayStream).connect(dest);

            finalStream = dest.stream;
          } catch (err) {
            console.warn("Failed to mix system audio:", err);
          }
        } else {
          // Toggle is on but there is no active display stream — turn it off
          setCaptureSystemAudio(false);
        }
      }

      // Choose best available MIME type
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "audio/mp4";
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "";

      const recorderOptions: MediaRecorderOptions = {};
      if (mimeType) recorderOptions.mimeType = mimeType;

      const recorder = new MediaRecorder(finalStream, recorderOptions);
      mediaRecorderRef.current = recorder;

      // Only fires when recorder.stop() is called (no timeslice)
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) sendAudioChunk(event.data);
      };

      recorder.onerror = () => {
        message.error("Error en la grabación");
      };

      // Start recording continuously — NO timeslice, audio is sent only on stop
      recorder.start();
      setIsRecording(true);

      // Start VAD on the final mixed stream
      startVAD(finalStream);

      // Limitar la grabación a 60 segundos (PERF-03)
      maxDurationTimeoutRef.current = window.setTimeout(() => {
        message.warning("Tiempo máximo de grabación (60s) alcanzado.");
        stopRecording();
      }, 60000);

      logDev("[AI-STT:start] Recording started (continuous, send on stop), mime:", mimeType || "default");
    } catch {
      setError("Microphone access denied");
      message.error("No se pudo acceder al micrófono");
    }
  }, [sendAudioChunk, startVAD, captureSystemAudio]);

  // If AI STT is toggled off while recording, stop
  useEffect(() => {
    if (!isAiStt) {
      if (isRecording) stopRecording();
      stopSystemAudioCapture();
    }
  }, [isAiStt, isRecording, stopRecording, stopSystemAudioCapture]);

  // Cleanup on unmount
  useEffect(() => () => {
    stopRecording();
    cleanupDisplayStream();
  }, [stopRecording, cleanupDisplayStream]);

  return {
    isAiStt, setAiStt, toggleAiStt,
    isRecording, isProcessing, isVoiceActive,
    captureSystemAudio, setCaptureSystemAudio,
    toggleSystemAudio,
    error, startRecording, stopRecording,
    selectedModel, setSelectedModel: handleSetModel,
  };
};
