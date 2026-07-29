import { useState, useRef, useCallback, useEffect } from "react";
import { useApiKey } from "../contexts/ApiKeyContext";

const STORAGE_KEY = "aiSttEnabled";

export const useAiSpeechToText = (
  onChunk: (text: string) => void,
  _sourceLang: string
) => {
  const [isAiStt, setIsAiStt] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
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

  const toggleAiStt = useCallback(() => setAiStt(!isAiStt), [isAiStt, setAiStt]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  const sendAudioChunk = useCallback(async (blob: Blob) => {
    const apiKey = getKey("nvidia");
    if (!apiKey) { setError("No NVIDIA API key"); stopRecording(); return; }
    setIsProcessing(true);
    try {
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      const lang = "multi";
      const mime = blob.type;

      const res = await fetch("/api/asr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _type: "asr",
          apiKey,
          audio: base64,
          language: lang,
          mime,
        }),
      });

      const data = await res.json();
      if (data.text) {
        setError(null);
        onChunk(data.text);
      } else {
        setError(data.detail || data.error || "ASR request failed");
        stopRecording();
      }
    } catch { setError("ASR request failed"); }
    finally { setIsProcessing(false); }
  }, [getKey, onChunk, stopRecording]);

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
      recorder.start(3000);
      setIsRecording(true);
    } catch { setError("Microphone access denied"); }
  }, [sendAudioChunk]);

  useEffect(() => () => stopRecording(), [stopRecording]);

  return { isAiStt, setAiStt, toggleAiStt, isRecording, isProcessing, error, startRecording, stopRecording };
};
