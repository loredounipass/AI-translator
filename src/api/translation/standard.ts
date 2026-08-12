import axios from "axios";
import { NVIDIA_API_URL, getAdaptiveTimeout, getAdaptiveMaxTokens } from "./constants";
import { stripXmlWrapper } from "./filters";

export interface StandardRequestOptions {
  modelId: string;
  messages: any[];
  temperature: number;
  apiKey?: string;
  provider?: string;
  signal?: AbortSignal;
  textLength?: number;
}

export const executeStandardRequest = async (options: StandardRequestOptions): Promise<string> => {
  const textLen = options.textLength || 0;

  const requestBody: any = {
    model: options.modelId,
    messages: options.messages,
    temperature: options.temperature,
    max_tokens: getAdaptiveMaxTokens(textLen),
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
      timeout: getAdaptiveTimeout(textLen),
    }
  );

  const rawContent = response.data?.choices?.[0]?.message?.content || response.data?.content?.[0]?.text;
  if (!rawContent) throw new Error("No se recibió traducción del modelo");

  let translated = stripXmlWrapper(rawContent);

  const isLeaking = translated.includes("CONTEXT ABOUT THE USER") || translated.includes("CRITICAL RULES") || translated.includes("MANDATORY");
  if (isLeaking) {
    throw new Error("Prompt Leakage detectado y bloqueado por seguridad.");
  }

  if (!translated) throw new Error("Fallo al extraer la traducción de las etiquetas XML");

  return translated;
};

