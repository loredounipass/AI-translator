import languages from "../../lib/languages.json";

// Todos los proveedores van ahora por el proxy (Vercel /api/completions); ya no hay
// ruta directa a un codespace local. El parámetro se conserva por compatibilidad de llamadas.
export const getApiUrl = (_provider?: string): string => {
  return (
    process.env.REACT_APP_COMPLETIONS_URL ||
    process.env.REACT_APP_API_URL ||
    "/api/completions"
  );
};

export const NVIDIA_API_URL = getApiUrl();
export const MAX_RETRIES = 3;
export const BASE_DELAY = 1000;
export const CACHE_TTL = 3 * 60 * 1000;

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calculate an adaptive timeout (ms) based on the length of the source text.
 * Longer texts require more generation time from the LLM. Reasoning models
 * (Nemotron Omni, etc.) may spend a long time in their hidden thinking trace
 * even on short inputs, so they get a much larger floor to avoid premature aborts.
 */
export const getAdaptiveTimeout = (textLength: number, isReasoning?: boolean): number => {
  // Reasoning: el "thinking" oculto puede tardar mucho aunque el texto sea corto.
  if (isReasoning) return textLength > 2000 ? 180_000 : 120_000;
  if (textLength > 5000) return 120_000;
  if (textLength > 2000) return 90_000;
  if (textLength > 500) return 60_000;
  return 30_000;
};

/**
 * Detecta si un modelo es de razonamiento (Chain of Thought).
 * Estos modelos consumen tokens en una "cadena de pensamiento" oculta
 * (delta.reasoning_content) antes de emitir la respuesta visible, por lo que
 * necesitan un presupuesto de tokens mínimo mayor que los modelos instruct.
 */
export const isReasoningModel = (modelId: string): boolean =>
  typeof modelId === "string" &&
  (modelId.includes("nemotron") || modelId.includes("reasoning") || modelId.includes("think"));

/**
 * Devuelve el presupuesto de max_tokens del modelo, tal como está declarado en el
 * registro (src/utils/constants.ts). No se aplican techos pequeños: se usa el valor
 * del modelo como piso amplio, para que los modelos de razonamiento (Nemotron Omni)
 * tengan espacio de sobra para su "thinking" oculto más la traducción.
 * textLength / isReasoning se conservan en la firma por compatibilidad de llamadas.
 */
export const getAdaptiveMaxTokens = (textLength: number, maxOutputTokensCap?: number, isReasoning?: boolean): number => {
  // El presupuesto lo define SIEMPRE el registro de modelos (src/utils/constants.ts).
  // No se inventa un valor: si falta, es un error de configuración del modelo.
  if (!maxOutputTokensCap) {
    throw new Error("getAdaptiveMaxTokens: falta maxOutputTokens/maxOutputTokensCap en el registro de modelos");
  }
  return maxOutputTokensCap;
};

// Única fuente de verdad: los nombres se derivan de languages.json (AVAILABLE_LANGUAGES),
// evitando divergencias entre dos listas separadas.
export const LANGUAGE_NAMES: Record<string, string> = languages.data.reduce(
  (acc: Record<string, string>, lang: { code: string; name: string }) => {
    acc[lang.code] = lang.name;
    return acc;
  },
  {}
);

export const getLanguageName = (code: string): string => {
  if (code === "auto" || code === "auto-detect") return "the source language";
  return LANGUAGE_NAMES[code] || code;
};
