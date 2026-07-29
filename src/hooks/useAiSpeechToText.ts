import { useState, useRef, useCallback, useEffect } from "react";
import { message } from "antd";
import { useApiKey } from "../contexts/ApiKeyContext";
import { INTERPETERAI_TRAINING_MODULE } from "../api/interpreter.guide";
import { analyzeAudioFrame } from "../utils/vadMath";
import { vadCheckInterval } from "../utils/vadConstants";

const STORAGE_KEY = "aiSttEnabled";

/**
 * Convert an audio Blob to a mono WAV base64 string.
 * Forces mono downmix, uses efficient base64 encoding, and properly
 * cleans up the temporary AudioContext.
 */
const blobToWavBase64 = async (blob: Blob): Promise<string> => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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

    // Efficient base64 conversion using chunked approach
    const bytes = new Uint8Array(wavBuffer);
    const chunkSize = 8192;
    const parts: string[] = [];
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      let binaryChunk = "";
      for (let j = 0; j < chunk.length; j++) {
        binaryChunk += String.fromCharCode(chunk[j]);
      }
      parts.push(binaryChunk);
    }
    return btoa(parts.join(""));
  } finally {
    try { await audioContext.close(); } catch { /* already closed */ }
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
  const hasSpokenRef = useRef<boolean>(false);

  const setAiStt = useCallback((value: boolean) => {
    setIsAiStt(value);
    try { localStorage.setItem(STORAGE_KEY, value ? "true" : "false"); } catch { }
  }, []);

  const handleSetModel = useCallback((model: string) => {
    setSelectedModel(model);
    try { localStorage.setItem("aiSttModel", model); } catch { }
  }, []);

  const toggleAiStt = useCallback(() => setAiStt(!isAiStt), [isAiStt, setAiStt]);

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
    setIsVoiceActive(false);
  }, []);

  // --- Start VAD on existing stream ---
  const startVAD = useCallback((stream: MediaStream) => {
    stopVAD();

    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const audioCtx: AudioContext = new AudioCtx();
    audioContextRef.current = audioCtx;

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
      setIsVoiceActive(isVoiceDetected);
      
      if (isVoiceDetected) {
        hasSpokenRef.current = true;
      }
    }, vadCheckInterval);
  }, [stopVAD]);

  // --- Stop Recording (user presses stop) => sends audio ---
  const stopRecording = useCallback(() => {
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
    const apiKey = getKey("nvidia");
    console.log("[AI-STT:send] blob size:", blob.size, "mime:", blob.type);

    if (!apiKey) {
      message.error("No NVIDIA API key configured");
      setError("No NVIDIA API key");
      return;
    }

    if (!hasSpokenRef.current) {
      console.log("[AI-STT:send] Skipping sending: No voice activity was detected during this recording session.");
      return;
    }

    // Skip very small blobs (likely silence — user pressed stop immediately)
    if (blob.size < 1000) {
      console.log("[AI-STT:send] Skipping tiny blob (no speech detected)");
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
          audio: base64,
          language: lang,
          mime: "audio/wav",
          model: selectedModel,
          interpreterContext: INTERPETERAI_TRAINING_MODULE,
        }),
      });

      console.log("[AI-STT:send] Response status:", res.status);

      const responseText = await res.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error("[AI-STT:send] Invalid JSON:", responseText.substring(0, 300));
        message.warning("Error al procesar respuesta del servidor");
        return;
      }

      if (data.text && data.text.trim()) {
        console.log("[AI-STT:send] Transcription:", data.text.substring(0, 100));
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
      console.error("[AI-STT:send] Error:", errorMessage);

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
    hasSpokenRef.current = false;
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = micStream;

      let finalStream = micStream;

      // If system audio capture is requested, try to mix it
      if (captureSystemAudio) {
        try {
          // Re-use existing display stream if user hasn't clicked "Stop sharing" on the browser UI
          let displayStream = displayStreamRef.current;
          const isStreamActive = displayStream && displayStream.getTracks().some(t => t.readyState === 'live');

          if (!isStreamActive) {
            displayStream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
            displayStreamRef.current = displayStream;
          }

          if (displayStream && displayStream.getAudioTracks().length === 0) {
            message.warning("No compartiste el audio del sistema. Grabando solo micrófono.");
          } else if (displayStream) {
            // Mix the two streams
            const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
            const mixCtx = new AudioCtx();
            mixAudioContextRef.current = mixCtx;
            
            const dest = mixCtx.createMediaStreamDestination();
            
            mixCtx.createMediaStreamSource(micStream).connect(dest);
            mixCtx.createMediaStreamSource(displayStream).connect(dest);
            
            finalStream = dest.stream;
          }
        } catch (err) {
          console.warn("Failed to get display media:", err);
          message.warning("Captura de sistema cancelada o fallida. Grabando solo micrófono.");
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

      console.log("[AI-STT:start] Recording started (continuous, send on stop), mime:", mimeType || "default");
    } catch {
      setError("Microphone access denied");
      message.error("No se pudo acceder al micrófono");
    }
  }, [sendAudioChunk, startVAD, captureSystemAudio]);

  // If AI STT is toggled off while recording, stop
  useEffect(() => {
    if (!isAiStt && isRecording) stopRecording();
  }, [isAiStt, isRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => () => stopRecording(), [stopRecording]);

  return {
    isAiStt, setAiStt, toggleAiStt,
    isRecording, isProcessing, isVoiceActive,
    captureSystemAudio, setCaptureSystemAudio,
    error, startRecording, stopRecording,
    selectedModel, setSelectedModel: handleSetModel,
  };
};
