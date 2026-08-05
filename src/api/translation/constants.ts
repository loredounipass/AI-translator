export const NVIDIA_API_URL = "/api/completions";
export const MAX_RETRIES = 3;
export const BASE_DELAY = 1000;
export const CACHE_TTL = 5 * 60 * 1000;
export const THINKING_CHAR_THRESHOLD = 100;

export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
