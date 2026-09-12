const allowedOrigins = [
  "https://ai-translator-lovat-three.vercel.app",
  "https://interpreter1-sooty.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
];

const PROVIDERS = {
  nvidia: {
    hostname: "integrate.api.nvidia.com",
    path: "/v1/chat/completions",
    authHeader: (key) => `Bearer ${key}`,
    authHeaderName: "Authorization",
  },
  openai: {
    hostname: "api.openai.com",
    path: "/v1/chat/completions",
    authHeader: (key) => `Bearer ${key}`,
    authHeaderName: "Authorization",
  },
  anthropic: {
    hostname: "api.anthropic.com",
    path: "/v1/messages",
    authHeader: (key) => key,
    authHeaderName: "x-api-key",
    extraHeaders: { "anthropic-version": "2023-06-01" },
  },
  google: {
    hostname: "generativelanguage.googleapis.com",
    path: "/v1beta/openai/chat/completions",
    authHeader: (key) => `Bearer ${key}`,
    authHeaderName: "Authorization",
  },
  qwen_local: {
    hostname: "cuddly-winner-pjqq9q54wrv6f7q7w-8000.app.github.dev",
    path: "/v1/chat/completions",
    authHeader: (key) => `Bearer ${key || "dummy-key"}`,
    authHeaderName: "Authorization",
  },
  phi_local: {
    hostname: "cuddly-winner-pjqq9q54wrv6f7q7w-8001.app.github.dev",
    path: "/v1/chat/completions",
    authHeader: (key) => `Bearer ${key || "dummy-key"}`,
    authHeaderName: "Authorization",
  },
  mistral_local: {
    hostname: "cuddly-winner-pjqq9q54wrv6f7q7w-8001.app.github.dev",
    path: "/v1/chat/completions",
    authHeader: (key) => `Bearer ${key || "dummy-key"}`,
    authHeaderName: "Authorization",
  },
  local: {
    hostname: "cuddly-winner-pjqq9q54wrv6f7q7w-8000.app.github.dev",
    path: "/v1/chat/completions",
    authHeader: (key) => `Bearer ${key || "dummy-key"}`,
    authHeaderName: "Authorization",
  },
};

const MAX_ASR_BODY = 15 * 1024 * 1024;   // 15MB
const MAX_TRANSLATE_BODY = 100 * 1024;    // 100KB

module.exports = {
  allowedOrigins,
  PROVIDERS,
  MAX_ASR_BODY,
  MAX_TRANSLATE_BODY,
};
