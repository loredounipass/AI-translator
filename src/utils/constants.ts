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
  // Pensador (thinker) o instruct instantaneo. Fuente de verdad para el badge de la UI
  // y para isReasoningModel (presupuesto/timeout/retries). Explicito por modelo porque
  // la heuristica del id falla con Nemotron Bolt (instruct pese a llevar "nemotron").
  reasoning?: boolean;
  temperature?: number | null;
  topP?: number | null;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  maxOutputTokensCap?: number;
  // Esfuerzo de razonamiento para modelos que razonan (flat param reasoning_effort).
  // Opt-in: solo se envia a la API si el modelo lo declara. Verificado en muse-glimmer:
  // "low" recorta el thinking ~2.3x (340->150 tokens) manteniendo el razonamiento.
  reasoningEffort?: "low" | "medium" | "high";
  stream?: boolean;
}


// REGISTRO DE MODELOS DE IA DISPONIBLES
export const AI_MODELS: Record<string, AIModel> = {
  "nvidia-diffusiongemma": {
    id: "google/diffusiongemma-26b-a4b-it",
    name: "DiffusionGemma 26B A4B IT",
    provider: "Google",
    apiProvider: "nvidia",
    free: true,
    modelType: "chat",
    reasoning: false,
    temperature: 1,
    topP: 0.95,
    maxInputTokens: 32000,
    maxOutputTokens: 42000,
    maxOutputTokensCap: 42000,
    stream: true,
  },
  "nvidia-nemotron-3-5-lightning": {
    id: "nvidia/nemotron-3.5-lightning-30b-a3b",
    name: "Nemotron 3.5 Lightning 30B",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: true,
    modelType: "chat",
    reasoning: true,
    temperature: 0.7,
    topP: 0.9,
    maxInputTokens: 32000,
    maxOutputTokens: 42000,
    // Verificado: low reduce el thinking ~2.2x (high=880 -> low=394 tokens) y se honra.
    reasoningEffort: "low",
    stream: true,
  },
  // Nemotron Bolt: instruct instantaneo (reasoning:false en el spec original), no hace
  // thinking oculto. Se omiten el timeout (180 s) del spec: aqui es adaptativo
  // (getAdaptiveTimeout) segun largo del texto. max_tokens 32768 -> maxOutputTokens.
  "nvidia-nemotron-bolt": {
    id: "nvidia/nemotron-3.5-bolt-e4b",
    name: "Nemotron 3.5 Bolt E4B",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: true,
    modelType: "chat",
    reasoning: false,
    temperature: 1.0,
    topP: 0.95,
    maxInputTokens: 32000,
    maxOutputTokens: 32768,
    maxOutputTokensCap: 32768,
    stream: true,
  },
  "nvidia-nemotron-omni": {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    name: "Nemotron Omni 30B",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: true,
    modelType: "chat",
    reasoning: true,
    temperature: 0.6,
    topP: 0.9,
    maxInputTokens: 32000,
    maxOutputTokens: 42000,
    // Omni es el de mayor latencia (40-98 s) por su thinking largo. "low" es aceptado
    // (HTTP 200) y acota la cadena de razonamiento en textos largos (intent de latencia).
    reasoningEffort: "low",
    stream: true,
  },
  "nvidia-nemotron-3-ultra": {
    id: "nvidia/nemotron-3-ultra-550b-a55b",
    name: "Nemotron 3 Ultra 550B",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: true,
    modelType: "chat",
    reasoning: true,
    temperature: 0.5,
    topP: 0.9,
    maxInputTokens: 32000,
    maxOutputTokens: 42000,
    stream: true,
  },

  "nvidia-riva-v2": {
    id: "nvidia/riva-translate-4b-instruct-v2",
    name: "Riva Translate 4B v2",
    provider: "NVIDIA",
    apiProvider: "nvidia",
    free: true,
    modelType: "translation-only",
    reasoning: false,
    temperature: 0.0,
    topP: 0.9,
    // Riva tiene ventana TOTAL de 8192 tokens: max_tokens debe ser menor que el total
    // (probado: con 42000 -> HTTP 400 "cannot be greater than max_total_tokens=8192").
    maxInputTokens: 8192,
    maxOutputTokens: 4096,
    maxOutputTokensCap: 4096,
    stream: false,
  },
  // Servido a traves de NVIDIA integrate (namespace de id "meta/"), igual que
  // DiffusionGemma usa "google/". apiProvider es "nvidia" porque el proxy solo
  // conoce nvidia/openai/anthropic/google. Se omiten top_k y timeout del spec
  // original: la app no envia top_k y el timeout es adaptativo (getAdaptiveTimeout).
  "meta-muse": {
    id: "meta/muse-glimmer-30b",
    name: "Muse Glimmer 30B",
    provider: "Meta",
    apiProvider: "nvidia",
    free: true,
    modelType: "chat",
    reasoning: true,
    temperature: 1.0,
    topP: 0.95,
    maxInputTokens: 32000,
    maxOutputTokens: 49152,
    maxOutputTokensCap: 49152,
    // Reduce la longitud del thinking (verificado: low < medium < high en tokens de
    // salida). El modelo sigue razonando, solo piensa menos -> respuesta mas rapida.
    reasoningEffort: "low",
    stream: true,
  },
  "google-gemini-3-5-flash": {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "Google",
    apiProvider: "google",
    free: true,
    modelType: "chat",
    reasoning: false,
    temperature: 0.2,
    topP: 1,
    maxInputTokens: 32000,
    maxOutputTokens: 42000,
    stream: true,
  },
  "google-gemini-3-1-pro": {
    id: "gemini-3.1-pro",
    name: "Gemini 3.1 Pro",
    provider: "Google",
    apiProvider: "google",
    free: false,
    modelType: "chat",
    reasoning: false,
    temperature: 0.2,
    topP: 1,
    maxInputTokens: 32000,
    maxOutputTokens: 42000,
    stream: true,
  },
  "google-gemini-3-5-flash-lite": {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash-Lite",
    provider: "Google",
    apiProvider: "google",
    free: true,
    modelType: "chat",
    reasoning: false,
    temperature: 0.2,
    topP: 1,
    maxInputTokens: 32000,
    maxOutputTokens: 42000,
    stream: true,
  },
  "openai-gpt-4o-mini": {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    apiProvider: "openai",
    free: false,
    modelType: "chat",
    reasoning: false,
    temperature: 0.0,
    topP: 1.0,
    maxInputTokens: 32000,
    maxOutputTokens: 42000,
    stream: true,
  },
  "openai-gpt-4.1-nano": {
    id: "gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "OpenAI",
    apiProvider: "openai",
    free: false,
    modelType: "chat",
    reasoning: false,
    temperature: 0.0,
    topP: 1.0,
    maxInputTokens: 32000,
    maxOutputTokens: 42000,
    stream: true,
  },
  "anthropic-sonnet-5-5": {
    id: "claude-3-5-sonnet-20241022",
    name: "Sonnet 5.5",
    provider: "Anthropic",
    apiProvider: "anthropic",
    free: false,
    modelType: "chat",
    reasoning: false,
    temperature: 0.2,
    topP: 1,
    maxInputTokens: 32000,
    maxOutputTokens: 42000,
    stream: true,
  },
  "anthropic-haiku-4-5": {
    id: "claude-3-5-haiku-20241022",
    name: "Haiku 4.5",
    provider: "Anthropic",
    apiProvider: "anthropic",
    free: false,
    modelType: "chat",
    reasoning: false,
    temperature: 0.2,
    topP: 1,
    maxInputTokens: 32000,
    maxOutputTokens: 42000,
    stream: true,
  },
};


// MODELO POR DEFECTO
export const DEFAULT_MODEL = "nvidia-diffusiongemma";