import { getLanguageName } from "./translation/constants";
import { translationCache, getCacheKey } from "./translation/cache";
import { buildSystemPrompt, buildSimpleTranslationSystemPrompt, buildSimpleTranslationUserPrompt } from "./translation/prompts";
import { isTrivialText } from "./translation/filters";
import { executeTranslationRequest } from "./translation/executor";
import { translationMemory } from "./translation/translationMemory";
import { AI_MODELS, AIModel } from "../utils/constants";

// RESOLVER CONFIGURACIÓN ESPECÍFICA DEL MODELO POR ID
const resolveModelConfig = (modelId: string) => {
  const entry = Object.values(AI_MODELS).find((m) => m.id === modelId);
  return {
    temperature: entry?.temperature ?? 0.1,
    topP: entry?.topP ?? undefined,
    maxOutputTokensCap: entry?.maxOutputTokensCap,
    modelType: entry?.modelType ?? "chat",
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

  const sourceName = getLanguageName(sourceLang);
  const targetName = getLanguageName(targetLang);

  const systemPrompt = isTranslationOnly
    ? buildSimpleTranslationSystemPrompt(sourceLang, targetLang)
    : buildSystemPrompt(targetLang, sourceLang, modelId, cleanedText);

  const llmInputText = cleanedText.replace(/\n/g, ' <br> ');

  const userPrompt = isTranslationOnly
    ? buildSimpleTranslationUserPrompt(llmInputText)
    : `Interpret the following text from ${sourceName} to ${targetName}. Apply first-person interpreting rules. If you need to reason or think step-by-step, you MUST wrap your reasoning entirely inside <thinking>...</thinking> tags. Your final raw interpreted text MUST be wrapped strictly inside <translation>...</translation> tags.\n\nText to interpret:\n${llmInputText}`;

  let memoryLimit = 10;
  if (modelConfig.maxOutputTokensCap && modelConfig.maxOutputTokensCap <= 2048) {
    memoryLimit = 2; // Strict limit for models with tiny context windows
  } else if (modelId.includes("3b") || modelId.includes("4b") || modelId.includes("mini") || modelId.includes("nano")) {
    memoryLimit = 2; // Strict limit for small parameter models
  } else if (modelId.includes("8b")) {
    memoryLimit = 5; // Moderate limit for medium models
  }

  const memoryMessages = isTranslationOnly
    ? []
    : translationMemory.buildMemoryMessages(sourceLang, targetLang, cleanedText, memoryLimit);

  const messages = [
    { role: "system", content: systemPrompt },
    ...memoryMessages,
    { role: "user", content: userPrompt },
  ];

  const translated = await executeTranslationRequest({
    modelId,
    messages,
    temperature: modelConfig.temperature,
    topP: modelConfig.topP,
    apiKey: options?.apiKey,
    provider: options?.provider,
    signal: options?.signal,
    onData: options?.onData ? (chunk: string) => {
      options.onData!(chunk.replace(/ ?<br> ?/gi, '\n'));
    } : undefined,
    textLength: cleanedText.length,
    maxOutputTokensCap: modelConfig.maxOutputTokensCap,
  });

  const finalTranslated = translated.replace(/ ?<br> ?/gi, '\n');

  translationCache.set(cacheKey, finalTranslated);
  translationMemory.add(cleanedText, finalTranslated, sourceLang, targetLang);

  return finalTranslated;
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
