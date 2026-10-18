import { describe, expect, it } from "vitest";
import { buildRealCityNetwork } from "@/lib/osm/network-builder";
import { areaDimensions, validateBoundingBox } from "@/lib/osm/geo";
import { realCityConfig } from "@/lib/real-city/model-config";
import { chooseNetworkProfile, importRoadClasses } from "@/lib/real-city/network-profile";
import { validateSnapshot } from "@/lib/real-city/snapshot";
import { screenCriticalCandidates } from "@/lib/real-city/stress-screening";
import { simulate } from "@/lib/simulation/simulate";
import type { BoundingBox, OSMNode, OSMResponse, OSMWay } from "@/types/real-city";
import okayama from "../public/real-city/okayama.json";
import matsumoto from "../public/real-city/matsumoto.json";

const bounds: BoundingBox = { south: 35, west: 139, north: 35.08, east: 139.1 };
/** Deterministic grid for performance regression; it is not a real-city dataset. */
function grid(size: number, highway = "secondary"): OSMResponse {
  const nodes: OSMNode[] = Array.from({ length: size * size }, (_, i) => ({
    type: "node",
    id: i + 1,
    lat: bounds.south + 0.001 + (Math.floor(i / size) / (size - 1)) * 0.078,
    lon: bounds.west + 0.001 + ((i % size) / (size - 1)) * 0.098,
  }));
  const ways: OSMWay[] = [];
  for (let row = 0; row < size; row++)
    ways.push({
      type: "way",
      id: 100000 + row,
      tags: { highway, name: `Test corridor ${row}` },
      nodes: Array.from({ length: size }, (_, col) => row * size + col + 1),
    });
  for (let col = 0; col < size; col++)
    ways.push({
      type: "way",
      id: 200000 + col,
      tags: { highway },
      nodes: Array.from({ length: size }, (_, row) => row * size + col + 1),
    });
  return { elements: [...nodes, ...ways] };
}

describe("bounded regional networks", () => {
  it("accepts a larger region while retaining limits and exact selected bounds", () => {
    expect(areaDimensions(bounds).area).toBeGreaterThan(75);
    expect(areaDimensions(bounds).area).toBeLessThan(100);
    expect(validateBoundingBox(bounds)).toEqual(bounds);
    expect(() => validateBoundingBox({ ...bounds, north: 35.2 })).toThrow("AREA_TOO_LARGE");
    expect(chooseNetworkProfile(bounds)).toBe("regional");
    expect(chooseNetworkProfile({ ...bounds, north: 35.02, east: 139.02 })).toBe("detailed");
  });

  it("preserves a disclosed class profile without silently shortening the area", () => {
    const raw = grid(5);
    raw.elements.push({ type: "way", id: 300000, nodes: [1, 7], tags: { highway: "residential" } });
    const regional = buildRealCityNetwork(raw, bounds);
    expect(regional.bbox).toEqual(bounds);
    expect(regional.importProfile).toMatchObject({
      mode: "regional",
      reason: "area",
      excludedRoadWays: 1,
    });
    expect(regional.importProfile?.includedHighways).toEqual(importRoadClasses("regional"));
    expect(regional.network.edges.some((e) => e.osm?.wayId === 300000)).toBe(false);
    expect(regional.demandModel.weightSource).toBe("road length proxy");
    expect(regional.odPairs.every((p) => Number.isFinite(p.demand) && p.demand > 0)).toBe(true);
    expect(buildRealCityNetwork(raw, bounds).odPairs).toEqual(regional.odPairs);
    expect(validateSnapshot(regional).importProfile).toEqual(regional.importProfile);
    const explicit = buildRealCityNetwork(raw, bounds, undefined, {
      profile: "regional",
      reason: "density",
    });
    expect(explicit.importProfile?.reason).toBe("density");
  });

  it("never fabricates an arterial network when only local streets are supplied", () => {
    expect(() => buildRealCityNetwork(grid(5, "residential"), bounds)).toThrow("EMPTY_ROADS");
    const detailed = buildRealCityNetwork(grid(5, "residential"), bounds, undefined, {
      profile: "detailed",
    });
    expect(detailed.importProfile?.mode).toBe("detailed");
    expect(detailed.demandModel.weightSource).toBe("residential road length proxy");
  });

  it("imports version 1.0 examples unchanged and rejects invalid profile provenance", () => {
    for (const raw of [okayama, matsumoto]) {
      const snapshot = validateSnapshot(raw);
      expect(snapshot.realCityModelVersion).toBe("1.0");
      expect(snapshot.osmMetadata.queryVersion).toBe("vehicle-network-v1");
      expect(snapshot.odPairs).toEqual(raw.odPairs);
      expect(snapshot.network.edges).toEqual(raw.network.edges);
    }
    const s = buildRealCityNetwork(grid(5), bounds);
    const invalid = structuredClone(s);
    invalid.importProfile!.includedHighways = ["invented"];
    expect(() => validateSnapshot(invalid)).toThrow("INVALID_SNAPSHOT");
    delete s.importProfile;
    expect(() => validateSnapshot(s)).toThrow("INVALID_SNAPSHOT");
  });

  it("runs the unchanged engine near the road limit, closes a road and reduces sweep work", () => {
    const started = performance.now();
    const snapshot = buildRealCityNetwork(grid(63), bounds);
    expect(snapshot.stats.intersections).toBe(3969);
    expect(snapshot.stats.roadLinks).toBe(7812);
    const baseline = simulate(snapshot.network, snapshot.odPairs);
    const simulationMs = performance.now() - started;
    const closed = Object.values(baseline.edgeStates).sort((a, b) => b.volume - a.volume)[0].id;
    const current = simulate(snapshot.network, snapshot.odPairs, [closed], baseline);
    expect(current.edgeStates[closed].volume).toBe(0);
    expect(current.assignments.every((a) => !a.path.edgeIds.includes(closed))).toBe(true);
    expect(current.metrics.totalDemand).toBe(baseline.metrics.totalDemand);
    expect(Object.values(current.metrics).every(Number.isFinite)).toBe(true);
    const screening = screenCriticalCandidates(snapshot.network, current);
    expect(screening.ids).toHaveLength(realCityConfig.largeStressCandidates);
    expect(screening.total).toBe(7811);
    expect(screening.ids).not.toContain(closed);
    expect(validateSnapshot(snapshot).network.edges).toHaveLength(7812);
    // Deliberately generous regression guard, not a universal performance claim.
    expect(simulationMs).toBeLessThan(15000);
    console.info(
      JSON.stringify({
        syntheticGrid: "3969 nodes / 7812 roads",
        buildAndBaselineMs: Math.round(simulationMs),
        closedRoadMs: Math.round(performance.now() - started - simulationMs),
      }),
    );
  }, 60000);

  it("rejects graphs beyond the cap instead of keeping an arbitrary partial network", () => {
    expect(() => buildRealCityNetwork(grid(65), bounds)).toThrow("TOO_COMPLEX");
  });
});
