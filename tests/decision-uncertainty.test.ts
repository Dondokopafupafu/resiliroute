import { describe, expect, it } from "vitest";
import { harborCity, odPairs } from "@/data/harbor-city";
import { scenarios } from "@/data/scenarios";
import { simulate } from "@/lib/simulation/simulate";
import { optimizeRecovery } from "@/lib/decision/recovery";
import {
  evaluateRobustRecovery,
  runUncertainty,
  seededRandom,
  summarizeDistribution,
  uncertaintyRunLimit,
} from "@/lib/decision/uncertainty";

describe("seeded scenario uncertainty and common-draw recovery", () => {
  const baseline = simulate(harborCity, odPairs);
  const failures = scenarios.earthquake.closedEdgeIds.map((edgeId) => ({
    edgeId,
    probability: 0.35,
  }));

  it("probability zero preserves baseline; probability one exactly reproduces multi-failure", () => {
    const zero = runUncertainty(harborCity, odPairs, baseline, {
      runs: 10,
      seed: 42,
      failures: failures.map((failure) => ({ ...failure, probability: 0 })),
    });
    expect(
      zero.samples.every(
        (sample) => sample.closedEdgeIds.length === 0 && sample.metrics.resilienceScore === 100,
      ),
    ).toBe(true);
    expect(zero.uniqueScenarios).toBe(1);
    const one = runUncertainty(harborCity, odPairs, baseline, {
      runs: 10,
      seed: 42,
      failures: failures.map((failure) => ({ ...failure, probability: 1 })),
    });
    expect(one.samples[0].metrics).toEqual(
      simulate(harborCity, odPairs, scenarios.earthquake.closedEdgeIds, baseline).metrics,
    );
    expect(one.samples.every((sample) => sample.closedEdgeIds.length === 3)).toBe(true);
    expect(one.summaries.resilience.min).toBe(one.summaries.resilience.max);
  });

  it("is reproducible for seed and assumptions independent of input edge order", () => {
    const a = runUncertainty(harborCity, odPairs, baseline, { runs: 100, seed: 2026, failures });
    const b = runUncertainty(harborCity, odPairs, baseline, {
      runs: 100,
      seed: 2026,
      failures: [...failures].reverse(),
    });
    expect(a).toEqual(b);
    expect(a.uniqueScenarios).toBeGreaterThan(1);
    expect(a.samples.some((sample) => sample.closedEdgeIds.length > 0)).toBe(true);
    expect(a.samples.some((sample) => sample.closedEdgeIds.length === 0)).toBe(true);
    for (const summary of Object.values(a.summaries))
      if (summary) {
        expect(Object.values(summary).every(Number.isFinite)).toBe(true);
        expect(summary.min).toBeLessThanOrEqual(summary.p10);
        expect(summary.p10).toBeLessThanOrEqual(summary.median);
        expect(summary.median).toBeLessThanOrEqual(summary.p90);
        expect(summary.p90).toBeLessThanOrEqual(summary.max);
      }
  });

  it("uses default 100 runs and reports completed sampled runs truthfully", () => {
    const progress: [number, number][] = [];
    const result = runUncertainty(harborCity, odPairs, baseline, { failures: [] }, (done, total) =>
      progress.push([done, total]),
    );
    expect(result.runs).toBe(100);
    expect(result.seed).toBe(2026);
    expect(progress[0]).toEqual([0, 100]);
    expect(progress.at(-1)).toEqual([100, 100]);
    expect(progress.length).toBe(101);
  });

  it("detects hospital access loss when all hospital approaches are unavailable", () => {
    const hospitals = new Set(
      harborCity.nodes.filter((node) => node.type === "hospital").map((node) => node.id),
    );
    const approaches = harborCity.edges.filter(
      (edge) => hospitals.has(edge.source) || hospitals.has(edge.target),
    );
    const result = runUncertainty(harborCity, odPairs, baseline, {
      runs: 5,
      failures: approaches.map((edge) => ({ edgeId: edge.id, probability: 1 })),
    });
    expect(result.summaries.hospitalAccessibility?.mean).toBe(0);
    expect(result.probabilityHospitalAccessibilityBelow70).toBe(1);
    expect(result.samples.every((sample) => sample.hospitalAccessibility === 0)).toBe(true);
  });

  it("has finite quantiles, distinct seeded streams, and rejects invalid workloads/probabilities", () => {
    expect(summarizeDistribution([0, 10, 20])).toEqual({
      mean: 10,
      median: 10,
      p10: 2,
      p90: 18,
      min: 0,
      max: 20,
    });
    expect(() => summarizeDistribution([Infinity])).toThrow("INVALID_DISTRIBUTION");
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
    for (const runs of [0, NaN, 1.1, uncertaintyRunLimit(harborCity) + 1])
      expect(() => runUncertainty(harborCity, odPairs, baseline, { failures, runs })).toThrow(
        "INVALID_UNCERTAINTY_RUNS",
      );
    for (const probability of [-1, 1.01, NaN])
      expect(() =>
        runUncertainty(harborCity, odPairs, baseline, {
          failures: [{ edgeId: "harbor-bridge", probability }],
        }),
      ).toThrow("INVALID_FAILURE_ASSUMPTIONS");
    expect(() =>
      runUncertainty(harborCity, odPairs, baseline, {
        failures: [{ edgeId: "unknown", probability: 0 }],
      }),
    ).toThrow("INVALID_DECISION_CLOSURES");
    expect(() => runUncertainty(harborCity, odPairs, baseline, { failures, seed: -1 })).toThrow(
      "INVALID_UNCERTAINTY_SEED",
    );
  });

  it("retains explicit fixed closures and represents missing facility categories as unavailable", () => {
    const network = {
      ...harborCity,
      nodes: harborCity.nodes.map((node) => ({ ...node, essentialService: false })),
      accessibilityCategories: [],
    };
    const base = simulate(network, odPairs);
    const result = runUncertainty(network, odPairs, base, {
      runs: 4,
      failures: [],
      fixedClosedEdgeIds: ["harbor-bridge"],
    });
    expect(result.samples.every((sample) => sample.closedEdgeIds.includes("harbor-bridge"))).toBe(
      true,
    );
    expect(result.summaries.hospitalAccessibility).toBeNull();
    expect(result.probabilityHospitalAccessibilityBelow70).toBeNull();
    expect(result.probabilityAccessibilityBelow70).toBeNull();
  });

  it("compares only the supplied recovery plans over identical draws and recomputed evidence", () => {
    const current = simulate(harborCity, odPairs, scenarios.earthquake.closedEdgeIds, baseline);
    const optimization = optimizeRecovery(harborCity, odPairs, current, baseline, {
      budget: 5,
      costs: {},
      objective: "resilience",
    });
    const uncertainty = runUncertainty(harborCity, odPairs, baseline, {
      runs: 30,
      seed: 17,
      failures,
    });
    const robust = evaluateRobustRecovery(
      harborCity,
      odPairs,
      baseline,
      optimization.plans,
      uncertainty,
    );
    expect(robust.assumption).toBe("restored-links-protected-in-user-defined-samples");
    expect(robust.comparedPlans).toBe(optimization.plans.length);
    expect(robust.runs).toBe(30);
    for (const plan of robust.plans) {
      const values = uncertainty.samples.map(
        (sample) =>
          simulate(
            harborCity,
            odPairs,
            sample.closedEdgeIds.filter((id) => !plan.restoredEdgeIds.includes(id)),
            baseline,
          ).metrics.resilienceScore,
      );
      expect(plan.expectedResilience).toBeCloseTo(
        values.reduce((sum, value) => sum + value, 0) / 30,
        10,
      );
      expect(plan.worstResilience).toBeCloseTo(Math.min(...values), 10);
    }
    expect(robust).toEqual(
      evaluateRobustRecovery(harborCity, odPairs, baseline, optimization.plans, uncertainty),
    );
  });
});
