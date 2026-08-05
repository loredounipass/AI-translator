import axios from "axios";
import { NVIDIA_API_URL } from "./constants";
import { stripXmlWrapper } from "./filters";

export interface StandardRequestOptions {
  modelId: string;
  messages: any[];
  temperature: number;
  useThinking: boolean;
  apiKey?: string;
  provider?: string;
  signal?: AbortSignal;
}

export const executeStandardRequest = async (options: StandardRequestOptions): Promise<string> => {
  const requestBody: any = {
    model: options.modelId,
    messages: options.messages,
    temperature: options.temperature,
    max_tokens: options.useThinking ? 2048 : 1024,
    stream: false,
    apiKey: options.apiKey,
    provider: options.provider,
  };

  if (options.provider === "anthropic") {
    const sysMsg = requestBody.messages.find((m: any) => m.role === "system");
    if (sysMsg) {
      requestBody.system = sysMsg.content;
      requestBody.messages = requestBody.messages.filter((m: any) => m.role !== "system");
    }
  }

  const response = await axios.post(
    NVIDIA_API_URL,
    requestBody,
    {
      headers: { "Content-Type": "application/json" },
      signal: options.signal,
    }
  );

  const rawContent = response.data?.choices?.[0]?.message?.content || response.data?.content?.[0]?.text;
  if (!rawContent) throw new Error("No se recibió traducción del modelo");

  let translated = rawContent;
  const translationMatch = rawContent.match(/<translation>([\s\S]*?)(?:<\/translation>|$)/);

  if (translationMatch && translationMatch[1]) {
    translated = translationMatch[1].trim();
  } else {
    const thinkingMatch = rawContent.match(/<\/thinking>([\s\S]*)/);
    if (thinkingMatch && thinkingMatch[1]) {
      translated = thinkingMatch[1].trim();
    }
  }
  translated = stripXmlWrapper(translated);

  const isLeaking = translated.includes("CONTEXT ABOUT THE USER") || translated.includes("CRITICAL RULES") || translated.includes("MANDATORY");
  if (isLeaking) {
    throw new Error("Prompt Leakage detectado y bloqueado por seguridad.");
  }

  if (!translated) throw new Error("Fallo al extraer la traducción de las etiquetas XML");

  return translated;
};
