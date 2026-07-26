console.log("[setupProxy] LOADED - setting up NVIDIA proxy with Cache & Rate Limit...");

const https = require("https");
const crypto = require("crypto");

// 1. In-memory Cache
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000;
const cache = new Map();

// 2. Request Coalescing
const pendingRequests = new Map();

// 3. Global Rate Limiter (timestamp-based, no race condition)
const RATE_LIMIT_MAX = 50; // Max requests per window
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const requestTimestamps = [];

const generateCacheKey = (bodyStr) => {
  return crypto.createHash("sha256").update(bodyStr || "").digest("hex");
};

const cleanupCache = () => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now > value.expiry) {
      cache.delete(key);
    }
  }
  if (cache.size > MAX_CACHE_SIZE) {
    const keysToRemove = Array.from(cache.keys()).slice(0, cache.size - MAX_CACHE_SIZE);
    keysToRemove.forEach(k => cache.delete(k));
  }
};

module.exports = function (app) {
  console.log("[setupProxy] Express app received, registering middleware");

  app.use(async (req, res, next) => {
    if (!req.url.startsWith("/api/nvidia")) {
      return next();
    }

    console.log("[setupProxy] PROXYING:", req.method, req.url);

    // --- Rate Limiting ---
    const now = Date.now();
    while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_LIMIT_WINDOW) {
      requestTimestamps.shift();
    }
    if (requestTimestamps.length >= RATE_LIMIT_MAX) {
      res.status(429).json({ error: "Too Many Requests" });
      return;
    }
    requestTimestamps.push(now);

    const processRequest = async (bodyBuffer) => {
      const bodyStr = bodyBuffer.toString();

      let apiKey = "";
      let cleanBody = bodyStr;
      try {
        const parsedBody = JSON.parse(bodyStr);
        apiKey = parsedBody.apiKey || "";
        if (apiKey) {
          const { apiKey: _, ...rest } = parsedBody;
          cleanBody = JSON.stringify(rest);
        }
      } catch (e) {
        // Ignored
      }

      if (!apiKey) {
        res.status(401).json({ error: "API key requerida — proporciona tu propia key de NVIDIA" });
        return;
      }

      const cacheKey = generateCacheKey(cleanBody);
      
      let isStreaming = false;
      try {
        const parsedBody = JSON.parse(cleanBody);
        isStreaming = parsedBody.stream === true;
      } catch (e) {
        // Ignored
      }
      
      cleanupCache();
      
      if (!isStreaming) {
        // Return from Cache
        if (cache.has(cacheKey)) {
          console.log("[setupProxy] Cache HIT for:", req.url);
          const cachedResponse = cache.get(cacheKey);
          res.status(cachedResponse.statusCode).json(cachedResponse.data);
          return;
        }

        // Wait for Pending Request (Coalescing)
        if (pendingRequests.has(cacheKey)) {
          console.log("[setupProxy] Coalescing request for:", req.url);
          try {
            const response = await pendingRequests.get(cacheKey);
            res.status(response.statusCode).json(response.data);
          } catch {
            res.status(500).json({ error: "Coalesced request failed" });
          }
          return;
        }
      }

      console.log(`[setupProxy] Cache MISS, forwarding to NVIDIA API (Streaming: ${isStreaming})`);

      if (req.url !== "/api/nvidia/chat/completions") {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const targetPath = "/v1/chat/completions";
      
      const options = {
        hostname: "integrate.api.nvidia.com",
        path: targetPath,
        method: req.method,
        headers: {
          host: "integrate.api.nvidia.com",
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": req.headers["content-type"] || "application/json",
          "Content-Length": Buffer.byteLength(cleanBody),
        },
      };

      if (isStreaming) {
        const proxyReq = https.request(options, (proxyRes) => {
          // Pass all headers from Nvidia directly back to the client
          const headersToSet = { ...proxyRes.headers };
          // Ensure it's treated as SSE
          headersToSet['Cache-Control'] = 'no-cache';
          headersToSet['Connection'] = 'keep-alive';
          
          res.writeHead(proxyRes.statusCode, headersToSet);
          proxyRes.pipe(res);
        });

        proxyReq.on("error", () => {
          if (!res.headersSent) {
            res.status(500).json({ error: "Proxy streaming error" });
          }
        });
        proxyReq.end(cleanBody);
        return;
      }

      // --- Make API Request (Non-Streaming) ---
      const requestPromise = new Promise((resolve, reject) => {
        const proxyReq = https.request(options, (proxyRes) => {
          const chunks = [];
          proxyRes.on("data", (chunk) => chunks.push(chunk));
          proxyRes.on("end", () => {
            try {
              const proxyBody = Buffer.concat(chunks);
              let data;
              
              if (proxyRes.statusCode === 200) {
                data = JSON.parse(proxyBody.toString());
                // Store successful requests in cache
                cache.set(cacheKey, {
                  statusCode: proxyRes.statusCode,
                  data: data,
                  expiry: Date.now() + CACHE_TTL
                });
              } else {
                // Handle error JSON
                try { data = JSON.parse(proxyBody.toString()); } 
                catch { data = proxyBody.toString(); }
              }
              
              resolve({ statusCode: proxyRes.statusCode, data });
            } catch (err) {
              reject(err);
            }
          });
        });

        proxyReq.on("error", reject);
        proxyReq.end(cleanBody);
      });

      // Store promise for concurrent identical requests
      pendingRequests.set(cacheKey, requestPromise);

      try {
        const response = await requestPromise;
        pendingRequests.delete(cacheKey);
        res.status(response.statusCode).json(response.data);
      } catch {
        pendingRequests.delete(cacheKey);
        if (!res.headersSent) {
           res.status(500).json({ error: "Proxy error" });
        }
      }
    };

    if (req.body) {
      console.log("[setupProxy] Using pre-parsed body");
      processRequest(Buffer.from(JSON.stringify(req.body)));
    } else {
      console.log("[setupProxy] Reading raw body");
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        processRequest(Buffer.concat(chunks));
      });
    }
  });
};
