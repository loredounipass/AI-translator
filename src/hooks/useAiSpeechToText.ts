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

  const sendAudioChunk = useCallback(async (blob: Blob) => {
    const apiKey = getKey("nvidia");
    if (!apiKey) { setError("No NVIDIA API key"); return; }
    setIsProcessing(true);
    try {
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      const lang = _sourceLang || "multi";

      const res = await fetch("/api/asr", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-nvidia-api-key": apiKey },
        body: JSON.stringify({ audio: base64, language: lang }),
      });

      const data = await res.json();
      if (data.text) onChunk(data.text);
    } catch { setError("ASR request failed"); }
    finally { setIsProcessing(false); }
  }, [getKey, onChunk, _sourceLang]);

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

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  useEffect(() => () => stopRecording(), [stopRecording]);

  return { isAiStt, setAiStt, toggleAiStt, isRecording, isProcessing, error, startRecording, stopRecording };
};
