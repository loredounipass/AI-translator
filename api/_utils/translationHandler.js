const https = require("https");
const { PROVIDERS, MAX_TRANSLATE_BODY } = require("./config");
const { cache, pendingRequests, generateCacheKey, cleanupCache, CACHE_TTL } = require("./cache");
const { checkRateLimit } = require("./rateLimiter");

let requestCounter = 0;

module.exports = async (req, res, contentLength) => {
  const apiKey = (req.body && req.body.apiKey) || "";
  const provider = (req.body && req.body.provider) || "nvidia";

  if (!apiKey) {
    return res.status(401).json({ error: `API key requerida para ${provider}` });
  }

  const providerConfig = PROVIDERS[provider];
  if (!providerConfig) {
    return res.status(400).json({ error: `Provider desconocido: ${provider}` });
  }

  const cleanBody = { ...req.body };
  delete cleanBody.apiKey;
  delete cleanBody.provider;

  if (contentLength > MAX_TRANSLATE_BODY) {
    return res.status(413).json({ error: "Payload too large" });
  }

  if (!checkRateLimit(req)) {
    return res.status(429).json({ error: "Too Many Requests" });
  }

  const isStreaming = cleanBody.stream === true;

  let textLength = 0;
  if (cleanBody.messages && cleanBody.messages.length > 0) {
    const lastMsg = cleanBody.messages[cleanBody.messages.length - 1];
    textLength = lastMsg.content ? lastMsg.content.length : 0;
  }
  
  let timeoutMs = 30000;
  if (textLength > 5000) timeoutMs = 120000;
  else if (textLength > 2000) timeoutMs = 90000;
  else if (textLength > 500) timeoutMs = 60000;
  
  const clientTimeout = req.headers['x-request-timeout'];
  if (clientTimeout && !isNaN(parseInt(clientTimeout))) {
    timeoutMs = Math.max(timeoutMs, parseInt(clientTimeout));
  }
  if (isStreaming) {
    const bodyStr = JSON.stringify(cleanBody);
    const headers = {
      host: providerConfig.hostname,
      [providerConfig.authHeaderName]: providerConfig.authHeader(apiKey),
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(bodyStr),
      ...(providerConfig.extraHeaders || {}),
    };

    const options = {
      hostname: providerConfig.hostname,
      path: providerConfig.path,
      method: "POST",
      headers,
    };

    const proxyReq = https.request(options, (proxyRes) => {
      const safeHeaders = {};
      const allowedHeaders = ['content-type', 'cache-control', 'transfer-encoding', 'content-encoding'];
      for (const key of allowedHeaders) {
        if (proxyRes.headers[key]) safeHeaders[key] = proxyRes.headers[key];
      }
      res.writeHead(proxyRes.statusCode, safeHeaders);
      proxyRes.pipe(res);
    });
    proxyReq.on("error", (err) => {
      if (!res.headersSent) res.status(502).json({ error: "Proxy stream error" });
    });
    proxyReq.setTimeout(timeoutMs, () => { proxyReq.destroy(); });
    proxyReq.end(bodyStr);
    return;
  }

  const cacheKey = generateCacheKey(cleanBody, apiKey);
  
  requestCounter++;
  if (requestCounter % 50 === 0) {
    cleanupCache();
  }

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

  const requestPromise = new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(cleanBody);
    const headers = {
      host: providerConfig.hostname,
      [providerConfig.authHeaderName]: providerConfig.authHeader(apiKey),
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(bodyStr),
      ...(providerConfig.extraHeaders || {}),
    };

    const options = {
      hostname: providerConfig.hostname,
      path: providerConfig.path,
      method: "POST",
      headers,
    };

    const proxyReq = https.request(options, (proxyRes) => {
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
        } catch {
          reject(new Error("Parse error"));
        }
      });
    });
    proxyReq.on("error", reject);
    proxyReq.setTimeout(timeoutMs, () => { proxyReq.destroy(); reject(new Error("Translation request timed out")); });
    proxyReq.end(bodyStr);
  });

  pendingRequests.set(cacheKey, requestPromise);
  try {
    const response = await requestPromise;
    pendingRequests.delete(cacheKey);
    return res.status(response.statusCode).json(response.data);
  } catch {
    pendingRequests.delete(cacheKey);
    return res.status(500).json({ error: "Proxy error" });
  }
};
