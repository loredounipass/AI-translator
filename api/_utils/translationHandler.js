const https = require("https");
const { PROVIDERS, MAX_TRANSLATE_BODY } = require("./config");
const { checkRateLimit, cleanupRateLimiter } = require("./rateLimiter");

module.exports = async (req, res, contentLength) => {
  const apiKey = (req.body && req.body.apiKey) || "";
  let provider = (req.body && req.body.provider) || "";
  if (!provider) {
    if (req.body && (req.body.model === "qwen2.5-1.5b" || req.body.model === "local-qwen" || req.body.model === "qwen")) {
      provider = "qwen_local";
    } else {
      provider = apiKey ? "nvidia" : "qwen_local";
    }
  }

  const providerConfig = PROVIDERS[provider];
  if (!providerConfig) {
    return res.status(400).json({ error: `Provider desconocido: ${provider}` });
  }

  const isLocalProvider = provider === "local" || provider === "qwen_local";
  if (!apiKey && !isLocalProvider) {
    return res.status(401).json({ error: `API key requerida para ${provider}` });
  }

  const cleanBody = { ...req.body };
  delete cleanBody.apiKey;
  delete cleanBody.provider;

  if (contentLength > MAX_TRANSLATE_BODY) {
    return res.status(413).json({ error: "Payload too large" });
  }

  cleanupRateLimiter(Date.now());
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
  if (isLocalProvider) timeoutMs = 120000;
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

  return new Promise((resolve) => {
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
          } else {
            try { data = JSON.parse(proxyBody.toString()); } catch { data = proxyBody.toString(); }
          }
          resolve({ statusCode: proxyRes.statusCode, data });
        } catch {
          resolve({ statusCode: 502, data: { error: "Invalid provider response" } });
        }
      });
    });
    proxyReq.on("error", () => resolve({ statusCode: 500, data: { error: "Proxy error" } }));
    proxyReq.setTimeout(timeoutMs, () => {
      proxyReq.destroy();
      resolve({ statusCode: 504, data: { error: "Translation request timed out" } });
    });
    proxyReq.end(bodyStr);
  });
};
