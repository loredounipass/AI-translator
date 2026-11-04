import axios from "axios";
import { MAX_RETRIES, BASE_DELAY, wait, isReasoningModel } from "./constants";
import { executeStreamRequest, StreamRequestOptions } from "./stream";
import { executeStandardRequest, StandardRequestOptions } from "./standard";

export interface TranslationExecutorOptions {
  modelId: string;
  messages: any[];
  temperature?: number | null;
  topP?: number | null;
  apiKey?: string;
  provider?: string;
  signal?: AbortSignal;
  onData?: (text: string) => void;
  textLength?: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  maxOutputTokensCap?: number;
  // Preferencia de streaming declarada por el modelo en el registro.
  // Si es false, se fuerza la ruta estándar aunque llegue onData (ej: Riva).
  stream?: boolean;
}

export const executeTranslationRequest = async (options: TranslationExecutorOptions): Promise<string> => {
  let lastError: Error | null = null;
  const isReasoning = isReasoningModel(options.modelId);
  const maxRetries = isReasoning ? 2 : MAX_RETRIES;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (attempt > 0) {
      let delay = BASE_DELAY * Math.pow(2, attempt - 1) + Math.random() * 1000;
      if (lastError && axios.isAxiosError(lastError) && lastError.response?.status === 429) {
        delay = 500 + Math.random() * 500;
      }
      await wait(delay);
      if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    }

    try {
      // Se usa streaming solo si el modelo lo permite (options.stream !== false)
      // y el llamante pidió callbacks (onData). Riva (stream:false) va a estándar.
      if (options.onData && options.stream !== false) {
        return await executeStreamRequest(options as StreamRequestOptions);
      } else {
        const result = await executeStandardRequest(options as StandardRequestOptions);
        return result;
      }
    } catch (error) {
      if (axios.isCancel(error)) throw error;
      if (error instanceof DOMException) throw error;

      const isAuthError =
        (axios.isAxiosError(error) && error.response?.status === 401) ||
        (error instanceof Error && /HTTP Error: 40[13]/.test(error.message));

      if (isAuthError) {
        throw new Error("AUTH_ERROR: Invalid or missing API key (401)");
      }

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 429 || (status && status >= 500 && status < 600)) {
          lastError = error;
          continue;
        }
      }
      if (error instanceof Error && error.message.startsWith("HTTP Error: ")) {
        lastError = error;
        continue;
      }

      throw new Error(`Error en traducción AI: ${(error as Error).message}`);
    }
  }

  throw new Error(`Error en traducción AI (after ${maxRetries} retries): ${(lastError as Error).message}`);
};
