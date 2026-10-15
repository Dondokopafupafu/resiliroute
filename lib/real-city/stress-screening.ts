import { realCityConfig } from "./model-config";
import type { Network, SimulationResult } from "@/types/network";

export function screenCriticalCandidates(network: Network, current: SimulationResult) {
  const roads = network.edges.filter((e) => e.osm && current.edgeStates[e.id].available);
  if (roads.length <= realCityConfig.fullStressThreshold)
    return { ids: roads.map((e) => e.id), screened: false, total: roads.length };
  // Fast structural/flow screening; this is NOT a criticality score. The
  // shortlisted roads are then tested with the unchanged full simulation.
  const degree = new Map<string, number>();
  network.edges.forEach((e) => {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  });
  const ranked = [...roads].sort((a, b) => {
    const score = (e: typeof a) =>
      current.edgeStates[e.id].volume * e.freeFlowTime +
      (e.osm?.bridge ? current.metrics.totalDemand : 0) +
      (degree.get(e.source) === 1 || degree.get(e.target) === 1
        ? current.metrics.totalDemand / 4
        : 0);
    return score(b) - score(a) || a.id.localeCompare(b.id);
  });
  return {
    ids: ranked.slice(0, realCityConfig.stressCandidates).map((e) => e.id),
    screened: true,
    total: roads.length,
  };
}
