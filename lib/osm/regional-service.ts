import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";
import { ImportError, validateBoundingBox } from "./geo";
import { buildRealCityNetwork } from "./network-builder";
import { createDiskNetworkCache } from "./network-cache";
import { transferRegionalPack } from "./regional-transfer";
import { findRegionForBounds } from "./region-catalog";
import { extractPbfRegion } from "./pbf-extract";
import { chooseNetworkProfile } from "@/lib/real-city/network-profile";
import { validateSnapshot } from "@/lib/real-city/snapshot";
import { realCityConfig } from "@/lib/real-city/model-config";
import type { NetworkProgressListener } from "@/lib/real-city/import-progress";
import type { BoundingBox, NetworkImportProfile, RealCityNetwork } from "@/types/real-city";

export const regionalDownloadLimits = {
  maxBytes: 600 * 1024 * 1024,
  maxPacks: 2,
  cacheMs: 7 * 24 * 60 * 60 * 1000,
  jobTimeoutMs: 280000,
} as const;
// Keep two completed packs. A replacement downloads atomically before pruning,
// so temporary peak disk use can include a third pack (at most 1.8 GiB total).
// Existing usable data remains intact if its replacement download fails.

type Region = Awaited<ReturnType<typeof findRegionForBounds>>;
interface PackMetadata {
  id: string;
  name: string;
  url: string;
  bytes: number;
  updatedAt: string | null;
  downloadedAt: string;
}
export interface RegionPreflight {
  id: string;
  name: string;
  bytes: number;
  updatedAt: string | null;
  cached: boolean;
  available: boolean;
  maxBytes: number;
}
interface NetworkResult {
  snapshot: RealCityNetwork;
  cached: boolean;
}
const projectAgent = "ResiliRoute/3.0 (+https://github.com/Dondokopafupafu/resiliroute)";

/** Only official catalog-selected public extracts can become download targets. */
function checkedUrl(value: string, dated = false): URL {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "download.geofabrik.de" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(
      dated ? /^\/[a-z0-9/_-]+-(latest|\d{6})\.osm\.pbf$/ : /^\/[a-z0-9/_-]+-latest\.osm\.pbf$/
    ).test(url.pathname)
  )
    throw new ImportError("INVALID_RESPONSE");
  return url;
}
const dateHeader = (value: string | null) =>
  value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;

export function createRegionalService(
  options: {
    fetcher?: typeof fetch;
    directory?: string;
    catalog?: typeof findRegionForBounds;
    extractor?: typeof extractPbfRegion;
  } = {},
) {
  const fetcher = options.fetcher ?? fetch;
  const catalog = options.catalog ?? findRegionForBounds;
  const extractor = options.extractor ?? extractPbfRegion;
  const directory = resolve(
    /* turbopackIgnore: true */ options.directory ??
      join(/* turbopackIgnore: true */ process.cwd(), "private", "osm-regions"),
  );
  const graphCache = createDiskNetworkCache(
    join(/* turbopackIgnore: true */ directory, "networks"),
  );
  const heads = new Map<string, { expires: number; bytes: number; updatedAt: string | null }>();
  let busy = false;
  let cooldownUntil = 0;
  const downloads: number[] = [];
  const stem = (region: Region) => createHash("sha256").update(region.id).digest("hex");
  const packPath = (region: Region) =>
    join(/* turbopackIgnore: true */ directory, `${stem(region)}.osm.pbf`);
  const metadataPath = (region: Region) =>
    join(/* turbopackIgnore: true */ directory, `${stem(region)}.json`);
  const owned = (path: string) =>
    isAbsolute(path) && resolve(/* turbopackIgnore: true */ path).startsWith(`${directory}${sep}`);
  const removeOwned = async (path: string) => {
    if (!owned(path)) throw new Error("Invalid regional cache path");
    await unlink(/* turbopackIgnore: true */ path).catch(() => undefined);
  };

  async function requestPack(
    url: string,
    init: RequestInit,
  ): Promise<{ response: Response; url: string }> {
    const original = checkedUrl(url, true);
    const base = original.pathname.replace(/-(latest|\d{6})\.osm\.pbf$/, "");
    let target = original;
    for (let redirects = 0; redirects <= 2; redirects++) {
      const response = await fetcher(target, { ...init, redirect: "manual" });
      if (![301, 302, 303, 307, 308].includes(response.status))
        return { response, url: target.toString() };
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location || redirects === 2) throw new ImportError("INVALID_RESPONSE");
      target = checkedUrl(new URL(location, target).toString(), true);
      // A latest-file redirect may change only the date suffix, not the region.
      if (target.pathname.replace(/-(latest|\d{6})\.osm\.pbf$/, "") !== base)
        throw new ImportError("INVALID_RESPONSE");
    }
    throw new ImportError("INVALID_RESPONSE");
  }

  async function cachedPack(region: Region): Promise<PackMetadata | null> {
    try {
      if ((await stat(/* turbopackIgnore: true */ metadataPath(region))).size > 4096) return null;
      const input: unknown = JSON.parse(
        await readFile(/* turbopackIgnore: true */ metadataPath(region), "utf8"),
      );
      if (!input || typeof input !== "object") return null;
      const m = input as PackMetadata;
      if (
        m.id !== region.id ||
        m.url !== region.url ||
        m.name !== region.name ||
        !Number.isFinite(m.bytes) ||
        m.bytes < 1 ||
        m.bytes > regionalDownloadLimits.maxBytes ||
        typeof m.downloadedAt !== "string" ||
        !Number.isFinite(Date.parse(m.downloadedAt)) ||
        Date.parse(m.downloadedAt) < Date.now() - regionalDownloadLimits.cacheMs ||
        Date.parse(m.downloadedAt) > Date.now() + 300000 ||
        (m.updatedAt !== null &&
          (typeof m.updatedAt !== "string" || !Number.isFinite(Date.parse(m.updatedAt))))
      )
        return null;
      if ((await stat(/* turbopackIgnore: true */ packPath(region))).size !== m.bytes) return null;
      return {
        id: m.id,
        name: m.name,
        url: m.url,
        bytes: m.bytes,
        downloadedAt: m.downloadedAt,
        updatedAt: m.updatedAt,
      };
    } catch {
      return null;
    }
  }

  async function responseOkay(response: Response) {
    if (response.ok) return;
    await response.body?.cancel();
    if (response.status === 429) {
      const value = response.headers.get("retry-after");
      const seconds =
        value && /^\d+$/.test(value)
          ? Number(value)
          : value
            ? Math.ceil((Date.parse(value) - Date.now()) / 1000)
            : 300;
      const retry = Number.isFinite(seconds) ? Math.max(300, seconds) : 300;
      cooldownUntil = Date.now() + retry * 1000;
      throw new ImportError("RATE_LIMIT", undefined, retry);
    }
    throw new ImportError("UPSTREAM_UNAVAILABLE");
  }

  async function inspect(region: Region, signal?: AbortSignal): Promise<RegionPreflight> {
    checkedUrl(region.url);
    const cached = await cachedPack(region);
    if (cached)
      return {
        ...cached,
        cached: true,
        available: true,
        maxBytes: regionalDownloadLimits.maxBytes,
      };
    if (cooldownUntil > Date.now())
      throw new ImportError(
        "RATE_LIMIT",
        undefined,
        Math.ceil((cooldownUntil - Date.now()) / 1000),
      );
    let details = heads.get(region.id);
    if (!details || details.expires <= Date.now()) {
      const timeout = AbortSignal.timeout(15000);
      try {
        const { response } = await requestPack(region.url, {
          method: "HEAD",
          headers: { "User-Agent": projectAgent },
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
          cache: "no-store",
        });
        await responseOkay(response);
        const bytes = Number(response.headers.get("content-length"));
        if (!Number.isSafeInteger(bytes) || bytes <= 0) throw new ImportError("INVALID_RESPONSE");
        details = {
          expires: Date.now() + 60 * 60 * 1000,
          bytes,
          updatedAt: dateHeader(response.headers.get("last-modified")),
        };
        if (heads.size >= 32) heads.delete(heads.keys().next().value!);
        heads.set(region.id, details);
      } catch (error) {
        if (signal?.aborted) throw new ImportError("CANCELLED");
        if (timeout.aborted) throw new ImportError("TIMEOUT");
        throw error instanceof ImportError ? error : new ImportError("UPSTREAM_UNAVAILABLE");
      }
    }
    return {
      id: region.id,
      name: region.name,
      bytes: details.bytes,
      updatedAt: details.updatedAt,
      cached: false,
      available: details.bytes <= regionalDownloadLimits.maxBytes,
      maxBytes: regionalDownloadLimits.maxBytes,
    };
  }

  async function prune() {
    const names = (await readdir(/* turbopackIgnore: true */ directory)).filter((name) =>
      /^[a-f0-9]{64}\.osm\.pbf$/.test(name),
    );
    const files = await Promise.all(
      names.map(async (name) => ({
        name,
        modified: (
          await stat(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ directory, name))
        ).mtimeMs,
      })),
    );
    files.sort((a, b) => b.modified - a.modified);
    for (const file of files.slice(regionalDownloadLimits.maxPacks)) {
      await removeOwned(join(/* turbopackIgnore: true */ directory, file.name));
      await removeOwned(
        join(/* turbopackIgnore: true */ directory, file.name.replace(/\.osm\.pbf$/, ".json")),
      );
    }
  }

  async function download(
    region: Region,
    inspection: RegionPreflight,
    signal: AbortSignal,
    progress: NetworkProgressListener | undefined,
    profile: NetworkImportProfile,
  ): Promise<PackMetadata> {
    if (!inspection.available) throw new ImportError("TOO_COMPLEX");
    const previous = await cachedPack(region);
    if (previous) return previous;
    while (downloads.length && downloads[0] <= Date.now() - 60 * 60 * 1000) downloads.shift();
    if (downloads.length >= 2)
      throw new ImportError(
        "RATE_LIMIT",
        undefined,
        Math.ceil((downloads[0] + 60 * 60 * 1000 - Date.now()) / 1000),
      );
    const temp = join(/* turbopackIgnore: true */ directory, `${stem(region)}.${randomUUID()}.tmp`);
    const tempMeta = `${temp}.json`;
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      if (signal.aborted) throw new ImportError("CANCELLED");
      await mkdir(/* turbopackIgnore: true */ directory, { recursive: true });
      downloads.push(Date.now());
      handle = await open(/* turbopackIgnore: true */ temp, "wx", 0o600);
      let reported = 0;
      progress?.({
        stage: "downloading",
        profile,
        regionName: region.name,
        bytesReceived: 0,
        totalBytes: inspection.bytes,
      });
      const transfer = await transferRegionalPack({
        url: region.url,
        bytes: inspection.bytes,
        maxBytes: regionalDownloadLimits.maxBytes,
        signal,
        request: requestPack,
        checkResponse: responseOkay,
        write: async (value) => {
          for (let offset = 0; offset < value.byteLength; ) {
            const written = (await handle!.write(value, offset)).bytesWritten;
            if (written <= 0) throw new ImportError("UPSTREAM_UNAVAILABLE");
            offset += written;
          }
        },
        onBytes: (bytes) => {
          if (Date.now() - reported > 400) {
            progress?.({
              stage: "downloading",
              profile,
              regionName: region.name,
              bytesReceived: bytes,
              totalBytes: inspection.bytes,
            });
            reported = Date.now();
          }
        },
      }).catch((error: unknown) => {
        // The latest extract may have changed since HEAD. A future explicit
        // prepare must inspect fresh metadata, never reuse a mismatched size.
        if (
          error instanceof ImportError &&
          ["INVALID_RESPONSE", "TOO_COMPLEX"].includes(error.code)
        )
          heads.delete(region.id);
        throw error;
      });
      const bytes = transfer.bytes;
      await handle.close();
      handle = undefined;
      // An HTTP 200 HTML error page is not an OSM pack. Check the bounded first
      // BlobHeader before allowing the file into the reusable cache.
      const inspectFile = await open(/* turbopackIgnore: true */ temp, "r");
      try {
        const prefix = Buffer.alloc(4);
        if ((await inspectFile.read(prefix, 0, 4, 0)).bytesRead !== 4)
          throw new ImportError("INVALID_RESPONSE");
        const headerSize = prefix.readUInt32BE();
        if (headerSize < 10 || headerSize > 65536 || bytes < headerSize + 4)
          throw new ImportError("INVALID_RESPONSE");
        const header = Buffer.alloc(headerSize);
        if (
          (await inspectFile.read(header, 0, headerSize, 4)).bytesRead !== headerSize ||
          !header.includes(Buffer.from("OSMHeader"))
        )
          throw new ImportError("INVALID_RESPONSE");
      } finally {
        await inspectFile.close();
      }
      const metadata: PackMetadata = {
        id: region.id,
        name: region.name,
        url: region.url,
        bytes,
        updatedAt: dateHeader(transfer.lastModified) ?? inspection.updatedAt,
        downloadedAt: new Date().toISOString(),
      };
      await writeFile(/* turbopackIgnore: true */ tempMeta, JSON.stringify(metadata), {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(/* turbopackIgnore: true */ temp, packPath(region));
      await rename(/* turbopackIgnore: true */ tempMeta, metadataPath(region));
      await prune();
      progress?.({
        stage: "downloading",
        profile,
        regionName: region.name,
        bytesReceived: bytes,
        totalBytes: bytes,
      });
      return metadata;
    } finally {
      await handle?.close().catch(() => undefined);
      await removeOwned(temp);
      await removeOwned(tempMeta);
    }
  }

  async function build(
    input: unknown,
    expectedRegion: string | undefined,
    signal?: AbortSignal,
    progress?: NetworkProgressListener,
    cachedOnly = false,
  ): Promise<NetworkResult | null> {
    const bbox = validateBoundingBox(input);
    if (signal?.aborted) throw new ImportError("CANCELLED");
    if (busy) throw new ImportError("RATE_LIMIT", undefined, 5);
    busy = true;
    const deadline = AbortSignal.timeout(regionalDownloadLimits.jobTimeoutMs);
    const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
    try {
      const region = await catalog(bbox, { fetcher, signal: combined });
      if (expectedRegion && region.id !== expectedRegion) throw new ImportError("INVALID_BBOX");
      const existing = await cachedPack(region);
      if (cachedOnly && !existing) return null;
      const profile = chooseNetworkProfile(bbox);
      const inspection = existing
        ? { ...existing, cached: true, available: true, maxBytes: regionalDownloadLimits.maxBytes }
        : await inspect(region, combined);
      const pack = existing ?? (await download(region, inspection, combined, progress, profile));
      const key = `${realCityConfig.queryVersion}:geofabrik:${region.id}:${pack.downloadedAt}:${profile}:${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
      const cached = await graphCache.get(key);
      if (
        cached &&
        Object.entries(bbox).every(
          ([field, value]) => cached.snapshot.bbox[field as keyof BoundingBox] === value,
        )
      ) {
        progress?.({
          stage: "cache",
          profile: cached.snapshot.importProfile?.mode ?? profile,
          regionName: region.name,
        });
        return { snapshot: cached.snapshot, cached: true };
      }
      const convert = async (selectedProfile: typeof profile, reason: "area" | "density") => {
        progress?.({
          stage: "extracting",
          profile: selectedProfile,
          regionName: region.name,
          bytesReceived: 0,
          totalBytes: pack.bytes * 2,
        });
        const extracted = await extractor(packPath(region), bbox, {
          profile: selectedProfile,
          signal: combined,
          onProgress: (event) =>
            progress?.({
              stage: "extracting",
              profile: selectedProfile,
              regionName: region.name,
              bytesReceived: event.bytesRead,
              totalBytes: event.totalBytes,
            }),
        }).catch(async (error: unknown) => {
          // Invalid file contents must not poison all future selections for a
          // week. Size limits, empty areas and cancellation do not imply damage.
          if (error instanceof ImportError && error.code === "INVALID_RESPONSE") {
            await removeOwned(packPath(region));
            await removeOwned(metadataPath(region));
          }
          throw error;
        });
        if (combined.aborted) throw new ImportError("CANCELLED");
        progress?.({ stage: "building", profile: selectedProfile, regionName: region.name });
        const snapshot = buildRealCityNetwork(extracted.raw, bbox, undefined, {
          profile: selectedProfile,
          reason,
        });
        snapshot.osmMetadata.timestamp = extracted.timestamp;
        snapshot.osmMetadata.regionalExtract = {
          provider: "Geofabrik",
          regionId: region.id,
          regionName: region.name,
          fileDate: pack.updatedAt,
          downloadedAt: pack.downloadedAt,
          excludedRelationFacilities: extracted.excludedRelationFacilities,
        };
        return validateSnapshot(snapshot);
      };
      let snapshot: RealCityNetwork;
      try {
        snapshot = await convert(profile, "area");
      } catch (error) {
        if (profile === "detailed" && error instanceof ImportError && error.code === "TOO_COMPLEX")
          snapshot = await convert("regional", "density");
        else throw error;
      }
      if (combined.aborted) throw new ImportError("CANCELLED");
      await graphCache.set(key, { expires: Date.now() + realCityConfig.cacheMs, snapshot });
      return { snapshot, cached: false };
    } catch (error) {
      if (signal?.aborted) throw new ImportError("CANCELLED");
      if (deadline.aborted) throw new ImportError("TIMEOUT");
      throw error instanceof ImportError ? error : new ImportError("UPSTREAM_UNAVAILABLE");
    } finally {
      busy = false;
    }
  }

  return {
    async preflight(input: unknown, signal?: AbortSignal): Promise<{ region: RegionPreflight }> {
      const bbox = validateBoundingBox(input);
      const region = await catalog(bbox, { fetcher, signal });
      return { region: await inspect(region, signal) };
    },
    build(
      input: unknown,
      expectedRegion: string,
      signal?: AbortSignal,
      progress?: NetworkProgressListener,
    ) {
      return build(input, expectedRegion, signal, progress);
    },
    async tryCached(
      input: unknown,
      signal?: AbortSignal,
      progress?: NetworkProgressListener,
    ): Promise<NetworkResult | null> {
      try {
        const files = await readdir(/* turbopackIgnore: true */ directory);
        if (!files.some((name) => /^[a-f0-9]{64}\.osm\.pbf$/.test(name))) return null;
      } catch {
        return null;
      }
      try {
        return await build(input, undefined, signal, progress, true);
      } catch (error) {
        if (
          error instanceof ImportError &&
          ["UPSTREAM_UNAVAILABLE", "EMPTY_ROADS", "INVALID_RESPONSE"].includes(error.code) &&
          !error.retryAfterSeconds
        )
          return null;
        throw error;
      }
    },
  };
}

export const regionalNetworkService = createRegionalService();
