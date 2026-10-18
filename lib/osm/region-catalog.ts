import { ImportError, validateBoundingBox } from "./geo";
import { regionalExtractLimits, type ExtractRegion } from "./region-types";
import type { BoundingBox } from "@/types/real-city";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

type Point = [number, number];
type Polygon = Point[][];
interface CatalogRegion extends ExtractRegion {
  polygons: Polygon[];
  area: number;
}
const CATALOG_URL = "https://download.geofabrik.de/index-v1.json";
const idPattern = /^[a-z0-9]+(?:[-/][a-z0-9]+)*$/;

export function validRegionUrl(input: unknown): input is string {
  if (typeof input !== "string") return false;
  try {
    const url = new URL(input);
    return (
      url.protocol === "https:" &&
      url.hostname === "download.geofabrik.de" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.search &&
      !url.hash &&
      /^\/(?:[a-z0-9-]+\/)*[a-z0-9-]+-latest\.osm\.pbf$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function ringArea(ring: Point[]): number {
  return (
    Math.abs(
      ring
        .slice(1)
        .reduce((sum, point, i) => sum + ring[i][0] * point[1] - point[0] * ring[i][1], 0),
    ) / 2
  );
}

/** Reject unsupported geometry instead of treating a broad bounding box as coverage. */
export function parseRegionCatalog(raw: unknown): CatalogRegion[] {
  if (
    !raw ||
    typeof raw !== "object" ||
    !("features" in raw) ||
    !("type" in raw) ||
    raw.type !== "FeatureCollection" ||
    !Array.isArray(raw.features) ||
    raw.features.length > regionalExtractLimits.catalogFeatures
  )
    throw new ImportError("INVALID_RESPONSE");
  let coordinates = 0;
  const regions: CatalogRegion[] = [];
  for (const value of raw.features) {
    if (!value || typeof value !== "object") continue;
    const properties = value.properties;
    if (
      !properties ||
      typeof properties.id !== "string" ||
      !idPattern.test(properties.id) ||
      properties.id.length > 150 ||
      typeof properties.name !== "string" ||
      !properties.name.length ||
      properties.name.length > 200 ||
      !validRegionUrl(properties.urls?.pbf)
    )
      continue;
    const geometry = value.geometry;
    const polygons: unknown =
      geometry?.type === "Polygon"
        ? [geometry.coordinates]
        : geometry?.type === "MultiPolygon"
          ? geometry.coordinates
          : null;
    if (!Array.isArray(polygons) || !polygons.length) continue;
    let valid = true;
    for (const polygon of polygons) {
      if (!Array.isArray(polygon) || !polygon.length) {
        valid = false;
        break;
      }
      for (const ring of polygon) {
        if (!Array.isArray(ring) || ring.length < 4) {
          valid = false;
          break;
        }
        coordinates += ring.length;
        if (coordinates > regionalExtractLimits.catalogCoordinates)
          throw new ImportError("TOO_COMPLEX");
        if (
          ring.some(
            (point) =>
              !Array.isArray(point) ||
              point.length < 2 ||
              !Number.isFinite(point[0]) ||
              !Number.isFinite(point[1]) ||
              Math.abs(point[0]) > 180 ||
              Math.abs(point[1]) > 90,
          ) ||
          ring[0][0] !== ring.at(-1)[0] ||
          ring[0][1] !== ring.at(-1)[1]
        ) {
          valid = false;
          break;
        }
      }
      if (!valid) break;
    }
    if (!valid) continue;
    const shape = polygons as Polygon[];
    regions.push({
      id: properties.id,
      name: properties.name,
      url: properties.urls.pbf,
      polygons: shape,
      area: shape.reduce(
        (sum, polygon) =>
          sum +
          ringArea(polygon[0]) -
          polygon.slice(1).reduce((holes, ring) => holes + ringArea(ring), 0),
        0,
      ),
    });
  }
  if (!regions.length) throw new ImportError("INVALID_RESPONSE");
  return regions;
}

function inRing(point: Point, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j],
      b = ring[i];
    const cross = (point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0]);
    if (
      Math.abs(cross) < 1e-12 &&
      point[0] >= Math.min(a[0], b[0]) &&
      point[0] <= Math.max(a[0], b[0]) &&
      point[1] >= Math.min(a[1], b[1]) &&
      point[1] <= Math.max(a[1], b[1])
    )
      return true;
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}

/** Liang–Barsky clipping against the rectangle's strict interior catches concave
 * notches and holes missed by checking just corners or a polygon's bounding box. */
function crossesInterior(a: Point, b: Point, box: BoundingBox): boolean {
  const epsilon = 1e-10;
  let low = 0,
    high = 1;
  const delta = [b[0] - a[0], b[1] - a[1]];
  const minima = [box.west + epsilon, box.south + epsilon];
  const maxima = [box.east - epsilon, box.north - epsilon];
  for (let axis = 0; axis < 2; axis++) {
    if (Math.abs(delta[axis]) < 1e-15) {
      if (a[axis] < minima[axis] || a[axis] > maxima[axis]) return false;
    } else {
      const t1 = (minima[axis] - a[axis]) / delta[axis],
        t2 = (maxima[axis] - a[axis]) / delta[axis];
      low = Math.max(low, Math.min(t1, t2));
      high = Math.min(high, Math.max(t1, t2));
      if (low > high) return false;
    }
  }
  return low <= high;
}

export function regionContainsBounds(region: CatalogRegion, bbox: BoundingBox): boolean {
  const corners: Point[] = [
    [bbox.west, bbox.south],
    [bbox.east, bbox.south],
    [bbox.east, bbox.north],
    [bbox.west, bbox.north],
  ];
  // Requiring one component to cover the entire rectangle is conservative at
  // touching multipolygon boundaries and never overclaims coverage across gaps.
  return region.polygons.some(
    (polygon) =>
      corners.every(
        (corner) =>
          inRing(corner, polygon[0]) && !polygon.slice(1).some((hole) => inRing(corner, hole)),
      ) &&
      polygon.every((ring) =>
        ring.slice(1).every((point, i) => !crossesInterior(ring[i], point, bbox)),
      ),
  );
}

export function selectRegionForBounds(regions: CatalogRegion[], input: BoundingBox): ExtractRegion {
  const bbox = validateBoundingBox(input);
  const match = regions
    .filter((region) => regionContainsBounds(region, bbox))
    .sort((a, b) => a.area - b.area || a.id.localeCompare(b.id))[0];
  if (!match) throw new ImportError("EMPTY_ROADS");
  return { id: match.id, name: match.name, url: match.url };
}

const caches = new WeakMap<typeof fetch, { expires: number; regions: CatalogRegion[] }>();
const diskLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const catalogDirectory = join(/* turbopackIgnore: true */ process.cwd(), "private", "osm-regions");
const catalogPath = join(/* turbopackIgnore: true */ catalogDirectory, "catalog.json");

async function readDiskCatalog(): Promise<CatalogRegion[] | null> {
  try {
    const info = await stat(/* turbopackIgnore: true */ catalogPath);
    if (info.size > regionalExtractLimits.catalogBytes || !info.isFile()) return null;
    const saved: unknown = JSON.parse(
      await readFile(/* turbopackIgnore: true */ catalogPath, "utf8"),
    );
    if (
      !saved ||
      typeof saved !== "object" ||
      !("savedAt" in saved) ||
      !("catalog" in saved) ||
      typeof saved.savedAt !== "number" ||
      !Number.isFinite(saved.savedAt) ||
      saved.savedAt > Date.now() ||
      Date.now() - saved.savedAt > diskLifetimeMs
    )
      return null;
    return parseRegionCatalog(saved.catalog);
  } catch {
    return null;
  }
}

async function writeDiskCatalog(catalog: unknown): Promise<void> {
  const temporary = join(
    /* turbopackIgnore: true */ catalogDirectory,
    `catalog-${randomUUID()}.tmp`,
  );
  try {
    const content = JSON.stringify({ savedAt: Date.now(), catalog });
    if (Buffer.byteLength(content) > regionalExtractLimits.catalogBytes) return;
    await mkdir(/* turbopackIgnore: true */ catalogDirectory, { recursive: true });
    await writeFile(/* turbopackIgnore: true */ temporary, content, { flag: "wx", mode: 0o600 });
    await rename(/* turbopackIgnore: true */ temporary, catalogPath);
  } catch {
    /* Disk cache is optional; fetching and validation remain usable. */
  } finally {
    await unlink(/* turbopackIgnore: true */ temporary).catch(() => {});
  }
}

export async function findRegionForBounds(
  bbox: BoundingBox,
  { fetcher = fetch, signal }: { fetcher?: typeof fetch; signal?: AbortSignal } = {},
): Promise<ExtractRegion> {
  validateBoundingBox(bbox);
  if (signal?.aborted) throw new ImportError("CANCELLED");
  const cached = caches.get(fetcher);
  if (cached && cached.expires > Date.now()) return selectRegionForBounds(cached.regions, bbox);
  // Dependency-injected test fetchers never read or write the user's cache.
  if (fetcher === globalThis.fetch) {
    const disk = await readDiskCatalog();
    if (signal?.aborted) throw new ImportError("CANCELLED");
    if (disk) {
      caches.set(fetcher, {
        regions: disk,
        expires: Date.now() + regionalExtractLimits.catalogCacheMs,
      });
      return selectRegionForBounds(disk, bbox);
    }
  }
  const deadline = AbortSignal.timeout(15000);
  try {
    const response = await fetcher(CATALOG_URL, {
      signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
      redirect: "error",
      headers: {
        Accept: "application/json",
        "User-Agent": "ResiliRoute/3.0 educational prototype",
      },
    });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw response.status === 429
        ? new ImportError("RATE_LIMIT", "RATE_LIMIT", 300)
        : new ImportError("UPSTREAM_UNAVAILABLE");
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > regionalExtractLimits.catalogBytes) throw new ImportError("TOO_COMPLEX");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const joined = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.length;
    }
    const catalog: unknown = JSON.parse(new TextDecoder().decode(joined));
    const regions = parseRegionCatalog(catalog);
    caches.set(fetcher, { regions, expires: Date.now() + regionalExtractLimits.catalogCacheMs });
    if (fetcher === globalThis.fetch) await writeDiskCatalog(catalog);
    return selectRegionForBounds(regions, bbox);
  } catch (error) {
    if (signal?.aborted) throw new ImportError("CANCELLED");
    if (deadline.aborted) throw new ImportError("TIMEOUT");
    if (error instanceof ImportError) throw error;
    throw new ImportError("INVALID_RESPONSE");
  }
}
