import { getLanguageName } from "./translation/constants";
import { translationCache, getCacheKey } from "./translation/cache";
import { buildSystemPrompt, buildSimpleTranslationSystemPrompt, buildSimpleTranslationUserPrompt, buildLightSystemPrompt } from "./translation/prompts";
import { isTrivialText } from "./translation/filters";
import { executeTranslationRequest } from "./translation/executor";
import { translationMemory } from "./translation/translationMemory";
import { AI_MODELS, AIModel } from "../utils/constants";

// RESOLVER CONFIGURACIÓN ESPECÍFICA DEL MODELO POR ID
const resolveModelConfig = (modelId: string) => {
  const entry = Object.values(AI_MODELS).find((m) => m.id === modelId);
  return {
    modelType: entry?.modelType ?? "chat",
    apiProvider: entry?.apiProvider,
  };
};

// TRADUCIR TEXTO INDIVIDUAL MEDIANTE MODELOS DE IA
export const translate = async (
  targetLang: string,
  sourceLang: string,
  text: string,
  modelId: string,
  options?: { signal?: AbortSignal; onData?: (text: string) => void; apiKey?: string; provider?: string; bypassCache?: boolean }
): Promise<string> => {
  const cleanedText = text.trim();
  if (!cleanedText) throw new Error("El texto a traducir no puede estar vacío.");

  if (isTrivialText(cleanedText, sourceLang, targetLang)) {
    return text.trim();
  }

  const cacheKey = getCacheKey(cleanedText, targetLang, sourceLang, modelId);

  if (!options?.bypassCache) {
    const cached = translationCache.get(cacheKey);
    if (cached) {
      if (options?.onData) {
        options.onData(cached);
      }
      return cached;
    }
  }

  const modelConfig = resolveModelConfig(modelId);
  const isTranslationOnly = modelConfig.modelType === "translation-only";
  const isLocal =
    options?.provider === "local" ||
    options?.provider === "qwen_local" ||
    modelConfig.apiProvider === "local" ||
    modelConfig.apiProvider === "qwen_local" ||
    modelId === "local-qwen" ||
    modelId === "qwen" ||
    modelId === "qwen2.5-1.5b";

  let messages: { role: string; content: string }[];

  if (isLocal) {
    // Para el modelo local, las instrucciones o prompt viven en el servidor donde corre el modelo.
    // Solo enviamos el mensaje con el texto a traducir para máxima velocidad y evitar latencia.
    messages = [
      { role: "user", content: cleanedText },
    ];
  } else {
    const sourceName = getLanguageName(sourceLang);
    const targetName = getLanguageName(targetLang);
    const isShortText = cleanedText.length <= 50;

    const systemPrompt = isTranslationOnly
      ? buildSimpleTranslationSystemPrompt(sourceLang, targetLang)
      : (isShortText
          ? buildLightSystemPrompt(targetLang, sourceLang)
          : buildSystemPrompt(targetLang, sourceLang, modelId, cleanedText));

    const userPrompt = isTranslationOnly
      ? buildSimpleTranslationUserPrompt(cleanedText)
      : `Interpret the following text from ${sourceName} to ${targetName}. Apply first-person interpreting rules. Return ONLY the final interpretation without any formatting, reasoning, or tags.\n\nText to interpret:\n${cleanedText}`;

    messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];
  }

  const effectiveProvider = options?.provider || modelConfig.apiProvider || (isLocal ? "qwen_local" : "nvidia");

  const translated = await executeTranslationRequest({
    modelId,
    messages,
    // temperature: modelConfig.temperature,
    // topP: modelConfig.topP,
    apiKey: options?.apiKey,
    provider: effectiveProvider,
    signal: options?.signal,
    onData: options?.onData,
    textLength: cleanedText.length,
    // maxOutputTokensCap: modelConfig.maxOutputTokensCap,
  });

  translationCache.set(cacheKey, translated);
  translationMemory.add(cleanedText, translated, sourceLang, targetLang);

  return translated;
};

// TRADUCIR MÚLTIPLES TEXTOS MEDIANTE MODELOS DE IA
export const translateMultiple = async (
  texts: string[],
  targetLang: string,
  sourceLang: string,
  modelId: string
): Promise<string[]> => {
  return Promise.all(texts.map((text) => translate(targetLang, sourceLang, text, modelId)));
};
