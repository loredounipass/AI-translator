import { LRUCache } from "lru-cache";
import { CACHE_TTL } from "./constants";

export const translationCache = new LRUCache<string, string>({ max: 1000, ttl: CACHE_TTL });

export const getCacheKey = (text: string, targetLang: string, sourceLang: string, modelId: string): string =>
  `${modelId}:${sourceLang}:${targetLang}:${text}`;
