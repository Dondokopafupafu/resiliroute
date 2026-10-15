import { cascadeClassification, criticalityBand } from "./evidence";

export type DecisionMapLayer = "traffic" | "criticality" | "cascade";
export type DecisionMapView = "before" | "after";

export const criticalColors = {
  untested: "#82929f",
  low: "#2899aa",
  moderate: "#638abc",
  high: "#cfa23f",
  "very-high": "#d57944",
  critical: "#b94d70",
} as const;
export const cascadeColors = {
  stable: "#439eaa",
  elevated: "#c9a242",
  high: "#db7d3d",
  severe: "#b44973",
} as const;

/** Closed links retain their explicit red/dashed state on every analysis layer. */
export function decisionEdgeColor(
  layer: DecisionMapLayer,
  available: boolean,
  trafficColor: string,
  score: number | undefined,
  maximum: number,
  utilizationIncrease: number,
  closedColor: string,
): string {
  if (!available) return closedColor;
  if (layer === "criticality") return criticalColors[criticalityBand(score, maximum)];
  if (layer === "cascade") return cascadeColors[cascadeClassification(utilizationIncrease)];
  return trafficColor;
}

export function bandText(band: string, locale: "en" | "ja"): string {
  const names: Record<string, [string, string]> = {
    untested: ["Not tested", "未解析"],
    low: ["Low", "低"],
    moderate: ["Moderate", "中"],
    high: ["High", "高"],
    "very-high": ["Very high", "非常に高い"],
    critical: ["Critical", "最重要"],
    stable: ["Stable", "安定"],
    elevated: ["Elevated", "上昇"],
    severe: ["Severe", "著しい増加"],
  };
  return names[band]?.[locale === "ja" ? 1 : 0] ?? band;
}
