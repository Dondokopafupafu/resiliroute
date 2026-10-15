import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/osm-small.json";
import { areaDimensions, geometryDistance, haversine, validateBoundingBox } from "@/lib/osm/geo";
import { buildOverpassQuery } from "@/lib/osm/query-builder";
import { parseOSMResponse } from "@/lib/osm/osm-parser";
import { buildRealCityNetwork } from "@/lib/osm/network-builder";
import { parseLanes, parseMaxspeed, roadModel } from "@/lib/real-city/road-model";
import { validateSnapshot } from "@/lib/real-city/snapshot";
import { simulate } from "@/lib/simulation/simulate";
import { analyzeCriticalLinks, analyzeRecovery } from "@/lib/simulation/stress-test";
import { buildGraph, shortestPath } from "@/lib/graph/shortest-path";
import { screenCriticalCandidates } from "@/lib/real-city/stress-screening";
import { realCityConfig } from "@/lib/real-city/model-config";
import { fetchOverpass } from "@/lib/osm/overpass-client";
import { createNetworkService } from "@/lib/osm/network-service";

export const bbox = { south: 35, west: 139, north: 35.02, east: 139.02 };
const build = () => buildRealCityNetwork(fixture, bbox, "2026-10-10T00:00:00Z");
describe("real-city import and shared simulation", () => {
  it("validates finite bounds and ordering", () => {
    for (const b of [
      null,
      {},
      { ...bbox, south: NaN },
      { ...bbox, west: 200 },
      { ...bbox, north: 34 },
    ])
      expect(() => validateBoundingBox(b)).toThrow();
  });
  it("rejects areas above 25 km² before querying", () =>
    expect(() => buildOverpassQuery({ south: 35, west: 139, north: 36, east: 140 })).toThrow(
      "AREA_TOO_LARGE",
    ));
  it("calculates latitude-aware dimensions", () => {
    expect(areaDimensions(bbox).area).toBeCloseTo(4.05, 1);
    expect(haversine([0, 0], [0, 1])).toBeCloseTo(111.195, 2);
  });
  it("uses a bounded vehicle-road query and real facility tags", () => {
    const q = buildOverpassQuery(bbox);
    expect(q).toContain(".roads >");
    expect(q).toContain("hospital|clinic");
    expect(q).not.toContain("footway");
  });
  it("rejects malformed or partial/remark responses", () => {
    for (const raw of [
      {},
      { elements: [{ type: "node", id: 1, lat: null, lon: 139 }] },
      { ...fixture, remark: "timeout" },
    ])
      expect(() => parseOSMResponse(raw)).toThrow("INVALID_RESPONSE");
  });
  it("splits intersections and retains degree-two geometry", () => {
    const s = build();
    expect(s.network.nodes.some((n) => n.id === "osm-node-2")).toBe(false);
    const e = s.network.edges.find((e) => e.osm?.wayId === 101)!;
    expect(e.geometry).toHaveLength(3);
    expect(e.target).toBe("osm-node-3");
    expect(e.distance).toBeCloseTo(geometryDistance(e.geometry!), 8);
    expect(s.network.edges.some((e) => e.osm?.wayId === 110)).toBe(false);
  });
  it("preserves one-way direction and supports reversed ways", () => {
    const raw = structuredClone(fixture);
    raw.elements.find((e) => e.id === 107)!.tags!.oneway = "-1";
    const s = buildRealCityNetwork(raw, bbox);
    const e = s.network.edges.find((e) => e.osm?.wayId === 107)!;
    expect(e.source).toBe("osm-node-8");
    expect(e.target).toBe("osm-node-7");
    expect(e.bidirectional).toBe(false);
  });
  it("parses km/h and mph; invalid speed tags use road defaults", () => {
    expect(parseMaxspeed("30 mph")).toBeCloseTo(48.28032);
    expect(parseMaxspeed("50 km/h")).toBe(50);
    expect(parseMaxspeed("signals")).toBeNull();
    expect(roadModel({ highway: "secondary", maxspeed: "0" }).speedKmh).toBe(40);
  });
  it("estimates shared capacity from all lanes and road class", () => {
    expect(parseLanes("2")).toBe(2);
    expect(parseLanes("unknown")).toBeNull();
    expect(roadModel({ highway: "primary", lanes: "4" }).capacity).toBe(6000);
    expect(roadModel({ highway: "residential" }).capacity).toBe(900);
  });
  it("snaps real facilities without replacing road nodes", () => {
    const s = build();
    expect(s.facilities).toHaveLength(3);
    expect(s.stats.excludedFacilities).toBe(1);
    expect(s.facilities.every((f) => f.snapDistanceKm <= realCityConfig.maxSnapKm)).toBe(true);
    expect(s.stats.components).toBe(1);
  });
  it("generates reproducible finite nonnegative demand on real geometry", () => {
    const a = build(),
      b = build();
    expect(a.odPairs).toEqual(b.odPairs);
    expect(a.odPairs.every((p) => Number.isFinite(p.demand) && p.demand > 0)).toBe(true);
    expect(a.stats.origins).toBeGreaterThan(1);
  });
  it("runs the existing engine, redistributes traffic, ranks recovery, and resets", () => {
    const s = build();
    const before = simulate(s.network, s.odPairs);
    const closed = "osm-way-102-0";
    const after = simulate(s.network, s.odPairs, [closed], before);
    expect(after.edgeStates[closed].volume).toBe(0);
    expect(after.assignments.every((a) => !a.path.edgeIds.includes(closed))).toBe(true);
    expect(after.metrics.averageTravelTime).toBeGreaterThan(before.metrics.averageTravelTime);
    expect(after.metrics.resilienceScore).toBeLessThan(100);
    expect(after.edgeStates["osm-way-105-0"].volume).toBeGreaterThan(
      before.edgeStates["osm-way-105-0"].volume,
    );
    expect(analyzeRecovery(s.network, s.odPairs, after, before)[0].resilienceGain).toBeGreaterThan(
      0,
    );
    expect(simulate(s.network, s.odPairs, [], before).metrics).toEqual(before.metrics);
    expect(
      shortestPath(buildGraph(s.network, [closed]), "osm-node-3", "osm-node-4").edgeIds,
    ).not.toContain(closed);
  });
  it("calculates actual criticality and excludes connectors", () => {
    const s = build(),
      before = simulate(s.network, s.odPairs),
      screen = screenCriticalCandidates(s.network, before);
    expect(screen.screened).toBe(false);
    expect(screen.ids.every((id) => !id.startsWith("connector"))).toBe(true);
    expect(
      analyzeCriticalLinks(s.network, s.odPairs, before, before, screen.ids)[0].score,
    ).toBeGreaterThan(0);
  });
  it("excludes missing service categories and handles no facilities", () => {
    const raw = {
      ...fixture,
      elements: fixture.elements.filter(
        (e) => !e.tags?.amenity && !e.tags?.railway && !e.tags?.emergency,
      ),
    };
    const s = buildRealCityNetwork(raw, bbox);
    expect(s.network.accessibilityCategories).toEqual([]);
    expect(Number.isFinite(simulate(s.network, s.odPairs).metrics.resilienceScore)).toBe(true);
  });
  it("round-trips sanitized snapshots and rejects bad references or infinity", () => {
    const s = build();
    expect(validateSnapshot(JSON.parse(JSON.stringify(s))).odPairs).toEqual(s.odPairs);
    const invalid = structuredClone(s);
    invalid.network.edges[0].target = "missing";
    expect(() => validateSnapshot(invalid)).toThrow();
    invalid.network.edges[0].target = s.network.edges[0].target;
    invalid.odPairs[0].demand = Infinity;
    expect(() => validateSnapshot(invalid)).toThrow();
  });
  it("rejects huge raw networks", () =>
    expect(() =>
      parseOSMResponse({
        elements: Array.from({ length: realCityConfig.maxElements + 1 }, () => fixture.elements[0]),
      }),
    ).toThrow("TOO_COMPLEX"));
});
describe("Overpass failure safety", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });
  it("validates oversized requests before any upstream call", async () => {
    let calls = 0;
    const service = createNetworkService(async () => {
      calls++;
      return Response.json(fixture);
    });
    await expect(service({ ...bbox, north: 36 })).rejects.toThrow("AREA_TOO_LARGE");
    expect(calls).toBe(0);
  });
  it("reports empty roads without manufacturing a network", () => {
    expect(() => buildRealCityNetwork({ elements: [] }, bbox)).toThrow("EMPTY_ROADS");
  });
  it("splits a long way at internal shared intersections", () => {
    const raw = structuredClone(fixture);
    raw.elements.find((e) => e.id === 101)!.nodes = [1, 2, 3, 4, 5];
    const roads = buildRealCityNetwork(raw, bbox).network.edges.filter((e) => e.osm?.wayId === 101);
    expect(roads.map((e) => e.target)).toEqual(["osm-node-3", "osm-node-4", "osm-node-5"]);
  });
  it("handles implicit roundabout direction and explicit two-way override", () => {
    expect(roadModel({ highway: "tertiary", junction: "roundabout" }).oneWay).toBe(true);
    expect(roadModel({ highway: "tertiary", junction: "roundabout", oneway: "no" }).oneWay).toBe(
      false,
    );
  });
  it("guards simplified network size before traffic assignment", () => {
    const nodes = Array.from({ length: 950 }, (_, i) => ({
      type: "node",
      id: i + 1,
      lat: 35.001 + i * 0.00001,
      lon: 139.005,
    }));
    const ways = nodes.slice(1).map((n, i) => ({
      type: "way",
      id: 10000 + i,
      nodes: [n.id - 1, n.id],
      tags: { highway: "residential" },
    }));
    expect(() => buildRealCityNetwork({ elements: [...nodes, ...ways] }, bbox)).toThrow(
      "TOO_COMPLEX",
    );
  });
  it("times out, bounds retries, and respects cancellation", async () => {
    let attempts = 0;
    const fetcher: typeof fetch = async (_, init) => {
      attempts++;
      return new Promise((_, reject) =>
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true }),
      );
    };
    await expect(
      fetchOverpass(bbox, {
        fetcher,
        timeoutMs: 10,
        endpoints: ["https://example.com", "https://example.org"],
      }),
    ).rejects.toThrow("TIMEOUT");
    expect(attempts).toBe(2);
    await expect(fetchOverpass(bbox, { signal: AbortSignal.abort() })).rejects.toThrow("CANCELLED");
  });
  it("uses the current documented fallback once after a temporary failure", async () => {
    vi.stubEnv("OVERPASS_API_URL", "");
    vi.stubEnv("OVERPASS_FALLBACK_URL", "");
    const urls: string[] = [];
    await fetchOverpass(bbox, {
      fetcher: async (url) => {
        urls.push(String(url));
        return urls.length === 1 ? new Response(null, { status: 503 }) : Response.json(fixture);
      },
    });
    expect(urls).toEqual([
      "https://overpass-api.de/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
    ]);
  });
  it("does not retry or fail over around a rate limit and honors Retry-After", async () => {
    let calls = 0;
    vi.useFakeTimers({ toFake: ["Date"] });
    const service = createNetworkService(async () => {
      calls++;
      return new Response(null, { status: 429, headers: { "Retry-After": "900" } });
    });
    await expect(service(bbox)).rejects.toMatchObject({
      code: "RATE_LIMIT",
      retryAfterSeconds: 900,
    });
    vi.setSystemTime(Date.now() + 600000);
    await expect(service(bbox)).rejects.toMatchObject({
      code: "RATE_LIMIT",
      retryAfterSeconds: 300,
    });
    expect(calls).toBe(1);
    vi.setSystemTime(Date.now() + 301000);
    await expect(service(bbox)).rejects.toMatchObject({ code: "RATE_LIMIT" });
    expect(calls).toBe(2);
  });
  it("rejects HTTP errors and invalid JSON", async () => {
    for (const response of [new Response("error", { status: 503 }), new Response("broken json")])
      await expect(
        fetchOverpass(bbox, { endpoints: ["https://example.com"], fetcher: async () => response }),
      ).rejects.toThrow();
  });
  it("uses fallback endpoints and caches normalized bounds", async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls++;
      return Response.json(fixture);
    };
    const service = createNetworkService(fetcher);
    const first = await service(bbox),
      second = await service(bbox);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(calls).toBe(1);
    let attempt = 0;
    await expect(
      fetchOverpass(bbox, {
        endpoints: ["https://example.com", "https://example.org"],
        fetcher: async () =>
          ++attempt === 1 ? new Response("error", { status: 503 }) : Response.json(fixture),
      }),
    ).resolves.toHaveProperty("elements");
  });
});
