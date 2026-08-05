import { THINKING_CHAR_THRESHOLD, getLanguageName } from "./translation/constants";
import { translationCache, getCacheKey } from "./translation/cache";
import { buildSystemPrompt, isLightweightModel } from "./translation/prompts";
import { isTrivialText } from "./translation/filters";
import { executeTranslationRequest } from "./translation/executor";
import { translationMemory } from "./translation/translationMemory";


// TRADUCIR TEXTO INDIVIDUAL MEDIANTE MODELOS DE IA
export const translate = async (
  targetLang: string,
  sourceLang: string,
  text: string,
  modelId: string,
  options?: { signal?: AbortSignal; onData?: (text: string) => void; apiKey?: string; provider?: string }
): Promise<string> => {
  const cleanedText = text.trim();
  if (!cleanedText) throw new Error("El texto a traducir no puede estar vacío.");

  if (isTrivialText(cleanedText, sourceLang, targetLang)) {
    return text.trim();
  }

  const cacheKey = getCacheKey(cleanedText, targetLang, sourceLang, modelId);
  const cached = translationCache.get(cacheKey);
  if (cached) {
    if (options?.onData) {
      options.onData(cached);
    }
    return cached;
  }

  const isLightweight = isLightweightModel(modelId);
  const useThinking = !isLightweight && cleanedText.length >= THINKING_CHAR_THRESHOLD;

  const systemPrompt = buildSystemPrompt(targetLang, sourceLang, modelId, useThinking);
  const sourceName = getLanguageName(sourceLang);
  const targetName = getLanguageName(targetLang);

  const recencyInstruction = useThinking
    ? `\n\nFINAL INSTRUCTION:\nTranslate the source text into ${targetName}. ONLY output the <thinking> block followed by the <translation> block. Do not include any other text.`
    : "";

  const finalSystemPrompt = useThinking
    ? systemPrompt + recencyInstruction
    : systemPrompt;

  const userPrompt = useThinking
    ? `<source_text>\n${cleanedText}\n</source_text>`
    : `Translate the following text from ${sourceName} to ${targetName}. Output ONLY the raw translated text. Do not wrap it in any tags or conversational filler.\n\nText to translate:\n${cleanedText}`;

  // Build memory pairs from recent translations for consistency
  const memoryMessages = translationMemory.buildMemoryMessages(sourceLang, targetLang, cleanedText);

  const messages = [
    { role: "system", content: finalSystemPrompt },
    ...memoryMessages,
    { role: "user", content: userPrompt },
  ];

  const dynamicTemperature = cleanedText.length < 15 ? 0.0 : 0.1;

  const translated = await executeTranslationRequest({
    modelId,
    messages,
    temperature: dynamicTemperature,
    useThinking,
    apiKey: options?.apiKey,
    provider: options?.provider,
    signal: options?.signal,
    onData: options?.onData,
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
