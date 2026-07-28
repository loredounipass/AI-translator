const https = require("https");

const TARGET_HOST = "integrate.api.nvidia.com";
const TARGET_PATH = "/v1";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = req.body?.apiKey;
  if (!apiKey) {
    return res.status(401).json({ error: "API key requerida para MiniMax" });
  }

  const cleanBody = { ...req.body };
  delete cleanBody.apiKey;
  delete cleanBody.provider;

  const isStreaming = cleanBody.stream === true;
  const bodyStr = JSON.stringify(cleanBody);

  const options = {
    hostname: TARGET_HOST,
    path: TARGET_PATH,
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(bodyStr),
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    if (isStreaming) {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    } else {
      const chunks = [];
      proxyRes.on("data", (chunk) => chunks.push(chunk));
      proxyRes.on("end", () => {
        const data = Buffer.concat(chunks);
        try {
          res.status(proxyRes.statusCode).json(JSON.parse(data.toString()));
        } catch {
          res.status(proxyRes.statusCode).send(data.toString());
        }
      });
    }
  });

  proxyReq.on("error", () => {
    if (!res.headersSent) res.status(500).json({ error: "MiniMax proxy error" });
  });

  proxyReq.end(bodyStr);
};
