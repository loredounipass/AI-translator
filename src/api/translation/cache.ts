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
  const cache = translationCache as unknown as {
    keys(): string[];
    delete(key: string): unknown;
  };
  for (const key of cache.keys()) {
    if (key.endsWith(suffix)) {
      cache.delete(key);
    }
  }
};


// REMOVE ALL CACHE ENTRIES THAT INVOLVE A SPECIFIC LANGUAGE PAIR (ANY TEXT, ANY MODEL)
// Used when the user switches languages to force a fresh translation.
export const invalidateCacheForLanguagePair = (sourceLang: string, targetLang: string): void => {
  const langFragment = `:${sourceLang}:${targetLang}:`;
  const cache = translationCache as unknown as {
    keys(): string[];
    delete(key: string): unknown;
  };
  for (const key of cache.keys()) {
    if (key.includes(langFragment)) {
      cache.delete(key);
    }
  }
};


// REMOVE ALL CACHE ENTRIES FOR A SPECIFIC MODEL (ANY LANGUAGE PAIR, ANY TEXT)
// Used when the user switches models to avoid serving translations from a different model.
export const invalidateCacheForModel = (modelId: string): void => {
  const prefix = `${modelId}:`;
  const cache = translationCache as unknown as {
    keys(): string[];
    delete(key: string): unknown;
  };
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
};
