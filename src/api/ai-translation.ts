import { getLanguageName } from "./translation/constants";
import { translationCache, getCacheKey } from "./translation/cache";
import { buildSystemPrompt } from "./translation/prompts";
import { isTrivialText } from "./translation/filters";
import { executeTranslationRequest } from "./translation/executor";
import { translationMemory } from "./translation/translationMemory";
import { AI_MODELS } from "../utils/constants";


// Resolve model-specific config from AI_MODELS by matching the modelId
const resolveModelConfig = (modelId: string) => {
  const entry = Object.values(AI_MODELS).find((m) => m.id === modelId);
  return {
    temperature: entry?.temperature ?? 0.1,
    topP: entry?.topP ?? undefined,
    maxOutputTokensCap: entry?.maxOutputTokensCap,
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

  // Allow callers to skip the cache (e.g. after a language or model change)
  if (!options?.bypassCache) {
    const cached = translationCache.get(cacheKey);
    if (cached) {
      if (options?.onData) {
        options.onData(cached);
      }
      return cached;
    }
  }

  const systemPrompt = buildSystemPrompt(targetLang, sourceLang, modelId, cleanedText);
  const sourceName = getLanguageName(sourceLang);
  const targetName = getLanguageName(targetLang);

  const userPrompt = `Interpret the following text from ${sourceName} to ${targetName}. Apply first-person interpreting rules. If you need to reason or think step-by-step, you MUST wrap your reasoning entirely inside <thinking>...</thinking> tags. Your final raw interpreted text MUST be wrapped strictly inside <translation>...</translation> tags.\n\nText to interpret:\n${cleanedText}`;

  // Build memory pairs from recent translations for consistency
  const memoryMessages = translationMemory.buildMemoryMessages(sourceLang, targetLang, cleanedText);

  const messages = [
    { role: "system", content: systemPrompt },
    ...memoryMessages,
    { role: "user", content: userPrompt },
  ];

  // Resolve per-model optimal parameters from documentation-based config
  const modelConfig = resolveModelConfig(modelId);

  const translated = await executeTranslationRequest({
    modelId,
    messages,
    temperature: modelConfig.temperature,
    topP: modelConfig.topP,
    apiKey: options?.apiKey,
    provider: options?.provider,
    signal: options?.signal,
    onData: options?.onData,
    textLength: cleanedText.length,
    maxOutputTokensCap: modelConfig.maxOutputTokensCap,
  });

  translationCache.set(cacheKey, translated);

  // Save to translation memory for future consistency
  translationMemory.add(cleanedText, translated, sourceLang, targetLang);

  return translated;
};


// TRADUCIR MULTIPLES TEXTOS MEDIANTE MODELOS DE IA
export const translateMultiple = async (
  texts: string[],
  targetLang: string,
  sourceLang: string,
  modelId: string
): Promise<string[]> => {
  return Promise.all(texts.map((text) => translate(targetLang, sourceLang, text, modelId)));
};
