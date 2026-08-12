export const NVIDIA_API_URL = "/api/completions";
export const MAX_RETRIES = 3;
export const BASE_DELAY = 1000;
export const CACHE_TTL = 3 * 60 * 1000;

export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate an adaptive timeout (ms) based on the length of the source text.
 * Longer texts require more generation time from the LLM.
 */
export const getAdaptiveTimeout = (textLength: number): number => {
  if (textLength > 5000) return 120_000;
  if (textLength > 2000) return 90_000;
  if (textLength > 500) return 60_000;
  return 30_000;
};

/**
 * Calculate adaptive max_tokens based on the length of the source text.
 * Short inputs need fewer output tokens; long inputs may need up to 4096.
 */
export const getAdaptiveMaxTokens = (textLength: number): number => {
  if (textLength > 4000) return 4096;
  if (textLength > 1000) return 2048;
  if (textLength > 200) return 1024;
  return 512;
};

export const LANGUAGE_NAMES: Record<string, string> = {
  ar: "Arabic",
  da: "Danish",
  de: "German",
  en: "English",
  es: "Spanish",
  fr: "French",
  hi: "Hindi",
  it: "Italian",
  id: "Indonesian",
  ja: "Japanese",
  ko: "Korean",
  nl: "Dutch",
  pl: "Polish",
  pt: "Portuguese",
  ru: "Russian",
  sv: "Swedish",
  th: "Thai",
  tr: "Turkish",
  vi: "Vietnamese",
  zh: "Chinese",
};

export const getLanguageName = (code: string): string => {
  if (code === "auto" || code === "auto-detect") return "the source language";
  return LANGUAGE_NAMES[code] || code;
};
