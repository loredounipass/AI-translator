const https = require("https");
const crypto = require("crypto");

const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 1000;
const cache = new Map();
const pendingRequests = new Map();
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW = 60000;
const requestTimestamps = [];

const PROVIDERS = {
  nvidia: {
    hostname: "integrate.api.nvidia.com",
    path: "/v1/chat/completions",
    authHeader: (key) => `Bearer ${key}`,
    authHeaderName: "Authorization",
  },
  openai: {
    hostname: "api.openai.com",
    path: "/v1/chat/completions",
    authHeader: (key) => `Bearer ${key}`,
    authHeaderName: "Authorization",
  },
  anthropic: {
    hostname: "api.anthropic.com",
    path: "/v1/messages",
    authHeader: (key) => key,
    authHeaderName: "x-api-key",
    extraHeaders: { "anthropic-version": "2023-06-01" },
  },
};

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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.body && req.body._type === "asr") {
    const apiKey = (req.body && req.body.apiKey) || "";
    if (!apiKey) {
      return res.status(401).json({ error: "NVIDIA API key requerida para ASR" });
    }

    const { audio, language, mime } = req.body;
    if (!audio) {
      return res.status(400).json({ error: "audio (base64) es requerido" });
    }

    const audioBuffer = Buffer.from(audio, "base64");
    const boundary = "----ASR" + Date.now().toString(36);
    const lang = language || "multi";
    const contentType = mime || "audio/wav";
    const ext = contentType.includes("webm") ? "webm" : contentType.includes("ogg") ? "ogg" : "wav";

    let body = "";
    body += `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nnvidia/parakeet-ctc-0.6b-es\r\n`;
    body += `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${lang}\r\n`;
    body += `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${ext}"\r\nContent-Type: ${contentType}\r\n\r\n`;
    const bodyBuffer = Buffer.concat([
      Buffer.from(body, "utf-8"),
      audioBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8"),
    ]);

    const options = {
      hostname: "integrate.api.nvidia.com",
      path: "/v1/audio/transcriptions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": bodyBuffer.length,
      },
    };

    const asrReq = https.request(options, (proxyRes) => {
      const chunks = [];
      proxyRes.on("data", (c) => chunks.push(c));
      proxyRes.on("end", () => {
        const raw = Buffer.concat(chunks).toString();
        try { return res.status(proxyRes.statusCode).json(JSON.parse(raw)); }
        catch { return res.status(proxyRes.statusCode).send(raw); }
      });
    });
    asrReq.on("error", (err) => res.status(502).json({ error: "ASR proxy error: " + err.message }));
    asrReq.end(bodyBuffer);
    return;
  }

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

  const now = Date.now();
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_LIMIT_WINDOW) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: "Too Many Requests" });
  }
  requestTimestamps.push(now);

  const isStreaming = cleanBody.stream === true;

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
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on("error", (err) => {
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
