const crypto = require("crypto");
const { cleanupRateLimiter } = require("./rateLimiter");

const CACHE_TTL = 3 * 60 * 1000;
const MAX_CACHE_SIZE = 1000;
const cache = new Map();
const pendingRequests = new Map();

const generateCacheKey = (bodyObj, apiKey = "") => {
  return crypto.createHash("sha256").update(JSON.stringify(bodyObj || {}) + apiKey).digest("hex");
};

const cleanupCache = () => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now > value.expiry) cache.delete(key);
  }
  if (cache.size > MAX_CACHE_SIZE) {
    const keysToRemove = Array.from(cache.keys()).slice(0, cache.size - MAX_CACHE_SIZE);
    keysToRemove.forEach(k => cache.delete(k));
  }
  
  cleanupRateLimiter(now);
};

module.exports = {
  cache,
  pendingRequests,
  generateCacheKey,
  cleanupCache,
  CACHE_TTL,
};
