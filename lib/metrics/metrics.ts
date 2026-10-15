import { districtOrder, modelConfig } from "@/data/harbor-city";
import { buildGraph, shortestPathsFrom } from "@/lib/graph/shortest-path";
import { clamp } from "@/lib/simulation/congestion";
import type {
  AssignedOD,
  DistrictMetrics,
  EdgeId,
  EdgeState,
  Network,
  NetworkNode,
  ServiceMetrics,
  SimulationMetrics,
} from "@/types/network";

const serviceTypes = ["hospital", "shelter", "station"] as const;
type ServiceType = (typeof serviceTypes)[number];
export interface AccessRecord {
  origin: string;
  population: number;
  scores: Record<ServiceType, number>;
  serviceTimes: Record<string, number>;
  accessibility: number;
}

export function calculateAccessibility(
  network: Network,
  edgeStates: Record<EdgeId, EdgeState>,
  closedEdgeIds: readonly EdgeId[],
): { score: number; records: AccessRecord[]; services: ServiceMetrics[] } {
  const graph = buildGraph(network, closedEdgeIds);
  const residences = network.nodes.filter((n) => n.type === "residential");
  const services = network.nodes.filter((n) => n.essentialService);
  const totalPopulation = residences.reduce((sum, n) => sum + n.populationWeight, 0);
  const categories: readonly ServiceType[] = network.accessibilityCategories ?? serviceTypes;
  const records: AccessRecord[] = residences.map((origin) => {
    const paths = shortestPathsFrom(
      graph,
      origin.id,
      services.map((s) => s.id),
      (edge) => edgeStates[edge.id].travelTime,
    );
    const serviceTimes = Object.fromEntries(
      services.map((service) => [service.id, paths[service.id].travelTime]),
    );
    const scores = Object.fromEntries(
      serviceTypes.map((type) => [
        type,
        services.some(
          (n) => n.type === type && serviceTimes[n.id] <= modelConfig.serviceThresholds[type],
        )
          ? 1
          : 0,
      ]),
    ) as Record<ServiceType, number>;
    const accessibility = categories.length
      ? categories.reduce((sum, type) => sum + scores[type], 0) / categories.length
      : 0;
    return {
      origin: origin.id,
      population: origin.populationWeight,
      scores,
      serviceTimes,
      accessibility,
    };
  });
  const score = totalPopulation
    ? (records.reduce((sum, r) => sum + r.population * r.accessibility, 0) / totalPopulation) * 100
    : 0;
  return {
    score,
    records,
    services: services.map((service) => {
      const threshold = modelConfig.serviceThresholds[service.type as ServiceType];
      return {
        nodeId: service.id,
        name: service.name,
        type: service.type,
        threshold,
        reachablePopulation: totalPopulation
          ? (records.reduce(
              (sum, r) => sum + (r.serviceTimes[service.id] <= threshold ? r.population : 0),
              0,
            ) /
              totalPopulation) *
            100
          : 0,
      };
    }),
  };
}

export function assignedTravelTime(assignment: AssignedOD): number {
  if (!assignment.path.reachable) return modelConfig.unreachablePenaltyMinutes;
  return (
    assignment.flowPaths.reduce((sum, route) => sum + route.path.travelTime * route.volume, 0) /
    assignment.od.demand
  );
}

// Demand-weighted harmonic efficiency; disconnected pairs contribute zero.
// 10 / (10 + t) creates a bounded 0–100 scale without fitted demo numbers.
export function calculateNetworkEfficiency(assignments: readonly AssignedOD[]): number {
  const total = assignments.reduce((sum, a) => sum + a.od.demand, 0);
  return total
    ? (assignments.reduce(
        (sum, a) =>
          sum +
          (a.path.reachable
            ? (a.od.demand * modelConfig.efficiencyReferenceMinutes) /
              (modelConfig.efficiencyReferenceMinutes + a.path.travelTime)
            : 0),
        0,
      ) /
        total) *
        100
    : 0;
}

export function calculateResilienceScore(
  current: Pick<
    SimulationMetrics,
    "accessibility" | "networkEfficiency" | "averageTravelTime" | "connectedDemandRetention"
  >,
  baseline: Pick<
    SimulationMetrics,
    "accessibility" | "networkEfficiency" | "averageTravelTime" | "connectedDemandRetention"
  >,
): number {
  // Squared retention deliberately penalizes simultaneous degradation.
  // Exponent and weights are exposed in the dataset and Methodology.
  const retention = (after: number, before: number) =>
    (before > 0 ? clamp(after / before, 0, 1) : after >= before ? 1 : 0) **
    modelConfig.retentionExponent;
  const w = modelConfig.resilienceWeights;
  return (
    100 *
    (w.accessibility * retention(current.accessibility, baseline.accessibility) +
      w.efficiency * retention(current.networkEfficiency, baseline.networkEfficiency) +
      w.travelTime *
        retention(baseline.averageTravelTime, current.averageTravelTime) *
        retention(current.connectedDemandRetention, baseline.connectedDemandRetention) +
      w.connectivity *
        retention(current.connectedDemandRetention, baseline.connectedDemandRetention))
  );
}

export function resilienceLabel(
  score: number,
): "Resilient" | "Strained" | "Vulnerable" | "Critical" {
  return score >= 80
    ? "Resilient"
    : score >= 60
      ? "Strained"
      : score >= 40
        ? "Vulnerable"
        : "Critical";
}

export function calculateDistrictImpact(
  nodes: readonly NetworkNode[],
  assignments: readonly AssignedOD[],
  records: readonly AccessRecord[],
): DistrictMetrics[] {
  const districts = [...districtOrder, "South" as const].filter((d) =>
    nodes.some((n) => n.district === d),
  );
  return districts.map((district) => {
    const residences = nodes.filter((n) => n.district === district && n.type === "residential");
    const ids = new Set(residences.map((n) => n.id));
    const population = residences.reduce((sum, n) => sum + n.populationWeight, 0);
    const districtDemand = assignments.filter((a) => ids.has(a.od.origin));
    const totalDemand = districtDemand.reduce((sum, a) => sum + a.od.demand, 0);
    const disconnectedDemand = districtDemand
      .filter((a) => !a.path.reachable)
      .reduce((sum, a) => sum + a.od.demand, 0);
    const accessibility = population
      ? (records
          .filter((r) => ids.has(r.origin))
          .reduce((sum, r) => sum + r.population * r.accessibility, 0) /
          population) *
        100
      : 0;
    return {
      district,
      population,
      averageTravelTime: totalDemand
        ? districtDemand.reduce((sum, a) => sum + assignedTravelTime(a) * a.od.demand, 0) /
          totalDemand
        : 0,
      accessibility,
      disconnectedDemand,
      isolationRisk: totalDemand ? (disconnectedDemand / totalDemand) * 100 : 0,
    };
  });
}
