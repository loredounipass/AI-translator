import languages from "../lib/languages.json";

export const AVAILABLE_LANGUAGES = languages.data
export const DEFAULT_SOURCE_LANGUAGE = "en"
export const DEFAULT_TARGET_LANGUAGE = "es"

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  apiProvider: string;
  free: boolean;
  /** Sampling temperature. null = omit from request (e.g. Gemini 3.x deprecated params). */
  temperature: number | null;
  /** Nucleus sampling top_p. null = omit from request (e.g. Anthropic, Gemini). */
  topP: number | null;
  /** Hard cap on max output tokens for models with small context windows. */
  maxOutputTokensCap?: number;
}

export const AI_MODELS: Record<string, AIModel> = {
  // ── NVIDIA (via integrate.api.nvidia.com) ──────────────────────────
  "nvidia-llama": {
    id: "meta/llama-3.1-8b-instruct",
    name: "Llama 3.1 8B",
    provider: "Meta",
    apiProvider: "nvidia",
    free: true,
    temperature: 0.1,
    topP: 0.9,
  },
  "nvidia-llama-3.2": {
    id: "meta/llama-3.2-3b-instruct",
    name: "Llama 3.2 3B",
    provider: "Meta",
    apiProvider: "nvidia",
    free: true,
    temperature: 0.1,
    topP: 0.9,
  },
  "nvidia-nemotron": {
    id: "nvidia/nemotron-3-nano-30b-a3b",
    name: "Nemotron 3 Nano 30B (3B active)",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: true,
    temperature: 0.2,
    topP: 0.9,
  },
  "nvidia-nemotron-mini-4b": {
    id: "nvidia/nemotron-mini-4b-instruct",
    name: "Nemotron Mini 4B Instruct",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: true,
    temperature: 0.2,
    topP: 0.9,
    maxOutputTokensCap: 2048, // 4096-token context window
  },
  "nvidia-gpt-oss": {
    id: "openai/gpt-oss-20b",
    name: "GPT-OSS 20B",
    provider: "OpenAI",
    apiProvider: "nvidia",
    free: true,
    temperature: 0.15,
    topP: 0.9,
  },
  "nvidia-riva": {
    id: "nvidia/riva-translate-4b-instruct-v1.1",
    name: "Riva Translate 4B v1.1",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: false,
    temperature: 0.0,
    topP: 0.9,
    maxOutputTokensCap: 1024, // Translation-specialized; 8K context
  },
  "nvidia-riva-v2": {
    id: "nvidia/riva-translate-4b-instruct-v2",
    name: "Riva Translate 4B v2",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: true,
    temperature: 0.0,
    topP: 0.9,
    maxOutputTokensCap: 1024, // Translation-specialized; 8K context
  },

  // ── Google (via generativelanguage.googleapis.com) ─────────────────
  // Gemini 3.x: temperature/top_p/top_k officially deprecated — must omit
  "google-gemini-3-5-flash": {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "Google",
    apiProvider: "google",
    free: true,
    temperature: null,
    topP: null,
  },
  "google-gemini-3-1-pro": {
    id: "gemini-3.1-pro",
    name: "Gemini 3.1 Pro",
    provider: "Google",
    apiProvider: "google",
    free: false,
    temperature: null,
    topP: null,
  },
  "google-gemini-3-5-flash-lite": {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash-Lite",
    provider: "Google",
    apiProvider: "google",
    free: true,
    temperature: null,
    topP: null,
  },

  // ── OpenAI (via api.openai.com) ───────────────────────────────────
  "openai-gpt-4o-mini": {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    apiProvider: "openai",
    free: false,
    temperature: 0.0,
    topP: 1.0,
  },
  "openai-gpt-4.1-nano": {
    id: "gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "OpenAI",
    apiProvider: "openai",
    free: false,
    temperature: 0.0,
    topP: 1.0,
  },

  // ── Anthropic (via api.anthropic.com) ─────────────────────────────
  // Anthropic: do NOT use temperature + top_p simultaneously — omit top_p
  "anthropic-claude-haiku-3-5": {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    provider: "Anthropic",
    apiProvider: "anthropic",
    free: false,
    temperature: 0.1,
    topP: null, // Anthropic advises against using both
  },
  "anthropic-claude-sonnet-3-5": {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    apiProvider: "anthropic",
    free: false,
    temperature: 0.1,
    topP: null, // Anthropic advises against using both
  },
};

export const DEFAULT_MODEL = "nvidia-nemotron";
