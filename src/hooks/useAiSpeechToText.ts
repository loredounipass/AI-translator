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
    console.log("[useAiSpeechToText:sendAudioChunk] Inicio — blob size:", blob.size, "mime:", blob.type);

    const apiKey = getKey("nvidia");
    if (!apiKey) {
      console.error("[useAiSpeechToText:sendAudioChunk] No hay API key de NVIDIA disponible");
      setError("No NVIDIA API key"); stopRecording(); return;
    }
    console.log("[useAiSpeechToText:sendAudioChunk] API key encontrada (primeros 8 chars):", apiKey.slice(0, 8) + "...");

    setIsProcessing(true);
    try {
      console.log("[useAiSpeechToText:sendAudioChunk] Convirtiendo blob a base64...");
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      console.log("[useAiSpeechToText:sendAudioChunk] Base64 generado — length:", base64.length, "primeros 50:", base64.slice(0, 50) + "...");

      const lang = "multi";
      const mime = blob.type;

      console.log("[useAiSpeechToText:sendAudioChunk] Enviando POST a /api/asr con lang=" + lang + " mime=" + mime);
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

      console.log("[useAiSpeechToText:sendAudioChunk] Respuesta recibida — status:", res.status, res.statusText);

      const responseText = await res.text();
      console.log("[useAiSpeechToText:sendAudioChunk] Cuerpo crudo (primeros 500 chars):", responseText.slice(0, 500));

      let data;
      try {
        data = JSON.parse(responseText);
        console.log("[useAiSpeechToText:sendAudioChunk] JSON parseado exitosamente:", data);
      } catch (parseErr) {
        console.error("[useAiSpeechToText:sendAudioChunk] Error al parsear JSON:", parseErr, "cuerpo:", responseText.slice(0, 300));
        setError("ASR response: " + res.status + " " + res.statusText);
        stopRecording();
        return;
      }

      if (data.text) {
        console.log("[useAiSpeechToText:sendAudioChunk] Transcripción recibida:", data.text);
        setError(null);
        onChunk(data.text);
      } else {
        console.error("[useAiSpeechToText:sendAudioChunk] Respuesta sin campo 'text':", JSON.stringify(data));
        setError(data.detail || data.error || data.message || "ASR request failed (no text in response)");
        stopRecording();
      }
    } catch (err) {
      console.error("[useAiSpeechToText:sendAudioChunk] Error en fetch/request:", err);
      setError("ASR request failed: " + (err instanceof Error ? err.message : String(err)));
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

  useEffect(() => () => stopRecording(), [stopRecording]);

  return { isAiStt, setAiStt, toggleAiStt, isRecording, isProcessing, error, startRecording, stopRecording };
};
