// VAD (Voice Activity Detection) settings - OPTIMIZED FOR VOICE IN MUSIC & NOISE REJECTION
// Detección: voces en canciones, susurros, gritos | Ignora: viento, respiración, ruido blanco
export const baseVolumeThreshold = 0.01;
export const vadCheckInterval = 25;
export const silenceHoldCount = 2;
export const silenceTimeout = 800;
export const rmsSmoothingAlpha = 0.30;
export const adaptiveMultiplier = 2.0;
export const peakVoiceThreshold = 0.45;
export const spectralCentroidThreshold = 1200;
export const formantRatioThreshold = 0.30;
export const spectralFlatnessThreshold = 0.45;
export const zeroCrossingThreshold = 0.18;
export const windNoiseThreshold = 35;
