import { useState, useRef, useCallback, useEffect } from "react";
import { useApiKey } from "../contexts/ApiKeyContext";

const STORAGE_KEY = "aiSttEnabled";

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

async function blobToWav(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  const numChannels = buf.numberOfChannels;
  const sampleRate = buf.sampleRate;
  const length = buf.length;

  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) channelData.push(buf.getChannelData(ch));
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let ch = 0; ch < numChannels; ch++) sum += channelData[ch][i];
    mono[i] = sum / numChannels;
  }

  const dataLen = length * 2;
  const wav = new ArrayBuffer(44 + dataLen);
  const v = new DataView(wav);

  writeString(v, 0, "RIFF");
  v.setUint32(4, 36 + dataLen, true);
  writeString(v, 8, "WAVE");
  writeString(v, 12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  writeString(v, 36, "data");
  v.setUint32(40, dataLen, true);

  let off = 44;
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    off += 2;
  }

  ctx.close();
  return new Blob([wav], { type: "audio/wav" });
}

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
      const wavBlob = await blobToWav(blob);
      const buffer = await wavBlob.arrayBuffer();
      const array = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < array.length; i++) binary += String.fromCharCode(array[i]);
      const base64 = btoa(binary);

      const formData = new FormData();
      formData.append("apiKey", apiKey);
      formData.append("audio", base64);
      formData.append("language", "multi");

      const res = await fetch("/api/asr", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.text) {
        setError(null);
        onChunk(data.text);
      } else {
        setError(data.error || data.detail || "ASR request failed");
        stopRecording();
      }
    } catch (err) {
      setError("ASR failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
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
