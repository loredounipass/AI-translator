const https = require("https");
const { Readable } = require("stream");

const allowedOrigins = [
  "https://interpreter1-sooty.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
];

function setCors(res, origin) {
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || "";
  setCors(res, origin);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const contentType = req.headers["content-type"] || "";
    let bodyObj;

    if (contentType.includes("application/json")) {
      bodyObj =
        typeof req.body === "string" && req.body.length > 0
          ? JSON.parse(req.body)
          : req.body && typeof req.body === "object"
          ? req.body
          : null;
    } else if (contentType.includes("multipart/form-data")) {
      const boundary = contentType.includes("boundary=") ? contentType.split("boundary=")[1].split(";")[0] : null;
      if (boundary) {
        const raw = req.body || "";
        const parts = raw.split("--" + boundary);
        bodyObj = { apiKey: "", audio: "", language: "multi", mime: "audio/wav" };
        for (const part of parts) {
          if (part.includes('name="apiKey"')) {
            const m = part.match(/name="apiKey"(?:[^]*?)\r\n\r\n([^\r\n]*)/);
            if (m) bodyObj.apiKey = m[1];
          } else if (part.includes('name="audio"')) {
            const m = part.match(/name="audio"(?:[^]*?)\r\n\r\n([^\r\n]*)/);
            if (m) bodyObj.audio = m[1];
          } else if (part.includes('name="language"')) {
            const m = part.match(/name="language"(?:[^]*?)\r\n\r\n([^\r\n]*)/);
            if (m) bodyObj.language = m[1];
          } else if (part.includes('name="mime"')) {
            const m = part.match(/name="mime"(?:[^]*?)\r\n\r\n([^\r\n]*)/);
            if (m) bodyObj.mime = m[1];
          }
        }
      }
    }

    if (!bodyObj) {
      return res.status(400).json({ error: "Unable to parse request body" });
    }

    bodyObj._type = "asr";

    console.log("[asr] Forwarding ASR request to completions handler, mime:", bodyObj.mime || "not set");

    const provider = "nvidia";
    if (!bodyObj.apiKey) {
      return res.status(401).json({ error: "NVIDIA API key requerida para ASR" });
    }

    const { audio, language, mime } = bodyObj;
    if (!audio) {
      return res.status(400).json({ error: "audio (base64) es requerido" });
    }

    const audioBuffer = Buffer.from(audio, "base64");
    const boundary = "----ASR" + Date.now().toString(36);
    const lang = language || "multi";
    const contentType = mime || "audio/wav";
    const ext = contentType.includes("webm") ? "webm" : contentType.includes("ogg") ? "ogg" : "wav";

    let body = "";
    body += `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nnvidia/parakeet-1.1b-rnnt-multilingual-asr\r\n`;
    body += `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${lang}\r\n`;
    body += `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${ext}"\r\nContent-Type: ${contentType}\r\n\r\n`;
    const bodyBuffer = Buffer.concat([Buffer.from(body, "utf-8"), audioBuffer, Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8")]);

    const options = {
      hostname: "integrate.api.nvidia.com",
      path: "/v1/audio/transcriptions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${bodyObj.apiKey}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": bodyBuffer.length,
      },
    };

    const { statusCode, raw } = await new Promise((resolve, reject) => {
      const proxyReq = https.request(options, (proxyRes) => {
        const chunks = [];
        proxyRes.on("data", (c) => chunks.push(c));
        proxyRes.on("end", () => {
          resolve({ statusCode: proxyRes.statusCode, raw: Buffer.concat(chunks).toString() });
        });
      });
      proxyReq.on("error", reject);
      proxyReq.setTimeout(15000, () => {
        proxyReq.destroy();
        reject(new Error("ASR request timed out"));
      });
      proxyReq.end(bodyBuffer);
    });

    try {
      return res.status(statusCode).json(JSON.parse(raw));
    } catch {
      return res.status(statusCode).send(raw);
    }
  } catch (err) {
    return res.status(502).json({ error: "ASR proxy error: " + (err instanceof Error ? err.message : String(err)) });
  }
};