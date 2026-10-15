import { modelConfig } from "@/data/harbor-city";
import { calculateODAssignment } from "./assignment";
import {
  assignedTravelTime,
  calculateAccessibility,
  calculateDistrictImpact,
  calculateNetworkEfficiency,
  calculateResilienceScore,
} from "@/lib/metrics/metrics";
import type { EdgeId, Network, ODPair, SimulationMetrics, SimulationResult } from "@/types/network";

export function simulate(
  network: Network,
  odPairs: readonly ODPair[],
  closedEdgeIds: readonly EdgeId[] = [],
  baseline?: SimulationResult,
): SimulationResult {
  const validClosedIds = [...new Set(closedEdgeIds)]
    .filter((id) => network.edges.some((e) => e.id === id))
    .sort();
  const { edgeStates, assignments, iterations } = calculateODAssignment(
    network,
    odPairs,
    validClosedIds,
  );
  const totalDemand = odPairs.reduce((sum, od) => sum + od.demand, 0);
  const disconnected = assignments.filter((a) => !a.path.reachable);
  const disconnectedDemand = disconnected.reduce((sum, a) => sum + a.od.demand, 0);
  const access = calculateAccessibility(network, edgeStates, validClosedIds);
  const traveledPersonMinutes = Object.values(edgeStates).reduce(
    (sum, e) => sum + e.volume * e.travelTime,
    0,
  );
  const freeFlowPersonMinutes = network.edges.reduce(
    (sum, e) => sum + edgeStates[e.id].volume * e.freeFlowTime,
    0,
  );
  const metrics: SimulationMetrics = {
    averageTravelTime: totalDemand
      ? assignments.reduce((sum, a) => sum + assignedTravelTime(a) * a.od.demand, 0) / totalDemand
      : 0,
    accessibility: access.score,
    networkEfficiency: calculateNetworkEfficiency(assignments),
    congestion: freeFlowPersonMinutes
      ? (traveledPersonMinutes / freeFlowPersonMinutes - 1) * 100
      : 0,
    disconnectedDemand,
    disconnectedODPairs: disconnected.length,
    connectedDemandRetention: totalDemand
      ? ((totalDemand - disconnectedDemand) / totalDemand) * 100
      : 0,
    resilienceScore: 100,
    totalDemand,
  };
  metrics.resilienceScore = calculateResilienceScore(metrics, baseline?.metrics ?? metrics);
  // The normal city is 100 by definition: retention is measured against itself.
  // Absolute accessibility/congestion still reveal weaknesses in the reference city.
  return {
    closedEdgeIds: validClosedIds,
    edgeStates,
    assignments,
    metrics,
    districts: calculateDistrictImpact(network.nodes, assignments, access.records),
    services: access.services,
    iterations,
  };
}

export function getModelSettings() {
  return modelConfig;
}
