import { calculateAccessibility } from "@/lib/metrics/metrics";
import { simulate } from "@/lib/simulation/simulate";
import type { Network, ODPair, SimulationMetrics, SimulationResult } from "@/types/network";
import { decisionConfig } from "./config";
import {
  createScenarioEvaluator,
  validClosureIds,
  validateDecisionNetwork,
  type AnalysisProgress,
  type RecoveryPlan,
} from "./recovery";

export interface FailureAssumption {
  edgeId: string;
  probability: number;
}
export interface UncertaintyOptions {
  runs?: number;
  seed?: number;
  failures: FailureAssumption[];
  /** Always unavailable, separately from independently sampled assumptions. */
  fixedClosedEdgeIds?: string[];
}
export interface DistributionSummary {
  mean: number;
  median: number;
  p10: number;
  p90: number;
  min: number;
  max: number;
}
export interface UncertaintySample {
  closedEdgeIds: string[];
  metrics: SimulationMetrics;
  hospitalAccessibility: number | null;
}
export interface UncertaintyResult {
  runs: number;
  seed: number;
  assumptions: FailureAssumption[];
  fixedClosedEdgeIds: string[];
  summaries: {
    resilience: DistributionSummary;
    accessibility: DistributionSummary;
    travelTime: DistributionSummary;
    efficiency: DistributionSummary;
    hospitalAccessibility: DistributionSummary | null;
  };
  probabilityResilienceBelow60: number;
  probabilityAccessibilityBelow70: number | null;
  probabilityHospitalAccessibilityBelow70: number | null;
  worst: UncertaintySample;
  samples: UncertaintySample[];
  /** A scenario sampling count, never a forecast of disaster likelihood. */
  uniqueScenarios: number;
}
export interface RobustRecoveryPlan {
  planId: string;
  restoredEdgeIds: string[];
  cost: number;
  expectedResilience: number;
  worstResilience: number;
  p10Resilience: number;
}
export interface RobustRecoveryResult {
  plans: RobustRecoveryPlan[];
  runs: number;
  assumption: "restored-links-protected-in-user-defined-samples";
  /** Only the supplied shortlisted plans were compared; not a global optimum. */
  comparedPlans: number;
}

export function uncertaintyRunLimit(network: Network): number {
  return network.edges.length <= 80
    ? decisionConfig.monteCarloMaxRuns
    : network.edges.length <= 200
      ? decisionConfig.monteCarloMediumMaxRuns
      : decisionConfig.monteCarloLargeMaxRuns;
}

/** Mulberry32: same unsigned seed gives the same independent uniform draws. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function summarizeDistribution(values: readonly number[]): DistributionSummary {
  if (!values.length || values.some((value) => !Number.isFinite(value)))
    throw new Error("INVALID_DISTRIBUTION");
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (q: number) => {
    const position = (sorted.length - 1) * q;
    const low = Math.floor(position);
    return (
      sorted[low] + (sorted[Math.min(low + 1, sorted.length - 1)] - sorted[low]) * (position - low)
    );
  };
  return {
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    median: quantile(0.5),
    p10: quantile(0.1),
    p90: quantile(0.9),
    min: sorted[0],
    max: sorted.at(-1)!,
  };
}

export function runUncertainty(
  network: Network,
  odPairs: readonly ODPair[],
  baseline: SimulationResult,
  options: UncertaintyOptions,
  onProgress?: AnalysisProgress,
): UncertaintyResult {
  validateDecisionNetwork(network, odPairs);
  const runs = options.runs ?? decisionConfig.monteCarloDefaultRuns;
  const seed = options.seed ?? decisionConfig.monteCarloDefaultSeed;
  if (
    !Number.isInteger(runs) ||
    runs < decisionConfig.monteCarloMinRuns ||
    runs > uncertaintyRunLimit(network)
  ) {
    throw new Error("INVALID_UNCERTAINTY_RUNS");
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("INVALID_UNCERTAINTY_SEED");
  if (
    options.failures.length > decisionConfig.monteCarloMaxAssumptions ||
    new Set(options.failures.map((failure) => failure.edgeId)).size !== options.failures.length ||
    options.failures.some(
      (failure) =>
        !Number.isFinite(failure.probability) || failure.probability < 0 || failure.probability > 1,
    )
  ) {
    throw new Error("INVALID_FAILURE_ASSUMPTIONS");
  }
  const failures = [...options.failures].sort((a, b) => a.edgeId.localeCompare(b.edgeId));
  const fixedClosedEdgeIds = validClosureIds(network, options.fixedClosedEdgeIds ?? []);
  validClosureIds(network, [...fixedClosedEdgeIds, ...failures.map((failure) => failure.edgeId)]);
  if (failures.some((failure) => fixedClosedEdgeIds.includes(failure.edgeId)))
    throw new Error("DUPLICATE_FIXED_FAILURE");
  const random = seededRandom(seed);
  const samples: UncertaintySample[] = [];
  const cache = new Map<string, UncertaintySample>();
  const unique = new Set<string>();
  const cacheLimit =
    network.edges.length <= 200
      ? decisionConfig.scenarioCacheSmall
      : decisionConfig.scenarioCacheLarge;
  const hasHospital = network.nodes.some(
    (node) => node.essentialService && node.type === "hospital",
  );
  const hasServices = network.nodes.some(
    (node) => node.essentialService && ["hospital", "shelter", "station"].includes(node.type),
  );
  onProgress?.(0, runs);
  for (let run = 0; run < runs; run++) {
    const closedEdgeIds = [
      ...fixedClosedEdgeIds,
      ...failures
        .filter((failure) => random() < failure.probability)
        .map((failure) => failure.edgeId),
    ].sort();
    const key = JSON.stringify(closedEdgeIds);
    unique.add(key);
    let sample = cache.get(key);
    if (!sample) {
      const result = closedEdgeIds.length
        ? simulate(network, odPairs, closedEdgeIds, baseline)
        : baseline;
      let hospitalAccessibility: number | null = null;
      if (hasHospital) {
        const access = calculateAccessibility(network, result.edgeStates, closedEdgeIds);
        const weight = access.records.reduce((sum, record) => sum + record.population, 0);
        // Union of hospitals within the model threshold, not an average of their catchments.
        hospitalAccessibility = weight
          ? (100 *
              access.records.reduce(
                (sum, record) => sum + record.population * record.scores.hospital,
                0,
              )) /
            weight
          : 0;
      }
      if (Object.values(result.metrics).some((value) => !Number.isFinite(value)))
        throw new Error("NONFINITE_DECISION_RESULT");
      sample = { closedEdgeIds, metrics: result.metrics, hospitalAccessibility };
      if (cache.size >= cacheLimit) cache.delete(cache.keys().next().value!);
      cache.set(key, sample);
    }
    samples.push(sample);
    onProgress?.(run + 1, runs);
  }
  const worst = [...samples].sort(
    (a, b) =>
      a.metrics.resilienceScore - b.metrics.resilienceScore ||
      JSON.stringify(a.closedEdgeIds).localeCompare(JSON.stringify(b.closedEdgeIds)),
  )[0];
  return {
    runs,
    seed,
    assumptions: failures,
    fixedClosedEdgeIds,
    summaries: {
      resilience: summarizeDistribution(samples.map((sample) => sample.metrics.resilienceScore)),
      accessibility: summarizeDistribution(samples.map((sample) => sample.metrics.accessibility)),
      travelTime: summarizeDistribution(samples.map((sample) => sample.metrics.averageTravelTime)),
      efficiency: summarizeDistribution(samples.map((sample) => sample.metrics.networkEfficiency)),
      hospitalAccessibility: hasHospital
        ? summarizeDistribution(samples.map((sample) => sample.hospitalAccessibility!))
        : null,
    },
    probabilityResilienceBelow60:
      samples.filter(
        (sample) => sample.metrics.resilienceScore < decisionConfig.resilienceWarningThreshold,
      ).length / runs,
    probabilityAccessibilityBelow70: hasServices
      ? samples.filter(
          (sample) => sample.metrics.accessibility < decisionConfig.accessibilityWarningThreshold,
        ).length / runs
      : null,
    probabilityHospitalAccessibilityBelow70: hasHospital
      ? samples.filter(
          (sample) => sample.hospitalAccessibility! < decisionConfig.accessibilityWarningThreshold,
        ).length / runs
      : null,
    worst,
    samples,
    uniqueScenarios: unique.size,
  };
}

/** Compares a shortlist against common draws. Restored links are explicitly
 * assumed available in every draw; this is not a claim about engineering repair. */
export function evaluateRobustRecovery(
  network: Network,
  odPairs: readonly ODPair[],
  baseline: SimulationResult,
  plans: readonly RecoveryPlan[],
  uncertainty: UncertaintyResult,
  onProgress?: AnalysisProgress,
): RobustRecoveryResult {
  if (
    !plans.length ||
    plans.length > 3 ||
    uncertainty.runs !== uncertainty.samples.length ||
    uncertainty.runs < 1 ||
    uncertainty.runs > uncertaintyRunLimit(network)
  )
    throw new Error("INVALID_ROBUST_COMPARISON");
  const evaluate = createScenarioEvaluator(network, odPairs, baseline);
  const total = plans.length * uncertainty.samples.length;
  let completed = 0;
  onProgress?.(0, total);
  const results = plans.map((plan) => {
    const restored = new Set(validClosureIds(network, plan.restoredEdgeIds));
    const values = uncertainty.samples.map((sample) => {
      const closures = validClosureIds(network, sample.closedEdgeIds).filter(
        (id) => !restored.has(id),
      );
      const score = evaluate(closures).resilienceScore;
      onProgress?.(++completed, total);
      return score;
    });
    const summary = summarizeDistribution(values);
    return {
      planId: plan.id,
      restoredEdgeIds: [...plan.restoredEdgeIds],
      cost: plan.cost,
      expectedResilience: summary.mean,
      worstResilience: summary.min,
      p10Resilience: summary.p10,
    };
  });
  return {
    plans: results.sort(
      (a, b) =>
        b.expectedResilience - a.expectedResilience ||
        b.worstResilience - a.worstResilience ||
        a.cost - b.cost ||
        a.planId.localeCompare(b.planId),
    ),
    runs: uncertainty.runs,
    assumption: "restored-links-protected-in-user-defined-samples",
    comparedPlans: results.length,
  };
}
