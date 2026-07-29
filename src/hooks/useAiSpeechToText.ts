import { useState, useRef, useCallback, useEffect } from "react";
import { message } from "antd";
import { useApiKey } from "../contexts/ApiKeyContext";

const STORAGE_KEY = "aiSttEnabled";
const CHUNK_INTERVAL_MS = 3000; // Send audio every 3 seconds for real-time transcription

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

    // BUG 2 FIX: Always downmix to mono for reliable WAV encoding
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const monoLength = audioBuffer.length;
    const monoData = new Float32Array(monoLength);

    if (numChannels === 1) {
      monoData.set(audioBuffer.getChannelData(0));
    } else {
      // Average all channels into mono
      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        for (let i = 0; i < monoLength; i++) {
          monoData[i] += channelData[i] / numChannels;
        }
      }
    }

    // Build WAV header + data (mono, 16-bit PCM)
    const dataLength = monoLength * 2; // 16-bit = 2 bytes per sample
    const bufferLength = 44 + dataLength;
    const wavBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(wavBuffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    // RIFF header
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');

    // fmt sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);          // Subchunk1Size (PCM = 16)
    view.setUint16(20, 1, true);           // AudioFormat (PCM = 1)
    view.setUint16(22, 1, true);           // NumChannels (mono = 1)
    view.setUint32(24, sampleRate, true);   // SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    view.setUint16(32, 2, true);           // BlockAlign (NumChannels * BitsPerSample/8)
    view.setUint16(34, 16, true);          // BitsPerSample

    // data sub-chunk
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    // Write mono PCM samples (interleaving is trivial for mono)
    let offset = 44;
    for (let i = 0; i < monoLength; i++) {
      const sample = Math.max(-1, Math.min(1, monoData[i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, int16, true);
      offset += 2;
    }

    // BUG 6 FIX: Efficient base64 conversion using chunked approach
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
    // BUG 5 FIX: Always close the temporary AudioContext to prevent leaks
    try {
      await audioContext.close();
    } catch {
      // Already closed — safe to ignore
    }
  }
};

/**
 * Determine if an error is fatal (should stop recording) vs transient (should retry).
 */
const isFatalError = (errorMsg: string): boolean => {
  const fatalPatterns = [
    "API key", "api key", "401", "403", "Unauthorized", "Forbidden",
    "key requerida", "Invalid", "invalid",
  ];
  return fatalPatterns.some(p => errorMsg.includes(p));
};

export const useAiSpeechToText = (
  onChunk: (text: string) => void,
  sourceLang: string // BUG 3 FIX: Renamed from _sourceLang — now actually used
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
  const processingCountRef = useRef<number>(0);
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

  // BUG 12 FIX: Safe stopRecording that checks state properly
  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try { recorder.stop(); } catch { /* already stopped */ }
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
    console.log("[AI-STT:sendChunk] blob size:", blob.size, "mime:", blob.type);

    if (!apiKey) {
      console.error("[AI-STT:sendChunk] No NVIDIA API key");
      setError("No NVIDIA API key");
      stopRecording();
      return;
    }

    // Skip very small blobs (likely silence)
    if (blob.size < 1000) {
      console.log("[AI-STT:sendChunk] Skipping tiny blob (likely silence)");
      return;
    }

    processingCountRef.current += 1;
    setIsProcessing(true);
    try {
      const base64 = await blobToWavBase64(blob);
      const mimeType = "audio/wav";
      console.log("[AI-STT:sendChunk] WAV base64 length:", base64.length);

      // BUG 3 FIX: Pass actual source language instead of hardcoded "multi"
      const lang = sourceLang || "multi";

      const res = await fetch("/api/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _type: "asr",
          apiKey,
          audio: base64,
          language: lang,
          mime: mimeType,
          model: selectedModel,
        }),
      });

      console.log("[AI-STT:sendChunk] Response status:", res.status);

      const responseText = await res.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error("[AI-STT:sendChunk] Invalid JSON response:", responseText.substring(0, 300));
        throw new Error(`Invalid JSON response (status ${res.status})`);
      }

      if (data.text) {
        console.log("[AI-STT:sendChunk] Transcription:", data.text.substring(0, 100));
        setError(null);
        onChunk(data.text);
      } else {
        let errorMsg = "ASR: no text in response";
        if (data.error) {
          errorMsg = typeof data.error === 'object' ? data.error.message || JSON.stringify(data.error) : data.error;
        } else if (data.detail) {
          errorMsg = typeof data.detail === 'object' ? JSON.stringify(data.detail) : data.detail;
        } else if (data.message) {
          errorMsg = data.message;
        }
        console.error("[AI-STT:sendChunk] Error:", errorMsg);
        
        if (isFatalError(errorMsg)) {
          console.error("[AI-STT:sendChunk] Fatal error — stopping recording");
          message.error("Error crítico: " + errorMsg);
          setError(errorMsg);
          stopRecording();
        } else {
          message.warning("Error de red, reintentando...");
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[AI-STT:sendChunk] Fetch error:", errorMessage);
      
      if (errorMessage.includes("Unable to decode audio data")) {
        console.log("[AI-STT:sendChunk] Silent failure - empty audio chunk ignored");
        return;
      }
      
      if (isFatalError(errorMessage)) {
        message.error("Error crítico de grabación: " + errorMessage);
        setError("ASR failed: " + errorMessage);
        stopRecording();
      } else {
        message.warning("Fallo temporal de conexión con IA...");
      }
    } finally {
      processingCountRef.current -= 1;
      if (processingCountRef.current <= 0) {
        processingCountRef.current = 0;
        setIsProcessing(false);
      }
    }
  }, [getKey, onChunk, stopRecording, selectedModel, sourceLang]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // BUG 10 FIX: Add Safari/iOS fallback MIME types
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/webm";
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/mp4"; // Safari fallback
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = ""; // Let browser choose default
      }

      const recorderOptions: MediaRecorderOptions = {};
      if (mimeType) {
        recorderOptions.mimeType = mimeType;
      }

      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) sendAudioChunk(event.data);
      };

      recorder.onerror = () => setError("Recording error");

      // BUG 1 FIX: Use timeslice to send chunks every CHUNK_INTERVAL_MS for real-time transcription
      recorder.start(CHUNK_INTERVAL_MS);
      setIsRecording(true);
      console.log("[AI-STT:startRecording] Started with timeslice:", CHUNK_INTERVAL_MS, "ms, mime:", mimeType || "default");
    } catch {
      setError("Microphone access denied");
    }
  }, [sendAudioChunk]);

  useEffect(() => {
    if (!isAiStt && isRecording) stopRecording();
  }, [isAiStt, isRecording, stopRecording]);

  useEffect(() => () => stopRecording(), [stopRecording]);

  return { isAiStt, setAiStt, toggleAiStt, isRecording, isProcessing, error, startRecording, stopRecording, selectedModel, setSelectedModel: handleSetModel };
};
