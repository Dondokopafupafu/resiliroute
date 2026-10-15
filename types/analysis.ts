import type { CriticalLinkResult, RecoveryResult, SimulationMetrics } from "./network";

export interface AnalysisContext {
  realCityEvidence?: {
    bounds: { south: number; west: number; north: number; east: number };
    intersections: number;
    roadLinks: number;
    origins: number;
    facilityCount: number;
    serviceCategories: string[];
    criticalCandidates: number;
    candidateScreening: boolean;
    modelVersion: string;
    mostAffectedOrigin: { name: string; travelTimeBefore: number; travelTimeAfter: number } | null;
  };
  scenario: string;
  closedEdges: string[];
  baseline: SimulationMetrics;
  current: SimulationMetrics;
  travelTimeChangePercent: number;
  congestionChangePoints: number;
  mostAffectedDistrict: {
    name: string;
    travelTimeBefore: number;
    travelTimeAfter: number;
    accessibilityBefore: number;
    accessibilityAfter: number;
  };
  criticalInfrastructure: Pick<
    CriticalLinkResult,
    "edgeId" | "name" | "score" | "travelTimeIncrease" | "accessibilityLoss"
  > | null;
  affectedServices: {
    name: string;
    type: string;
    before: number;
    after: number;
    threshold: number;
  }[];
  redistributedLink: { name: string; before: number; after: number; utilization: number } | null;
  bestRecovery: Pick<
    RecoveryResult,
    "edgeId" | "name" | "resilienceGain" | "accessibilityGain" | "travelTimeSaved"
  > | null;
}
export interface AIAnalysis {
  summary: string;
  mainImpact: string;
  whyItMatters: string;
  mostAffectedArea: string;
  criticalInfrastructure: string;
  recommendedActions: string[];
  limitations: string;
}
export interface AnalysisResponse {
  analysis: AIAnalysis;
  source: "local" | "openai";
}
