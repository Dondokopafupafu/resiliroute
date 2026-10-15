import { describe, expect, it } from "vitest";
import { harborCity, odPairs } from "@/data/harbor-city";
import { scenarios, toggleClosure } from "@/data/scenarios";
import { buildGraph, shortestPath } from "@/lib/graph/shortest-path";
import { calculateEdgeVolumes, calculateODAssignment } from "@/lib/simulation/assignment";
import { calculateCongestedTravelTime } from "@/lib/simulation/congestion";
import { simulate } from "@/lib/simulation/simulate";
import { analyzeCriticalLinks, analyzeRecovery } from "@/lib/simulation/stress-test";
import { calculateResilienceScore } from "@/lib/metrics/metrics";
import type { Network } from "@/types/network";

const small: Network = {
  nodes: harborCity.nodes.slice(0, 3).map((n, i) => ({ ...n, id: ["a", "b", "c"][i] })),
  edges: [
    { ...harborCity.edges[0], id: "ab", source: "a", target: "b", freeFlowTime: 2 },
    { ...harborCity.edges[0], id: "bc", source: "b", target: "c", freeFlowTime: 3 },
    { ...harborCity.edges[0], id: "ac", source: "a", target: "c", freeFlowTime: 9 },
  ],
};

describe("Dijkstra", () => {
  it("finds the exact least-cost path", () => {
    const path = shortestPath(buildGraph(small), "a", "c");
    expect(path.edgeIds).toEqual(["ab", "bc"]);
    expect(path.travelTime).toBe(5);
  });
  it("excludes unavailable links", () => {
    expect(shortestPath(buildGraph(small, ["bc"]), "a", "c").edgeIds).toEqual(["ac"]);
    const unavailable = {
      ...small,
      edges: small.edges.map((e) => ({ ...e, available: e.id !== "ab" })),
    };
    expect(shortestPath(buildGraph(unavailable), "a", "c").edgeIds).toEqual(["ac"]);
  });
  it("detects unreachable and invalid destinations", () => {
    expect(shortestPath(buildGraph(small, ["ac", "bc"]), "a", "c").reachable).toBe(false);
    expect(shortestPath(buildGraph(small), "unknown", "c").reachable).toBe(false);
  });
  it("handles identity, one-way links, and custom costs", () => {
    expect(shortestPath(buildGraph(small), "a", "a").travelTime).toBe(0);
    const oneWay = { ...small, edges: small.edges.map((e) => ({ ...e, bidirectional: false })) };
    expect(shortestPath(buildGraph(oneWay), "c", "a").reachable).toBe(false);
    expect(
      shortestPath(buildGraph(small), "a", "c", (e) => (e.id === "ac" ? 1 : 10)).edgeIds,
    ).toEqual(["ac"]);
    expect(() => shortestPath(buildGraph(small), "a", "c", () => -1)).toThrow();
  });
});

describe("Demand and congestion", () => {
  it("adds OD demand to every traversed edge", () => {
    const od = { ...odPairs[0], origin: "a", destination: "c", demand: 100 };
    const path = shortestPath(buildGraph(small), "a", "c");
    expect(calculateEdgeVolumes(small, [{ od, path }])).toEqual({ ab: 100, bc: 100, ac: 0 });
  });
  it("conserves assigned flow at each residential origin", () => {
    const result = calculateODAssignment(harborCity, odPairs, scenarios.earthquake.closedEdgeIds);
    for (const a of result.assignments) {
      expect(a.flowPaths.reduce((sum, r) => sum + r.volume, 0)).toBeCloseTo(
        a.path.reachable ? a.od.demand : 0,
        6,
      );
      for (const route of a.flowPaths)
        expect(
          route.path.edgeIds.some((id) => scenarios.earthquake.closedEdgeIds.includes(id)),
        ).toBe(false);
    }
    for (const edge of harborCity.edges) {
      const expected = result.assignments.reduce(
        (sum, a) =>
          sum +
          a.flowPaths
            .filter((r) => r.path.edgeIds.includes(edge.id))
            .reduce((s, r) => s + r.volume, 0),
        0,
      );
      expect(result.edgeStates[edge.id].volume).toBeCloseTo(expected, 6);
    }
  });
  it("increases BPR travel time with demand and safely caps it", () => {
    expect(calculateCongestedTravelTime(10, 0, 100)).toBe(10);
    expect(calculateCongestedTravelTime(10, 100, 100)).toBe(11.5);
    expect(calculateCongestedTravelTime(10, 200, 100)).toBeGreaterThan(11.5);
    expect(calculateCongestedTravelTime(10, 100000, 100)).toBe(
      calculateCongestedTravelTime(10, 250, 100),
    );
    expect(() => calculateCongestedTravelTime(10, 100, 0)).toThrow();
  });
});

describe("Resilience and stress testing", () => {
  const baseline = simulate(harborCity, odPairs);
  const earthquake = simulate(harborCity, odPairs, scenarios.earthquake.closedEdgeIds, baseline);
  it("reduces population-weighted service access after disruption", () => {
    expect(earthquake.metrics.accessibility).toBeLessThan(baseline.metrics.accessibility);
    expect(earthquake.metrics.networkEfficiency).toBeLessThan(baseline.metrics.networkEfficiency);
  });
  it("keeps all scores finite and within 0–100, including full isolation", () => {
    const isolated = simulate(
      harborCity,
      odPairs,
      harborCity.edges.map((e) => e.id),
      baseline,
    );
    expect(isolated.metrics.resilienceScore).toBe(0);
    expect(isolated.metrics.disconnectedDemand).toBe(baseline.metrics.totalDemand);
    for (const r of [baseline, earthquake, isolated]) {
      for (const key of ["resilienceScore", "accessibility", "networkEfficiency"] as const) {
        expect(r.metrics[key]).toBeGreaterThanOrEqual(0);
        expect(r.metrics[key]).toBeLessThanOrEqual(100);
      }
      expect(Number.isFinite(r.metrics.averageTravelTime)).toBe(true);
    }
    expect(calculateResilienceScore(baseline.metrics, baseline.metrics)).toBe(100);
  });
  it("ranks significant crossings above local links", () => {
    const rank = analyzeCriticalLinks(harborCity, odPairs, baseline);
    expect(rank.find((e) => e.edgeId === "harbor-bridge")!.score).toBeGreaterThan(
      rank.find((e) => e.edgeId === "community-road")!.score,
    );
    const currentRank = analyzeCriticalLinks(harborCity, odPairs, earthquake, baseline);
    expect(currentRank.some((e) => earthquake.closedEdgeIds.includes(e.edgeId))).toBe(false);
    expect(currentRank[0].edgeId).not.toBe(rank[0].edgeId);
  });
  it("calculates recovery improvements and reset restores the reference", () => {
    const recovered = analyzeRecovery(harborCity, odPairs, earthquake, baseline);
    expect(recovered).toHaveLength(earthquake.closedEdgeIds.length);
    expect(recovered[0].resilienceGain).toBeGreaterThanOrEqual(recovered[1].resilienceGain);
    expect(simulate(harborCity, odPairs, [], baseline).metrics).toEqual(baseline.metrics);
    expect(toggleClosure(toggleClosure([], "harbor-bridge"), "harbor-bridge")).toEqual([]);
  });
});
