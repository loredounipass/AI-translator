const https = require("https");
const crypto = require("crypto");

const allowedOrigins = [
  "https://interpreter1-sooty.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
];

const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 1000;
const cache = new Map();
const pendingRequests = new Map();
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW = 60000;
const rateLimitMap = new Map(); // Map<ip, timestamps[]>
let requestCounter = 0;

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
  google: {
    hostname: "generativelanguage.googleapis.com",
    path: "/v1beta/openai/chat/completions",
    authHeader: (key) => `Bearer ${key}`,
    authHeaderName: "Authorization",
  },
};

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
  
  // Cleanup rateLimitMap
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const validTimestamps = timestamps.filter(t => t >= now - RATE_LIMIT_WINDOW);
    if (validTimestamps.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, validTimestamps);
    }
  }
};

module.exports = async (req, res) => {
  const origin = req.headers.origin || "";
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
     // Explicitly deny wildcard
     res.setHeader("Access-Control-Allow-Origin", "https://interpreter1-sooty.vercel.app");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const MAX_ASR_BODY = 15 * 1024 * 1024;   // 15MB
  const MAX_TRANSLATE_BODY = 100 * 1024;    // 100KB
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);

  if (req.body && req.body._type === "asr") {
    if (contentLength > MAX_ASR_BODY) {
      return res.status(413).json({ error: "Payload too large" });
    }
    const reqProvider = (req.body && req.body.provider) || "nvidia";
    const apiKey = (req.body && req.body.apiKey) || "";
    if (!apiKey) {
      return res.status(401).json({ error: `API key requerida para ASR (${reqProvider})` });
    }

    let model = req.body.model || "";
    if (reqProvider === "nvidia") {
      const ALLOWED_ASR_MODELS = new Set(['nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', 'nvidia/canary-1b-asr']);
      model = ALLOWED_ASR_MODELS.has(model) ? model : "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";
    } else if (reqProvider === "google") {
      model = model.replace("google/", ""); // E.g., 'gemini-3.5-flash'
      if (!model) model = "gemini-3.5-flash";
    }

    const { audio, language, mime } = req.body;
    if (!audio) {
      return res.status(400).json({ error: "audio (base64) es requerido" });
    }

    const lang = language || "multi";
    const contentType = mime || "audio/wav";
    const cleanContentType = contentType.split(';')[0];

    const langInstruction = lang === "multi"
      ? "Detect the spoken language automatically."
      : `The spoken language is ${lang}.`;

    const contextInstruction = `\nCONTEXT ABOUT THE USER'S JOB (FOR YOUR UNDERSTANDING ONLY):\nThe user you are assisting is a professional over-the-phone interpreter. Their job involves strict training where they must interpret in the 1st person, maintain neutrality, and not break character or assist the parties directly. They use specific 3rd person phrases (e.g. "The interpreter needs repetition") only when necessary.\n\nThat is the USER'S job. YOUR ROLE AS THE AI is to transcribe the text exactly as spoken to help them. You MUST NOT try to do the user's job or intervene in the scenarios.`;

    const systemPromptText = `You are a highly precise speech-to-text transcription engine.
Your ONLY task is to transcribe the audio exactly as spoken.
${langInstruction}${contextInstruction}

CRITICAL RULES:
1. Output ONLY the transcribed text.
2. NO explanations, NO formatting (no markdown, no bold), NO quotes around the text.
3. DO NOT add any conversational filler (e.g., "Here is the transcription:").
4. If there is no speech, return an empty string.`;

    let payloadStr = "";
    let options = {};

    if (reqProvider === "google") {
      // Native Google Gemini REST API payload
      payloadStr = JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPromptText },
              { inlineData: { mimeType: cleanContentType, data: audio } }
            ]
          }
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 1024
        }
      });
      options = {
        hostname: "generativelanguage.googleapis.com",
        path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payloadStr),
        },
      };
    } else {
      // NVIDIA / OpenAI compatible payload
      payloadStr = JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPromptText },
          {
            role: "user",
            content: [
              { type: "audio_url", audio_url: { url: `data:${cleanContentType};base64,${audio}` } }
            ]
          }
        ],
        max_tokens: 1024,
        temperature: 0
      });
      options = {
        hostname: "integrate.api.nvidia.com",
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payloadStr),
        },
      };
    }

    try {
      const { statusCode, raw } = await new Promise((resolve, reject) => {
        const proxyReq = https.request(options, (proxyRes) => {
          const chunks = [];
          proxyRes.on("data", (c) => chunks.push(c));
          proxyRes.on("end", () => {
            resolve({ statusCode: proxyRes.statusCode, raw: Buffer.concat(chunks).toString() });
          });
        });
        proxyReq.on("error", reject);
        proxyReq.setTimeout(45000, () => { proxyReq.destroy(); reject(new Error("ASR request timed out")); });
        proxyReq.end(payloadStr);
      });

      let parsed;
      try { parsed = JSON.parse(raw); } catch {
        return res.status(statusCode).send(raw);
      }

      // Extract transcribed text
      if (statusCode === 200) {
        let transcribedText = "";

        if (reqProvider === "google") {
          // Parse Google Gemini response format
          const candidate = parsed.candidates && parsed.candidates[0];
          if (candidate && candidate.content && candidate.content.parts && candidate.content.parts[0]) {
            transcribedText = (candidate.content.parts[0].text || "").trim();
          }
        } else {
          // Parse OpenAI/NVIDIA response format
          if (parsed.choices && parsed.choices[0]) {
            transcribedText = (parsed.choices[0].message?.content || "").trim();
          }
        }
        
        // Filter out AI meta-commentary (model "thinking out loud" instead of transcribing)
        const metaPatterns = [
          /^we need to/i,
          /^the user gave/i,
          /^there'?s no speech/i,
          /^no (?:speech|audio|sound)/i,
          /return empty string/i,
          /not provided/i,
          /no audio content/i,
          /no transcri/i,
          /I (?:can'?t|cannot|don'?t) (?:hear|detect|find)/i,
          /the audio (?:is|appears|seems) (?:empty|silent|blank)/i,
        ];
        
        // Filter out Prompt Leakage (model hallucinating the system prompt during silence)
        const promptLeakagePatterns = [
          /professional over-the-phone interpreter/i,
          /interpret in the 1st person/i,
          /maintain neutrality/i,
          /not break character/i,
          /The interpreter needs repetition/i,
          /That is the USER'?S job/i,
          /YOUR ROLE AS THE AI/i,
          /transcribe the audio exactly as spoken/i,
          /Output ONLY the transcribed text/i,
          /NO explanations, NO formatting/i,
          /DO NOT add any conversational filler/i,
        ];
        
        if (metaPatterns.some(p => p.test(transcribedText)) || promptLeakagePatterns.some(p => p.test(transcribedText))) {
          transcribedText = "";
        }
        
        return res.status(200).json({ text: transcribedText });
      }

      return res.status(statusCode).json(parsed);
    } catch (err) {
      console.error("ASR proxy error:", err);
      return res.status(502).json({ error: "An error occurred while processing the request." });
    }
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

  if (contentLength > MAX_TRANSLATE_BODY) {
    return res.status(413).json({ error: "Payload too large" });
  }

  const now = Date.now();
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  let timestamps = rateLimitMap.get(ip) || [];
  timestamps = timestamps.filter(t => t >= now - RATE_LIMIT_WINDOW);
  if (timestamps.length >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: "Too Many Requests" });
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);

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
    proxyReq.setTimeout(45000, () => { proxyReq.destroy(); reject(new Error("Translation request timed out")); });
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
