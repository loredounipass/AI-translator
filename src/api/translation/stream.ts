import { NVIDIA_API_URL, getAdaptiveTimeout, getAdaptiveMaxTokens } from "./constants";
import { stripXmlWrapper } from "./filters";

export interface StreamRequestOptions {
  modelId: string;
  messages: any[];
  temperature: number;
  apiKey?: string;
  provider?: string;
  signal?: AbortSignal;
  onData: (text: string) => void;
  textLength?: number;
}

export const executeStreamRequest = async (options: StreamRequestOptions): Promise<string> => {
  const textLen = options.textLength || 0;

  const requestBody: any = {
    model: options.modelId,
    messages: options.messages,
    temperature: options.temperature,
    max_tokens: getAdaptiveMaxTokens(textLen),
    stream: true,
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

  // Build a combined signal: user abort + adaptive timeout fallback
  const timeoutMs = getAdaptiveTimeout(textLen);
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  let combinedSignal: AbortSignal;
  if (options.signal) {
    // If the user signal fires, also clean up our timeout
    const onUserAbort = () => {
      timeoutController.abort();
      clearTimeout(timeoutId);
    };
    options.signal.addEventListener("abort", onUserAbort, { once: true });
    // Use whichever fires first
    combinedSignal = options.signal.aborted ? options.signal : timeoutController.signal;
    if (!options.signal.aborted) {
      // We need a proper composite — use AbortSignal.any if available, else fallback
      if (typeof AbortSignal.any === "function") {
        combinedSignal = AbortSignal.any([options.signal, timeoutController.signal]);
      } else {
        // Fallback: prefer user signal, but timeout controller will also abort fetch
        combinedSignal = timeoutController.signal;
      }
    }
  } else {
    combinedSignal = timeoutController.signal;
  }

  try {
    const fetchResponse = await fetch(NVIDIA_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: combinedSignal,
    });

    if (!fetchResponse.ok) {
      throw new Error(`HTTP Error: ${fetchResponse.status}`);
    }

    const reader = fetchResponse.body?.getReader();
    if (!reader) {
      throw new Error("No se pudo iniciar el lector de streaming del response body");
    }

    const decoder = new TextDecoder("utf-8");
    let accumulatedRawText = "";
    let buffer = "";

    while (true) {
      if (combinedSignal.aborted) {
        reader.cancel();
        throw new DOMException("Aborted", "AbortError");
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine === "data: [DONE]") continue;
        if (trimmedLine.startsWith("data: ")) {
          try {
            const data = JSON.parse(trimmedLine.substring(6));
            const content = data.choices?.[0]?.delta?.content || data.delta?.text || "";
            if (content) {
              accumulatedRawText += content;
              
              const cleaned = stripXmlWrapper(accumulatedRawText);
              if (cleaned) {
                options.onData(cleaned);
              }
            }
          } catch {
          }
        }
      }
    }
    const remaining = decoder.decode();
    if (remaining) {
      accumulatedRawText += remaining;
    }

    if (!accumulatedRawText.trim()) {
      throw new Error("No se recibió contenido del modelo durante el streaming");
    }

    let translated = stripXmlWrapper(accumulatedRawText);

    const isLeaking = translated.includes("CONTEXT ABOUT THE USER") || translated.includes("CRITICAL RULES") || translated.includes("MANDATORY");
    if (isLeaking) {
      throw new Error("Prompt Leakage detectado y bloqueado por seguridad.");
    }

    if (!translated) {
      throw new Error("Fallo al extraer la traducción de las etiquetas XML (streaming)");
    }

    options.onData(translated);
    return translated;
  } finally {
    clearTimeout(timeoutId);
  }
};

