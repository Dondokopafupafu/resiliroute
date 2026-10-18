import { ImportError, validateBoundingBox } from "@/lib/osm/geo";
import { validateSnapshot } from "./snapshot";
import { realCityConfig } from "./model-config";
import type { NetworkProgressListener } from "./import-progress";
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
  "INVALID_OSM_FILE",
];

function serverError(data: unknown): ImportError {
  const known =
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof data.error === "string" &&
    serverErrors.includes(data.error as ImportErrorCode);
  const retry =
    known &&
    "retryAfterSeconds" in data &&
    typeof data.retryAfterSeconds === "number" &&
    Number.isFinite(data.retryAfterSeconds)
      ? data.retryAfterSeconds
      : undefined;
  return new ImportError(
    known ? (data.error as ImportErrorCode) : "SERVER_UNREACHABLE",
    undefined,
    retry,
  );
}

async function readStream(
  response: Response,
  signal?: AbortSignal,
  progress?: NetworkProgressListener,
): Promise<unknown> {
  if (!response.body) throw new ImportError("INVALID_RESPONSE");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener("abort", cancel, { once: true });
  let buffer = "",
    bytes = 0;
  const maxBytes = realCityConfig.maxSnapshotBytes + 1024 * 1024;
  try {
    while (true) {
      if (signal?.aborted) throw new ImportError("CANCELLED");
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new ImportError("TOO_COMPLEX");
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line) {
          let event: unknown;
          try {
            event = JSON.parse(line);
          } catch {
            throw new ImportError("INVALID_RESPONSE");
          }
          if (!event || typeof event !== "object" || !("type" in event))
            throw new ImportError("INVALID_RESPONSE");
          if (event.type === "result") return event;
          if (event.type === "error") throw serverError(event);
          if (
            event.type !== "progress" ||
            !("stage" in event) ||
            !["cache", "fetching", "building", "downloading", "extracting"].includes(
              String(event.stage),
            ) ||
            !("profile" in event) ||
            !["detailed", "regional"].includes(String(event.profile))
          )
            throw new ImportError("INVALID_RESPONSE");
          progress?.({
            stage: event.stage as "cache" | "fetching" | "building" | "downloading" | "extracting",
            profile: event.profile as "detailed" | "regional",
            ...("attempt" in event &&
            typeof event.attempt === "number" &&
            Number.isInteger(event.attempt) &&
            event.attempt > 0 &&
            event.attempt <= 4
              ? { attempt: event.attempt }
              : {}),
            ...("attempts" in event &&
            typeof event.attempts === "number" &&
            Number.isInteger(event.attempts) &&
            event.attempts > 0 &&
            event.attempts <= 4
              ? { attempts: event.attempts }
              : {}),
            ...("bytesReceived" in event &&
            typeof event.bytesReceived === "number" &&
            Number.isSafeInteger(event.bytesReceived) &&
            event.bytesReceived >= 0 &&
            event.bytesReceived <= 2 * 1024 * 1024 * 1024
              ? { bytesReceived: event.bytesReceived }
              : {}),
            ...("totalBytes" in event &&
            typeof event.totalBytes === "number" &&
            Number.isSafeInteger(event.totalBytes) &&
            event.totalBytes > 0 &&
            event.totalBytes <= 2 * 1024 * 1024 * 1024
              ? { totalBytes: event.totalBytes }
              : {}),
            ...("regionName" in event &&
            typeof event.regionName === "string" &&
            event.regionName.length <= 160
              ? { regionName: event.regionName }
              : {}),
          });
        }
        newline = buffer.indexOf("\n");
      }
    }
    throw new ImportError(signal?.aborted ? "CANCELLED" : "INVALID_RESPONSE");
  } finally {
    signal?.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** A stopped local app is different from a working proxy reporting an OSM failure. */
export async function requestRealCityNetwork(
  bbox: BoundingBox,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  onProgress?: NetworkProgressListener,
  source?: { source: "regional-extract"; regionId: string },
): Promise<{ snapshot: RealCityNetwork; cached: boolean }> {
  validateBoundingBox(bbox);
  let response: Response;
  let data: unknown;
  try {
    response = await fetcher("/api/osm/network", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/x-ndjson, application/json",
      },
      body: JSON.stringify({ ...bbox, ...source }),
      signal,
    });
    data =
      response.ok && response.headers.get("content-type")?.includes("application/x-ndjson")
        ? await readStream(response, signal, onProgress)
        : await response.json();
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw new ImportError(signal?.aborted ? "CANCELLED" : "SERVER_UNREACHABLE");
  }
  if (!response.ok) {
    throw serverError(data);
  }
  if (!data || typeof data !== "object" || !("snapshot" in data))
    throw new ImportError("INVALID_RESPONSE");
  return {
    snapshot: validateSnapshot(data.snapshot),
    cached: "cached" in data && data.cached === true,
  };
}
