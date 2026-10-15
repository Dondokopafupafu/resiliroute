import { modelConfig } from "@/data/harbor-city";

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateCongestedTravelTime(
  freeFlowTime: number,
  volume: number,
  capacity: number,
): number {
  if (
    !Number.isFinite(freeFlowTime) ||
    freeFlowTime < 0 ||
    !Number.isFinite(volume) ||
    volume < 0 ||
    !Number.isFinite(capacity) ||
    capacity <= 0
  ) {
    throw new Error("BPR inputs must be finite, nonnegative, and have positive capacity.");
  }
  const ratio = clamp(volume / capacity, 0, modelConfig.maxVolumeCapacityRatio);
  return freeFlowTime * (1 + modelConfig.bprAlpha * ratio ** modelConfig.bprBeta);
}
