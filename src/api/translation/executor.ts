import axios from "axios";
import { MAX_RETRIES, BASE_DELAY, wait } from "./constants";
import { executeStreamRequest, StreamRequestOptions } from "./stream";
import { executeStandardRequest, StandardRequestOptions } from "./standard";

export interface TranslationExecutorOptions {
  modelId: string;
  messages: any[];
  temperature: number;
  apiKey?: string;
  provider?: string;
  signal?: AbortSignal;
  onData?: (text: string) => void;
  textLength?: number;
}

export const executeTranslationRequest = async (options: TranslationExecutorOptions): Promise<string> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (attempt > 0) {
      const delay = BASE_DELAY * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await wait(delay);
      if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    }

    try {
      if (options.onData) {
        return await executeStreamRequest(options as StreamRequestOptions);
      } else {
        return await executeStandardRequest(options as StandardRequestOptions);
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

  throw new Error(`Error en traducción AI (after ${MAX_RETRIES} retries): ${(lastError as Error).message}`);
};

