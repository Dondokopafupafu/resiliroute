import { createAnalysisContext } from "@/lib/ai/analysis";
import { assignedTravelTime } from "@/lib/metrics/metrics";
import type { AnalysisContext } from "@/types/analysis";
import type { CriticalLinkResult, RecoveryResult, SimulationResult } from "@/types/network";
import type { RealCityNetwork } from "@/types/real-city";
import type { screenCriticalCandidates } from "./stress-screening";

export function realCityContext(
  snapshot: RealCityNetwork,
  baseline: SimulationResult,
  current: SimulationResult,
  critical: CriticalLinkResult[],
  recovery: RecoveryResult[],
  screening: ReturnType<typeof screenCriticalCandidates>,
): AnalysisContext {
  const context = createAnalysisContext(
    "Real City · manual what-if closures",
    baseline,
    current,
    critical,
    recovery,
    snapshot.network,
  );
  const originChanges = snapshot.network.nodes
    .filter((n) => n.type === "residential")
    .map((n) => {
      const average = (sim: SimulationResult) => {
        const list = sim.assignments.filter((a) => a.od.origin === n.id),
          total = list.reduce((sum, a) => sum + a.od.demand, 0);
        return total
          ? list.reduce((sum, a) => sum + assignedTravelTime(a) * a.od.demand, 0) / total
          : 0;
      };
      return {
        name: n.name,
        travelTimeBefore: average(baseline),
        travelTimeAfter: average(current),
      };
    })
    .sort(
      (a, b) => b.travelTimeAfter - b.travelTimeBefore - (a.travelTimeAfter - a.travelTimeBefore),
    );
  context.realCityEvidence = {
    bounds: snapshot.bbox,
    intersections: snapshot.stats.intersections,
    roadLinks: snapshot.stats.roadLinks,
    origins: snapshot.stats.origins,
    facilityCount: snapshot.facilities.length,
    serviceCategories: snapshot.network.accessibilityCategories ?? [],
    criticalCandidates: screening.ids.length,
    candidateScreening: screening.screened,
    modelVersion: snapshot.realCityModelVersion,
    mostAffectedOrigin: originChanges[0] ?? null,
  };
  return context;
}
