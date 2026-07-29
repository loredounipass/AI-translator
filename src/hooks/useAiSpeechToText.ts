import { useState, useRef, useCallback, useEffect } from "react";
import { useApiKey } from "../contexts/ApiKeyContext";

const STORAGE_KEY = "aiSttEnabled";

const blobToWavBase64 = async (blob: Blob): Promise<string> => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const numOfChan = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + audioBuffer.length * numOfChan * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numOfChan, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * 2 * numOfChan, true);
  view.setUint16(32, numOfChan * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, audioBuffer.length * numOfChan * 2, true);
  
  const offset = 44;
  for (let i = 0; i < numOfChan; i++) {
    const channelData = audioBuffer.getChannelData(i);
    let pos = offset + (i * 2);
    for (let j = 0; j < audioBuffer.length; j++) {
      let sample = Math.max(-1, Math.min(1, channelData[j]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(pos, sample, true);
      pos += numOfChan * 2;
    }
  }
  
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const useAiSpeechToText = (
  onChunk: (text: string) => void,
  _sourceLang: string
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
  const streamRef = useRef<MediaStream | null>(null);
  const { getKey } = useApiKey();

  const setAiStt = useCallback((value: boolean) => {
    setIsAiStt(value);
    try { localStorage.setItem(STORAGE_KEY, value ? "true" : "false"); } catch {}
  }, []);

  const handleSetModel = useCallback((model: string) => {
    setSelectedModel(model);
    try { localStorage.setItem("aiSttModel", model); } catch {}
  }, []);

  const toggleAiStt = useCallback(() => setAiStt(!isAiStt), [isAiStt, setAiStt]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== "inactive") {
      try { mediaRecorderRef.current?.stop(); } catch (e) {}
    }
    if (streamRef.current) { 
      streamRef.current.getTracks().forEach((t) => t.stop()); 
      streamRef.current = null; 
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  const sendAudioChunk = useCallback(async (blob: Blob) => {
    const apiKey = getKey("nvidia");
    console.log("[useAiSpeechToText:sendAudioChunk] Inicio — blob size:", blob.size, "mime:", blob.type);
    if (!apiKey) { console.log("[useAiSpeechToText:sendAudioChunk] No NVIDIA API key"); setError("No NVIDIA API key"); stopRecording(); return; }
    console.log("[useAiSpeechToText:sendAudioChunk] API key encontrada (primeros 8 chars):", apiKey.substring(0, 8));

    setIsProcessing(true);
    try {
      const base64 = await blobToWavBase64(blob);
      const mimeType = "audio/wav";
      console.log("[useAiSpeechToText:sendAudioChunk] Base64 generado — length:", base64.length, "mime:", mimeType);

      const res = await fetch("/api/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _type: "asr", apiKey, audio: base64, language: "multi", mime: mimeType, model: selectedModel }),
      });

      console.log("[useAiSpeechToText:sendAudioChunk] Respuesta del servidor — status:", res.status, "ok:", res.ok);

      const responseText = await res.text();
      console.log("[useAiSpeechToText:sendAudioChunk] Respuesta raw (primeros 300):", responseText.substring(0, 300));

      let data;
      try {
        data = JSON.parse(responseText);
        console.log("[useAiSpeechToText:sendAudioChunk] Respuesta JSON parseada:", JSON.stringify(data).substring(0, 300));
      } catch (parseError) {
        console.error("[useAiSpeechToText:sendAudioChunk] ERROR: Respuesta no es JSON válido:", responseText.substring(0, 500));
        throw new Error(`Invalid JSON response from server (status ${res.status}): ${responseText.substring(0, 300)}`);
      }

      if (data.text) {
        console.log("[useAiSpeechToText:sendAudioChunk] Transcripción recibida:", data.text.substring(0, 100));
        setError(null);
        onChunk(data.text);
      } else {
        let errorMsg = "ASR request failed (sin texto en respuesta)";
        if (data.error) {
          errorMsg = typeof data.error === 'object' ? data.error.message || JSON.stringify(data.error) : data.error;
        } else if (data.detail) {
          errorMsg = typeof data.detail === 'object' ? JSON.stringify(data.detail) : data.detail;
        } else if (data.message) {
          errorMsg = data.message;
        }
        console.error("[useAiSpeechToText:sendAudioChunk] ERROR: Sin texto en respuesta:", errorMsg);
        setError(errorMsg);
        stopRecording();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[useAiSpeechToText:sendAudioChunk] ERROR en fetch/request:", errorMessage, err);
      setError("ASR failed: " + errorMessage);
    } finally {
      console.log("[useAiSpeechToText:sendAudioChunk] Finalizado — isProcessing=false");
      setIsProcessing(false);
    }
  }, [getKey, onChunk, stopRecording, selectedModel]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus" : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) sendAudioChunk(event.data);
      };

      recorder.onerror = () => setError("Recording error");
      recorder.start(); // Start without timeslice to record until stopped
      setIsRecording(true);
    } catch { setError("Microphone access denied"); }
  }, [sendAudioChunk]);

  useEffect(() => {
    if (!isAiStt && isRecording) stopRecording();
  }, [isAiStt, isRecording, stopRecording]);

  useEffect(() => () => stopRecording(), [stopRecording]);

  return { isAiStt, setAiStt, toggleAiStt, isRecording, isProcessing, error, startRecording, stopRecording, selectedModel, setSelectedModel: handleSetModel };
};
