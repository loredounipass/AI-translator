import axios from "axios";
import { LRUCache } from "lru-cache";
import { GLOSSARY } from "./glossary";
import { INTERPETERAI_TRAINING_MODULE } from "./interpreter.guide";

const NVIDIA_API_URL = "/api/completions";

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

const CACHE_TTL = 5 * 60 * 1000;
const translationCache = new LRUCache<string, string>({ max: 1000, ttl: CACHE_TTL });

const getCacheKey = (text: string, targetLang: string, sourceLang: string, modelId: string): string =>
  `${modelId}:${sourceLang}:${targetLang}:${text}`;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const LANGUAGE_NAMES: Record<string, string> = {
  ar: "Arabic",
  bn: "Bengali",
  de: "German",
  en: "English",
  es: "Spanish",
  fa: "Persian",
  fr: "French",
  hi: "Hindi",
  it: "Italian",
  id: "Indonesian",
  ja: "Japanese",
  ko: "Korean",
  la: "Latin",
  ms: "Malay",
  pt: "Portuguese",
  ru: "Russian",
  tr: "Turkish",
  ur: "Urdu",
  zh: "Chinese",
};

const getLanguageName = (code: string): string => {
  if (code === "auto" || code === "auto-detect") return "the source language";
  return LANGUAGE_NAMES[code] || code;
};

// 2. Glosario Modularizado importado desde glossary.ts

const isLightweightModel = (modelId: string): boolean => {
  const lowerId = modelId.toLowerCase();
  return lowerId.includes("riva") || lowerId.includes("nemotron");
};

const buildSystemPrompt = (targetLang: string, sourceLang: string, modelId: string): string => {
  const targetName = getLanguageName(targetLang);

  const exactKey = `${sourceLang}-${targetLang}`;
  const reverseKey = `${targetLang}-${sourceLang}`;

  let pairGlossary = GLOSSARY[exactKey];
  let isReversed = false;

  if (!pairGlossary && GLOSSARY[reverseKey]) {
    pairGlossary = GLOSSARY[reverseKey];
    isReversed = true;
  }

  let domainRules = "";
  if (pairGlossary) {
    let termsOutput = "";
    for (const [domain, terms] of Object.entries(pairGlossary)) {
      let domainName = domain.toUpperCase().replace(/_/g, " ");
      // Map domains to standard display names
      if (domain === "medical_vns") domainName = "MEDICAL / VNS HEALTH / MEDICARE";
      if (domain === "legal_us") domainName = "US LEGAL / COURT";
      if (domain === "veterinary_banfield") domainName = "VETERINARY / BANFIELD PET HOSPITAL";

      const formattedTerms = Object.entries(terms)
        .map(([src, tgt]) => isReversed ? `    - "${tgt}" → "${src}"` : `    - "${src}" → "${tgt}"`)
        .join("\n");
      termsOutput += `  [${domainName}]:\n${formattedTerms}\n`;
    }

    domainRules = `
- The following glossary provides examples of REQUIRED domain-specific terminology. You MUST use these exact equivalents when they appear:
${termsOutput.trimEnd()}
- IMPORTANT: This glossary is not exhaustive. You must analyze the context of the phrase to identify the specific domain (e.g., medical, legal, automotive, veterinary) and independently apply the most accurate, natural, and professional terminology for that domain, even for words not listed above.`;
  }

  let dialectRule = "";
  if (targetLang === "en") dialectRule = "\n- Use professional American English (US dialect, not British).";
  else if (targetLang === "es") dialectRule = "\n- Use professional Spanish (neutral Latin American dialect).";

  const styleRules = `
STYLE RULES & DOMAIN TERMINOLOGY - MANDATORY:
- Maintain formal/professional tone appropriate for business, medical, and legal contexts.${dialectRule}${domainRules}`;

  if (isLightweightModel(modelId)) {
    return `You are a highly precise professional translator.
Your ONLY job is to translate the source text into ${targetName}.

CRITICAL RULES:
1. Translate EVERYTHING exactly as requested. NEVER omit, summarize, or skip any factual content.
2. Maintain strict semantic fidelity. Do not add foreign commentary or explanations.
3. PRESERVE numbers, dates, and codes exactly as they appear: "123", "45.6", "$50".
4. If the text is already in ${targetName}, return it AS-IS.
5. Preserve original formatting and line breaks.
6. OUTPUT ONLY THE TRANSLATION. NO conversational filler. NO thinking steps.
${styleRules}`;
  }

  const interpreterContext = `CONTEXT ABOUT THE USER'S JOB (FOR YOUR UNDERSTANDING ONLY):
The user you are assisting is a professional over-the-phone interpreter. Their job involves strict training based on the following module:

${JSON.stringify(INTERPETERAI_TRAINING_MODULE, null, 2)}

That is the USER'S job and they will handle all behavioral and cultural nuances described in the module (such as speaking in 1st person, maintaining neutrality, using specific 3rd person phrases).

YOUR ROLE AS THE AI:
You are an elite, highly precise translation assistant supporting the user. You MUST NOT try to do the user's job or intervene in the scenarios. Your ONLY job is to translate the text exactly as requested. You MUST obey the following rules WITHOUT EXCEPTION.`;

  return `${interpreterContext}

CRITICAL RULES:
1. Translate EVERYTHING. NEVER omit, summarize, or skip any factual content or meaning.
2. Maintain strict semantic fidelity. Do not add foreign commentary, explanations, or meta-text outside of the requested translation.
3. PRESERVE numbers, dates, and codes exactly as they appear: "123", "45.6", "$50", "2024-03-15".
4. If the text is already in ${targetName}, return it AS-IS.
5. REPEATED PHRASES: if the same phrase appears consecutively (e.g., "el dia de ayer el dia de ayer"), translate it ONCE only.
6. Interpret in first person when source uses "I" or "we".
7. Preserve original formatting, line breaks, and structure.
${styleRules}

<execution_instructions>
1. First, analyze the source text, context, and apply rules in a <thinking> block.
2. Then, provide the final translated text inside <translation> tags.
3. Your final response MUST be formatted exactly as:
<thinking>
...your analysis here...
</thinking>
<translation>
...your final translation here...
</translation>
</execution_instructions>`;
};

// 1. Cortocircuito Inteligente
const isTrivialText = (text: string): boolean => {
  // Solo números, puntuación básica o espacios
  const trivialRegex = /^[\d\s.,!?;:'"()[\]{}<>\-_=+*/\\|@#%^&`~]+$/;
  // Emails o URLs puras
  const urlEmailRegex = /^(https?:\/\/[^\s]+|[^\s@]+@[^\s@]+\.[^\s@]+)$/i;

  return trivialRegex.test(text) || urlEmailRegex.test(text);
};

/**
 * Strip all known XML wrapper tags that the model might echo back.
 * This is the last line of defense when structured parsing fails.
 */
const stripXmlWrapper = (text: string): string => {
  return text
    .replace(/<\/?(source_text|thinking|translation|execution_instructions|response|output|result|answer)[^>]*>/gi, "")
    .replace(/^\s*\n/, "")
    .trim();
};

export const translate = async (
  targetLang: string,
  sourceLang: string,
  text: string,
  modelId: string,
  options?: { signal?: AbortSignal; onData?: (text: string) => void; apiKey?: string; provider?: string }
): Promise<string> => {
  const cleanedText = text.trim();
  if (!cleanedText) throw new Error("El texto a traducir no puede estar vacío.");

  // Cortocircuito Inteligente: No llamar a la IA para texto que no necesita traducción
  if (isTrivialText(cleanedText)) {
    return text.trim(); // Devolvemos el texto original
  }

  const cacheKey = getCacheKey(cleanedText, targetLang, sourceLang, modelId);
  const cached = translationCache.get(cacheKey);
  if (cached) {
    if (options?.onData) {
      options.onData(cached);
    }
    return cached;
  }

  const systemPrompt = buildSystemPrompt(targetLang, sourceLang, modelId);
  const isLightweight = isLightweightModel(modelId);
  
  const recencyInstruction = isLightweight 
    ? `\n\nFINAL INSTRUCTION:\nTranslate the source text into ${getLanguageName(targetLang)}. Output ONLY the raw translated text. Do not wrap it in any tags.`
    : `\n\nFINAL INSTRUCTION:\nTranslate the source text into ${getLanguageName(targetLang)}. ONLY output the <thinking> block followed by the <translation> block. Do not include any other text.`;
  
  const finalSystemPrompt = systemPrompt + recencyInstruction;
  
  const userPrompt = isLightweight 
    ? cleanedText 
    : `<source_text>\n${cleanedText}\n</source_text>`;

  const messages = [
    { role: "system", content: finalSystemPrompt },
    // Actual Request
    { role: "user", content: userPrompt },
  ];

  // Ajuste Dinámico de Temperatura
  const dynamicTemperature = cleanedText.length < 15 ? 0.0 : 0.1;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (attempt > 0) {
      const delay = BASE_DELAY * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await wait(delay);
      if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    }

    try {
      if (options?.onData) {
        const fetchResponse = await fetch(NVIDIA_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: modelId,
            messages,
            temperature: dynamicTemperature,
            max_tokens: 4096,
            stream: true,
            apiKey: options?.apiKey,
            provider: options?.provider,
          }),
          signal: options?.signal,
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

                  // Filter: only emit the text inside <translation> to the UI
                  const translationIndex = accumulatedRawText.indexOf("<translation>");
                  if (translationIndex !== -1) {
                    let streamText = accumulatedRawText.substring(translationIndex + 13);
                    const endIndex = streamText.indexOf("</translation>");
                    if (endIndex !== -1) {
                      streamText = streamText.substring(0, endIndex);
                    }
                    streamText = streamText.trimStart();
                    
                    // Prevenir fugas de prompt incluso durante el stream (State safety net)
                    const isLeaking = streamText.includes("CONTEXT ABOUT THE USER") || streamText.includes("CRITICAL RULES") || streamText.includes("MANDATORY");
                    
                    if (streamText && !isLeaking) {
                      options.onData(streamText);
                    }
                  } else if (
                    accumulatedRawText.length > 100 &&
                    !accumulatedRawText.includes("<thinking>") &&
                    !accumulatedRawText.includes("<translation>")
                  ) {
                    // Fallback: model is not following XML format at all
                    // Strip any echoed XML tags and emit cleaned text progressively
                    const cleaned = stripXmlWrapper(accumulatedRawText);
                    if (cleaned) {
                      options.onData(cleaned);
                    }
                  }
                  // While inside <thinking> or before any tag, emit nothing to the user
                }
              } catch {
                // Ignore incomplete JSON chunks from SSE
              }
            }
          }
        }
        // Flush any remaining bytes in the decoder
        const remaining = decoder.decode();
        if (remaining) {
          accumulatedRawText += remaining;
        }

        if (!accumulatedRawText.trim()) {
          throw new Error("No se recibió contenido del modelo durante el streaming");
        }

        // Extract the clean translation from the full accumulated response
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
        // Final safety net: strip any residual XML wrapper tags the model echoed back
        translated = stripXmlWrapper(translated);

        // Hard filter contra Prompt Leakage en el resultado final
        const isLeaking = translated.includes("CONTEXT ABOUT THE USER") || translated.includes("CRITICAL RULES") || translated.includes("MANDATORY");
        if (isLeaking) {
          throw new Error("Prompt Leakage detectado y bloqueado por seguridad.");
        }

        if (!translated) {
          throw new Error("Fallo al extraer la traducción de las etiquetas XML (streaming)");
        }

        // Send the final clean translation to ensure UI has the complete text
        options.onData(translated);
        translationCache.set(cacheKey, translated);
        return translated;
      } else {
        const response = await axios.post(
          NVIDIA_API_URL,
          {
            model: modelId,
            messages,
            temperature: dynamicTemperature,
            max_tokens: 4096,
            stream: false,
            apiKey: options?.apiKey,
            provider: options?.provider,
          },
          {
            headers: { "Content-Type": "application/json" },
            signal: options?.signal,
          }
        );

        const rawContent = response.data?.choices?.[0]?.message?.content?.trim();
        if (!rawContent) throw new Error("No se recibió traducción del modelo");

        // 4. Extracción de <translation> XML
        let translated = rawContent;
        const translationMatch = rawContent.match(/<translation>([\s\S]*?)(?:<\/translation>|$)/);

        if (translationMatch && translationMatch[1]) {
          translated = translationMatch[1].trim();
        } else {
          // Fallback robusto en caso de que el modelo ignore las etiquetas XML
          const thinkingMatch = rawContent.match(/<\/thinking>([\s\S]*)/);
          if (thinkingMatch && thinkingMatch[1]) {
            translated = thinkingMatch[1].trim();
          }
        }
        // Final safety net: strip any residual XML wrapper tags the model echoed back
        translated = stripXmlWrapper(translated);

        // Hard filter contra Prompt Leakage (Non-streaming fallback)
        const isLeaking = translated.includes("CONTEXT ABOUT THE USER") || translated.includes("CRITICAL RULES") || translated.includes("MANDATORY");
        if (isLeaking) {
          throw new Error("Prompt Leakage detectado y bloqueado por seguridad.");
        }

        if (!translated) throw new Error("Fallo al extraer la traducción de las etiquetas XML");

        translationCache.set(cacheKey, translated);

        return translated;
      }
    } catch (error) {
      if (axios.isCancel(error)) throw error;
      if (error instanceof DOMException) throw error;

      const isAuthError =
        (axios.isAxiosError(error) && error.response?.status === 401) ||
        (error instanceof Error && /HTTP Error: 40[13]/.test(error.message));

      if (isAuthError) {
        throw new Error("AUTH_ERROR: Invalid or missing API key (401)");
      }

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 429 || (status && status >= 500 && status < 600)) {
          lastError = error;
          continue;
        }
      }
      if (error instanceof Error && error.message.startsWith("HTTP Error: ")) {
        lastError = error;
        continue;
      }

      throw new Error(`Error en traducción AI: ${(error as Error).message}`);
    }
  }

  throw new Error(`Error en traducción AI (after ${MAX_RETRIES} retries): ${(lastError as Error).message}`);
};

export const translateMultiple = async (
  texts: string[],
  targetLang: string,
  sourceLang: string,
  modelId: string
): Promise<string[]> => {
  return Promise.all(texts.map((text) => translate(targetLang, sourceLang, text, modelId)));
};
