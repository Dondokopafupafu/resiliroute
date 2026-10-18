import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";
import { readOsmPbf, type OsmPbfBlock, type OsmPbfHeaderBlock } from "@osmix/pbf";
import { ImportError, inside, validateBoundingBox } from "./geo";
import { parseOSMResponse } from "./osm-parser";
import {
  regionalExtractLimits,
  type PbfExtractProgress,
  type PbfExtractResult,
} from "./region-types";
import { importRoadClasses } from "@/lib/real-city/network-profile";
import { realCityConfig } from "@/lib/real-city/model-config";
import type {
  BoundingBox,
  NetworkImportProfile,
  OSMNode,
  OSMTags,
  OSMWay,
} from "@/types/real-city";

// Retain modeling tags only. Contributor identities and unrelated address/contact
// metadata never enter the extracted network or its exportable snapshot.
const wantedTags = new Set([
  "name",
  "highway",
  "maxspeed",
  "oneway",
  "lanes",
  "bridge",
  "tunnel",
  "access",
  "service",
  "motor_vehicle",
  "vehicle",
  "junction",
  "amenity",
  "railway",
  "emergency",
]);
const decoder = new TextDecoder("utf-8", { fatal: true });
const isFacility = (tags: OSMTags) =>
  ["hospital", "clinic", "school", "university"].includes(tags.amenity) ||
  ["station", "halt"].includes(tags.railway) ||
  tags.emergency === "shelter";
const validId = (id: number) => Number.isSafeInteger(id) && id > 0;

function readHeader(header: OsmPbfHeaderBlock): string | null {
  if (
    !header.required_features.includes("OsmSchema-V0.6") ||
    header.required_features.some((feature) => !["OsmSchema-V0.6", "DenseNodes"].includes(feature))
  )
    throw new ImportError("INVALID_RESPONSE");
  const timestamp = header.osmosis_replication_timestamp;
  if (timestamp === undefined) return null;
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0 || timestamp > 8.64e12)
    throw new ImportError("INVALID_RESPONSE");
  return new Date(timestamp * 1000).toISOString();
}

function stringsFor(block: OsmPbfBlock) {
  const cache = new Map<number, string>();
  return (index: number): string => {
    if (!Number.isSafeInteger(index) || index < 0 || index >= block.stringtable.length)
      throw new ImportError("INVALID_RESPONSE");
    const existing = cache.get(index);
    if (existing !== undefined) return existing;
    const value = decoder.decode(block.stringtable[index]);
    cache.set(index, value);
    return value;
  };
}

function tagsFor(keys: number[], values: number[], getString: (index: number) => string): OSMTags {
  if (keys.length !== values.length) throw new ImportError("INVALID_RESPONSE");
  const result: OSMTags = {};
  keys.forEach((index, i) => {
    const key = getString(index);
    if (wantedTags.has(key)) {
      const value = getString(values[i]);
      if (value.length >= 2000) throw new ImportError("INVALID_RESPONSE");
      result[key] = value;
    }
  });
  return result;
}

/** Two bounded streaming passes preserve real OSM node identities. Pass one
 * discovers road/facility references using in-area node IDs; pass two retains
 * coordinates only for those references. This avoids retaining every building
 * vertex in a dense city and never merges grade-separated roads by coordinates.
 * Geofabrik extracts are type-sorted; an unsorted file is rejected explicitly. */
export async function extractPbfRegion(
  path: string,
  input: BoundingBox,
  {
    profile,
    signal,
    onProgress,
  }: {
    profile: NetworkImportProfile;
    signal?: AbortSignal;
    onProgress?: (progress: PbfExtractProgress) => void;
  },
): Promise<PbfExtractResult> {
  const bbox = validateBoundingBox(input);
  const checkCancelled = () => {
    if (signal?.aborted) throw new ImportError("CANCELLED");
  };
  checkCancelled();
  const metadata = await stat(/* turbopackIgnore: true */ path);
  if (!metadata.isFile() || !metadata.size) throw new ImportError("INVALID_RESPONSE");
  if (metadata.size > regionalExtractLimits.maxFileBytes) throw new ImportError("TOO_COMPLEX");
  const roadClasses = new Set<string>(importRoadClasses(profile));
  const insideIds = new Set<number>();
  const requiredIds = new Set<number>();
  const facilities = new Map<number, OSMNode>();
  const ways = new Map<number, OSMWay>();
  const coordinates = new Map<number, OSMNode>();
  let bytesRead = 0;
  let timestamp: string | null = null;
  const totalBytes = metadata.size * 2;
  const checkSize = () => {
    if (
      insideIds.size > regionalExtractLimits.maxInsideNodeIds ||
      requiredIds.size + facilities.size > realCityConfig.maxRawNodes ||
      ways.size + requiredIds.size + facilities.size > realCityConfig.maxElements
    )
      throw new ImportError("TOO_COMPLEX");
  };
  try {
    for (const pass of [1, 2] as const) {
      let seenWays = false;
      const stream = createReadStream(/* turbopackIgnore: true */ path, {
        highWaterMark: 256 * 1024,
        signal,
      });
      async function* chunks() {
        for await (const chunk of stream) {
          checkCancelled();
          if (!(chunk instanceof Uint8Array)) throw new ImportError("INVALID_RESPONSE");
          bytesRead += chunk.byteLength;
          if (bytesRead > pass * metadata.size) throw new ImportError("INVALID_RESPONSE");
          onProgress?.({ pass, bytesRead, totalBytes });
          yield chunk;
        }
      }
      try {
        const parsed = await readOsmPbf(chunks());
        const headerTime = readHeader(parsed.header);
        if (pass === 1) timestamp = headerTime;
        else if (headerTime !== timestamp) throw new ImportError("INVALID_RESPONSE");
        for await (const block of parsed.blocks) {
          checkCancelled();
          const divisor = block.granularity ?? 1e7;
          if (!Number.isFinite(divisor) || divisor <= 0) throw new ImportError("INVALID_RESPONSE");
          const getString = stringsFor(block);
          const visitNode = (
            id: number,
            rawLat: number,
            rawLon: number,
            getTags: () => OSMTags,
          ) => {
            if (seenWays || !validId(id)) throw new ImportError("INVALID_RESPONSE");
            const lat = rawLat / divisor + (block.lat_offset ?? 0);
            const lon = rawLon / divisor + (block.lon_offset ?? 0);
            if (
              !Number.isFinite(lat) ||
              !Number.isFinite(lon) ||
              Math.abs(lat) > 90 ||
              Math.abs(lon) > 180
            )
              throw new ImportError("INVALID_RESPONSE");
            if (pass === 1 && inside(bbox, lat, lon)) {
              insideIds.add(id);
              const tags = getTags();
              if (isFacility(tags)) facilities.set(id, { type: "node", id, lat, lon, tags });
              checkSize();
            } else if (pass === 2 && requiredIds.has(id)) {
              if (coordinates.has(id)) throw new ImportError("INVALID_RESPONSE");
              coordinates.set(id, facilities.get(id) ?? { type: "node", id, lat, lon });
            }
          };
          for (const group of block.primitivegroup) {
            for (const node of group.nodes)
              visitNode(node.id, node.lat, node.lon, () =>
                tagsFor(node.keys, node.vals, getString),
              );
            if (group.dense) {
              const dense = group.dense;
              if (dense.id.length !== dense.lat.length || dense.id.length !== dense.lon.length)
                throw new ImportError("INVALID_RESPONSE");
              let id = 0,
                lat = 0,
                lon = 0,
                tagIndex = 0;
              for (let i = 0; i < dense.id.length; i++) {
                id += dense.id[i];
                lat += dense.lat[i];
                lon += dense.lon[i];
                const start = tagIndex;
                if (dense.keys_vals.length) {
                  while (tagIndex < dense.keys_vals.length && dense.keys_vals[tagIndex] !== 0)
                    tagIndex += 2;
                  if (tagIndex >= dense.keys_vals.length) throw new ImportError("INVALID_RESPONSE");
                  tagIndex++;
                }
                const end = tagIndex - 1;
                visitNode(id, lat, lon, () => {
                  const keys: number[] = [],
                    vals: number[] = [];
                  for (let k = start; k < end; k += 2) {
                    keys.push(dense.keys_vals[k]);
                    vals.push(dense.keys_vals[k + 1]);
                  }
                  return tagsFor(keys, vals, getString);
                });
              }
              if (tagIndex !== dense.keys_vals.length) throw new ImportError("INVALID_RESPONSE");
            }
            for (const way of group.ways) {
              seenWays = true;
              if (pass === 2) continue;
              if (!validId(way.id)) throw new ImportError("INVALID_RESPONSE");
              const tags = tagsFor(way.keys, way.vals, getString);
              const road =
                roadClasses.has(tags.highway) &&
                ![tags.access, tags.motor_vehicle, tags.vehicle].some((value) =>
                  ["private", "no"].includes(value),
                );
              if (!road && !isFacility(tags)) continue;
              let id = 0;
              const nodes = way.refs.map((delta) => {
                id += delta;
                return id;
              });
              if (!nodes.some((ref) => insideIds.has(ref))) continue;
              if (
                nodes.length < 2 ||
                nodes.length > 10000 ||
                nodes.some((ref) => !validId(ref)) ||
                ways.has(way.id)
              )
                throw new ImportError("INVALID_RESPONSE");
              ways.set(way.id, { type: "way", id: way.id, nodes, tags });
              for (const ref of nodes) requiredIds.add(ref);
              checkSize();
            }
          }
          // Yield between bounded blobs so cancellation/polling remains responsive.
          await yieldToEventLoop();
        }
      } finally {
        stream.destroy();
      }
      if (bytesRead !== pass * metadata.size) throw new ImportError("INVALID_RESPONSE");
      if (pass === 1) insideIds.clear();
    }
    if (coordinates.size !== requiredIds.size) throw new ImportError("INVALID_RESPONSE");
    for (const node of facilities.values()) coordinates.set(node.id, node);
    for (const way of ways.values())
      if (isFacility(way.tags)) {
        const points = way.nodes.map((id) => coordinates.get(id)!);
        way.center = {
          lat:
            (Math.min(...points.map((point) => point.lat)) +
              Math.max(...points.map((point) => point.lat))) /
            2,
          lon:
            (Math.min(...points.map((point) => point.lon)) +
              Math.max(...points.map((point) => point.lon))) /
            2,
        };
      }
    const raw = parseOSMResponse({
      elements: [...coordinates.values(), ...ways.values()],
      ...(timestamp ? { osm3s: { timestamp_osm_base: timestamp } } : {}),
    });
    return { raw, timestamp, excludedRelationFacilities: null, bytesRead };
  } catch (error) {
    if (signal?.aborted) throw new ImportError("CANCELLED");
    if (error instanceof ImportError) throw error;
    throw new ImportError("INVALID_RESPONSE");
  }
}
