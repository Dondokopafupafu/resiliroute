import type { OSMResponse } from "@/types/real-city";

export const regionalExtractLimits = {
  maxFileBytes: 600 * 1024 * 1024,
  catalogBytes: 24 * 1024 * 1024,
  catalogCacheMs: 24 * 60 * 60 * 1000,
  catalogFeatures: 6000,
  catalogCoordinates: 2000000,
  maxInsideNodeIds: 1000000,
} as const;

export interface ExtractRegion {
  id: string;
  name: string;
  url: string;
}
export interface PbfExtractProgress {
  pass: 1 | 2;
  bytesRead: number;
  totalBytes: number;
}
export interface PbfExtractResult {
  raw: OSMResponse;
  timestamp: string | null;
  /** Relations are not spatially reconstructed; null means their local coverage is unknown. */
  excludedRelationFacilities: number | null;
  bytesRead: number;
}
