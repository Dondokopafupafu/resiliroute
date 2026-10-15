import { modelConfig } from "@/data/harbor-city";
import { clamp } from "./congestion";
import { simulate } from "./simulate";
import type {
  CriticalLinkResult,
  Network,
  ODPair,
  RecoveryResult,
  SimulationResult,
} from "@/types/network";

// Rankings are conditional on the current scenario. Already-closed links are
// excluded: stress-testing an unavailable edge cannot add another failure.
export function analyzeCriticalLinks(
  network: Network,
  odPairs: readonly ODPair[],
  reference: SimulationResult,
  baseline: SimulationResult = reference,
  candidateIds?: readonly string[],
): CriticalLinkResult[] {
  return network.edges
    .filter(
      (e) =>
        e.available &&
        !reference.closedEdgeIds.includes(e.id) &&
        (!candidateIds || candidateIds.includes(e.id)),
    )
    .map((edge) => {
      const result = simulate(network, odPairs, [...reference.closedEdgeIds, edge.id], baseline);
      const travelTimeIncrease =
        result.metrics.averageTravelTime - reference.metrics.averageTravelTime;
      const accessibilityLoss = reference.metrics.accessibility - result.metrics.accessibility;
      const efficiencyLoss = reference.metrics.networkEfficiency - result.metrics.networkEfficiency;
      const disconnectedDemandIncrease =
        result.metrics.disconnectedDemand - reference.metrics.disconnectedDemand;
      const w = modelConfig.criticalityWeights;
      // Fixed normalization anchors: doubling travel time, losing all currently
      // accessible services/efficiency, or all reference demand = maximum impact.
      const score =
        100 *
        (w.travelTime *
          clamp(travelTimeIncrease / Math.max(reference.metrics.averageTravelTime, 1), 0, 1) +
          w.accessibility *
            clamp(accessibilityLoss / Math.max(reference.metrics.accessibility, 1), 0, 1) +
          w.efficiency *
            clamp(efficiencyLoss / Math.max(reference.metrics.networkEfficiency, 1), 0, 1) +
          w.connectivity *
            clamp(disconnectedDemandIncrease / Math.max(reference.metrics.totalDemand, 1), 0, 1));
      return {
        edgeId: edge.id,
        name: edge.name,
        score,
        travelTimeIncrease,
        accessibilityLoss,
        efficiencyLoss,
        disconnectedDemandIncrease,
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function analyzeRecovery(
  network: Network,
  odPairs: readonly ODPair[],
  current: SimulationResult,
  baseline: SimulationResult,
): RecoveryResult[] {
  return current.closedEdgeIds
    .map((edgeId) => {
      const result = simulate(
        network,
        odPairs,
        current.closedEdgeIds.filter((id) => id !== edgeId),
        baseline,
      );
      return {
        edgeId,
        name: network.edges.find((e) => e.id === edgeId)!.name,
        resilienceGain: result.metrics.resilienceScore - current.metrics.resilienceScore,
        accessibilityGain: result.metrics.accessibility - current.metrics.accessibility,
        travelTimeSaved: current.metrics.averageTravelTime - result.metrics.averageTravelTime,
        result,
      };
    })
    .sort(
      (a, b) => b.resilienceGain - a.resilienceGain || b.accessibilityGain - a.accessibilityGain,
    );
}
