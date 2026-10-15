import { describe, expect, it } from "vitest";
import { harborCity, odPairs } from "@/data/harbor-city";
import { scenarios } from "@/data/scenarios";
import { simulate } from "@/lib/simulation/simulate";
import {
  cascadeClassification,
  criticalityBand,
  deriveDecisionEvidence,
  explainCriticality,
} from "@/lib/decision/evidence";
import type { Network } from "@/types/network";

describe("decision evidence", () => {
  const baseline = simulate(harborCity, odPairs);
  const disrupted = simulate(harborCity, odPairs, scenarios.earthquake.closedEdgeIds, baseline);
  const evidence = deriveDecisionEvidence(harborCity, baseline, disrupted);

  it("retains Harbor districts and exposes inequity hidden by the city mean", () => {
    expect(evidence.zones.map((zone) => zone.name)).toContain("Harbor");
    expect(evidence.worstZone?.impactScore).toBeGreaterThan(0);
    expect(evidence.impactGap).toBeGreaterThan(0);
    expect(evidence.accessibilityDisparity).toBeGreaterThan(0);
    expect(evidence.affectedODPairs).toBeGreaterThan(0);
    expect(evidence.zones.reduce((sum, zone) => sum + zone.demandWeight, 0)).toBe(
      harborCity.nodes.reduce((sum, node) => sum + node.populationWeight, 0),
    );
  });

  it("uses neutral spatial zones for real infrastructure and never invents districts", () => {
    const result = deriveDecisionEvidence(harborCity, baseline, disrupted, { realCity: true });
    expect(result.zones.length).toBeLessThanOrEqual(4);
    expect(result.zones.every((zone) => /^Analysis Zone [A-D]$/.test(zone.name))).toBe(true);
    expect(result.zones.flatMap((zone) => zone.originIds)).toHaveLength(
      harborCity.nodes.filter((node) => node.type === "residential").length,
    );
  });

  it("classifies open-link secondary stress by v/c percentage-point increase", () => {
    expect(cascadeClassification(9.999)).toBe("stable");
    expect(cascadeClassification(10)).toBe("elevated");
    expect(cascadeClassification(30)).toBe("high");
    expect(cascadeClassification(60)).toBe("severe");
    expect(cascadeClassification(-40)).toBe("stable");
    expect(evidence.cascades.some((link) => disrupted.closedEdgeIds.includes(link.edgeId))).toBe(
      false,
    );
    const crossing = evidence.cascades.find((link) => link.edgeId === "riverside-crossing")!;
    expect(crossing.flowIncrease).toBeGreaterThan(0);
    expect(crossing.utilizationIncrease).toBeCloseTo(
      (disrupted.edgeStates[crossing.edgeId].utilization -
        baseline.edgeStates[crossing.edgeId].utilization) *
        100,
    );
  });

  it("shows category N/A and no fabricated services when hospitals and stations are absent", () => {
    const empty: Network = {
      ...harborCity,
      nodes: harborCity.nodes.map((node) =>
        node.essentialService ? { ...node, type: "intersection", essentialService: false } : node,
      ),
      accessibilityCategories: [],
    };
    const normal = simulate(empty, odPairs);
    const result = deriveDecisionEvidence(empty, normal, normal);
    expect(result.facilities).toEqual([]);
    expect(
      result.zones.every(
        (zone) =>
          zone.current.accessibility === null &&
          zone.current.hospitalAccessibility === null &&
          zone.current.stationAccessibility === null,
      ),
    ).toBe(true);
    expect(result.impactGap).toBe(0);
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
  });

  it("handles an empty graph and origins without NaN", () => {
    const network: Network = { nodes: [], edges: [], accessibilityCategories: [] };
    const result = simulate(network, []);
    const derived = deriveDecisionEvidence(network, result, result);
    expect(derived.zones).toEqual([]);
    expect(derived.worstZone).toBeNull();
    expect(derived.accessibilityDisparity).toBe(0);
    expect(derived.affectedODPairs).toBe(0);
  });

  it("detects an essential facility losing all modeled reach", () => {
    const hospital = harborCity.nodes.find((node) => node.id === "general-hospital")!;
    const closures = harborCity.edges
      .filter((edge) => edge.source === hospital.id || edge.target === hospital.id)
      .map((edge) => edge.id);
    const current = simulate(harborCity, odPairs, closures, baseline);
    const facility = deriveDecisionEvidence(harborCity, baseline, current).facilities.find(
      (item) => item.id === hospital.id,
    )!;
    expect(facility.baselineReach).toBeGreaterThan(0);
    expect(facility.currentReach).toBe(0);
    expect(facility.isolated).toBe(true);
  });

  it("keeps untested roads distinct from low criticality and explains only actual impacts", () => {
    expect(criticalityBand(undefined, 50)).toBe("untested");
    expect(criticalityBand(0, 50)).toBe("low");
    expect(criticalityBand(10, 50)).toBe("moderate");
    expect(criticalityBand(20, 50)).toBe("high");
    expect(criticalityBand(30, 50)).toBe("very-high");
    expect(criticalityBand(40, 50)).toBe("critical");
    const link = {
      edgeId: "test",
      name: "Test",
      score: 60,
      travelTimeIncrease: 3,
      accessibilityLoss: 10,
      efficiencyLoss: 0,
      disconnectedDemandIncrease: 0,
    };
    expect(explainCriticality(link)).toContain("accessibility");
    expect(explainCriticality(link)).not.toContain("hospital");
    expect(explainCriticality(link, "ja")).toContain("重要施設");
  });
});
