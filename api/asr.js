const https = require("https");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

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
    body += `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nnvidia/parakeet-1.1b-rnnt-multilingual-asr\r\n`;
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

    const { statusCode, raw } = await new Promise((resolve, reject) => {
      const proxyReq = https.request(options, (proxyRes) => {
        const chunks = [];
        proxyRes.on("data", (c) => chunks.push(c));
        proxyRes.on("end", () => {
          resolve({
            statusCode: proxyRes.statusCode,
            raw: Buffer.concat(chunks).toString(),
          });
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
