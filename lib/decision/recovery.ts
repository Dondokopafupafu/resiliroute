import { simulate } from "@/lib/simulation/simulate";
import type {
  Network,
  NetworkEdge,
  ODPair,
  SimulationMetrics,
  SimulationResult,
} from "@/types/network";
import { decisionConfig } from "./config";
import { decisionClosureLinks } from "./closure-links";

export type RecoveryObjective =
  | "resilience"
  | "accessibility"
  | "travelTime"
  | "efficiency"
  | "balanced";
export interface RecoveryPlan {
  id: string;
  restoredEdgeIds: string[];
  cost: number;
  metrics: SimulationMetrics;
  /** Higher is better; normalized to 0–100 for every objective. */
  score: number;
}
export interface RecoveryOptions {
  budget: number;
  costs: Record<string, number>;
  objective: RecoveryObjective;
}
export interface RecoveryOptimizationResult {
  method: "exact" | "beam";
  plans: RecoveryPlan[];
  evaluated: number;
  exactClosureLimit: number;
  evaluationLimit: number;
}
export interface RecoveryStage {
  edgeId: string;
  stage: number;
  metrics: SimulationMetrics;
  resilienceGain: number;
  accessibilityGain: number;
  travelTimeSaved: number;
  method: "exact-subset" | "greedy";
}
export type AnalysisProgress = (completed: number, total: number) => void;

export function inferRecoveryCost(edge: NetworkEdge): number {
  const costs = decisionConfig.recoveryCosts;
  if (edge.infrastructureType === "bridge" || edge.osm?.bridge) return costs.bridge;
  if (edge.mode === "rail") return costs.rail;
  const roadClass = edge.osm?.highway.replace(/_link$/, "");
  if (roadClass && roadClass in costs) return costs[roadClass as keyof typeof costs];
  return costs.other;
}

export function validateDecisionNetwork(network: Network, odPairs: readonly ODPair[]): void {
  if (
    !network.nodes.length ||
    !network.edges.length ||
    network.nodes.length > decisionConfig.maxNetworkNodes ||
    network.edges.length > decisionConfig.maxNetworkEdges ||
    odPairs.length > decisionConfig.maxODPairs
  )
    throw new Error("DECISION_NETWORK_LIMIT");
}

export function validClosureIds(network: Network, ids: readonly string[]): string[] {
  const existing = new Set(decisionClosureLinks(network).map((edge) => edge.id));
  const unique = [...new Set(ids)].sort();
  if (unique.length > decisionConfig.maxClosedLinks || unique.some((id) => !existing.has(id))) {
    throw new Error("INVALID_DECISION_CLOSURES");
  }
  return unique;
}

/** A cache belongs to a single network/baseline/parameter job. It is never reused
 * across networks, and only retains metrics-sized results for bounded memory. */
export function createScenarioEvaluator(
  network: Network,
  odPairs: readonly ODPair[],
  baseline: SimulationResult,
  current?: SimulationResult,
) {
  validateDecisionNetwork(network, odPairs);
  const cache = new Map<string, SimulationMetrics>();
  const capacity =
    network.edges.length <= 200
      ? decisionConfig.scenarioCacheSmall
      : decisionConfig.scenarioCacheLarge;
  const key = (ids: readonly string[]) => JSON.stringify([...new Set(ids)].sort());
  cache.set(key([]), baseline.metrics);
  if (current) cache.set(key(current.closedEdgeIds), current.metrics);
  return (closedIds: readonly string[]): SimulationMetrics => {
    const cacheKey = key(closedIds);
    const found = cache.get(cacheKey);
    if (found) return found;
    const result = simulate(network, odPairs, closedIds, baseline).metrics;
    if (Object.values(result).some((value) => !Number.isFinite(value)))
      throw new Error("NONFINITE_DECISION_RESULT");
    if (cache.size >= capacity) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, result);
    return result;
  };
}

const bounded = (value: number) => Math.max(0, Math.min(1, value));
function retention(value: number, reference: number): number {
  return reference > 0 ? bounded(value / reference) : value > 0 ? 1 : 0;
}
export function recoveryObjectiveScore(
  metrics: SimulationMetrics,
  baseline: SimulationMetrics,
  objective: RecoveryObjective,
): number {
  // Single objectives must remain strictly ordered even when restoring a road
  // improves on baseline (Braess-like outcomes can exist in an assignment).
  if (objective === "travelTime") {
    const scale = Math.max(baseline.averageTravelTime, 1e-9);
    return 100 / (1 + Math.max(0, metrics.averageTravelTime) / scale);
  }
  if (objective === "efficiency") return 100 * bounded(metrics.networkEfficiency / 100);
  const scores = {
    resilience: bounded(metrics.resilienceScore / 100),
    accessibility: bounded(metrics.accessibility / 100),
    travelTime:
      metrics.averageTravelTime > 0
        ? bounded(baseline.averageTravelTime / metrics.averageTravelTime)
        : 1,
    efficiency: retention(metrics.networkEfficiency, baseline.networkEfficiency),
  };
  if (objective !== "balanced") return 100 * scores[objective];
  const weights = decisionConfig.balancedWeights;
  return (
    100 *
    (scores.resilience * weights.resilience +
      scores.accessibility * weights.accessibility +
      scores.travelTime * weights.travelTime +
      scores.efficiency * weights.efficiency)
  );
}

export function exactRecoveryLimit(network: Network): number {
  return (
    decisionConfig.exactRecoveryThresholds.find((limit) => network.edges.length <= limit.maxEdges)
      ?.maxClosures ?? 0
  );
}
function sortPlans(a: RecoveryPlan, b: RecoveryPlan): number {
  return b.score - a.score || a.cost - b.cost || a.id.localeCompare(b.id);
}

export function optimizeRecovery(
  network: Network,
  odPairs: readonly ODPair[],
  current: SimulationResult,
  baseline: SimulationResult,
  options: RecoveryOptions,
  onProgress?: AnalysisProgress,
): RecoveryOptimizationResult {
  const closedIds = validClosureIds(network, current.closedEdgeIds);
  if (
    !Number.isInteger(options.budget) ||
    options.budget < 0 ||
    options.budget > decisionConfig.maxBudget
  ) {
    throw new Error("INVALID_RECOVERY_BUDGET");
  }
  if (
    !["resilience", "accessibility", "travelTime", "efficiency", "balanced"].includes(
      options.objective,
    )
  ) {
    throw new Error("INVALID_RECOVERY_OBJECTIVE");
  }
  const edgeById = new Map(network.edges.map((edge) => [edge.id, edge]));
  const costs = new Map(
    closedIds.map((id) => {
      const cost = options.costs[id] ?? inferRecoveryCost(edgeById.get(id)!);
      if (
        !Number.isInteger(cost) ||
        cost < decisionConfig.recoveryCostMin ||
        cost > decisionConfig.recoveryCostMax
      ) {
        throw new Error("INVALID_RECOVERY_COST");
      }
      return [id, cost];
    }),
  );
  const evaluate = createScenarioEvaluator(network, odPairs, baseline, current);
  const exactClosureLimit = exactRecoveryLimit(network);
  const method = closedIds.length <= exactClosureLimit ? "exact" : "beam";
  const evaluationLimit =
    method === "exact"
      ? 2 ** closedIds.length
      : network.edges.length <= 200
        ? decisionConfig.beamEvaluationsSmall
        : decisionConfig.beamEvaluationsLarge;
  const plans = new Map<string, RecoveryPlan>();
  function plan(ids: string[], cost: number): RecoveryPlan {
    const sorted = [...ids].sort();
    const restored = new Set(sorted);
    const metrics = evaluate(closedIds.filter((id) => !restored.has(id)));
    const result: RecoveryPlan = {
      id: JSON.stringify(sorted),
      restoredEdgeIds: sorted,
      cost,
      metrics,
      score: recoveryObjectiveScore(metrics, baseline.metrics, options.objective),
    };
    plans.set(result.id, result);
    return result;
  }
  if (method === "exact") {
    const feasible: { ids: string[]; cost: number }[] = [];
    for (let mask = 0; mask < 2 ** closedIds.length; mask++) {
      const ids = closedIds.filter((_, index) => (mask & (1 << index)) !== 0);
      const cost = ids.reduce((sum, id) => sum + costs.get(id)!, 0);
      if (cost <= options.budget) feasible.push({ ids, cost });
    }
    onProgress?.(0, feasible.length);
    for (const candidate of feasible) {
      plan(candidate.ids, candidate.cost);
      onProgress?.(plans.size, feasible.length);
    }
  } else {
    const first = plan([], 0);
    let beam = [first];
    onProgress?.(0, evaluationLimit);
    while (beam.length && plans.size < evaluationLimit) {
      const candidates: RecoveryPlan[] = [];
      for (const parent of beam) {
        for (const id of closedIds) {
          if (parent.restoredEdgeIds.includes(id)) continue;
          const cost = parent.cost + costs.get(id)!;
          const ids = [...parent.restoredEdgeIds, id].sort();
          if (cost > options.budget || plans.has(JSON.stringify(ids))) continue;
          candidates.push(plan(ids, cost));
          onProgress?.(plans.size, evaluationLimit);
          if (plans.size >= evaluationLimit) break;
        }
        if (plans.size >= evaluationLimit) break;
      }
      beam = candidates.sort(sortPlans).slice(0, decisionConfig.beamWidth);
    }
    // Actual workload can end before the cap when budget prunes every expansion.
    onProgress?.(plans.size, plans.size);
  }
  return {
    method,
    plans: [...plans.values()].sort(sortPlans).slice(0, 3),
    evaluated: plans.size,
    exactClosureLimit,
    evaluationLimit,
  };
}

/** Maximizes the sum of stage resilience, not construction time or days. For
 * <=8 links subset-DP considers every ordering; larger plans use greedy stages. */
export function calculateRecoverySequence(
  network: Network,
  odPairs: readonly ODPair[],
  current: SimulationResult,
  baseline: SimulationResult,
  planIds: readonly string[],
  onProgress?: AnalysisProgress,
): RecoveryStage[] {
  const closures = validClosureIds(network, current.closedEdgeIds);
  const ids = [...new Set(planIds)].sort();
  if (ids.some((id) => !closures.includes(id))) throw new Error("INVALID_RECOVERY_SEQUENCE");
  const evaluate = createScenarioEvaluator(network, odPairs, baseline, current);
  const metricsFor = (restored: readonly string[]) => {
    const restoredIds = new Set(restored);
    return evaluate(closures.filter((id) => !restoredIds.has(id)));
  };
  const method = ids.length <= decisionConfig.exactSequenceMaxLinks ? "exact-subset" : "greedy";
  const order: string[] = [];
  if (method === "exact-subset") {
    const count = 2 ** ids.length;
    const scores = new Float64Array(count).fill(Number.NEGATIVE_INFINITY);
    const previous = new Int16Array(count).fill(-1);
    scores[0] = 0;
    onProgress?.(0, count - 1);
    for (let mask = 1; mask < count; mask++) {
      const restored = ids.filter((_, index) => (mask & (1 << index)) !== 0);
      const stageScore = metricsFor(restored).resilienceScore;
      for (let index = 0; index < ids.length; index++) {
        if (!(mask & (1 << index))) continue;
        const candidate = scores[mask ^ (1 << index)] + stageScore;
        if (candidate > scores[mask]) {
          scores[mask] = candidate;
          previous[mask] = index;
        }
      }
      onProgress?.(mask, count - 1);
    }
    for (let mask = count - 1; mask > 0; ) {
      const index = previous[mask];
      order.unshift(ids[index]);
      mask ^= 1 << index;
    }
  } else {
    const remaining = new Set(ids);
    while (remaining.size) {
      const next = [...remaining]
        .map((id) => ({ id, score: metricsFor([...order, id]).resilienceScore }))
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))[0];
      order.push(next.id);
      remaining.delete(next.id);
      onProgress?.(order.length, ids.length);
    }
  }
  let previousMetrics = current.metrics;
  return order.map((edgeId, index) => {
    const metrics = metricsFor(order.slice(0, index + 1));
    const stage: RecoveryStage = {
      edgeId,
      stage: index + 1,
      metrics,
      resilienceGain: metrics.resilienceScore - previousMetrics.resilienceScore,
      accessibilityGain: metrics.accessibility - previousMetrics.accessibility,
      travelTimeSaved: previousMetrics.averageTravelTime - metrics.averageTravelTime,
      method,
    };
    previousMetrics = metrics;
    return stage;
  });
}
