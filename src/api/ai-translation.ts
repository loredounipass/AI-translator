import { getLanguageName } from "./translation/constants";
import { buildSystemPrompt, buildSimpleTranslationSystemPrompt, buildSimpleTranslationUserPrompt, buildLightSystemPrompt } from "./translation/prompts";
import { isTrivialText } from "./translation/filters";
import { executeTranslationRequest } from "./translation/executor";
import { translationMemory } from "./translation/translationMemory";
import { AI_MODELS } from "../utils/constants";

// DEDUPLICACIÓN O(1): Almacena promesas activas por clave única.
// Si la misma petición llega dos veces (ej. React StrictMode), la segunda espera la primera.
const activeRequests = new Map<string, Promise<string>>();

// RESOLVER CONFIGURACIÓN ESPECÍFICA DEL MODELO POR ID
const resolveModelConfig = (modelId: string) => {
  const entry = Object.values(AI_MODELS).find((m) => m.id === modelId);
  return {
    modelType: entry?.modelType ?? "chat",
    apiProvider: entry?.apiProvider,
    // Muestreo y límites salen del registro; si un modelo no define temperature/topP,
    // se deja undefined para usar el default del proveedor (no se inventa un valor).
    temperature: entry?.temperature,
    topP: entry?.topP,
    maxInputTokens: entry?.maxInputTokens,
    maxOutputTokens: entry?.maxOutputTokens,
    maxOutputTokensCap: entry?.maxOutputTokensCap,
    reasoningEffort: entry?.reasoningEffort,
    stream: entry?.stream ?? true,
  };
};

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

  const modelConfig = resolveModelConfig(modelId);
  const isTranslationOnly = modelConfig.modelType === "translation-only";

  // CACHE HIT O(1): Retorna la traducción instantáneamente sin llamar al modelo.
  const cached = translationMemory.get(cleanedText, sourceLang, targetLang, modelId);
  if (cached) return cached;

  // DEDUPLICACIÓN O(1): Clave única por texto + idiomas + modelo.
  const requestKey = `${sourceLang}:${targetLang}:${modelId}:${cleanedText}`;
  const existingRequest = activeRequests.get(requestKey);
  if (existingRequest) return existingRequest;

  const sourceName = getLanguageName(sourceLang);
  const targetName = getLanguageName(targetLang);

  let messages: { role: string; content: string }[];

  const isShortText = cleanedText.length <= 50;
  const systemPrompt = isTranslationOnly
    ? buildSimpleTranslationSystemPrompt(sourceLang, targetLang)
    : (isShortText
        ? buildLightSystemPrompt(targetLang, sourceLang)
        : buildSystemPrompt(targetLang, sourceLang));

  const userPrompt = isTranslationOnly
    ? buildSimpleTranslationUserPrompt(cleanedText)
    : `Interpret the following text from ${sourceName} to ${targetName}. Apply first-person interpreting rules. Return ONLY the final interpretation without any formatting, reasoning, or tags.\n\nText to interpret:\n${cleanedText}`;

  // MEMORIA FEW-SHOT: inyecta pares previos relevantes (regla 6 de terminología
  // consistente). Solo para modelos chat; Riva (translation-only) no la recibe.
  const memoryMessages = isTranslationOnly
    ? []
    : translationMemory.buildMemoryMessages(sourceLang, targetLang, cleanedText);

  messages = [
    { role: "system", content: systemPrompt },
    ...memoryMessages,
    { role: "user", content: userPrompt },
  ];

  const effectiveProvider =
    options?.provider
      ? options.provider
      : modelConfig.apiProvider || "nvidia";

  const requestPromise = executeTranslationRequest({
    modelId,
    messages,
    apiKey: options?.apiKey,
    provider: effectiveProvider,
    signal: options?.signal,
    onData: options?.onData,
    textLength: cleanedText.length,
    temperature: modelConfig.temperature,
    topP: modelConfig.topP,
    maxInputTokens: modelConfig.maxInputTokens,
    maxOutputTokens: modelConfig.maxOutputTokens,
    maxOutputTokensCap: modelConfig.maxOutputTokensCap,
    reasoningEffort: modelConfig.reasoningEffort,
    stream: modelConfig.stream,
  }).then((translated) => {
    translationMemory.add(cleanedText, translated, sourceLang, targetLang, modelId);
    activeRequests.delete(requestKey);
    return translated;
  }).catch((err) => {
    activeRequests.delete(requestKey);
    throw err;
  });

  activeRequests.set(requestKey, requestPromise);
  return requestPromise;
};

// TRADUCIR MÚLTIPLES TEXTOS MEDIANTE MODELOS DE IA
export const translateMultiple = async (
  texts: string[],
  targetLang: string,
  sourceLang: string,
  modelId: string,
  options?: { signal?: AbortSignal; onData?: (text: string) => void; apiKey?: string; provider?: string }
): Promise<string[]> => {
  return Promise.all(texts.map((text) => translate(targetLang, sourceLang, text, modelId, options)));
};
