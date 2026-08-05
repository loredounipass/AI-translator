import { NVIDIA_API_URL } from "./constants";
import { stripXmlWrapper } from "./filters";

export interface StreamRequestOptions {
  modelId: string;
  messages: any[];
  temperature: number;
  useThinking: boolean;
  apiKey?: string;
  provider?: string;
  signal?: AbortSignal;
  onData: (text: string) => void;
}

export const executeStreamRequest = async (options: StreamRequestOptions): Promise<string> => {
  const fetchResponse = await fetch(NVIDIA_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: options.modelId,
      messages: options.messages,
      temperature: options.temperature,
      max_tokens: options.useThinking ? 2048 : 1024,
      stream: true,
      apiKey: options.apiKey,
      provider: options.provider,
    }),
    signal: options.signal,
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
  let translationTagFound = false;
  let translationStartIndex = -1;

  while (true) {
    if (options.signal?.aborted) {
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
          const content = data.choices?.[0]?.delta?.content || "";
          if (content) {
            accumulatedRawText += content;

            if (!translationTagFound) {
              const idx = accumulatedRawText.indexOf("<translation>");
              if (idx !== -1) {
                translationTagFound = true;
                translationStartIndex = idx;
              }
            }

            if (translationTagFound) {
              let streamText = accumulatedRawText.substring(translationStartIndex + 13);
              const endIndex = streamText.indexOf("</translation>");
              if (endIndex !== -1) {
                streamText = streamText.substring(0, endIndex);
              }
              streamText = streamText.trimStart();

              const isLeaking = streamText.includes("CONTEXT ABOUT THE USER") || streamText.includes("CRITICAL RULES") || streamText.includes("MANDATORY");

              if (streamText && !isLeaking) {
                options.onData(streamText);
              }
            } else if (
              !options.useThinking ||
              (accumulatedRawText.length > 100 &&
              !accumulatedRawText.includes("<thinking>") &&
              !accumulatedRawText.includes("<translation>"))
            ) {
              const cleaned = stripXmlWrapper(accumulatedRawText);
              if (cleaned) {
                options.onData(cleaned);
              }
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

  let translated = accumulatedRawText;
  const translationMatch = accumulatedRawText.match(/<translation>([\s\S]*?)(?:<\/translation>|$)/);
  if (translationMatch && translationMatch[1]) {
    translated = translationMatch[1].trim();
  } else {
    const thinkingMatch = accumulatedRawText.match(/<\/thinking>([\s\S]*)/);
    if (thinkingMatch && thinkingMatch[1]) {
      translated = thinkingMatch[1].trim();
    }
  }
  translated = stripXmlWrapper(translated);

  const isLeaking = translated.includes("CONTEXT ABOUT THE USER") || translated.includes("CRITICAL RULES") || translated.includes("MANDATORY");
  if (isLeaking) {
    throw new Error("Prompt Leakage detectado y bloqueado por seguridad.");
  }

  if (!translated) {
    throw new Error("Fallo al extraer la traducción de las etiquetas XML (streaming)");
  }

  options.onData(translated);
  return translated;
};
