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
  "nvidia-nemotron": {
    id: "nvidia/nemotron-3-nano-30b-a3b",
    name: "Nemotron 3 Nano 30B (3B active)",
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
  "nvidia-riva-v2": {
    id: "nvidia/riva-translate-4b-instruct-v2",
    name: "Riva Translate 4B v2",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: true,
  },

  // "nvidia-deepseek": {
  //   id: "deepseek-ai/deepseek-v4-flash",
  //   name: "DeepSeek V4 Flash",
  //   provider: "DeepSeek",
  //   apiProvider: "nvidia",
  //   free: true,
  // },
  "nvidia-asr-parakeet": {
    id: "nvidia/parakeet-ctc-0.6b-es",
    name: "Parakeet CTC 0.6B ES (ASR)",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: false,
  },
};

export const DEFAULT_MODEL = "nvidia-nemotron";
