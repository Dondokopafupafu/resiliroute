import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { osmBlockToPbfBlobBytes, type OsmPbfBlock, type OsmPbfHeaderBlock } from "@osmix/pbf";
import { extractPbfRegion } from "@/lib/osm/pbf-extract";
import {
  findRegionForBounds,
  parseRegionCatalog,
  selectRegionForBounds,
  validRegionUrl,
} from "@/lib/osm/region-catalog";
import { buildRealCityNetwork } from "@/lib/osm/network-builder";
import { validateSnapshot } from "@/lib/real-city/snapshot";
import { simulate } from "@/lib/simulation/simulate";
import type { BoundingBox, OSMNode, OSMResponse, OSMWay } from "@/types/real-city";
import fixture from "./fixtures/osm-small.json";

const bbox: BoundingBox = { south: 35, west: 139, north: 35.02, east: 139.02 };
const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});
const rectangle = (west: number, south: number, east: number, north: number) => [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
  [west, south],
];
function catalogFeature(id: string, rings = [rectangle(138, 34, 140, 36)]) {
  return {
    type: "Feature",
    properties: {
      id,
      name: id,
      urls: { pbf: `https://download.geofabrik.de/test/${id}-latest.osm.pbf` },
    },
    geometry: { type: "Polygon", coordinates: rings },
  };
}
const catalog = (...features: ReturnType<typeof catalogFeature>[]) => ({
  type: "FeatureCollection",
  features,
});

describe("official regional extract catalog", () => {
  it("selects the smallest fully covering region, not just a matching corner", () => {
    const regions = parseRegionCatalog(
      catalog(
        catalogFeature("large"),
        catalogFeature("small", [rectangle(138.99, 34.99, 139.03, 35.03)]),
      ),
    );
    expect(selectRegionForBounds(regions, bbox).id).toBe("small");
  });
  it("rejects interior holes and concave notches even when every corner is inside", () => {
    const hole = catalogFeature("hole", [
      rectangle(138.99, 34.99, 139.03, 35.03),
      rectangle(139.008, 35.008, 139.012, 35.012),
    ]);
    expect(() => selectRegionForBounds(parseRegionCatalog(catalog(hole)), bbox)).toThrow(
      "EMPTY_ROADS",
    );
    const notch = [
      [138.99, 34.99],
      [139.03, 34.99],
      [139.03, 35.03],
      [139.012, 35.03],
      [139.012, 35.01],
      [139.008, 35.01],
      [139.008, 35.03],
      [138.99, 35.03],
      [138.99, 34.99],
    ];
    expect(() =>
      selectRegionForBounds(parseRegionCatalog(catalog(catalogFeature("notch", [notch]))), bbox),
    ).toThrow("EMPTY_ROADS");
  });
  it("permits only official HTTPS file paths, never attacker URLs or credentials", () => {
    expect(validRegionUrl("https://download.geofabrik.de/asia/japan/chugoku-latest.osm.pbf")).toBe(
      true,
    );
    for (const url of [
      "https://download.geofabrik.de.evil.test/asia-latest.osm.pbf",
      "http://download.geofabrik.de/asia-latest.osm.pbf",
      Object.assign(new URL("https://download.geofabrik.de/asia-latest.osm.pbf"), {
        username: "fixture-user",
      }).toString(),
      "https://download.geofabrik.de/asia-latest.osm.pbf?key=secret",
      "https://example.com/file.pbf",
    ])
      expect(validRegionUrl(url)).toBe(false);
    const bad = catalogFeature("bad");
    bad.properties.urls.pbf = "https://evil.test/file.pbf";
    expect(() => parseRegionCatalog(catalog(bad))).toThrow("INVALID_RESPONSE");
  });
  it("caches the validated catalog and does not fetch after cancellation", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(catalog(catalogFeature("sample"))),
    ) as unknown as typeof fetch;
    expect((await findRegionForBounds(bbox, { fetcher })).id).toBe("sample");
    await findRegionForBounds(bbox, { fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(
      findRegionForBounds(bbox, { fetcher, signal: AbortSignal.abort() }),
    ).rejects.toMatchObject({ code: "CANCELLED" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("propagates rate limits and invalid JSON without changing data providers", async () => {
    const limited = vi.fn(
      async () => new Response("limit", { status: 429 }),
    ) as unknown as typeof fetch;
    await expect(findRegionForBounds(bbox, { fetcher: limited })).rejects.toMatchObject({
      code: "RATE_LIMIT",
    });
    expect(limited).toHaveBeenCalledTimes(1);
    const invalid = vi.fn(async () => new Response("not JSON")) as unknown as typeof fetch;
    await expect(findRegionForBounds(bbox, { fetcher: invalid })).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
});

async function pbfFile(
  raw: OSMResponse,
  options: { dense?: boolean; required?: string[]; unsorted?: boolean } = {},
) {
  const directory = await mkdtemp(join(tmpdir(), "resiliroute-pbf-test-"));
  temporary.push(directory);
  const path = join(directory, "sample.osm.pbf");
  const strings = [""];
  const index = (value: string) => {
    let found = strings.indexOf(value);
    if (found < 0) {
      found = strings.length;
      strings.push(value);
    }
    return found;
  };
  const tags = (value: Record<string, string> = {}) => ({
    keys: Object.keys(value).map(index),
    vals: Object.values(value).map(index),
  });
  const nodes = raw.elements
    .filter((element): element is OSMNode => element.type === "node")
    .map((node) => ({
      id: node.id,
      lat: Math.round((node.lat - 0.125) * 1e6),
      lon: Math.round((node.lon - 0.25) * 1e6),
      ...tags(node.tags),
      info: { uid: 123, user_sid: index("private-contributor") },
    }));
  const ways = raw.elements
    .filter((element): element is OSMWay => element.type === "way")
    .map((way) => ({
      id: way.id,
      ...tags(way.tags),
      refs: way.nodes.map((id, i) => id - (way.nodes[i - 1] ?? 0)),
    }));
  const nodeGroup: OsmPbfBlock["primitivegroup"][number] = {
    nodes: options.dense ? [] : nodes,
    ways: [],
    relations: [],
  };
  if (options.dense)
    nodeGroup.dense = {
      id: nodes.map((node, i) => node.id - (nodes[i - 1]?.id ?? 0)),
      lat: nodes.map((node, i) => node.lat - (nodes[i - 1]?.lat ?? 0)),
      lon: nodes.map((node, i) => node.lon - (nodes[i - 1]?.lon ?? 0)),
      keys_vals: nodes.flatMap((node) => [
        ...node.keys.flatMap((key, i) => [key, node.vals[i]]),
        0,
      ]),
    };
  const stringtable = strings.map((value) => new TextEncoder().encode(value));
  const settings = { granularity: 1e6, lat_offset: 0.125, lon_offset: 0.25 };
  const header: OsmPbfHeaderBlock = {
    required_features: options.required ?? ["OsmSchema-V0.6", "DenseNodes"],
    optional_features: ["Sort.Type_then_ID"],
    osmosis_replication_timestamp: Date.parse("2026-10-10T00:00:00Z") / 1000,
  };
  const nodeBlock: OsmPbfBlock = { stringtable, primitivegroup: [nodeGroup], ...settings };
  const wayBlock: OsmPbfBlock = {
    stringtable,
    primitivegroup: [{ nodes: [], ways, relations: [] }],
    ...settings,
  };
  const blocks = options.unsorted ? [wayBlock, nodeBlock] : [nodeBlock, wayBlock];
  await writeFile(
    path,
    Buffer.concat(
      await Promise.all(
        [header, ...blocks].map(async (block) => Buffer.from(await osmBlockToPbfBlobBytes(block))),
      ),
    ),
  );
  return path;
}

describe("bounded regional PBF extraction", () => {
  it.each([false, true])(
    "preserves exact geometry, topology, facilities and source date (dense=%s)",
    async (dense) => {
      const raw = structuredClone(fixture) as OSMResponse;
      const first = raw.elements.find((element) => element.type === "node")! as OSMNode;
      first.tags = {
        amenity: "clinic",
        name: "Public Clinic",
        phone: "private-contact",
        "addr:street": "private-address",
      };
      const path = await pbfFile(raw, { dense });
      const progress: number[] = [];
      const result = await extractPbfRegion(path, bbox, {
        profile: "detailed",
        onProgress: (p) => progress.push(p.bytesRead),
      });
      const node = result.raw.elements.find(
        (element) => element.type === "node" && element.id === 1,
      );
      expect(node).toMatchObject({
        type: "node",
        id: 1,
        tags: { amenity: "clinic", name: "Public Clinic" },
      });
      expect((node as OSMNode).lat).toBeCloseTo(first.lat, 8);
      expect((node as OSMNode).lon).toBeCloseTo(first.lon, 8);
      expect(
        result.raw.elements.find((element) => element.type === "way" && element.id === 102),
      ).toMatchObject({ nodes: [3, 4] });
      expect(result.timestamp).toBe("2026-10-10T00:00:00.000Z");
      expect(result.excludedRelationFacilities).toBeNull();
      expect(result.bytesRead).toBe((await stat(path)).size * 2);
      expect(progress.at(-1)).toBe(result.bytesRead);
      expect(progress).toEqual([...progress].sort((a, b) => a - b));
      expect(JSON.stringify(result)).not.toMatch(
        /private-contact|private-address|private-contributor|user_sid/,
      );
      const built = buildRealCityNetwork(result.raw, bbox);
      const baseline = simulate(built.network, built.odPairs, []);
      const bridge = built.network.edges.find((edge) => edge.osm?.wayId === 102)!;
      const closed = simulate(built.network, built.odPairs, [bridge.id], baseline);
      expect(Number.isFinite(baseline.metrics.averageTravelTime)).toBe(true);
      expect(closed.edgeStates[bridge.id].volume).toBe(0);
    },
  );
  it("retains outside shape references, excludes unrelated roads, and honors regional classes", async () => {
    const raw = structuredClone(fixture) as OSMResponse;
    raw.elements.push(
      { type: "node", id: 1000, lat: 34.9, lon: 138.9 },
      { type: "node", id: 1001, lat: 34.91, lon: 138.91 },
      { type: "way", id: 9001, nodes: [1000, 1], tags: { highway: "primary" } },
      { type: "way", id: 9002, nodes: [1000, 1001], tags: { highway: "primary" } },
    );
    const result = await extractPbfRegion(await pbfFile(raw, { dense: true }), bbox, {
      profile: "regional",
    });
    expect(
      result.raw.elements.some((element) => element.type === "node" && element.id === 1000),
    ).toBe(true);
    expect(
      result.raw.elements.some((element) => element.type === "node" && element.id === 1001),
    ).toBe(false);
    expect(
      result.raw.elements.some((element) => element.type === "way" && element.id === 9002),
    ).toBe(false);
    expect(
      result.raw.elements
        .filter((element) => element.type === "way")
        .some((way) => way.tags.highway === "residential"),
    ).toBe(false);
  });
  it("derives facility-way center from actual vertices without fabricating relation geometry", async () => {
    const raw = structuredClone(fixture) as OSMResponse;
    raw.elements.push({
      type: "way",
      id: 9000,
      nodes: [1, 2, 3, 1],
      tags: { amenity: "hospital" },
    });
    const result = await extractPbfRegion(await pbfFile(raw), bbox, { profile: "detailed" });
    const hospital = result.raw.elements.find(
      (element) => element.type === "way" && element.id === 9000,
    ) as OSMWay;
    expect(hospital.center?.lat).toBeCloseTo(35.003, 8);
    expect(hospital.center?.lon).toBeCloseTo(139.005, 8);
  });
  it("rejects unsupported history features, unsorted files and missing geometry", async () => {
    const raw = structuredClone(fixture) as OSMResponse;
    await expect(
      extractPbfRegion(
        await pbfFile(raw, { required: ["OsmSchema-V0.6", "HistoricalInformation"] }),
        bbox,
        { profile: "detailed" },
      ),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    await expect(
      extractPbfRegion(await pbfFile(raw, { unsorted: true }), bbox, { profile: "detailed" }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    raw.elements.push({ type: "way", id: 888, nodes: [1, 9999], tags: { highway: "primary" } });
    await expect(
      extractPbfRegion(await pbfFile(raw), bbox, { profile: "detailed" }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("rejects truncated blobs and cancels without returning a partial network", async () => {
    const path = await pbfFile(fixture as OSMResponse);
    const controller = new AbortController();
    await expect(
      extractPbfRegion(path, bbox, {
        profile: "detailed",
        signal: controller.signal,
        onProgress: () => controller.abort(),
      }),
    ).rejects.toMatchObject({ code: "CANCELLED" });
    const bytes = await readFile(path);
    await writeFile(path, bytes.subarray(0, bytes.length - 3));
    await expect(extractPbfRegion(path, bbox, { profile: "detailed" })).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it("preserves validated regional provenance across snapshot export/import", () => {
    const built = buildRealCityNetwork(fixture, bbox);
    built.osmMetadata.regionalExtract = {
      provider: "Geofabrik",
      regionId: "asia/japan/test",
      regionName: "Test region",
      fileDate: "2026-10-11T00:00:00Z",
      downloadedAt: "2026-10-16T00:00:00Z",
      excludedRelationFacilities: null,
    };
    expect(validateSnapshot(built).osmMetadata.regionalExtract).toEqual(
      built.osmMetadata.regionalExtract,
    );
    built.osmMetadata.regionalExtract.regionId = "../../private";
    expect(() => validateSnapshot(built)).toThrow("INVALID_SNAPSHOT");
  });
});
