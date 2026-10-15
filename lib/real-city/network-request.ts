import { ImportError, validateBoundingBox } from "@/lib/osm/geo";
import { validateSnapshot } from "./snapshot";
import type { BoundingBox, ImportErrorCode, RealCityNetwork } from "@/types/real-city";

const serverErrors: readonly ImportErrorCode[] = [
  "INVALID_BBOX",
  "AREA_TOO_LARGE",
  "TOO_COMPLEX",
  "EMPTY_ROADS",
  "INVALID_RESPONSE",
  "UPSTREAM_UNAVAILABLE",
  "TIMEOUT",
  "CANCELLED",
  "RATE_LIMIT",
  "INVALID_SNAPSHOT",
];

/** A stopped local app is different from a working proxy reporting an OSM failure. */
export async function requestRealCityNetwork(
  bbox: BoundingBox,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<{ snapshot: RealCityNetwork; cached: boolean }> {
  validateBoundingBox(bbox);
  let response: Response;
  let data: unknown;
  try {
    response = await fetcher("/api/osm/network", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bbox),
      signal,
    });
    data = await response.json();
  } catch {
    throw new ImportError(signal?.aborted ? "CANCELLED" : "SERVER_UNREACHABLE");
  }
  if (!response.ok) {
    const code =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string" &&
      serverErrors.includes(data.error as ImportErrorCode)
        ? (data.error as ImportErrorCode)
        : "SERVER_UNREACHABLE";
    throw new ImportError(code);
  }
  if (!data || typeof data !== "object" || !("snapshot" in data))
    throw new ImportError("INVALID_RESPONSE");
  return {
    snapshot: validateSnapshot(data.snapshot),
    cached: "cached" in data && data.cached === true,
  };
}
