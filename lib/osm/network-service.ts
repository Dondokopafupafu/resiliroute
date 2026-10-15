import { validateBoundingBox, ImportError } from "./geo";
import { fetchOverpass } from "./overpass-client";
import { buildRealCityNetwork } from "./network-builder";
import { realCityConfig } from "@/lib/real-city/model-config";
import type { RealCityNetwork } from "@/types/real-city";

export function createNetworkService(fetcher: typeof fetch = fetch) {
  const cache = new Map<string, { expires: number; snapshot: RealCityNetwork }>();
  let active = 0,
    calls = 0,
    windowStarted = Date.now();
  let upstreamCooldownUntil = 0;
  return async (input: unknown, signal?: AbortSignal) => {
    const bbox = validateBoundingBox(input);
    // Rounded coordinates are used for both query and key; cache never returns
    // geometry built for a different unrounded selection.
    const rounded = Object.fromEntries(
      Object.entries(bbox).map(([k, v]) => [k, Number(v.toFixed(5))]),
    );
    const normalized = validateBoundingBox(rounded);
    const key = `${realCityConfig.queryVersion}:${Object.values(normalized).join(",")}`;
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return { snapshot: cached.snapshot, cached: true };
    if (upstreamCooldownUntil > Date.now())
      throw new ImportError(
        "RATE_LIMIT",
        undefined,
        Math.ceil((upstreamCooldownUntil - Date.now()) / 1000),
      );
    if (Date.now() - windowStarted > 300000) {
      windowStarted = Date.now();
      calls = 0;
    }
    if (active >= 2 || calls >= 16) throw new ImportError("RATE_LIMIT");
    active++;
    calls++;
    try {
      const raw = await fetchOverpass(normalized, { signal, fetcher });
      if (signal?.aborted) throw new ImportError("CANCELLED");
      const snapshot = buildRealCityNetwork(raw, normalized);
      if (cache.size >= 16) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: Date.now() + realCityConfig.cacheMs, snapshot });
      return { snapshot, cached: false };
    } catch (error) {
      if (error instanceof ImportError && error.code === "RATE_LIMIT")
        upstreamCooldownUntil = Date.now() + (error.retryAfterSeconds ?? 300) * 1000;
      throw error;
    } finally {
      active--;
    }
  };
}
