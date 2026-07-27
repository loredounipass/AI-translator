module.exports = async (req, res) => {
  console.log("[health] Health check called, method:", req.method);
  res.status(200).json({ status: "ok", timestamp: Date.now() });
};
