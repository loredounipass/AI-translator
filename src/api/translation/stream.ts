import { getApiUrl, getAdaptiveTimeout, getAdaptiveMaxTokens, isReasoningModel } from "./constants";
import { stripXmlWrapper } from "./filters";


export interface StreamRequestOptions {
  modelId: string;
  messages: any[];
  temperature?: number | null;
  topP?: number | null;
  apiKey?: string;
  provider?: string;
  signal?: AbortSignal;
  onData: (text: string) => void;
  textLength?: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  maxOutputTokensCap?: number;
  reasoningEffort?: "low" | "medium" | "high";
}


// EJECUTAR PETICIÓN DE TRADUCCIÓN MEDIANTE STREAMING
export const executeStreamRequest = async (options: StreamRequestOptions): Promise<string> => {
  const textLen = options.textLength || 0;
  // Los límites de tokens NO se hardcodean aquí: provienen del registro de modelos
  // (src/utils/constants.ts) y llegan vía options. maxOutputTokensCap es opcional y,
  // si falta, usa maxOutputTokens como techo del presupuesto adaptativo.
  const maxOutputLimit = options.maxOutputTokens;
  const outputBudgetCap = options.maxOutputTokensCap ?? maxOutputLimit;
  const isReasoning = isReasoningModel(options.modelId);
  // Solo los verdaderos modelos de razonamiento (reasoning/think) rechazan el
  // muestreo personalizado. Nemotron Lightning/Ultra mantienen sus parámetros.
  const omitsSampling = options.modelId.includes("reasoning") || options.modelId.includes("think");
  const adaptiveTokens = getAdaptiveMaxTokens(textLen, outputBudgetCap, isReasoning);

  const requestBody: any = {
    model: options.modelId,
    messages: options.messages,
    max_tokens: maxOutputLimit ? Math.min(adaptiveTokens, maxOutputLimit) : adaptiveTokens,
    stream: true,
  };

  // apiKey/provider van al proxy (Vercel), que los usa para elegir el proveedor real.
  requestBody.apiKey = options.apiKey;
  requestBody.provider = options.provider;

  // Esfuerzo de razonamiento: solo modelos que lo declaran en el registro (opt-in).
  // Es un flat param de NVIDIA integrate ("reasoning_effort"); la forma anidada
  // "reasoning: {effort}" es rechazada con 400. Recorta el thinking -> mas rapido.
  if (options.reasoningEffort) {
    requestBody.reasoning_effort = options.reasoningEffort;
  }

  // NOTA: NO se envían max_input_tokens / max_output_tokens. La API de integración
  // de NVIDIA (/v1/chat/completions) los rechaza con HTTP 400 ("Unsupported parameter(s)"),
  // igual que el resto de proveedores. El límite de salida ya lo controla max_tokens.

  // Los modelos de razonamiento suelen rechazar o ignorar parámetros de muestreo
  // personalizados; no se envían para evitar 4xx del proveedor.
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

  const timeoutMs = getAdaptiveTimeout(textLen, isReasoning);
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  let combinedSignal: AbortSignal;
  if (options.signal) {
    const onUserAbort = () => {
      timeoutController.abort();
      clearTimeout(timeoutId);
    };
    options.signal.addEventListener("abort", onUserAbort, { once: true });
    
    combinedSignal = options.signal.aborted ? options.signal : timeoutController.signal;
    if (!options.signal.aborted) {
      if (typeof AbortSignal.any === "function") {
        combinedSignal = AbortSignal.any([options.signal, timeoutController.signal]);
      } else {
        combinedSignal = timeoutController.signal;
      }
    }
  } else {
    combinedSignal = timeoutController.signal;
  }

  try {
    const fetchResponse = await fetch(getApiUrl(options.provider), {
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
    let accumulatedReasoning = "";
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
            // Los modelos de razonamiento (Nemotron Omni) emiten el "thinking" en
            // delta.reasoning_content y solo al final la traducción en delta.content.
            // Capturamos el razonamiento por separado SIN mostrarlo como traducción.
            const reasoning = data.choices?.[0]?.delta?.reasoning_content;
            if (reasoning) {
              accumulatedReasoning += reasoning;
            }
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
        } else if (trimmedLine.startsWith("{") && trimmedLine.endsWith("}")) {
          try {
            const data = JSON.parse(trimmedLine);
            const content = data.choices?.[0]?.message?.content || data.choices?.[0]?.delta?.content || data.content?.[0]?.text || "";
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
      buffer += remaining;
    }
    if (buffer.trim() && !accumulatedRawText) {
      try {
        const data = JSON.parse(buffer.trim());
        const content = data.choices?.[0]?.message?.content || data.choices?.[0]?.delta?.content || data.content?.[0]?.text || "";
        if (content) {
          accumulatedRawText = content;
        }
      } catch {
      }
    }

    if (!accumulatedRawText.trim()) {
      if (isReasoning && accumulatedReasoning.trim()) {
        // El modelo razonó pero no alcanzó a emitir la respuesta visible (budget agotado
        // durante el thinking). Damos un error accionable en lugar del genérico.
        throw new Error("El modelo de razonamiento agotó el presupuesto en el thinking sin emitir la traducción");
      }
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


