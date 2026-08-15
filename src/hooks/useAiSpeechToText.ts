import { useState, useRef, useCallback, useEffect } from "react";
import { useApiKey } from "../contexts/ApiKeyContext";
import { showInfoToast, showWarningToast, showErrorToast } from "../components/AppNotifications";

const STORAGE_KEY = "aiSttEnabled";


// INITIALIZE OFFLINE AUDIO CONTEXT FOR DECODING
const getOfflineAudioContext = () => {
  const OfflineAudioCtx = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (OfflineAudioCtx) {
    return new OfflineAudioCtx(1, 1, 16000);
  }
  const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as any;
  return new AudioCtx({ sampleRate: 16000 });
};
let sharedAudioContext: AudioContext | null = null;


// LOG TO CONSOLE IN DEVELOPMENT MODE
const logDev = (...args: any[]) => {
  if (process.env.NODE_ENV === "development") {
    console.log(...args);
  }
};


// LOG ERROR TO CONSOLE IN DEVELOPMENT MODE
const errorDev = (...args: any[]) => {
  if (process.env.NODE_ENV === "development") {
    console.error(...args);
  }
};


// CONVERT AUDIO BLOB TO MONO WAV BASE64 STRING
const blobToWavBase64 = async (blob: Blob): Promise<string> => {
  if (!sharedAudioContext) {
    sharedAudioContext = getOfflineAudioContext();
  }
  const audioContext = sharedAudioContext!;
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

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


// CHECK IF ERROR MESSAGE IS FATAL
const isFatalError = (errorMsg: string): boolean => {
  const fatalPatterns = [
    "API key", "api key", "401", "403", "Unauthorized", "Forbidden",
    "key requerida",
  ];
  return fatalPatterns.some(p => errorMsg.includes(p));
};


// MAIN HOOK FOR AI SPEECH TO TEXT
export const useAiSpeechToText = (
  onChunk: (text: string) => void,
  sourceLang: string,
  mediaStream: MediaStream | null,
  onStopRequest?: () => void
) => {
  const [isAiStt, setIsAiStt] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
  });
  const [selectedModel, setSelectedModel] = useState(() => {
    try { return localStorage.getItem("aiSttModel") || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"; } catch { return "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"; }
  });
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const { getKey } = useApiKey();
  const maxDurationTimeoutRef = useRef<number | null>(null);


  // PERSIST AI SPEECH TO TEXT TOGGLE STATE
  const setAiStt = useCallback((value: boolean) => {
    setIsAiStt(value);
    try { localStorage.setItem(STORAGE_KEY, value ? "true" : "false"); } catch { }
  }, []);


  // PERSIST SELECTED AI MODEL
  const handleSetModel = useCallback((model: string) => {
    setSelectedModel(model);
    try { localStorage.setItem("aiSttModel", model); } catch { }
  }, []);


  // TOGGLE AI SPEECH TO TEXT STATE
  const toggleAiStt = useCallback(() => setAiStt(!isAiStt), [isAiStt, setAiStt]);


  // STOP RECORDING AUDIO AND TRIGGER STOP CALLBACK
  const stopRecording = useCallback(() => {
    if (maxDurationTimeoutRef.current) {
      window.clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try { recorder.stop(); } catch { }
    }

    mediaRecorderRef.current = null;
    setIsRecording(false);
    if (onStopRequest) onStopRequest();
  }, [onStopRequest]);


  // CONVERT AUDIO BLOB SEND TO API FOR TRANSCRIPTION AND PROCESS RESPONSE
  const sendAudioChunk = useCallback(async (blob: Blob) => {
    const provider = selectedModel.includes("google") ? "google" : "nvidia";
    const apiKey = getKey(provider);
    logDev("[AI-STT:send] blob size:", blob.size, "mime:", blob.type, "provider:", provider);

    if (!apiKey) {
      showErrorToast("Error de API Key", `No API key configured for ${provider}`);
      setError(`No API key for ${provider}`);
      return;
    }

    if (blob.size < 1000) {
      logDev("[AI-STT:send] Skipping tiny blob (no speech detected)");
      return;
    }

    setIsProcessing(true);
    try {
      const base64 = await blobToWavBase64(blob);
      const cleanLang = (sourceLang || "auto").split("-")[0].toLowerCase();

      const res = await fetch("/api/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _type: "asr",
          apiKey,
          provider,
          audio: base64,
          language: cleanLang,
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
        showWarningToast("Error", "Error al procesar respuesta del servidor");
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
          showErrorToast("Error", errorMsg);
          setError(errorMsg);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      errorDev("[AI-STT:send] Error:", errorMessage);

      if (errorMessage.includes("Unable to decode audio data")) {
        return;
      }

      if (isFatalError(errorMessage)) {
        showErrorToast("Error", errorMessage);
        setError(errorMessage);
      } else {
        showWarningToast("Aviso", "Fallo temporal de conexión con IA");
      }
    } finally {
      setIsProcessing(false);
    }
  }, [getKey, onChunk, selectedModel, sourceLang]);


  // START RECORDING USING THE PROVIDED MEDIA STREAM
  const startRecording = useCallback((streamOverride?: MediaStream) => {
    const stream = streamOverride || mediaStream;
    if (!stream) {
      setError("No media stream available");
      return;
    }
    setError(null);

    let mimeType = "audio/webm;codecs=opus";
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "audio/webm";
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "audio/mp4";
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "";

    const recorderOptions: MediaRecorderOptions = {};
    if (mimeType) recorderOptions.mimeType = mimeType;

    const recorder = new MediaRecorder(stream, recorderOptions);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) sendAudioChunk(event.data);
    };

    recorder.onerror = () => {
      showErrorToast("Error", "Error en la grabación");
      stopRecording();
    };

    recorder.start();
    setIsRecording(true);

    maxDurationTimeoutRef.current = window.setTimeout(() => {
      showWarningToast("Límite de tiempo", "Tiempo máximo de grabación (60s) alcanzado.");
      stopRecording();
    }, 60000);

    logDev("[AI-STT:start] Recording started (continuous, send on stop), mime:", mimeType || "default");
  }, [mediaStream, sendAudioChunk, stopRecording]);


  useEffect(() => {
    if (!isAiStt && isRecording) {
      stopRecording();
    }
  }, [isAiStt, isRecording, stopRecording]);


  useEffect(() => () => {
    stopRecording();
  }, [stopRecording]);

  return {
    isAiStt, setAiStt, toggleAiStt,
    isRecording, isProcessing,
    error, startRecording, stopRecording,
    selectedModel, setSelectedModel: handleSetModel,
  };
};
