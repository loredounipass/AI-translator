const https = require("https");
const crypto = require("crypto");

const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 1000;
const cache = new Map();
const pendingRequests = new Map();
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW = 60000;
const requestTimestamps = [];

const generateCacheKey = (bodyObj) => {
  return crypto.createHash("sha256").update(JSON.stringify(bodyObj || {})).digest("hex");
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
};

module.exports = async (req, res) => {
  console.log("[completions] Called, method:", req.method);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = (req.body && req.body.apiKey) || "";
  console.log("[completions] apiKey present:", !!apiKey, "stream:", req.body?.stream);
  if (!apiKey) {
    console.log("[completions] Missing apiKey");
    return res.status(401).json({ error: "API key requerida" });
  }

  const cleanBody = { ...req.body };
  delete cleanBody.apiKey;

  const now = Date.now();
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_LIMIT_WINDOW) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: "Too Many Requests" });
  }
  requestTimestamps.push(now);

  if (cleanBody.stream === true) {
    const bodyStr = JSON.stringify(cleanBody);
    const options = {
      hostname: "integrate.api.nvidia.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        host: "integrate.api.nvidia.com",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
      },
    };
    console.log("[completions] Streaming to NVIDIA");
    const proxyReq = https.request(options, (proxyRes) => {
      console.log("[completions] NVIDIA stream status:", proxyRes.statusCode);
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on("error", (err) => {
      console.log("[completions] Stream error:", err.message);
      if (!res.headersSent) res.status(500).json({ error: "Proxy stream error" });
    });
    proxyReq.end(bodyStr);
    return;
  }

  const cacheKey = generateCacheKey(cleanBody);
  cleanupCache();

  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    return res.status(cached.statusCode).json(cached.data);
  }

  if (pendingRequests.has(cacheKey)) {
    try {
      const response = await pendingRequests.get(cacheKey);
      return res.status(response.statusCode).json(response.data);
    } catch {
      return res.status(500).json({ error: "Coalesced request failed" });
    }
  }

  console.log("[completions] Non-streaming to NVIDIA");
  const requestPromise = new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(cleanBody);
    const options = {
      hostname: "integrate.api.nvidia.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        host: "integrate.api.nvidia.com",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      console.log("[completions] NVIDIA status:", proxyRes.statusCode);
      const chunks = [];
      proxyRes.on("data", (chunk) => chunks.push(chunk));
      proxyRes.on("end", () => {
        try {
          const proxyBody = Buffer.concat(chunks);
          let data;
          if (proxyRes.statusCode === 200) {
            data = JSON.parse(proxyBody.toString());
            cache.set(cacheKey, { statusCode: proxyRes.statusCode, data, expiry: Date.now() + CACHE_TTL });
          } else {
            try { data = JSON.parse(proxyBody.toString()); } catch { data = proxyBody.toString(); }
          }
          resolve({ statusCode: proxyRes.statusCode, data });
        } catch (err) {
          console.log("[completions] Parse error:", err.message);
          reject(err);
        }
      });
    });
    proxyReq.on("error", (err) => {
      console.log("[completions] Request error:", err.message);
      reject(err);
    });
    proxyReq.end(bodyStr);
  });

  pendingRequests.set(cacheKey, requestPromise);
  try {
    const response = await requestPromise;
    pendingRequests.delete(cacheKey);
    console.log("[completions] Response status:", response.statusCode);
    return res.status(response.statusCode).json(response.data);
  } catch (err) {
    pendingRequests.delete(cacheKey);
    console.log("[completions] Proxy error:", err.message);
    return res.status(500).json({ error: "Proxy error" });
  }
};
