import { harborCity } from "@/data/harbor-city";
import type { Locale } from "@/lib/i18n/messages";
import { generateJapaneseAnalysis } from "./japanese-analysis";
import type { AIAnalysis, AnalysisContext } from "@/types/analysis";
import type {
  CriticalLinkResult,
  RecoveryResult,
  SimulationResult,
  Network,
} from "@/types/network";
import { generateRealCityBrief } from "@/lib/real-city/brief";

export function createAnalysisContext(
  scenario: string,
  baseline: SimulationResult,
  current: SimulationResult,
  critical: readonly CriticalLinkResult[],
  recovery: readonly RecoveryResult[],
  network: Network = harborCity,
): AnalysisContext {
  const districts = current.districts
    .map((d) => {
      const before = baseline.districts.find((b) => b.district === d.district)!;
      const score =
        Math.max(0, d.averageTravelTime / Math.max(before.averageTravelTime, 1) - 1) * 100 +
        Math.max(0, before.accessibility - d.accessibility) +
        d.isolationRisk;
      return { d, before, score };
    })
    .sort((a, b) => b.score - a.score);
  const affected = districts[0];
  const redistribution = network.edges
    .filter((e) => current.edgeStates[e.id].available)
    .map((e) => ({
      name: e.name,
      before: baseline.edgeStates[e.id].volume,
      after: current.edgeStates[e.id].volume,
      utilization: current.edgeStates[e.id].utilization,
    }))
    .sort((a, b) => b.after - b.before - (a.after - a.before))[0];
  return {
    scenario,
    closedEdges: current.closedEdgeIds.map((id) => network.edges.find((e) => e.id === id)!.name),
    baseline: baseline.metrics,
    current: current.metrics,
    travelTimeChangePercent: baseline.metrics.averageTravelTime
      ? (current.metrics.averageTravelTime / baseline.metrics.averageTravelTime - 1) * 100
      : 0,
    congestionChangePoints: current.metrics.congestion - baseline.metrics.congestion,
    mostAffectedDistrict: {
      name: affected.d.district,
      travelTimeBefore: affected.before.averageTravelTime,
      travelTimeAfter: affected.d.averageTravelTime,
      accessibilityBefore: affected.before.accessibility,
      accessibilityAfter: affected.d.accessibility,
    },
    criticalInfrastructure: critical[0] ?? null,
    affectedServices: current.services
      .filter((s) => s.type !== "station")
      .map((service) => ({
        name: service.name,
        type: service.type,
        before: baseline.services.find((s) => s.nodeId === service.nodeId)!.reachablePopulation,
        after: service.reachablePopulation,
        threshold: service.threshold,
      }))
      .sort((a, b) => b.before - b.after - (a.before - a.after)),
    redistributedLink:
      redistribution && redistribution.after > redistribution.before + 1 ? redistribution : null,
    bestRecovery: recovery[0]
      ? {
          edgeId: recovery[0].edgeId,
          name: recovery[0].name,
          resilienceGain: recovery[0].resilienceGain,
          accessibilityGain: recovery[0].accessibilityGain,
          travelTimeSaved: recovery[0].travelTimeSaved,
        }
      : null,
  };
}

const f = (value: number) => value.toFixed(1);

// This is a deterministic reasoning layer, clearly labeled as local analysis.
// Every statement is selected from actual calculated evidence, never a fixed
// scenario script. The LLM uses the same context when configured.
export function generateLocalAnalysis(context: AnalysisContext, locale: Locale = "en"): AIAnalysis {
  if (context.realCityEvidence) return generateRealCityBrief(context, locale);
  if (locale === "ja") return generateJapaneseAnalysis(context);
  const {
    baseline: before,
    current: after,
    mostAffectedDistrict: district,
    redistributedLink: redistribution,
    bestRecovery,
    criticalInfrastructure: critical,
  } = context;
  const disrupted = context.closedEdges.length > 0;
  const service = context.affectedServices.find((s) => s.before > s.after + 0.01);
  const changed =
    Math.abs(after.averageTravelTime - before.averageTravelTime) > 0.05 ||
    Math.abs(after.accessibility - before.accessibility) > 0.05;
  return {
    summary: !disrupted
      ? "A connected city still has weak links. Test a disruption to see how local failures can cascade across Harbor City."
      : changed
        ? `${context.closedEdges.length} ${context.closedEdges.length === 1 ? "link closure changes" : "link closures change"} mobility across the city. Average modeled travel time ${after.averageTravelTime >= before.averageTravelTime ? "increases" : "decreases"} from ${f(before.averageTravelTime)} to ${f(after.averageTravelTime)} minutes.`
        : "These closures have little citywide effect under the modeled demand. Local facilities and individual routes can still be affected.",
    mainImpact: disrupted
      ? `Essential-service accessibility shifts from ${f(before.accessibility)}% to ${f(after.accessibility)}%. ${after.disconnectedDemand > 0 ? `${Math.round(after.disconnectedDemand).toLocaleString("en-US")} person-trips per model hour are disconnected.` : "All modeled OD pairs remain connected, but connectivity alone does not guarantee timely access."}`
      : `The reference network serves ${Math.round(before.totalDemand).toLocaleString("en-US")} modeled person-trips per hour. Accessibility is ${f(before.accessibility)}%; the resilience score is 100 by definition of baseline retention.`,
    whyItMatters: redistribution
      ? `Demand moves onto ${redistribution.name}: ${Math.round(redistribution.before).toLocaleString("en-US")} → ${Math.round(redistribution.after).toLocaleString("en-US")} person-trips per model hour. Its utilization reaches ${Math.round(redistribution.utilization * 100)}% of synthetic capacity. ${service ? `${service.name} loses ${f(service.before - service.after)} percentage points of reachable population within its ${service.threshold}-minute threshold.` : "Shared corridors carry the spillover, so effects extend beyond the closed links."}`
      : disrupted
        ? "The remaining connections absorb demand. Check district access and individual routes even when citywide averages move only slightly."
        : "The next-link stress test measures which single failure creates the greatest additional loss. It can reveal risks that an ordinary route finder cannot show.",
    mostAffectedArea:
      disrupted && changed
        ? `${district.name} has the largest combined increase in district travel time, loss of accessibility, and disconnected-demand share. Its modeled average trip changes from ${f(district.travelTimeBefore)} to ${f(district.travelTimeAfter)} minutes.`
        : "No district is affected by a disruption in the reference state. District comparisons reveal unequal impacts once a link closes.",
    criticalInfrastructure: critical
      ? `${critical.name} is the highest-ranked available link in the current stress test. Removing it ${critical.travelTimeIncrease >= 0 ? "adds" : "reduces travel time by"} ${f(Math.abs(critical.travelTimeIncrease))} minutes ${critical.travelTimeIncrease >= 0 ? "to the citywide modeled average" : "in the citywide modeled average"} and ${critical.accessibilityLoss >= 0 ? "loses" : "gains"} ${f(Math.abs(critical.accessibilityLoss))} accessibility points.`
      : "No available links remain to stress-test in the current network.",
    recommendedActions: bestRecovery
      ? [
          `Consider restoring ${bestRecovery.name} first: the model estimates a ${f(bestRecovery.resilienceGain)}-point resilience improvement and ${f(bestRecovery.accessibilityGain)} accessibility points recovered.`,
          redistribution
            ? `Evaluate temporary capacity or demand-management options on ${redistribution.name}, then rerun the model with revised inputs.`
            : "Compare district impacts before considering temporary capacity or demand-management options.",
          service
            ? `Investigate the modeled access loss at ${service.name} with local planners and verified infrastructure data.`
            : "Validate essential-service accessibility with local planners and verified infrastructure data.",
        ]
      : [
          critical
            ? `Explore a contingency for ${critical.name}, the highest-ranked single-link failure in the current model.`
            : "Restore network connectivity before comparing further single-link failures.",
          "Test flood and rail scenarios to compare different patterns of network failure.",
          "Replace synthetic inputs with validated local demand and capacity data before using this for planning decisions.",
        ],
    limitations:
      "Synthetic data and a simplified, fixed-iteration traffic model. These are possible planning strategies, not verified emergency instructions. Follow official local guidance during an actual emergency.",
  };
}

const fields = [
  "summary",
  "mainImpact",
  "whyItMatters",
  "mostAffectedArea",
  "criticalInfrastructure",
  "limitations",
] as const;
export function isAIAnalysis(value: unknown): value is AIAnalysis {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    fields.every(
      (field) =>
        typeof record[field] === "string" &&
        record[field].length > 0 &&
        record[field].length <= 1400,
    ) &&
    Array.isArray(record.recommendedActions) &&
    record.recommendedActions.length >= 1 &&
    record.recommendedActions.length <= 5 &&
    record.recommendedActions.every(
      (action) => typeof action === "string" && action.length > 0 && action.length <= 900,
    )
  );
}

export const analysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    mainImpact: { type: "string" },
    whyItMatters: { type: "string" },
    mostAffectedArea: { type: "string" },
    criticalInfrastructure: { type: "string" },
    recommendedActions: { type: "array", items: { type: "string" } },
    limitations: { type: "string" },
  },
  required: [...fields, "recommendedActions"],
};
