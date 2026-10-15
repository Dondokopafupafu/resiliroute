import { calculateAccessibility, assignedTravelTime } from "@/lib/metrics/metrics";
import type { CriticalLinkResult, Network, SimulationResult } from "@/types/network";
import type { BoundingBox } from "@/types/real-city";
import { decisionConfig } from "./config";

/** Changes are percentage points of v/c, not percent relative to an empty road. */
export const cascadeThresholds = {
  elevated: decisionConfig.cascadeUtilizationPoints[0],
  high: decisionConfig.cascadeUtilizationPoints[1],
  severe: decisionConfig.cascadeUtilizationPoints[2],
} as const;
export type CascadeClassification = "stable" | "elevated" | "high" | "severe";
export interface CascadeEvidence {
  edgeId: string;
  name: string;
  baselineVolume: number;
  currentVolume: number;
  flowIncrease: number;
  baselineUtilization: number;
  currentUtilization: number;
  utilizationIncrease: number;
  classification: CascadeClassification;
}
export interface ZoneState {
  travelTime: number;
  accessibility: number | null;
  hospitalAccessibility: number | null;
  stationAccessibility: number | null;
  disconnectedDemand: number;
  congestionExposure: number;
}
export interface ZoneEvidence {
  id: string;
  name: string;
  originIds: string[];
  demandWeight: number;
  baseline: ZoneState;
  current: ZoneState;
  accessibilityLoss: number;
  travelTimeIncrease: number;
  impactScore: number;
}
export interface FacilityEvidence {
  id: string;
  name: string;
  type: string;
  threshold: number;
  baselineReach: number;
  currentReach: number;
  loss: number;
  isolated: boolean;
}
export interface DecisionEvidence {
  zones: ZoneEvidence[];
  facilities: FacilityEvidence[];
  cascades: CascadeEvidence[];
  affectedODPairs: number;
  worstZone: ZoneEvidence | null;
  impactGap: number;
  accessibilityDisparity: number;
  summary: { stressedLinks: number; severeLinks: number; isolatedFacilities: number };
}

export function cascadeClassification(increase: number): CascadeClassification {
  return increase >= cascadeThresholds.severe
    ? "severe"
    : increase >= cascadeThresholds.high
      ? "high"
      : increase >= cascadeThresholds.elevated
        ? "elevated"
        : "stable";
}

/** Equal-width bands of the largest *tested* criticality, not a claim about untested roads. */
export function criticalityBand(
  score: number | undefined,
  maximum: number,
): "untested" | "low" | "moderate" | "high" | "very-high" | "critical" {
  if (score === undefined || !Number.isFinite(score)) return "untested";
  const normalized = maximum > 0 ? Math.max(0, Math.min(1, score / maximum)) : 0;
  return normalized >= 0.8
    ? "critical"
    : normalized >= 0.6
      ? "very-high"
      : normalized >= 0.4
        ? "high"
        : normalized >= 0.2
          ? "moderate"
          : "low";
}

export function explainCriticality(link: CriticalLinkResult, locale: "en" | "ja" = "en"): string {
  const effects = [
    {
      value: link.travelTimeIncrease,
      en: "increased modeled travel time",
      ja: "モデル移動時間の増加",
    },
    {
      value: link.accessibilityLoss,
      en: "lost essential-service accessibility",
      ja: "重要施設アクセスの低下",
    },
    { value: link.efficiencyLoss, en: "reduced network efficiency", ja: "ネットワーク効率の低下" },
    {
      value: link.disconnectedDemandIncrease,
      en: "disconnected modeled demand",
      ja: "モデル需要の到達不能",
    },
  ]
    .filter((effect) => effect.value > 0)
    .sort((a, b) => b.value - a.value);
  if (!effects.length)
    return locale === "ja"
      ? "このリンクの単独閉鎖では、計算した都市指標に悪化は見られませんでした。"
      : "Its single-link closure produced no deterioration in the measured citywide metrics.";
  return locale === "ja"
    ? `単独閉鎖試験で${effects
        .slice(0, 2)
        .map((effect) => effect.ja)
        .join("と")}が見られました。実際の被害確率を示すものではありません。`
    : `The single-link stress test found ${effects
        .slice(0, 2)
        .map((effect) => effect.en)
        .join(" and ")}. This does not estimate its probability of failure.`;
}

export function deriveDecisionEvidence(
  network: Network,
  baseline: SimulationResult,
  current: SimulationResult,
  options: { realCity?: boolean; bbox?: BoundingBox } = {},
): DecisionEvidence {
  const beforeAccess = calculateAccessibility(network, baseline.edgeStates, baseline.closedEdgeIds);
  const afterAccess = calculateAccessibility(network, current.edgeStates, current.closedEdgeIds);
  const origins = network.nodes.filter((node) => node.type === "residential");
  const bounds = options.bbox ?? {
    south: Math.min(...network.nodes.map((node) => node.latitude)),
    north: Math.max(...network.nodes.map((node) => node.latitude)),
    west: Math.min(...network.nodes.map((node) => node.longitude)),
    east: Math.max(...network.nodes.map((node) => node.longitude)),
  };
  const groups = new Map<string, typeof origins>();
  for (const origin of origins) {
    const row = origin.latitude >= (bounds.north + bounds.south) / 2 ? 0 : 1;
    const column = origin.longitude >= (bounds.east + bounds.west) / 2 ? 1 : 0;
    const key = options.realCity
      ? `Analysis Zone ${String.fromCharCode(65 + row * 2 + column)}`
      : origin.district;
    const list = groups.get(key) ?? [];
    list.push(origin);
    groups.set(key, list);
  }
  const availableTypes = new Set(
    network.nodes.filter((node) => node.essentialService).map((node) => node.type),
  );
  const categories = network.accessibilityCategories ?? ["hospital", "shelter", "station"];
  const hasApplicableService = categories.some((type) => availableTypes.has(type));
  const stateFor = (
    ids: Set<string>,
    result: SimulationResult,
    access: typeof beforeAccess,
  ): ZoneState => {
    const assignments = result.assignments.filter((item) => ids.has(item.od.origin));
    const demand = assignments.reduce((sum, item) => sum + item.od.demand, 0);
    const records = access.records.filter((record) => ids.has(record.origin));
    const weight = records.reduce((sum, record) => sum + record.population, 0);
    const weighted = (get: (record: (typeof records)[number]) => number) =>
      weight > 0
        ? (100 * records.reduce((sum, record) => sum + record.population * get(record), 0)) / weight
        : 0;
    let weightedUtilization = 0;
    let pathFlow = 0;
    for (const assignment of assignments)
      for (const flow of assignment.flowPaths)
        for (const id of flow.path.edgeIds) {
          weightedUtilization += flow.volume * (result.edgeStates[id]?.utilization ?? 0);
          pathFlow += flow.volume;
        }
    return {
      travelTime:
        demand > 0
          ? assignments.reduce((sum, item) => sum + assignedTravelTime(item) * item.od.demand, 0) /
            demand
          : 0,
      accessibility: hasApplicableService ? weighted((record) => record.accessibility) : null,
      hospitalAccessibility: availableTypes.has("hospital")
        ? weighted((record) => record.scores.hospital)
        : null,
      stationAccessibility: availableTypes.has("station")
        ? weighted((record) => record.scores.station)
        : null,
      disconnectedDemand: assignments
        .filter((item) => !item.path.reachable)
        .reduce((sum, item) => sum + item.od.demand, 0),
      congestionExposure: pathFlow > 0 ? (100 * weightedUtilization) / pathFlow : 0,
    };
  };
  const zones = [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, nodes]): ZoneEvidence => {
      const ids = new Set(nodes.map((node) => node.id));
      const before = stateFor(ids, baseline, beforeAccess);
      const after = stateFor(ids, current, afterAccess);
      const accessibilityLoss = (before.accessibility ?? 0) - (after.accessibility ?? 0);
      const travelTimeIncrease = after.travelTime - before.travelTime;
      const demand = baseline.assignments
        .filter((item) => ids.has(item.od.origin))
        .reduce((sum, item) => sum + item.od.demand, 0);
      // Transparent diagnostic loss, not a validated social equity measure.
      const timeLoss =
        before.travelTime > 0
          ? Math.min(100, Math.max(0, (travelTimeIncrease / before.travelTime) * 100))
          : 0;
      const disconnectedLoss =
        demand > 0
          ? (Math.max(0, after.disconnectedDemand - before.disconnectedDemand) / demand) * 100
          : 0;
      return {
        id: name,
        name,
        originIds: [...ids],
        demandWeight: nodes.reduce((sum, node) => sum + node.populationWeight, 0),
        baseline: before,
        current: after,
        accessibilityLoss,
        travelTimeIncrease,
        impactScore: 0.5 * Math.max(0, accessibilityLoss) + 0.3 * timeLoss + 0.2 * disconnectedLoss,
      };
    });
  const facilities = afterAccess.services
    .map((service): FacilityEvidence => {
      const before = beforeAccess.services.find((item) => item.nodeId === service.nodeId);
      const beforeConnected = beforeAccess.records.some(
        (record) => record.population > 0 && Number.isFinite(record.serviceTimes[service.nodeId]),
      );
      const afterConnected = afterAccess.records.some(
        (record) => record.population > 0 && Number.isFinite(record.serviceTimes[service.nodeId]),
      );
      return {
        id: service.nodeId,
        name: service.name,
        type: service.type,
        threshold: service.threshold,
        baselineReach: before?.reachablePopulation ?? 0,
        currentReach: service.reachablePopulation,
        loss: (before?.reachablePopulation ?? 0) - service.reachablePopulation,
        isolated: beforeConnected && !afterConnected,
      };
    })
    .sort((a, b) => b.loss - a.loss || a.id.localeCompare(b.id));
  const cascades = network.edges
    .flatMap((edge): CascadeEvidence[] => {
      const before = baseline.edgeStates[edge.id];
      const after = current.edgeStates[edge.id];
      if (!before || !after?.available) return [];
      const utilizationIncrease = (after.utilization - before.utilization) * 100;
      return [
        {
          edgeId: edge.id,
          name: edge.name,
          baselineVolume: before.volume,
          currentVolume: after.volume,
          flowIncrease: after.volume - before.volume,
          baselineUtilization: before.utilization * 100,
          currentUtilization: after.utilization * 100,
          utilizationIncrease,
          classification: cascadeClassification(utilizationIncrease),
        },
      ];
    })
    .sort(
      (a, b) => b.utilizationIncrease - a.utilizationIncrease || a.edgeId.localeCompare(b.edgeId),
    );
  const baselineAssignments = new Map(baseline.assignments.map((item) => [item.od.id, item]));
  const affectedODPairs = current.assignments.filter((item) => {
    const before = baselineAssignments.get(item.od.id);
    return (
      before &&
      (before.path.reachable !== item.path.reachable ||
        Math.abs(assignedTravelTime(before) - assignedTravelTime(item)) > 0.01 ||
        before.path.edgeIds.join("|") !== item.path.edgeIds.join("|"))
    );
  }).length;
  const losses = zones.map((zone) => Math.max(0, zone.accessibilityLoss));
  const impacts = zones.map((zone) => zone.impactScore);
  return {
    zones,
    facilities,
    cascades,
    affectedODPairs,
    worstZone:
      [...zones].sort((a, b) => b.impactScore - a.impactScore || a.id.localeCompare(b.id))[0] ??
      null,
    impactGap: impacts.length ? Math.max(...impacts) - Math.min(...impacts) : 0,
    accessibilityDisparity: losses.length ? Math.max(...losses) - Math.min(...losses) : 0,
    summary: {
      stressedLinks: cascades.filter((link) => link.classification !== "stable").length,
      severeLinks: cascades.filter((link) => link.classification === "severe").length,
      isolatedFacilities: facilities.filter((facility) => facility.isolated).length,
    },
  };
}
