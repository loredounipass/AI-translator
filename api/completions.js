const { allowedOrigins } = require("./_utils/config");
const asrHandler = require("./_utils/asrHandler");
const translationHandler = require("./_utils/translationHandler");

module.exports = async (req, res) => {
  const origin = req.headers.origin || "";
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    // Explicitly deny wildcard
    res.setHeader("Access-Control-Allow-Origin", "https://interpreter000-sooty.vercel.app");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const contentLength = parseInt(req.headers['content-length'] || '0', 10);

  if (req.body && req.body._type === "asr") {
    return asrHandler(req, res, contentLength);
  } else {
    return translationHandler(req, res, contentLength);
  }
};
