const https = require("https");

const allowedOrigins = [
  "https://interpreter1-sooty.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
];

module.exports = async (req, res) => {
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
      return res.status(200).end();
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const contentType = req.headers['content-type'] || "";
    let apiKey = "";
    let audio = "";
    let language = "multi";

    if (contentType.includes('application/json')) {
      try {
        const body = JSON.parse(req.body);
        apiKey = body.apiKey || "";
        audio = body.audio || "";
        language = body.language || "multi";
      } catch (e) {
        return res.status(400).json({ error: "Invalid JSON body" });
      }
    } else if (contentType.includes('multipart/form-data')) {
      const boundary = contentType.includes('boundary=') 
        ? contentType.split('boundary=')[1].split(';')[0]
        : `----ASR${Date.now().toString(36)}`;

      const parts = req.body.split(`\r\n`);
      let inSection = null;
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].includes('Content-Disposition:')) {
          if (parts[i].includes('name="apiKey"')) inSection = 'apiKey';
          else if (parts[i].includes('name="audio"')) inSection = 'audio';
          else if (parts[i].includes('name="language"')) inSection = 'language';
          else inSection = null;
        } else if (inSection) {
          if (inSection === 'apiKey') apiKey = parts[i];
          else if (inSection === 'audio') audio = parts[i];
          else if (inSection === 'language') language = parts[i];
          inSection = null;
        }
      }
    } else {
      return res.status(400).json({ error: "Unsupported content-type: " + contentType });
    }

    if (!apiKey) {
      return res.status(401).json({ error: "NVIDIA API key requerida para ASR" });
    }

    if (!audio) {
      return res.status(400).json({ error: "audio es requerido" });
    }

    const lang = language || "multi";

    const audioBuffer = Buffer.from(audio, "base64");
    const boundary = "----ASR" + Date.now().toString(36);

    let body = "";
    body += `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nnvidia/parakeet-1.1b-rnnt-multilingual-asr\r\n`;
    body += `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${lang}\r\n`;
    body += `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n`;
    const bodyBuffer = Buffer.concat([
      Buffer.from(body, "utf-8"),
      audioBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n", "utf-8"),
    ]);

    const options = {
      hostname: "integrate.api.nvidia.com",
      path: "/v1/audio/transcriptions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": bodyBuffer.length,
        "User-Agent": "Mozilla/5.0 (compatible; AI-translator/1.0)",
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
      proxyReq.setTimeout(15000, () => { proxyReq.destroy(); reject(new Error("ASR request timed out")); });
      proxyReq.end(bodyBuffer);
    });

    try { return res.status(statusCode).json(JSON.parse(raw)); }
    catch { return res.status(statusCode).send(raw); }
  } catch (err) {
    return res.status(502).json({ error: "ASR proxy error: " + (err instanceof Error ? err.message : String(err)) });
  }
};
