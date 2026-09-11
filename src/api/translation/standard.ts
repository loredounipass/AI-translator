import axios from "axios";
import { getApiUrl, getAdaptiveTimeout, getAdaptiveMaxTokens } from "./constants";
import { stripXmlWrapper } from "./filters";


export interface StandardRequestOptions {
  modelId: string;
  messages: any[];
  temperature?: number | null;
  topP?: number | null;
  apiKey?: string;
  provider?: string;
  signal?: AbortSignal;
  textLength?: number;
  maxOutputTokensCap?: number;
}


// EJECUTAR PETICIÓN DE TRADUCCIÓN ESTÁNDAR
export const executeStandardRequest = async (options: StandardRequestOptions): Promise<string> => {
  const textLen = options.textLength || 0;
  const isLocal = options.provider === "local" || options.provider === "qwen_local";
  const targetUrl = getApiUrl(options.provider);

  const requestBody: any = {
    model: options.modelId || "qwen2.5-1.5b",
    messages: options.messages,
    max_tokens: getAdaptiveMaxTokens(textLen, options.maxOutputTokensCap),
  };

  if (!isLocal) {
    requestBody.stream = false;
    if (options.apiKey) requestBody.apiKey = options.apiKey;
    if (options.provider) requestBody.provider = options.provider;
  }

  if (options.temperature !== null && options.temperature !== undefined) {
    requestBody.temperature = options.temperature;
  }

  if (options.topP !== null && options.topP !== undefined && !isLocal) {
    requestBody.top_p = options.topP;
  }

  if (options.provider === "anthropic") {
    const sysMsg = requestBody.messages.find((m: any) => m.role === "system");
    if (sysMsg) {
      requestBody.system = sysMsg.content;
      requestBody.messages = requestBody.messages.filter((m: any) => m.role !== "system");
    }
  }

  const response = await axios.post(
    targetUrl,
    requestBody,
    {
      headers: { "Content-Type": "application/json" },
      signal: options.signal,
      timeout: getAdaptiveTimeout(textLen, isLocal),
    }
  );

  const rawContent = response.data?.choices?.[0]?.message?.content || response.data?.content?.[0]?.text;
  if (!rawContent) throw new Error("No se recibió traducción del modelo");

  let translated = stripXmlWrapper(rawContent) || String(rawContent).trim();

  const isLeaking = translated.includes("CONTEXT ABOUT THE USER") || translated.includes("CRITICAL RULES") || translated.includes("MANDATORY");
  if (isLeaking) {
    throw new Error("Prompt Leakage detectado y bloqueado por seguridad.");
  }

  return translated;
};
