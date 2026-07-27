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
  "nvidia-megatron": {
    id: "nvidia/megatron-1b-nmt",
    name: "Megatron 1B NMT",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: true,
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
  "nvidia-deepseek": {
    id: "deepseek-ai/deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    provider: "DeepSeek",
    apiProvider: "nvidia",
    free: true,
  },
};

export const DEFAULT_MODEL = "nvidia-megatron";
