import axios from "axios";
import { getApiUrl, getAdaptiveTimeout, getAdaptiveMaxTokens, isReasoningModel } from "./constants";
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
  maxInputTokens?: number;
  maxOutputTokens?: number;
  maxOutputTokensCap?: number;
}


// EJECUTAR PETICIÓN DE TRADUCCIÓN ESTÁNDAR
export const executeStandardRequest = async (options: StandardRequestOptions): Promise<string> => {
  const textLen = options.textLength || 0;
  const targetUrl = getApiUrl(options.provider);
  // Los límites de tokens provienen del registro de modelos (src/utils/constants.ts),
  // no se hardcodean aquí. maxOutputTokensCap es opcional y cae en maxOutputTokens.
  const maxOutputLimit = options.maxOutputTokens;
  const outputBudgetCap = options.maxOutputTokensCap ?? maxOutputLimit;
  const isReasoning = isReasoningModel(options.modelId);
  const omitsSampling = options.modelId.includes("reasoning") || options.modelId.includes("think");
  const adaptiveTokens = getAdaptiveMaxTokens(textLen, outputBudgetCap, isReasoning);

  const requestBody: any = {
    model: options.modelId,
    messages: options.messages,
    max_tokens: maxOutputLimit ? Math.min(adaptiveTokens, maxOutputLimit) : adaptiveTokens,
  };

  // NOTA: NO se envían max_input_tokens / max_output_tokens. La API de integración
  // de NVIDIA (/v1/chat/completions) los rechaza con HTTP 400 ("Unsupported parameter(s)").
  // El límite de salida ya lo controla max_tokens.

  requestBody.stream = false;
  if (options.apiKey) requestBody.apiKey = options.apiKey;
  if (options.provider) requestBody.provider = options.provider;

  // No enviar parámetros de muestreo a modelos de razonamiento (suelen rechazarlos).
  if (!omitsSampling && options.temperature !== null && options.temperature !== undefined) {
    requestBody.temperature = options.temperature;
  }

  if (!omitsSampling && options.topP !== null && options.topP !== undefined) {
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
      timeout: getAdaptiveTimeout(textLen, isReasoning),
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
