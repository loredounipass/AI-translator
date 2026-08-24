import languages from "../lib/languages.json";

// LENGUAJES DISPONIBLES Y POR DEFECTO
export const AVAILABLE_LANGUAGES = languages.data
export const DEFAULT_SOURCE_LANGUAGE = "en"
export const DEFAULT_TARGET_LANGUAGE = "es"


// INTERFAZ DE CONFIGURACIÓN DEL MODELO DE IA
export interface AIModel {
  id: string;
  name: string;
  provider: string;
  apiProvider: string;
  free: boolean;
  modelType: "chat" | "translation-only";
  temperature: number | null;
  topP: number | null;
  maxOutputTokensCap?: number;
  stream?: boolean;
}


// REGISTRO DE MODELOS DE IA DISPONIBLES
export const AI_MODELS: Record<string, AIModel> = {
  "nvidia-llama": {
    id: "meta/llama-3.1-8b-instruct",
    name: "Llama 3.1 8B",
    provider: "Meta",
    apiProvider: "nvidia",
    free: true,
    modelType: "chat",
    temperature: 0.2,
    topP: 0.9,
  },
  "nvidia-llama-3.2": {
    id: "meta/llama-3.2-3b-instruct",
    name: "Llama 3.2 3B",
    provider: "Meta",
    apiProvider: "nvidia",
    free: true,
    modelType: "chat",
    temperature: 0.2,
    topP: 0.7,
    maxOutputTokensCap: 1024,

  },
  "nvidia-nemotron": {
    id: "nvidia/nemotron-3-nano-30b-a3b",
    name: "Nemotron 3 Nano 30B (3B active)",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: true,
    modelType: "chat",
    temperature: 0.2,
    topP: 0.9,
  },
  "nvidia-nemotron-mini-4b": {
    id: "nvidia/nemotron-mini-4b-instruct",
    name: "Nemotron Mini 4B Instruct",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: true,
    modelType: "chat",
    temperature: 0.2,
    topP: 0.9,
    maxOutputTokensCap: 2048,
  },
  "mistral-nemotron": {
    id: "mistralai/mistral-nemotron",
    name: "Mistral Nemotron",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: true,
    modelType: "chat",
    temperature: 0.2,
    topP: 0.9,
    //maxOutputTokensCap: 4096,
  },
  "nvidia-gpt-oss": {
    id: "openai/gpt-oss-20b",
    name: "GPT-OSS 20B",
    provider: "OpenAI",
    apiProvider: "nvidia",
    free: true,
    modelType: "chat",
    temperature: 0.15,
    topP: 0.9,
    maxOutputTokensCap: 4096,
  },
  "nvidia-riva": {
    id: "nvidia/riva-translate-4b-instruct-v1.1",
    name: "Riva Translate 4B v1.1",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: false,
    modelType: "translation-only",
    temperature: 0.0,
    topP: 0.9,
    maxOutputTokensCap: 1024,
  },
  "nvidia-riva-v2": {
    id: "nvidia/riva-translate-4b-instruct-v2",
    name: "Riva Translate 4B v2",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: true,
    modelType: "translation-only",
    temperature: 0.0,
    topP: 0.9,
    maxOutputTokensCap: 1024,
  },
  "google-gemini-3-5-flash": {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "Google",
    apiProvider: "google",
    free: true,
    modelType: "chat",
    temperature: null,
    topP: null,
  },
  "google-gemini-3-1-pro": {
    id: "gemini-3.1-pro",
    name: "Gemini 3.1 Pro",
    provider: "Google",
    apiProvider: "google",
    free: false,
    modelType: "chat",
    temperature: null,
    topP: null,
  },
  "google-gemini-3-5-flash-lite": {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash-Lite",
    provider: "Google",
    apiProvider: "google",
    free: true,
    modelType: "chat",
    temperature: null,
    topP: null,
  },
  "openai-gpt-4o-mini": {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    apiProvider: "openai",
    free: false,
    modelType: "chat",
    temperature: 0.0,
    topP: 1.0,
  },
  "openai-gpt-4.1-nano": {
    id: "gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "OpenAI",
    apiProvider: "openai",
    free: false,
    modelType: "chat",
    temperature: 0.0,
    topP: 1.0,
  },
  "anthropic-claude-haiku-3-5": {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    provider: "Anthropic",
    apiProvider: "anthropic",
    free: false,
    modelType: "chat",
    temperature: 0.1,
    topP: null,
  },
  "anthropic-claude-sonnet-3-5": {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    apiProvider: "anthropic",
    free: false,
    modelType: "chat",
    temperature: 0.1,
    topP: null,
  },
  "qwen-2-5-7b-instruct": {
    id: "qwen/qwen2.5-7b-instruct",
    name: "Qwen 2.5 7B Instruct",
    provider: "Alibaba",
    apiProvider: "nvidia",
    free: true,
    modelType: "chat",
    temperature: 0.5,
    topP: 1,
    maxOutputTokensCap: 1024,
    stream: true,
  },
};


// MODELO POR DEFECTO
export const DEFAULT_MODEL = "nvidia-llama";