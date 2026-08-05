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
  return text
    .replace(/<\/?(source_text|thinking|translation|execution_instructions|response|output|result|answer)[^>]*>/gi, "")
    .replace(/^\s*\n/, "")
    .trim();
};
