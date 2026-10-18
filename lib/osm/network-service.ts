import { join } from "node:path";
import { validateBoundingBox, ImportError } from "./geo";
import { fetchOverpass } from "./overpass-client";
import { buildRealCityNetwork } from "./network-builder";
import { createDiskNetworkCache, type CachedNetwork } from "./network-cache";
import { realCityConfig } from "@/lib/real-city/model-config";
import { chooseNetworkProfile } from "@/lib/real-city/network-profile";
import type {
  NetworkImportProgress,
  NetworkProgressListener,
} from "@/lib/real-city/import-progress";
import type { BoundingBox, NetworkImportProfile, RealCityNetwork } from "@/types/real-city";

interface NetworkResult {
  snapshot: RealCityNetwork;
  cached: boolean;
}
interface SharedJob {
  controller: AbortController;
  promise: Promise<NetworkResult>;
  listeners: Set<NetworkProgressListener>;
  subscribers: number;
  progress?: NetworkImportProgress;
}

export function createNetworkService(
  fetcher: typeof fetch = fetch,
  options: { cacheDirectory?: string | null } = {},
) {
  const cache = new Map<string, CachedNetwork>();
  const inFlight = new Map<string, SharedJob>();
  // Mock fetches never write fixtures into the live cache. Serverless hosts may
  // reject writes; the disk adapter safely falls back to the memory cache.
  const disk = createDiskNetworkCache(
    options.cacheDirectory !== undefined
      ? options.cacheDirectory
      : fetcher === fetch
        ? join(/* turbopackIgnore: true */ process.cwd(), "private", "osm-cache")
        : null,
  );
  let calls = 0,
    windowStarted = Date.now(),
    upstreamCooldownUntil = 0;

  function subscribe(job: SharedJob, signal?: AbortSignal, progress?: NetworkProgressListener) {
    if (signal?.aborted) return Promise.reject(new ImportError("CANCELLED"));
    job.subscribers++;
    if (progress) {
      job.listeners.add(progress);
      if (job.progress) progress(job.progress);
    }
    return new Promise<NetworkResult>((resolve, reject) => {
      let finished = false;
      const cleanup = () => {
        if (finished) return false;
        finished = true;
        signal?.removeEventListener("abort", cancel);
        if (progress) job.listeners.delete(progress);
        job.subscribers--;
        return true;
      };
      const cancel = () => {
        if (!cleanup()) return;
        reject(new ImportError("CANCELLED"));
        if (job.subscribers === 0) job.controller.abort();
      };
      signal?.addEventListener("abort", cancel, { once: true });
      job.promise.then(
        (value) => {
          if (cleanup()) resolve(value);
        },
        (error: unknown) => {
          if (cleanup()) reject(error);
        },
      );
    });
  }

  return async (
    input: unknown,
    signal?: AbortSignal,
    progress?: NetworkProgressListener,
  ): Promise<NetworkResult> => {
    if (signal?.aborted) throw new ImportError("CANCELLED");
    const bbox = validateBoundingBox(input);
    // Use exactly the same rounded bounds for acquisition and cache identity.
    const normalized = validateBoundingBox(
      Object.fromEntries(Object.entries(bbox).map(([k, v]) => [k, Number(v.toFixed(5))])),
    );
    const profile = chooseNetworkProfile(normalized);
    const key = `${realCityConfig.queryVersion}:${profile}:${Object.values(normalized).join(",")}`;
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) {
      progress?.({ stage: "cache", profile: cached.snapshot.importProfile?.mode ?? profile });
      return { snapshot: cached.snapshot, cached: true };
    }
    const existing = inFlight.get(key);
    if (existing && !existing.controller.signal.aborted)
      return subscribe(existing, signal, progress);
    const persisted = await disk.get(key);
    if (signal?.aborted) throw new ImportError("CANCELLED");
    // Disk IO yielded: another request may now own this same selection.
    const pending = inFlight.get(key);
    if (pending && !pending.controller.signal.aborted) return subscribe(pending, signal, progress);
    if (
      persisted &&
      Object.entries(normalized).every(
        ([key, value]) => persisted.snapshot.bbox[key as keyof BoundingBox] === value,
      )
    ) {
      cache.set(key, persisted);
      progress?.({ stage: "cache", profile: persisted.snapshot.importProfile?.mode ?? profile });
      return { snapshot: persisted.snapshot, cached: true };
    }
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
    if (inFlight.size >= 2 || calls >= 16) throw new ImportError("RATE_LIMIT");
    calls++;
    const job: SharedJob = {
      controller: new AbortController(),
      promise: Promise.resolve(null as never),
      listeners: new Set(),
      subscribers: 0,
    };
    const deadline = AbortSignal.timeout(45000);
    const jobSignal = AbortSignal.any([job.controller.signal, deadline]);
    const emit = (event: NetworkImportProgress) => {
      job.progress = event;
      for (const listener of job.listeners) listener(event);
    };
    const acquire = async (
      bounds: BoundingBox,
      selectedProfile: NetworkImportProfile,
      reason: "area" | "density",
    ) => {
      const raw = await fetchOverpass(bounds, {
        signal: jobSignal,
        fetcher,
        profile: selectedProfile,
        onAttempt: (attempt, attempts) =>
          emit({ stage: "fetching", profile: selectedProfile, attempt, attempts }),
      });
      if (job.controller.signal.aborted) throw new ImportError("CANCELLED");
      emit({ stage: "building", profile: selectedProfile });
      return buildRealCityNetwork(raw, bounds, undefined, { profile: selectedProfile, reason });
    };
    // Defer work until the first subscriber is registered, so cancellation is
    // tied to actual consumers and the first progress event is not lost.
    job.promise = Promise.resolve().then(async () => {
      try {
        let snapshot: RealCityNetwork;
        try {
          snapshot = await acquire(normalized, profile, "area");
        } catch (error) {
          if (
            error instanceof ImportError &&
            error.code === "TOO_COMPLEX" &&
            profile === "detailed"
          ) {
            // A second, smaller road-class query covers the SAME selected box.
            // This is not clipping the area or serving an unrelated demo city.
            snapshot = await acquire(normalized, "regional", "density");
          } else throw error;
        }
        if (job.controller.signal.aborted) throw new ImportError("CANCELLED");
        const entry = { expires: Date.now() + realCityConfig.cacheMs, snapshot };
        if (cache.size >= 16) cache.delete(cache.keys().next().value!);
        cache.set(key, entry);
        await disk.set(key, entry);
        return { snapshot, cached: false };
      } catch (error) {
        if (deadline.aborted && !job.controller.signal.aborted) throw new ImportError("TIMEOUT");
        if (error instanceof ImportError && error.retryAfterSeconds)
          upstreamCooldownUntil = Date.now() + (error.retryAfterSeconds ?? 300) * 1000;
        throw error;
      } finally {
        if (inFlight.get(key) === job) inFlight.delete(key);
      }
    });
    inFlight.set(key, job);
    return subscribe(job, signal, progress);
  };
}
