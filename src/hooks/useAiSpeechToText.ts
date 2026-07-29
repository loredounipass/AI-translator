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
    console.log("[useAiSpeechToText:sendAudioChunk] Inicio — blob size:", blob.size, "mime:", blob.type);
    if (!apiKey) { console.log("[useAiSpeechToText:sendAudioChunk] No NVIDIA API key"); setError("No NVIDIA API key"); stopRecording(); return; }
    console.log("[useAiSpeechToText:sendAudioChunk] API key encontrada (primeros 8 chars):", apiKey.substring(0, 8));

    setIsProcessing(true);
    try {
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      const mimeType = blob.type || "audio/webm";
      console.log("[useAiSpeechToText:sendAudioChunk] Base64 generado — length:", base64.length, "mime:", mimeType);

      const res = await fetch("/api/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _type: "asr", apiKey, audio: base64, language: "multi", mime: mimeType, model: "nvidia/nemotron-3.5-asr-streaming-0.6b" }),
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
        const errorMsg = data.error || data.detail || data.message || "ASR request failed (sin texto en respuesta)";
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

  useEffect(() => {
    if (!isAiStt && isRecording) stopRecording();
  }, [isAiStt, isRecording, stopRecording]);

  useEffect(() => () => stopRecording(), [stopRecording]);

  return { isAiStt, setAiStt, toggleAiStt, isRecording, isProcessing, error, startRecording, stopRecording };
};
