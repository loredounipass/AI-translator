

const https = require("https");
const crypto = require("crypto");

// 1. In-memory Cache
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000;
const cache = new Map();

// 2. Request Coalescing
const pendingRequests = new Map();

// 3. Rate Limiter
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW = 60000;
const rateLimitMap = new Map();
let requestCounter = 0;

const generateCacheKey = (bodyStr, apiKey = "") => {
  return crypto.createHash("sha256").update((bodyStr || "") + apiKey).digest("hex");
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
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const validTimestamps = timestamps.filter(t => t >= now - RATE_LIMIT_WINDOW);
    if (validTimestamps.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, validTimestamps);
    }
  }
};

module.exports = function (app) {

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  app.use(async (req, res, next) => {
    if (!req.url.startsWith("/api/nvidia") && !req.url.startsWith("/api/completions")) {
      return next();
    }

    const MAX_ASR_BODY = 15 * 1024 * 1024;
    const MAX_TRANSLATE_BODY = 100 * 1024;
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    
    // --- Rate Limiting ---
    const now = Date.now();
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    let timestamps = rateLimitMap.get(ip) || [];
    timestamps = timestamps.filter(t => t >= now - RATE_LIMIT_WINDOW);
    if (timestamps.length >= RATE_LIMIT_MAX) {
      return res.status(429).json({ error: "Too Many Requests" });
    }
    timestamps.push(now);
    rateLimitMap.set(ip, timestamps);

    const processRequest = async (bodyBuffer) => {
      const bodyStr = bodyBuffer.toString();

      let apiKey = "";
      let cleanBody = bodyStr;
      let isAsr = false;
      let parsedBody = null;
      try {
        parsedBody = JSON.parse(bodyStr);
        apiKey = parsedBody.apiKey || "";
        isAsr = parsedBody._type === "asr";
        
        if (apiKey) {
          const { apiKey: _, ...rest } = parsedBody;
          cleanBody = JSON.stringify(rest);
        }
      } catch (e) {
        // Ignored
      }

      if (!apiKey) {
        res.status(401).json({ error: "API key requerida" });
        return;
      }

      if (isAsr && parsedBody) {
        if (contentLength > MAX_ASR_BODY) {
          return res.status(413).json({ error: "Payload too large" });
        }
        
        const ALLOWED_ASR_MODELS = new Set(['nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', 'nvidia/canary-1b-asr']);
        const model = ALLOWED_ASR_MODELS.has(parsedBody.model) ? parsedBody.model : "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";
        
        const { audio, language, mime } = parsedBody;
        if (!audio) return res.status(400).json({ error: "audio is required" });
        
        const lang = language || "multi";
        const cleanContentType = (mime || "audio/wav").split(';')[0];
        
        const langInstruction = lang === "multi" ? "Detect the spoken language automatically." : `The spoken language is ${lang}.`;
        
        const contextInstruction = `\nCONTEXT ABOUT THE USER'S JOB (FOR YOUR UNDERSTANDING ONLY):\nThe user you are assisting is a professional over-the-phone interpreter. Their job involves strict training where they must interpret in the 1st person, maintain neutrality, and not break character or assist the parties directly. They use specific 3rd person phrases (e.g. "The interpreter needs repetition") only when necessary.\n\nThat is the USER'S job. YOUR ROLE AS THE AI is to transcribe the text exactly as spoken to help them. You MUST NOT try to do the user's job or intervene in the scenarios.`;

        cleanBody = JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: `You are a highly precise speech-to-text transcription engine.
Your ONLY task is to transcribe the audio exactly as spoken.
${langInstruction}${contextInstruction}

CRITICAL RULES:
1. Output ONLY the transcribed text.
2. NO explanations, NO formatting (no markdown, no bold), NO quotes around the text.
3. DO NOT add any conversational filler.
4. If there is no speech, return an empty string.`
            },
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
      }


      if (!apiKey) {
        res.status(401).json({ error: "API key requerida — proporciona tu propia key de NVIDIA" });
        return;
      }
      
      if (!isAsr && contentLength > MAX_TRANSLATE_BODY) {
        return res.status(413).json({ error: "Payload too large" });
      }

      const cacheKey = generateCacheKey(cleanBody, apiKey);
      
      let isStreaming = false;
      try {
        const parsedBody = JSON.parse(cleanBody);
        isStreaming = parsedBody.stream === true;
      } catch (e) {
        // Ignored
      }
      
      requestCounter++;
      if (requestCounter % 50 === 0) {
        cleanupCache();
      }
      
      if (!isStreaming) {
        // Return from Cache
        if (cache.has(cacheKey)) {
          const cachedResponse = cache.get(cacheKey);
          res.status(cachedResponse.statusCode).json(cachedResponse.data);
          return;
        }

        // Wait for Pending Request (Coalescing)
        if (pendingRequests.has(cacheKey)) {
          try {
            const response = await pendingRequests.get(cacheKey);
            res.status(response.statusCode).json(response.data);
          } catch {
            res.status(500).json({ error: "Coalesced request failed" });
          }
          return;
        }
      }

      if (req.url !== "/api/nvidia/chat/completions" && req.url !== "/api/completions") {
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
          const safeHeaders = {};
          const allowedHeaders = ['content-type', 'cache-control', 'transfer-encoding', 'content-encoding'];
          for (const key of allowedHeaders) {
            if (proxyRes.headers[key]) safeHeaders[key] = proxyRes.headers[key];
          }
          // Ensure it's treated as SSE
          safeHeaders['Cache-Control'] = 'no-cache';
          safeHeaders['Connection'] = 'keep-alive';
          
          res.writeHead(proxyRes.statusCode, safeHeaders);
          proxyRes.pipe(res);
        });

        proxyReq.on("error", () => {
          if (!res.headersSent) {
            res.status(502).json({ error: "Proxy streaming error" });
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
                
                if (isAsr && data.choices && data.choices[0]) {
                  let transcribed = (data.choices[0].message?.content || "").trim();
                  
                  // Filter out AI meta-commentary
                  const metaPatterns = [
                    /^we need to/i, /^the user gave/i, /^there'?s no speech/i,
                    /^no (?:speech|audio|sound)/i, /return empty string/i,
                    /not provided/i, /no audio content/i, /no transcri/i,
                    /I (?:can'?t|cannot|don'?t) (?:hear|detect|find)/i,
                    /the audio (?:is|appears|seems) (?:empty|silent|blank)/i,
                  ];
                  if (metaPatterns.some(p => p.test(transcribed))) transcribed = "";
                  
                  data = { text: transcribed };
                }
                
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
        proxyReq.setTimeout(45000, () => { proxyReq.destroy(); reject(new Error("Translation request timed out")); });
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
      processRequest(Buffer.from(JSON.stringify(req.body)));
    } else {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        processRequest(Buffer.concat(chunks));
      });
    }
  });
};
