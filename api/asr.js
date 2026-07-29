const https = require("https");

const allowedOrigins = [
  "https://interpreter1-sooty.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
];

module.exports = async (req, res) => {
  const requestId = "req-" + Date.now().toString(36);
  console.log(`[${requestId}] ===== ASR Request Received =====`);
  console.log(`[${requestId}] Method:`, req.method);
  console.log(`[${requestId}] Content-Type:`, req.headers["content-type"] || "not set");
  console.log(`[${requestId}] Origin:`, req.headers.origin || "not set");

  try {
    const origin = req.headers.origin || "";
    if (allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else if (origin) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      console.log(`[${requestId}] OPTIONS preflight — returning 200`);
      return res.status(200).end();
    }

    if (req.method !== "POST") {
      console.log(`[${requestId}] Method not allowed:`, req.method);
      return res.status(405).json({ error: "Method not allowed" });
    }

    const contentType = req.headers["content-type"] || "";
    let apiKey = "";
    let audio = "";
    let language = "multi";

    console.log(`[${requestId}] Content-Type:`, contentType);

    if (contentType.includes("application/json")) {
      console.log(`[${requestId}] Parsing JSON body`);
      try {
        let body;
        if (typeof req.body === "string") {
          console.log(`[${requestId}] req.body is a string, parsing JSON...`);
          body = JSON.parse(req.body);
        } else if (req.body && typeof req.body === "object") {
          console.log(`[${requestId}] req.body is already a parsed object`);
          body = req.body;
        } else {
          console.log(`[${requestId}] ERROR: req.body is empty/undefined/null`);
          return res.status(400).json({ error: "Empty request body" });
        }
        console.log(`[${requestId}] Parsed body keys:`, Object.keys(body));
        apiKey = body.apiKey || "";
        audio = body.audio || "";
        language = body.language || "multi";
        console.log(`[${requestId}] apiKey present:`, !!apiKey, "audio present:", !!audio, "language:", language);
      } catch (e) {
        console.error(`[${requestId}] ERROR parsing JSON body:`, e.message);
        return res.status(400).json({ error: "Invalid JSON body: " + e.message });
      }
    } else {
      console.log(`[${requestId}] Non-JSON content-type, trying fallback form-data parsing`);
      const boundary = contentType.includes("boundary=")
        ? contentType.split("boundary=")[1].split(";")[0]
        : null;

      if (!boundary) {
        console.log(`[${requestId}] ERROR: No boundary found in content-type`);
        return res.status(400).json({ error: "Unsupported content-type and no boundary found" });
      }

      const body = req.body || "";
      const parts = body.split("--" + boundary);
      console.log(`[${requestId}] Form-data parts found:`, parts.length);

      for (const part of parts) {
        if (part.includes('name="apiKey"')) {
          const match = part.match(/name="apiKey"(?:[^]*?)\r\n\r\n([^\r\n]*)/);
          if (match) apiKey = match[1];
        } else if (part.includes('name="audio"')) {
          const match = part.match(/name="audio"(?:[^]*?)\r\n\r\n([^\r\n]*)/);
          if (match) audio = match[1];
        } else if (part.includes('name="language"')) {
          const match = part.match(/name="language"(?:[^]*?)\r\n\r\n([^\r\n]*)/);
          if (match) language = match[1];
        }
      }
      console.log(`[${requestId}] After form-data parse: apiKey=${!!apiKey}, audio=${!!audio}, language=${language}`);
    }

    if (!apiKey) {
      console.log(`[${requestId}] ERROR: No API key provided`);
      return res.status(401).json({ error: "NVIDIA API key requerida para ASR" });
    }
    console.log(`[${requestId}] API key present: true (first 8 chars: ${apiKey.substring(0, 8)})`);

    if (!audio) {
      console.log(`[${requestId}] ERROR: No audio data provided`);
      return res.status(400).json({ error: "audio es requerido" });
    }
    console.log(`[${requestId}] Audio data present: true, length:`, audio.length);

    const lang = language || "multi";
    console.log(`[${requestId}] Language:`, lang);

    console.log(`[${requestId}] Decoding base64 audio...`);
    let audioBuffer;
    try {
      audioBuffer = Buffer.from(audio, "base64");
      console.log(`[${requestId}] Audio buffer size:`, audioBuffer.length, "bytes");
    } catch (e) {
      console.error(`[${requestId}] ERROR decoding base64 audio:`, e.message);
      return res.status(400).json({ error: "Unable to decode audio data: " + e.message });
    }

    const boundary = "----ASR" + Date.now().toString(36);
    console.log(`[${requestId}] Building multipart request to NVIDIA with boundary:`, boundary);

    const headers = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="model"',
      "",
      "nvidia/parakeet-1.1b-rnnt-multilingual-asr",
      `--${boundary}`,
      'Content-Disposition: form-data; name="language"',
      "",
      lang,
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="audio.wav"',
      "Content-Type: audio/wav",
      "",
    ].join("\r\n");

    const closing = `\r\n--${boundary}--\r\n`;
    const bodyBuffer = Buffer.concat([Buffer.from(headers, "utf-8"), audioBuffer, Buffer.from(closing, "utf-8")]);
    console.log(`[${requestId}] Multipart body total size:`, bodyBuffer.length);

    const options = {
      hostname: "integrate.api.nvidia.com",
      path: "/v1/audio/transcriptions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": bodyBuffer.length,
        "User-Agent": "AI-translator/1.0",
      },
    };

    console.log(`[${requestId}] Sending request to NVIDIA API...`);
    const { statusCode, raw } = await new Promise((resolve, reject) => {
      const proxyReq = https.request(options, (proxyRes) => {
        console.log(`[${requestId}] NVIDIA API response status:`, proxyRes.statusCode);
        const chunks = [];
        proxyRes.on("data", (c) => chunks.push(c));
        proxyRes.on("end", () => {
          const rawStr = Buffer.concat(chunks).toString();
          console.log(`[${requestId}] NVIDIA response raw (first 500):`, rawStr.substring(0, 500));
          resolve({ statusCode: proxyRes.statusCode, raw: rawStr });
        });
      });
      proxyReq.on("error", (err) => {
        console.error(`[${requestId}] NVIDIA request error:`, err.message);
        reject(err);
      });
      proxyReq.setTimeout(15000, () => {
        proxyReq.destroy();
        reject(new Error("ASR request timed out"));
      });
      proxyReq.end(bodyBuffer);
    });

    console.log(`[${requestId}] NVIDIA API status:`, statusCode);
    console.log(`[${requestId}] Attempting JSON parse of NVIDIA response...`);

    try {
      const jsonData = JSON.parse(raw);
      console.log(`[${requestId}] JSON parsed successfully. Keys:`, Object.keys(jsonData));
      return res.status(statusCode).json(jsonData);
    } catch (e) {
      console.error(`[${requestId}] ERROR: NVIDIA response is not valid JSON:`, raw.substring(0, 500));
      return res.status(statusCode).send(raw);
    }
  } catch (err) {
    console.error(`[${requestId}] UNCAUGHT ERROR in ASR handler:`, err.message);
    console.error(`[${requestId}] Stack:`, err.stack);
    return res.status(502).json({ error: "ASR proxy error: " + (err instanceof Error ? err.message : String(err)) });
  }
};