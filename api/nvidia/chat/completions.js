const translationHandler = require("../../_utils/translationHandler");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Preserve the debug logs from the original file
  const apiKey = (req.body && req.body.apiKey) || "";
  console.log("[completions] Request received, apiKey present:", !!apiKey, "stream:", req.body?.stream);
  
  if (!apiKey) {
    console.log("[completions] Missing apiKey in request body");
    return res.status(401).json({ error: "API key requerida — proporciona tu propia key de NVIDIA" });
  }

  // Enforce NVIDIA provider configuration for this specific endpoint
  if (req.body) {
    req.body.provider = "nvidia";
  }

  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  
  // Route to the global decoupled translation handler
  return translationHandler(req, res, contentLength);
};
