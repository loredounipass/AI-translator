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
  const isLocal =
    options?.provider === "local" ||
    options?.provider === "qwen_local" ||
    options?.provider === "phi_local" ||
    options?.provider === "mistral_local" ||
    modelConfig.apiProvider === "local" ||
    modelConfig.apiProvider === "qwen_local" ||
    modelConfig.apiProvider === "phi_local" ||
    modelConfig.apiProvider === "mistral_local" ||
    modelId === "local-qwen" ||
    modelId === "qwen" ||
    modelId === "qwen2.5-1.5b" ||
    modelId === "local-phi" ||
    modelId === "phi-3.5-mini" ||
    modelId === "microsoft/Phi-3.5-mini-instruct" ||
    modelId === "local-mistral" ||
    modelId === "mistral-7b";

  // CACHE HIT O(1): Retorna la traducción instantáneamente sin llamar al modelo.
  const cached = translationMemory.get(cleanedText, sourceLang, targetLang);
  if (cached) return cached;

  // DEDUPLICACIÓN O(1): Clave única por texto + idiomas + modelo.
  const requestKey = `${sourceLang}:${targetLang}:${modelId}:${cleanedText}`;
  const existingRequest = activeRequests.get(requestKey);
  if (existingRequest) return existingRequest;

  const sourceName = getLanguageName(sourceLang);
  const targetName = getLanguageName(targetLang);

  let messages: { role: string; content: string }[];

  if (isLocal) {
    // PROMPT MINIMALISTA PARA MODELO LOCAL (solo Reglas 2 y 3):
    // Un modelo pequeño como Qwen 1.5B se sobrecarga con prompts extensos y omite
    // el inicio del texto. Enviamos solo las reglas esenciales y el texto crudo.
    let dialectRule = "";
    if (targetLang === "en") dialectRule = "Use native-sounding US American English.";
    else if (targetLang === "es") dialectRule = "Use formal 'usted', neutral Latin American Spanish.";

    const localSystemPrompt = `You are a professional over-the-phone interpreter. Translate from ${sourceName} to ${targetName}.
Rules:
- FIRST PERSON: Strip third-person directives ("Tell him...", "Dígale que..."). Output in first person.
- TONE: ${dialectRule}
- OUTPUT: Return ONLY the final translation. No explanations, no tags, no reasoning.`;

    messages = [
      { role: "system", content: localSystemPrompt },
      { role: "user", content: cleanedText },
    ];
  } else {
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

  const effectiveProvider =
    options?.provider && options.provider !== "local"
      ? options.provider
      : modelConfig.apiProvider || (modelId === "local-phi" || modelId === "phi-3.5-mini" || modelId === "microsoft/Phi-3.5-mini-instruct" ? "phi_local" : modelId === "local-mistral" || modelId === "mistral-7b" ? "mistral_local" : isLocal ? "qwen_local" : "nvidia");

  const requestPromise = executeTranslationRequest({
    modelId,
    messages,
    apiKey: options?.apiKey,
    provider: effectiveProvider,
    signal: options?.signal,
    onData: options?.onData,
    textLength: cleanedText.length,
  }).then((translated) => {
    translationMemory.add(cleanedText, translated, sourceLang, targetLang);
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
  modelId: string
): Promise<string[]> => {
  return Promise.all(texts.map((text) => translate(targetLang, sourceLang, text, modelId)));
};
