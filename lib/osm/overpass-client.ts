import { ImportError } from "./geo";
import { buildOverpassQuery } from "./query-builder";
import { parseOSMResponse } from "./osm-parser";
import { realCityConfig } from "@/lib/real-city/model-config";
import type { BoundingBox, OSMResponse } from "@/types/real-city";

export async function boundedText(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<string> {
  if (!body) throw new ImportError("INVALID_RESPONSE");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let total = 0,
    text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ImportError("TOO_COMPLEX");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function fetchOverpass(
  bbox: BoundingBox,
  options: {
    signal?: AbortSignal;
    fetcher?: typeof fetch;
    endpoints?: string[];
    timeoutMs?: number;
  } = {},
): Promise<OSMResponse> {
  const primary = process.env.OVERPASS_API_URL || "https://overpass-api.de/api/interpreter";
  const secondary =
    process.env.OVERPASS_FALLBACK_URL || "https://overpass.kumi.systems/api/interpreter";
  const endpoints = options.endpoints ?? [primary, primary, secondary];
  let failure: ImportError = new ImportError("UPSTREAM_UNAVAILABLE");
  const query = buildOverpassQuery(bbox);
  for (const endpoint of endpoints) {
    if (options.signal?.aborted) throw new ImportError("CANCELLED");
    const timeout = AbortSignal.timeout(options.timeoutMs ?? realCityConfig.timeoutMs);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    try {
      const response = await (options.fetcher ?? fetch)(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "ResiliRoute/2.0 (educational urban network analysis)",
        },
        body: new URLSearchParams({ data: query }),
        signal,
        cache: "no-store",
      });
      if (!response.ok) throw new ImportError("UPSTREAM_UNAVAILABLE");
      const text = await boundedText(response.body, realCityConfig.maxResponseBytes);
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new ImportError("INVALID_RESPONSE");
      }
      return parseOSMResponse(raw);
    } catch (error) {
      if (options.signal?.aborted) throw new ImportError("CANCELLED");
      failure = timeout.aborted
        ? new ImportError("TIMEOUT")
        : error instanceof ImportError
          ? error
          : new ImportError("UPSTREAM_UNAVAILABLE");
      // A well-formed but overlarge model will not improve on another endpoint.
      if (failure.code === "TOO_COMPLEX") throw failure;
    }
  }
  throw failure;
}
