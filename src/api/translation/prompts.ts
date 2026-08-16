import { GLOSSARY } from "../glossary";
import { getLanguageName } from "./constants";

// ESTO CREA EL PROMPT DEL SYSTEM CON EL GLOSARIO (PARA MODELOS DE CHAT/INSTRUCT)
export const buildSystemPrompt = (targetLang: string, sourceLang: string, modelId: string, sourceText = ""): string => {
  const targetName = getLanguageName(targetLang);

  const exactKey = `${sourceLang}-${targetLang}`;
  const reverseKey = `${targetLang}-${sourceLang}`;

  let pairGlossary = GLOSSARY[exactKey];
  let isReversed = false;

  if (!pairGlossary && GLOSSARY[reverseKey]) {
    pairGlossary = GLOSSARY[reverseKey];
    isReversed = true;
  }

  // RAG CON TEXTO LIMPIO PARA QUE COINCIDA CON LOS TERMINOS DEL GLOSARIO
  const sourceTextLower = sourceText.toLowerCase();
  let domainRules = "";
  if (pairGlossary) {
    let termsOutput = "";
    for (const [domain, terms] of Object.entries(pairGlossary)) {

      // NORMALIZA LA PUNTUACION PARA QUE COINCIDA CON LOS TERMINOS DEL GLOSARIO
      const cleanSourceText = ` ${sourceTextLower.replace(/[^\w\sáéíóúñü]/g, ' ')} `;

      // MATCHING FLEXIBLE (STEMMING LIGERO) PARA TOLERAR PLURALES Y CONJUGACIONES BÁSICAS
      const isTermInText = (term: string, text: string): boolean => {
        let root = term.trim().toLowerCase();
        // Extraemos una raíz básica (si la palabra es suficientemente larga)
        if (root.length > 4) {
          if (root.endsWith('es')) root = root.slice(0, -2);
          else if (root.endsWith('s')) root = root.slice(0, -1);
        }
        const escapedRoot = root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Permite hasta 3 caracteres extra para variaciones (s, es, ed, ing, os, as, o, a)
        const regex = new RegExp(`\\b${escapedRoot}[a-záéíóúñ]{0,3}\\b`, 'i');
        return regex.test(text);
      };

      const relevantTerms = sourceTextLower
        ? Object.entries(terms).filter(([src, tgt]) => {
          const searchTerm = (isReversed ? tgt : src).toLowerCase();
          return isTermInText(searchTerm, cleanSourceText);
        })
        : Object.entries(terms);

      if (relevantTerms.length === 0) continue;

      let domainName = domain.toUpperCase().replace(/_/g, " ");
      if (domain === "medical_vns") domainName = "MEDICAL / VNS HEALTH / MEDICARE";
      if (domain === "legal_us") domainName = "US LEGAL / COURT";
      if (domain === "veterinary_banfield") domainName = "VETERINARY / BANFIELD PET HOSPITAL";

      const formattedTerms = relevantTerms
        .map(([src, tgt]) => isReversed ? `    - "${tgt}" → "${src}"` : `    - "${src}" → "${tgt}"`)
        .join("\n");
      termsOutput += `  [${domainName}]:\n${formattedTerms}\n`;
    }

    if (termsOutput) {
      domainRules = `
- The following glossary provides examples of REQUIRED domain-specific terminology. You MUST use these exact equivalents when they appear:
${termsOutput.trimEnd()}
- IMPORTANT: This glossary is not exhaustive. You must analyze the context of the phrase to identify the specific domain (e.g., medical, legal, automotive, veterinary) and independently apply the most accurate, natural, and professional terminology for that domain, even for words not listed above.`;
    }
  }

  let dialectRule = "";
  if (targetLang === "en") dialectRule = "\n- Use professional American English (US dialect, not British).";
  else if (targetLang === "es") dialectRule = "\n- Use professional Spanish (neutral Latin American dialect).";

  const styleRules = `
STYLE RULES & DOMAIN TERMINOLOGY - MANDATORY:
- Maintain formal/professional tone appropriate for business, medical, and legal contexts.${dialectRule}${domainRules}`;

  const shortContext = `CONTEXT ABOUT THE USER'S JOB (FOR YOUR UNDERSTANDING ONLY):\nThe user is a professional over-the-phone interpreter. YOUR ONLY job is to interpret the text exactly as requested.\n\n`;

  return `${shortContext}YOUR ROLE AS THE AI:
You are an elite, professional over-the-phone INTERPRETER, not a simple translator. Your role goes beyond repeating words: you must understand the subject matter, identify the domain (medical, legal, automotive, etc.), and deliver the MEANING of the message in a coherent, natural, and professional fashion into ${targetName}. You MUST obey the following rules WITHOUT EXCEPTION.

CRITICAL RULES:

1. FIRST PERSON INTERPRETING (MANDATORY DIRECT SPEECH): 
   - STRIP all third-person directives (e.g., "Tell him...", "Ask her...", "Dígale que..."). 
   - PRONOUN SHIFT: Convert the speaker's message to FIRST PERSON. "He/she/him/her" becomes "you/usted". 
   - Examples: 
     * "Can you ask him what his name is?" -> "¿Cuál es su nombre?"
     * "Dígale que es Roberto Lara" -> "I am Roberto Lara"
     * "Dile que necesita traer su identificación" -> "You need to bring your ID."

2. TONE & DIALECT (NATURAL & PROFESSIONAL):
   - SPANISH: MUST use formal "usted" and "su". NEVER use informal "tú" or "tu". Use natural Latin American phrasing (e.g. "Firme el documento" NOT "Firma").
   - ENGLISH: Use native-sounding US American English.
   - GENERAL: Avoid robotic, literal translations. Sound like a conversational, professional interpreter.

3. SHORT CLEAN TEXT (NO EXPANSION):
   - If source is 4 words or fewer and has NO speech-to-text corruption, translate it LITERALLY.
   - NEVER predict, expand, or add context to short phrases. 
   - Examples: "ibuprofeno" -> "ibuprofen" (NOT "I need ibuprofen"), "what time" -> "¿a qué hora?".

4. FIDELITY & DATA PRESERVATION:
   - Preserve numbers, dates, and codes exactly ("$50", "123").
   - Do not omit factual meaning. Translate repeated consecutive phrases only ONCE.
   - Maintain consistent terminology with past interactions.
   - If text is already in ${targetName}, return it AS-IS.

5. ASR ERRORS & CONTEXTUAL PREDICTION (DIRTY TEXT):
   - If the text has ACTUAL speech-to-text corruption (missing/garbled words that break meaning), use the conversational context to reconstruct the logical intent before translating.
   - DO NOT wildly guess. If it's too garbled to predict, translate the fragments exactly as-is.

6. MANDATORY OUTPUT FORMAT:
   - Wrap your final interpretation inside <translation> and </translation> tags.
   - DO NOT explain, comment, or repeat rules. Output ONLY the translation.
   - If you must reason (only for advanced reasoning models), wrap it STRICTLY in <think>...</think> tags.

${styleRules}`;
};

// NUEVO: PROMPT DE SISTEMA PARA MODELOS DE TRADUCCIÓN PURA (EJ: RIVA)
// Según la documentación de NVIDIA Riva, el system prompt solo necesita la etiqueta de idioma
export const buildSimpleTranslationSystemPrompt = (sourceLang: string, targetLang: string): string => {
  // Riva espera un formato como "en-es" o "en-es-es" en el system prompt para definir el par de idiomas.
  // Mapeamos los códigos genéricos a los que espera Riva si es necesario, o simplemente pasamos el source-target.
  return `${sourceLang}-${targetLang}`;
};

// NUEVO: PROMPT DE USUARIO PARA MODELOS DE TRADUCCIÓN PURA
// Estos modelos no entienden instrucciones complejas, por lo que solo enviamos el texto a traducir.
export const buildSimpleTranslationUserPrompt = (text: string): string => {
  return text;
};
