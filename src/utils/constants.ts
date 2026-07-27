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
  "nvidia-nemotron": {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    name: "Nemotron 3 Nano Omni",
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
  "nvidia-mistral": {
    id: "mistralai/mistral-medium-3.5-128b",
    name: "Mistral Medium 3.5 128B",
    provider: "Mistral AI",
    apiProvider: "nvidia",
    free: true,
  },
  "nvidia-deepseek": {
    id: "deepseek-ai/deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    provider: "DeepSeek",
    apiProvider: "nvidia",
    free: true,
  },
};

export const DEFAULT_MODEL = "nvidia-deepseek";
