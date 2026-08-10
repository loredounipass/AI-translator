import { LRUCache } from "lru-cache";
import { CACHE_TTL } from "./constants";

export const translationCache = new LRUCache<string, string>({ max: 1000, ttl: CACHE_TTL });

export const getCacheKey = (text: string, targetLang: string, sourceLang: string, modelId: string): string =>
  `${modelId}:${sourceLang}:${targetLang}:${text}`;


// CLEAR THE ENTIRE TRANSLATION CACHE (FRESH START)
export const clearTranslationCache = (): void => {
  translationCache.clear();
};


// REMOVE A SPECIFIC ITEM FROM THE TRANSLATION CACHE
export const removeFromCache = (text: string, targetLang: string, sourceLang: string, modelId: string): void => {
  const key = getCacheKey(text, targetLang, sourceLang, modelId);
  translationCache.delete(key);
};


// REMOVE ALL CACHE ENTRIES FOR A SOURCE TEXT + LANGUAGE PAIR (ANY MODEL)
export const removeFromCacheByPair = (text: string, targetLang: string, sourceLang: string): void => {
  const suffix = `:${sourceLang}:${targetLang}:${text.trim()}`;
  for (const key of translationCache.keys()) {
    if (key.endsWith(suffix)) {
      translationCache.delete(key);
    }
  }
};
