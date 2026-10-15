import { realCityConfig } from "@/lib/real-city/model-config";
import type { BoundingBox, ImportErrorCode } from "@/types/real-city";

export class ImportError extends Error {
  constructor(
    public code: ImportErrorCode,
    message = code,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ImportError";
  }
}
const rad = (degrees: number) => (degrees * Math.PI) / 180;
export function haversine(a: readonly [number, number], b: readonly [number, number]): number {
  const value =
    Math.sin(rad(b[0] - a[0]) / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return (
    6371.0088 * 2 * Math.atan2(Math.sqrt(Math.min(1, value)), Math.sqrt(Math.max(0, 1 - value)))
  );
}
export function areaDimensions(bbox: BoundingBox) {
  const midLat = (bbox.south + bbox.north) / 2;
  const width = haversine([midLat, bbox.west], [midLat, bbox.east]);
  const height = haversine([bbox.south, bbox.west], [bbox.north, bbox.west]);
  return { width, height, area: width * height };
}
export function validateBoundingBox(input: unknown): BoundingBox {
  if (!input || typeof input !== "object") throw new ImportError("INVALID_BBOX");
  const b = input as Record<string, unknown>;
  if (
    !["south", "west", "north", "east"].every(
      (k) => typeof b[k] === "number" && Number.isFinite(b[k]),
    )
  )
    throw new ImportError("INVALID_BBOX");
  const bbox = {
    south: b.south as number,
    west: b.west as number,
    north: b.north as number,
    east: b.east as number,
  };
  if (
    bbox.south < -85 ||
    bbox.north > 85 ||
    bbox.west < -180 ||
    bbox.east > 180 ||
    bbox.south >= bbox.north ||
    bbox.west >= bbox.east
  )
    throw new ImportError("INVALID_BBOX");
  const { area, width, height } = areaDimensions(bbox);
  if (area > realCityConfig.maxAreaKm2 || width > 25 || height > 25)
    throw new ImportError("AREA_TOO_LARGE");
  if (width < 0.01 || height < 0.01) throw new ImportError("INVALID_BBOX");
  return bbox;
}
export function inside(bbox: BoundingBox, lat: number, lon: number) {
  return lat >= bbox.south && lat <= bbox.north && lon >= bbox.west && lon <= bbox.east;
}
export function geometryDistance(points: readonly [number, number][]) {
  return points.slice(1).reduce((sum, p, i) => sum + haversine(points[i], p), 0);
}
