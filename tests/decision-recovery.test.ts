import { describe, expect, it } from "vitest";
import { harborCity, odPairs } from "@/data/harbor-city";
import { scenarios } from "@/data/scenarios";
import okayama from "../public/real-city/okayama.json";
import { validateSnapshot } from "@/lib/real-city/snapshot";
import { simulate } from "@/lib/simulation/simulate";
import { decisionConfig } from "@/lib/decision/config";
import {
  calculateRecoverySequence,
  exactRecoveryLimit,
  inferRecoveryCost,
  optimizeRecovery,
  recoveryObjectiveScore,
} from "@/lib/decision/recovery";

describe("budgeted recovery decisions reuse the traffic simulation", () => {
  const baseline = simulate(harborCity, odPairs);
  const current = simulate(harborCity, odPairs, scenarios.earthquake.closedEdgeIds, baseline);
  const costs = { "harbor-bridge": 5, "east-rail": 5, "coastal-road": 1 };

  it("keeps the exact current scenario when budget is zero", () => {
    const result = optimizeRecovery(harborCity, odPairs, current, baseline, {
      budget: 0,
      costs,
      objective: "resilience",
    });
    expect(result.method).toBe("exact");
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0].restoredEdgeIds).toEqual([]);
    expect(result.plans[0].metrics).toEqual(current.metrics);
  });

  it("finds the same exact optimum as every affordable subset and retains unique top three plans", () => {
    const result = optimizeRecovery(harborCity, odPairs, current, baseline, {
      budget: 6,
      costs,
      objective: "balanced",
    });
    const candidates = Array.from({ length: 8 }, (_, mask) =>
      current.closedEdgeIds.filter((_, i) => mask & (1 << i)),
    )
      .map((restored) => ({
        restored,
        cost: restored.reduce((sum, id) => sum + costs[id as keyof typeof costs], 0),
      }))
      .filter((candidate) => candidate.cost <= 6)
      .map((candidate) => ({
        ...candidate,
        score: recoveryObjectiveScore(
          simulate(
            harborCity,
            odPairs,
            current.closedEdgeIds.filter((id) => !candidate.restored.includes(id)),
            baseline,
          ).metrics,
          baseline.metrics,
          "balanced",
        ),
      }));
    expect(result.plans[0].score).toBeCloseTo(
      Math.max(...candidates.map((candidate) => candidate.score)),
      10,
    );
    expect(result.plans).toHaveLength(3);
    expect(new Set(result.plans.map((plan) => plan.id)).size).toBe(3);
    for (const plan of result.plans) {
      expect(plan.cost).toBeLessThanOrEqual(6);
      expect(plan.metrics).toEqual(
        simulate(
          harborCity,
          odPairs,
          current.closedEdgeIds.filter((id) => !plan.restoredEdgeIds.includes(id)),
          baseline,
        ).metrics,
      );
    }
  });

  it("respects insufficient budget and can afford only the low-cost road", () => {
    const result = optimizeRecovery(harborCity, odPairs, current, baseline, {
      budget: 1,
      costs,
      objective: "accessibility",
    });
    expect(
      result.plans.every((plan) => plan.restoredEdgeIds.every((id) => id === "coastal-road")),
    ).toBe(true);
    expect(result.plans.every((plan) => plan.cost <= 1)).toBe(true);
  });

  it("strictly orders single objectives even when outcomes improve beyond baseline", () => {
    const faster = {
      ...baseline.metrics,
      averageTravelTime: baseline.metrics.averageTravelTime * 0.5,
    };
    const fastest = {
      ...baseline.metrics,
      averageTravelTime: baseline.metrics.averageTravelTime * 0.25,
    };
    expect(recoveryObjectiveScore(fastest, baseline.metrics, "travelTime")).toBeGreaterThan(
      recoveryObjectiveScore(faster, baseline.metrics, "travelTime"),
    );
    const efficient = {
      ...baseline.metrics,
      networkEfficiency: baseline.metrics.networkEfficiency + 5,
    };
    const mostEfficient = {
      ...baseline.metrics,
      networkEfficiency: baseline.metrics.networkEfficiency + 10,
    };
    expect(recoveryObjectiveScore(mostEfficient, baseline.metrics, "efficiency")).toBeGreaterThan(
      recoveryObjectiveScore(efficient, baseline.metrics, "efficiency"),
    );
  });

  it("restoring every failed link reproduces the baseline and uses deterministic tie ordering", () => {
    const result = optimizeRecovery(harborCity, odPairs, current, baseline, {
      budget: 11,
      costs,
      objective: "resilience",
    });
    expect(result.plans[0].metrics).toEqual(baseline.metrics);
    expect(result).toEqual(
      optimizeRecovery(harborCity, odPairs, current, baseline, {
        budget: 11,
        costs,
        objective: "resilience",
      }),
    );
    const empty = optimizeRecovery(
      harborCity,
      [],
      simulate(harborCity, []),
      simulate(harborCity, []),
      { budget: 5, costs: {}, objective: "travelTime" },
    );
    expect(empty.plans[0].cost).toBe(0);
    expect(Number.isFinite(empty.plans[0].score)).toBe(true);
  });

  it("switches to bounded approximate search for denser networks and reports actual progress", () => {
    const network = {
      ...harborCity,
      edges: [
        ...harborCity.edges,
        ...Array.from({ length: 160 }, (_, i) => ({ ...harborCity.edges[0], id: `padding-${i}` })),
      ],
    };
    const base = simulate(network, odPairs);
    const closed = network.edges.slice(2, 14).map((edge) => edge.id);
    const disrupted = simulate(network, odPairs, closed, base);
    const progress: [number, number][] = [];
    const result = optimizeRecovery(
      network,
      odPairs,
      disrupted,
      base,
      {
        budget: 8,
        costs: Object.fromEntries(closed.map((id) => [id, 1])),
        objective: "efficiency",
      },
      (done, total) => progress.push([done, total]),
    );
    expect(exactRecoveryLimit(network)).toBe(6);
    expect(result.method).toBe("beam");
    expect(result.evaluated).toBeLessThanOrEqual(decisionConfig.beamEvaluationsLarge);
    expect(result.plans.every((plan) => plan.cost <= 8)).toBe(true);
    expect(progress.at(-1)).toEqual([result.evaluated, result.evaluated]);
  });

  it("validates budget, relative costs, objective, and foreign closures", () => {
    for (const budget of [-1, NaN, 1.5, decisionConfig.maxBudget + 1]) {
      expect(() =>
        optimizeRecovery(harborCity, odPairs, current, baseline, {
          budget,
          costs,
          objective: "resilience",
        }),
      ).toThrow("INVALID_RECOVERY_BUDGET");
    }
    expect(() =>
      optimizeRecovery(harborCity, odPairs, current, baseline, {
        budget: 5,
        costs: { ...costs, "harbor-bridge": 0 },
        objective: "resilience",
      }),
    ).toThrow("INVALID_RECOVERY_COST");
    expect(() =>
      optimizeRecovery(harborCity, odPairs, { ...current, closedEdgeIds: ["foreign"] }, baseline, {
        budget: 5,
        costs,
        objective: "resilience",
      }),
    ).toThrow("INVALID_DECISION_CLOSURES");
  });

  it("uses transparent bridge/rail/road-class relative cost defaults", () => {
    expect(inferRecoveryCost(harborCity.edges.find((edge) => edge.id === "harbor-bridge")!)).toBe(
      5,
    );
    expect(inferRecoveryCost(harborCity.edges.find((edge) => edge.id === "east-rail")!)).toBe(5);
    expect(
      inferRecoveryCost(
        harborCity.edges.find(
          (edge) => edge.infrastructureType === "street" && edge.mode === "road",
        )!,
      ),
    ).toBe(1);
  });

  it("subset-DP finds the best cumulative-resilience sequence and reports marginal stage changes", () => {
    const sequence = calculateRecoverySequence(
      harborCity,
      odPairs,
      current,
      baseline,
      current.closedEdgeIds,
    );
    const permutations = (ids: string[]): string[][] =>
      ids.length
        ? ids.flatMap((id) =>
            permutations(ids.filter((candidate) => candidate !== id)).map((tail) => [id, ...tail]),
          )
        : [[]];
    const value = (order: string[]) =>
      order.reduce(
        (sum, _, index) =>
          sum +
          simulate(
            harborCity,
            odPairs,
            current.closedEdgeIds.filter((id) => !order.slice(0, index + 1).includes(id)),
            baseline,
          ).metrics.resilienceScore,
        0,
      );
    expect(sequence.every((stage) => stage.method === "exact-subset")).toBe(true);
    expect(value(sequence.map((stage) => stage.edgeId))).toBeCloseTo(
      Math.max(...permutations(current.closedEdgeIds).map(value)),
      10,
    );
    expect(sequence.at(-1)?.metrics).toEqual(baseline.metrics);
    expect(
      sequence.reduce((sum, stage) => sum + stage.resilienceGain, current.metrics.resilienceScore),
    ).toBeCloseTo(100, 10);
    expect(calculateRecoverySequence(harborCity, odPairs, current, baseline, [])).toEqual([]);
    expect(() =>
      calculateRecoverySequence(harborCity, odPairs, current, baseline, ["not-closed"]),
    ).toThrow("INVALID_RECOVERY_SEQUENCE");
  });

  it("supports the actual saved Okayama OSM network with multiple closures and a real budgeted plan", () => {
    const snapshot = validateSnapshot(okayama);
    const base = simulate(snapshot.network, snapshot.odPairs);
    const bridge = snapshot.network.edges.find((edge) => edge.osm?.bridge)!;
    const busy = [...snapshot.network.edges].sort(
      (a, b) => base.edgeStates[b.id].volume - base.edgeStates[a.id].volume,
    );
    const closed = [...new Set([bridge.id, busy[0].id, busy[1].id])];
    const disrupted = simulate(snapshot.network, snapshot.odPairs, closed, base);
    const result = optimizeRecovery(snapshot.network, snapshot.odPairs, disrupted, base, {
      budget: 5,
      costs: {},
      objective: "balanced",
    });
    expect(result.method).toBe("exact");
    expect(result.exactClosureLimit).toBe(6);
    expect(result.evaluated).toBeLessThanOrEqual(8);
    expect(result.plans.length).toBeGreaterThan(0);
    expect(
      result.plans.every(
        (plan) => plan.cost <= 5 && Object.values(plan.metrics).every(Number.isFinite),
      ),
    ).toBe(true);
    expect(disrupted.metrics.totalDemand).toBe(base.metrics.totalDemand);
    expect(closed.every((id) => disrupted.edgeStates[id].volume === 0)).toBe(true);
    for (const plan of result.plans)
      expect(plan.metrics).toEqual(
        simulate(
          snapshot.network,
          snapshot.odPairs,
          closed.filter((id) => !plan.restoredEdgeIds.includes(id)),
          base,
        ).metrics,
      );
  }, 30000);
});
