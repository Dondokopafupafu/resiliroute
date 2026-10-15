import { describe, expect, it } from "vitest";
import { harborCity, modelConfig, odPairs } from "@/data/harbor-city";
import { scenarios } from "@/data/scenarios";
import { simulate } from "@/lib/simulation/simulate";
import { analyzeCriticalLinks, analyzeRecovery } from "@/lib/simulation/stress-test";
import { buildGraph, shortestPath } from "@/lib/graph/shortest-path";

describe("Harbor City dataset audit", () => {
  const baseline = simulate(harborCity, odPairs);
  const earthquake = simulate(harborCity, odPairs, scenarios.earthquake.closedEdgeIds, baseline);
  it("has valid unique nodes, edges, and demand", () => {
    expect(new Set(harborCity.nodes.map((n) => n.id)).size).toBe(harborCity.nodes.length);
    expect(new Set(harborCity.edges.map((e) => e.id)).size).toBe(harborCity.edges.length);
    const ids = new Set(harborCity.nodes.map((n) => n.id));
    for (const edge of harborCity.edges) {
      expect(ids.has(edge.source) && ids.has(edge.target)).toBe(true);
      expect(edge.capacity).toBeGreaterThan(0);
      expect(edge.distance).toBeGreaterThan(0);
    }
    for (const od of odPairs)
      expect(ids.has(od.origin) && ids.has(od.destination) && od.demand > 0).toBe(true);
  });
  it("connects every node and every essential facility in normal conditions", () => {
    const graph = buildGraph(harborCity);
    for (const node of harborCity.nodes)
      expect(shortestPath(graph, harborCity.nodes[0].id, node.id).reachable).toBe(true);
    expect(baseline.metrics.disconnectedODPairs).toBe(0);
    expect(baseline.metrics.accessibility).toBeGreaterThan(85);
  });
  it("produces meaningful earthquake impacts and redistributes demand", () => {
    expect(earthquake.metrics.averageTravelTime).toBeGreaterThan(
      baseline.metrics.averageTravelTime * 1.15,
    );
    expect(earthquake.metrics.accessibility).toBeLessThan(baseline.metrics.accessibility);
    expect(earthquake.metrics.resilienceScore).toBeLessThan(90);
    expect(earthquake.edgeStates["harbor-bridge"].volume).toBe(0);
    expect(earthquake.edgeStates["riverside-crossing"].volume).toBeGreaterThan(
      baseline.edgeStates["riverside-crossing"].volume,
    );
  });
  it("bounds BPR values without discarding over-capacity utilization", () => {
    for (const edge of harborCity.edges) {
      const state = earthquake.edgeStates[edge.id];
      expect(Number.isFinite(state.travelTime)).toBe(true);
      expect(state.travelTime).toBeLessThanOrEqual(
        edge.freeFlowTime * (1 + modelConfig.bprAlpha * modelConfig.maxVolumeCapacityRatio ** 4) +
          1e-8,
      );
    }
  });
  it("computes rankings and reports reproducible audit values", () => {
    const ranking = analyzeCriticalLinks(harborCity, odPairs, baseline);
    const recovery = analyzeRecovery(harborCity, odPairs, earthquake, baseline);
    console.info(
      JSON.stringify(
        {
          baseline: baseline.metrics,
          earthquake: earthquake.metrics,
          districts: earthquake.districts,
          critical: ranking.slice(0, 5),
          recovery: recovery.map(({ name, resilienceGain, accessibilityGain }) => ({
            name,
            resilienceGain,
            accessibilityGain,
          })),
        },
        null,
        2,
      ),
    );
    expect(ranking.slice(0, 5).some((e) => ["harbor-bridge", "east-rail"].includes(e.edgeId))).toBe(
      true,
    );
    expect(recovery[0].resilienceGain).toBeGreaterThan(0);
  });
});
