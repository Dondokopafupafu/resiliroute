import { simulate } from "@/lib/simulation/simulate";
import { analyzeCriticalLinks, analyzeRecovery } from "@/lib/simulation/stress-test";
import { screenCriticalCandidates } from "./stress-screening";
import type { RealCityNetwork } from "@/types/real-city";
import type { CriticalLinkResult, RecoveryResult, SimulationResult } from "@/types/network";

export interface LabAnalysis {
  baseline: SimulationResult;
  current: SimulationResult;
  ranking: CriticalLinkResult[];
  recovery: RecoveryResult[];
  screening: { ids: string[]; screened: boolean; total: number };
  elapsedMs: number;
}
export type WorkerResponse =
  | {
      type: "progress";
      step: "baseline" | "assignment" | "criticality" | "recovery";
      completed: number;
      total: number;
    }
  | { type: "current"; baseline: SimulationResult; current: SimulationResult }
  | { type: "complete"; result: LabAnalysis }
  | { type: "error" };

self.onmessage = (
  event: MessageEvent<{
    snapshot: RealCityNetwork;
    closedIds: string[];
    baseline?: SimulationResult;
  }>,
) => {
  const { snapshot, closedIds } = event.data;
  const started = performance.now();
  const send = (message: WorkerResponse) => self.postMessage(message);
  try {
    send({ type: "progress", step: "baseline", completed: 0, total: 1 });
    const baseline = event.data.baseline ?? simulate(snapshot.network, snapshot.odPairs);
    send({ type: "progress", step: "assignment", completed: 0, total: 1 });
    const current = closedIds.length
      ? simulate(snapshot.network, snapshot.odPairs, closedIds, baseline)
      : baseline;
    send({ type: "current", baseline, current });
    const screening = screenCriticalCandidates(snapshot.network, current);
    const ranking: CriticalLinkResult[] = [];
    screening.ids.forEach((id, i) => {
      send({ type: "progress", step: "criticality", completed: i, total: screening.ids.length });
      ranking.push(
        ...analyzeCriticalLinks(snapshot.network, snapshot.odPairs, current, baseline, [id]),
      );
    });
    ranking.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    send({ type: "progress", step: "recovery", completed: 0, total: closedIds.length });
    const recovery = analyzeRecovery(snapshot.network, snapshot.odPairs, current, baseline);
    send({
      type: "complete",
      result: {
        baseline,
        current,
        ranking,
        recovery,
        screening,
        elapsedMs: performance.now() - started,
      },
    });
  } catch {
    send({ type: "error" });
  }
};
