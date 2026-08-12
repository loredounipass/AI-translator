const TRIVIAL_REGEX = /^[\d\s.,!?;:'"()[\]{}<>\-_=+*/\\|@#%^&`~]+$/;
const URL_EMAIL_REGEX = /^(https?:\/\/[^\s]+|[^\s@]+@[^\s@]+\.[^\s@]+)$/i;
const NO_PRONOUNS_REGEX = /\b(i|you|he|she|it|we|they|my|your|his|her|our|their|the|a|an|is|are|was|were|am|going|live|address)\b/i;
const _SS = "st|street|ave|avenue|aven|rd|road|blvd|boulevard|ln|lane|dr|drive|ct|court|pkwy|parkway";
const _AS = "apt|apartment|apart|suite|ste|unit|rm|room|bldg|building";
const ADDR_STARTS_NUMBER = new RegExp(`^\\d+\\s+[a-z0-9\\s.,-]+\\b(${_SS})\\b`, "i");
const ADDR_HAS_APT      = new RegExp(`^([a-z0-9\\s.,-]+)?\\b(${_SS})\\b[\\s.,]+\\b(${_AS})\\b\\s*\\d+`, "i");
const ADDR_HAS_STATE_ZIP = new RegExp(`^([a-z0-9\\s.,-]+)?\\b(${_SS})\\b[\\s.,]+\\b([a-z]{2})\\b\\s+\\d{5}`, "i");
const ADDR_JUST_STREET  = new RegExp(`^[a-z0-9\\s.,-]+\\b(${_SS})\\b$`, "i");

export const isTrivialText = (text: string, sourceLang?: string, targetLang?: string): boolean => {
  if (TRIVIAL_REGEX.test(text) || URL_EMAIL_REGEX.test(text)) {
    return true;
  }

  if (sourceLang === "en" && targetLang === "es") {
    const normalized = text.toLowerCase().trim();
    const noPronouns = !NO_PRONOUNS_REGEX.test(normalized);

    if (
      ADDR_STARTS_NUMBER.test(normalized) ||
      ADDR_HAS_APT.test(normalized) ||
      ADDR_HAS_STATE_ZIP.test(normalized) ||
      (ADDR_JUST_STREET.test(normalized) && noPronouns)
    ) {
      return true;
    }
  }

  return false;
};

export const stripXmlWrapper = (text: string): string => {
  // 1. Try to extract content specifically from inside translation/output tags
  const extractRegex = /<(?:translation|traduccion|interpretacion|output|result|final_translation)>([\s\S]*?)(?:<\/(?:translation|traduccion|interpretacion|output|result|final_translation)>|$)/i;
  const match = text.match(extractRegex);
  
  if (match) {
    // If we found the target tag, return only its content (hiding any reasoning outside it)
    return match[1].replace(/^\s*\n/, "");
  }

  // 2. Fallback: if no translation tag is found, strip out thinking tags and return what's left
  // (In case the model outputs <thinking>...</thinking> but glitched and didn't use <translation>)
  const withoutThinking = text.replace(/<thinking>[\s\S]*?(?:<\/thinking>|$)/gi, "");
  
  return withoutThinking
    .replace(/<\/?(source_text|pensamiento|interpretation|interpretaci[óo]n|translation|traducci[óo]n|execution_instructions|response|output|result|answer)[^>]*>/gi, "")
    .replace(/^\s*\n/, "");
};
