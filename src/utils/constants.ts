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
}

export const AI_MODELS: Record<string, AIModel> = {
  "nvidia-llama": {
    id: "meta/llama-3.1-8b-instruct",
    name: "Llama 3.1 8B",
    provider: "Meta",
    apiProvider: "nvidia",
    free: true,
  },
  "nvidia-llama-3.2": {
    id: "meta/llama-3.2-3b-instruct",
    name: "Llama 3.2 3B",
    provider: "Meta",
    apiProvider: "nvidia",
    free: true,
  },

  "nvidia-muse-glimmer-30b": {
    id: "nvidia/muse-glimmer-30b",
    name: "Muse Glimmer 30B",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: true,
  },


  "nvidia-nemotron": {
    id: "nvidia/nemotron-3-nano-30b-a3b",
    name: "Nemotron 3 Nano 30B (3B active)",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: true,
  },
  "nvidia-nemotron-mini-4b": {
    id: "nvidia/nemotron-mini-4b-instruct",
    name: "Nemotron Mini 4B Instruct",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: true,
  },

  "nvidia-nemotron-3.5-lightning-30b-a3b": {
    id: "nvidia/nemotron-3.5-lightning-30b-a3b",
    name: "Nemotron 3.5 Lightning 30B (3B active)",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: true,
  },

  "nvidia-nemotron-4-pro-46b-a3b": {
    id: "nvidia/nemotron-4-pro-46b-a3b",
    name: "Nemotron 4 Pro 46B (3B active)",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: false,
  },

  "nvidia-gpt-oss": {
    id: "openai/gpt-oss-20b",
    name: "GPT-OSS 20B",
    provider: "OpenAI",
    apiProvider: "nvidia",
    free: true,
  },
  "nvidia-riva": {
    id: "nvidia/riva-translate-4b-instruct-v1.1",
    name: "Riva Translate 4B v1.1",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: false,
  },
  "nvidia-riva-v2": {
    id: "nvidia/riva-translate-4b-instruct-v2",
    name: "Riva Translate 4B v2",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: true,
  },
  "google-gemini-3-5-flash": {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "Google",
    apiProvider: "google",
    free: true,
  },
  "google-gemini-3-1-pro": {
    id: "gemini-3.1-pro",
    name: "Gemini 3.1 Pro",
    provider: "Google",
    apiProvider: "google",
    free: false,
  },
  "google-gemini-3-5-flash-lite": {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash-Lite",
    provider: "Google",
    apiProvider: "google",
    free: true,
  },
  "openai-gpt-4o-mini": {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    apiProvider: "openai",
    free: false,
  },
  "openai-gpt-4.1-nano": {
    id: "gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "OpenAI",
    apiProvider: "openai",
    free: false,
  },
  "anthropic-claude-haiku-3-5": {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    provider: "Anthropic",
    apiProvider: "anthropic",
    free: false,
  },
  "anthropic-claude-sonnet-3-5": {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    apiProvider: "anthropic",
    free: false,
  },
};

export const DEFAULT_MODEL = "nvidia-nemotron";
