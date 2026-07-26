import {
  rmsSmoothingAlpha,
  spectralCentroidThreshold,
  formantRatioThreshold,
  spectralFlatnessThreshold,
  zeroCrossingThreshold,
  windNoiseThreshold,
  baseVolumeThreshold,
  adaptiveMultiplier,
  peakVoiceThreshold
} from "./vadConstants";

export interface VADMathResult {
  isVoiceDetected: boolean;
  newSmooth: number;
  newNoiseFloor: number;
}

export const analyzeAudioFrame = (
  floatData: Float32Array,
  fftData: Uint8Array,
  binWidth: number,
  nyquist: number,
  prevSmooth: number,
  prevNoiseFloor: number
): VADMathResult => {
  const lowBinStart = Math.floor(60 / binWidth);
  const lowBinEnd = Math.floor(250 / binWidth);
  let lowEnergy = 0;
  for (let i = lowBinStart; i < lowBinEnd; i++) {
    lowEnergy += fftData[i];
  }
  lowEnergy /= (lowBinEnd - lowBinStart + 1);

  const midBinStart = lowBinEnd;
  const midBinEnd = Math.floor(2000 / binWidth);
  let midEnergy = 0;
  for (let i = midBinStart; i < midBinEnd; i++) {
    midEnergy += fftData[i];
  }
  midEnergy /= (midBinEnd - midBinStart + 1);

  const highBinStart = midBinEnd;
  const highBinEnd = Math.floor(4000 / binWidth);
  let highEnergy = 0;
  for (let i = highBinStart; i < highBinEnd; i++) {
    highEnergy += fftData[i];
  }
  highEnergy /= (highBinEnd - highBinStart + 1);

  const formantRatio = (midEnergy + highEnergy) / (lowEnergy + midEnergy + 0.001);
  const voiceSignature = midEnergy > lowEnergy * 0.7;

  let numerator = 0;
  let denominator = 0;
  let logSum = 0;
  let validLogCount = 0;
  for (let i = highBinStart; i < highBinEnd; i++) {
    const frequency = (i * nyquist) / fftData.length;
    numerator += frequency * fftData[i];
    denominator += fftData[i];
    if (fftData[i] > 0) {
      logSum += Math.log(fftData[i]);
      validLogCount++;
    }
  }
  const spectralCentroid = denominator > 0 ? numerator / denominator : 0;
  const isSpectralInVoiceRange = spectralCentroid > spectralCentroidThreshold * 0.6;

  const arithmeticMean = denominator / (highBinEnd - highBinStart + 1) || 1e-10;
  const geometricMean = validLogCount > 0 ? Math.exp(logSum / validLogCount) : 0;
  const spectralFlatness = Math.max(0, Math.min(1, geometricMean / (arithmeticMean + 1e-10)));
  const isNotWindNoise = spectralFlatness < spectralFlatnessThreshold;

  let zeroCrossings = 0;
  for (let i = 1; i < floatData.length; i++) {
    if ((floatData[i] > 0 && floatData[i - 1] <= 0) || (floatData[i] <= 0 && floatData[i - 1] > 0)) {
      zeroCrossings++;
    }
  }
  const zcr = zeroCrossings / floatData.length;
  const isNotVoiceNoise = zcr < zeroCrossingThreshold;

  const voiceEnergyRatio = (midEnergy + highEnergy) / (lowEnergy + 1e-6);
  const isNotWindRespiration = voiceEnergyRatio > windNoiseThreshold * 0.01;

  let sum = 0;
  for (let i = 0; i < floatData.length; i++) {
    const v = floatData[i];
    sum += v * v;
  }
  const rms = Math.sqrt(sum / floatData.length);

  const smooth = rmsSmoothingAlpha * rms + (1 - rmsSmoothingAlpha) * prevSmooth;
  
  let newNoiseFloor = Math.min(prevNoiseFloor, smooth * 0.8);
  newNoiseFloor = Math.max(newNoiseFloor, prevNoiseFloor * 1.001);

  const adaptiveThreshold = Math.max(baseVolumeThreshold, newNoiseFloor * adaptiveMultiplier + 0.003);

  const isVoiceDetected =
    (smooth > adaptiveThreshold || rms > peakVoiceThreshold) &&
    (voiceSignature || formantRatio > formantRatioThreshold) &&
    isSpectralInVoiceRange &&
    isNotWindNoise &&
    isNotVoiceNoise &&
    isNotWindRespiration;

  return { isVoiceDetected, newSmooth: smooth, newNoiseFloor };
};
