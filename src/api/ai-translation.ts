import { getLanguageName } from "./translation/constants";
import { translationCache, getCacheKey } from "./translation/cache";
import { buildSystemPrompt } from "./translation/prompts";
import { isTrivialText } from "./translation/filters";
import { executeTranslationRequest } from "./translation/executor";
import { translationMemory } from "./translation/translationMemory";


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

  const userPrompt = `Interpret the following text from ${sourceName} to ${targetName}. Apply first-person interpreting rules. Output ONLY the final raw interpreted text. DO NOT output any reasoning, chain of thought, or thinking process. Do not wrap it in any tags or conversational filler.\n\nText to interpret:\n${cleanedText}`;

  // Build memory pairs from recent translations for consistency
  const memoryMessages = translationMemory.buildMemoryMessages(sourceLang, targetLang, cleanedText);

  const messages = [
    { role: "system", content: systemPrompt },
    ...memoryMessages,
    { role: "user", content: userPrompt },
  ];

  const dynamicTemperature = cleanedText.length < 15 ? 0.0 : 0.1;

  const translated = await executeTranslationRequest({
    modelId,
    messages,
    temperature: dynamicTemperature,
    apiKey: options?.apiKey,
    provider: options?.provider,
    signal: options?.signal,
    onData: options?.onData,
    textLength: cleanedText.length,
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
