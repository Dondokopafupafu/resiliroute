import { simulate } from "@/lib/simulation/simulate";
import type { Network, ODPair, SimulationResult } from "@/types/network";
import { decisionConfig } from "./config";
import {
  calculateRecoverySequence,
  optimizeRecovery,
  validClosureIds,
  validateDecisionNetwork,
  type RecoveryOptions,
  type RecoveryOptimizationResult,
  type RecoveryPlan,
  type RecoveryStage,
} from "./recovery";
import {
  evaluateRobustRecovery,
  runUncertainty,
  type RobustRecoveryResult,
  type UncertaintyOptions,
  type UncertaintyResult,
} from "./uncertainty";

interface NetworkPayload {
  network: Network;
  odPairs: ODPair[];
  baseline: SimulationResult;
}
export type DecisionWorkerRequest =
  | {
      id: string;
      type: "recovery";
      payload: NetworkPayload & { current: SimulationResult; options: RecoveryOptions };
    }
  | {
      id: string;
      type: "sequence";
      payload: NetworkPayload & { current: SimulationResult; restoredEdgeIds: string[] };
    }
  | { id: string; type: "uncertainty"; payload: NetworkPayload & { options: UncertaintyOptions } }
  | {
      id: string;
      type: "robust";
      payload: NetworkPayload & { plans: RecoveryPlan[]; uncertainty: UncertaintyResult };
    }
  | {
      id: string;
      type: "compare";
      payload: NetworkPayload & { scenarios: { id: string; closedEdgeIds: string[] }[] };
    };
export interface RecoveryWorkerResult {
  optimization: RecoveryOptimizationResult;
  sequence: RecoveryStage[];
}
export type DecisionWorkerResponse =
  | {
      id: string;
      type: "progress";
      phase: DecisionWorkerRequest["type"] | "sequence";
      completed: number;
      total: number;
    }
  | { id: string; type: "result"; job: "recovery"; payload: RecoveryWorkerResult }
  | { id: string; type: "result"; job: "sequence"; payload: RecoveryStage[] }
  | { id: string; type: "result"; job: "uncertainty"; payload: UncertaintyResult }
  | { id: string; type: "result"; job: "robust"; payload: RobustRecoveryResult }
  | {
      id: string;
      type: "result";
      job: "compare";
      payload: { id: string; result: SimulationResult }[];
    }
  | { id: string; type: "error"; message: string };

// The caller cancels by terminating this worker. No late response can modify a
// later job because every response also carries the caller's unique request id.
self.onmessage = (event: MessageEvent<DecisionWorkerRequest>) => {
  const request = event.data;
  const send = (message: DecisionWorkerResponse) => self.postMessage(message);
  try {
    if (!request || typeof request.id !== "string" || request.id.length > 100)
      throw new Error("INVALID_DECISION_REQUEST");
    const { id, payload } = request;
    validateDecisionNetwork(payload.network, payload.odPairs);
    const progress = (completed: number, total: number) =>
      send({ id, type: "progress", phase: request.type, completed, total });
    switch (request.type) {
      case "recovery": {
        const { network, odPairs, current, baseline, options } = request.payload;
        const optimization = optimizeRecovery(
          network,
          odPairs,
          current,
          baseline,
          options,
          progress,
        );
        const sequence = calculateRecoverySequence(
          network,
          odPairs,
          current,
          baseline,
          optimization.plans[0]?.restoredEdgeIds ?? [],
          (completed, total) => send({ id, type: "progress", phase: "sequence", completed, total }),
        );
        send({ id, type: "result", job: "recovery", payload: { optimization, sequence } });
        break;
      }
      case "sequence": {
        const { network, odPairs, current, baseline, restoredEdgeIds } = request.payload;
        send({
          id,
          type: "result",
          job: "sequence",
          payload: calculateRecoverySequence(
            network,
            odPairs,
            current,
            baseline,
            restoredEdgeIds,
            progress,
          ),
        });
        break;
      }
      case "uncertainty": {
        const { network, odPairs, baseline, options } = request.payload;
        send({
          id,
          type: "result",
          job: "uncertainty",
          payload: runUncertainty(network, odPairs, baseline, options, progress),
        });
        break;
      }
      case "robust": {
        const { network, odPairs, baseline, plans, uncertainty } = request.payload;
        send({
          id,
          type: "result",
          job: "robust",
          payload: evaluateRobustRecovery(network, odPairs, baseline, plans, uncertainty, progress),
        });
        break;
      }
      case "compare": {
        const { network, odPairs, baseline, scenarios } = request.payload;
        if (
          scenarios.length > decisionConfig.maxComparedScenarios ||
          new Set(scenarios.map((scenario) => scenario.id)).size !== scenarios.length
        ) {
          throw new Error("INVALID_SCENARIO_COMPARISON");
        }
        progress(0, scenarios.length);
        const results = scenarios.map((scenario, index) => {
          const closed = validClosureIds(network, scenario.closedEdgeIds);
          const result = closed.length ? simulate(network, odPairs, closed, baseline) : baseline;
          progress(index + 1, scenarios.length);
          return { id: scenario.id, result };
        });
        send({ id, type: "result", job: "compare", payload: results });
        break;
      }
      default:
        throw new Error("INVALID_DECISION_REQUEST");
    }
  } catch (error) {
    const message =
      error instanceof Error && /^[A-Z_]+$/.test(error.message)
        ? error.message
        : "DECISION_ANALYSIS_FAILED";
    send({ id: request?.id ?? "invalid", type: "error", message });
  }
};
