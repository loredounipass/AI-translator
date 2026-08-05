const express = require("express");
const path = require("path");

// Cargar manejador centralizado de Vercel
const completionsHandler = require(path.join(__dirname, "../api/completions"));

module.exports = function (app) {
  // Configurar límite alto para payload de ASR (audio base64)
  app.use(express.json({ limit: "15mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  const proxyCompletions = async (req, res) => {
    try {
      await completionsHandler(req, res);
    } catch (err) {
      console.error("Local proxy error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Local proxy error" });
      }
    }
  };

  app.post("/api/completions", proxyCompletions);
  app.post("/api/nvidia/chat/completions", proxyCompletions);
};
