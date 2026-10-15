"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Check,
  Download,
  Layers,
  Play,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { deriveDecisionEvidence, explainCriticality } from "@/lib/decision/evidence";
import {
  createSavedScenario,
  networkIdentifier,
  parseSavedScenario,
  scenarioLimits,
  type SavedScenario,
} from "@/lib/decision/scenarios";
import {
  exportAnalysisSnapshot,
  exportDecisionCSV,
  renderResilienceReport,
  type DecisionReportInput,
} from "@/lib/decision/report";
import { decisionConfig } from "@/lib/decision/config";
import { decisionClosureLinks } from "@/lib/decision/closure-links";
import {
  inferRecoveryCost,
  type RecoveryObjective,
  type RecoveryOptimizationResult,
  type RecoveryStage,
} from "@/lib/decision/recovery";
import {
  uncertaintyRunLimit,
  type UncertaintyResult,
  type RobustRecoveryResult,
} from "@/lib/decision/uncertainty";
import type { DecisionWorkerRequest, DecisionWorkerResponse } from "@/lib/decision/analysis-worker";
import type {
  CriticalLinkResult,
  Network,
  ODPair,
  SimulationMetrics,
  SimulationResult,
} from "@/types/network";
import type { BoundingBox } from "@/types/real-city";
import "./decision.css";

export interface DecisionWorkspaceProps {
  network: Network;
  odPairs: readonly ODPair[];
  baseline: SimulationResult;
  current: SimulationResult;
  critical: CriticalLinkResult[];
  networkLabel: string;
  realCity?: boolean;
  bbox?: BoundingBox;
  selectedEdgeId?: string | null;
  busy?: boolean;
  onApplyClosures: (ids: string[]) => void;
  onHighlightEdge?: (id: string | null) => void;
  onLayerChange?: (layer: "traffic" | "criticality" | "cascade") => void;
}

type Tab = "disrupt" | "compare" | "recover" | "uncertainty" | "report";
type Words = (english: string, japanese: string) => string;
type Tagged<T> = { key: string; value: T };
type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;
const MAX_CLOSURES = decisionConfig.maxClosedLinks;
const MAX_SAVED = scenarioLimits.maxSaved;
const MAX_SCENARIO_BYTES = scenarioLimits.maxBytes;
const MAX_BUDGET = decisionConfig.maxClosedLinks * decisionConfig.recoveryCostMax;
const number = (value: number | null | undefined, digits = 1) =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
const delta = (value: number, digits = 1) => `${value > 0 ? "+" : ""}${number(value, digits)}`;
const errorText = (error: unknown) => (error instanceof Error ? error.message : "Invalid input");
const metricLabels = [
  ["resilienceScore", "Resilience", "レジリエンス", " / 100"],
  ["accessibility", "Accessibility", "アクセス率", "%"],
  ["averageTravelTime", "Travel time", "平均移動時間", " min"],
  ["networkEfficiency", "Efficiency", "ネットワーク効率", "%"],
  ["congestion", "Congestion delay", "混雑による遅延", "%"],
  ["disconnectedDemand", "Disconnected demand", "到達不能需要", ""],
] as const;

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function MetricsTable({
  baseline,
  current,
  w,
  hasServices,
}: {
  baseline: SimulationMetrics;
  current: SimulationMetrics;
  w: Words;
  hasServices: boolean;
}) {
  return (
    <div className="decision-table-scroll">
      <table className="decision-table">
        <thead>
          <tr>
            <th>{w("Metric", "指標")}</th>
            <th>{w("Baseline", "通常時")}</th>
            <th>{w("Scenario", "シナリオ")}</th>
            <th>{w("Change", "変化")}</th>
          </tr>
        </thead>
        <tbody>
          {metricLabels.map(([key, en, ja, unit]) => (
            <tr key={key}>
              <th scope="row">{w(en, ja)}</th>
              <td>
                {key === "accessibility" && !hasServices
                  ? w("N/A", "対象なし")
                  : `${number(baseline[key])}${unit}`}
              </td>
              <td>
                {key === "accessibility" && !hasServices
                  ? w("N/A", "対象なし")
                  : `${number(current[key])}${unit}`}
              </td>
              <td>
                {key === "accessibility" && !hasServices
                  ? w("N/A", "対象なし")
                  : delta(current[key] - baseline[key])}
                {key === "accessibility" && !hasServices
                  ? ""
                  : ["accessibility", "networkEfficiency", "congestion"].includes(key)
                    ? w(" pts", " ポイント")
                    : key === "averageTravelTime"
                      ? w(" min", " 分")
                      : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`decision-panel ${className}`}>
      <div className="decision-panel-heading">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="decision-empty">{children}</div>;
}

function SequenceChart({
  rows,
  current,
  w,
  hasServices,
}: {
  rows: RecoveryStage[];
  current: SimulationMetrics;
  w: Words;
  hasServices: boolean;
}) {
  const data = [current, ...rows.map((row) => row.metrics)];
  const width = 580;
  const height = 140;
  const x = (index: number) => 25 + (index * (width - 50)) / Math.max(1, data.length - 1);
  const y = (value: number) =>
    height - 22 - (Math.max(0, Math.min(100, value)) * (height - 42)) / 100;
  return (
    <div className="decision-sequence-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={w(
          "Modeled resilience and accessibility at each recovery stage",
          "復旧段階ごとのモデル上のレジリエンスとアクセス率",
        )}
      >
        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line x1="25" y1={y(tick)} x2={width - 25} y2={y(tick)} stroke="#dfe7eb" />
            <text x="0" y={y(tick) + 4} fontSize="10" fill="#667d89">
              {tick}
            </text>
          </g>
        ))}
        <polyline
          points={data.map((row, index) => `${x(index)},${y(row.resilienceScore)}`).join(" ")}
          fill="none"
          stroke="#087d89"
          strokeWidth="3"
        />
        {hasServices && (
          <polyline
            points={data.map((row, index) => `${x(index)},${y(row.accessibility)}`).join(" ")}
            fill="none"
            stroke="#c85c35"
            strokeWidth="2"
            strokeDasharray="5 3"
          />
        )}
        {data.map((row, index) => (
          <g key={index}>
            <circle cx={x(index)} cy={y(row.resilienceScore)} r="3" fill="#087d89" />
            <text x={x(index)} y={height - 3} textAnchor="middle" fontSize="10" fill="#667d89">
              {index}
            </text>
          </g>
        ))}
      </svg>
      <p>
        <span className="decision-key-line" />
        {w("Resilience", "レジリエンス")}{" "}
        {hasServices && <span className="decision-key-line dashed" />}
        {hasServices
          ? w(
              "Accessibility · stages, not predicted days",
              "アクセス率・段階は予測日数ではありません",
            )
          : w("Stages, not predicted days", "段階は予測日数ではありません")}
      </p>
    </div>
  );
}

export function DecisionWorkspace({
  network,
  odPairs,
  baseline,
  current,
  critical,
  networkLabel,
  realCity = false,
  bbox,
  selectedEdgeId,
  busy = false,
  onApplyClosures,
  onHighlightEdge,
  onLayerChange,
}: DecisionWorkspaceProps) {
  const { locale, t } = useLocale();
  const w: Words = (en, ja) => (locale === "ja" ? ja : en);
  const rootId = useId();
  const [tab, setTab] = useState<Tab>("disrupt");
  const [draft, setDraft] = useState<string[]>(current.closedEdgeIds);
  const [addId, setAddId] = useState("");
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<{ en: string; ja: string; error?: boolean } | null>(null);
  const [saved, setSaved] = useState<Tagged<SavedScenario[]> | null>(null);
  const [comparison, setComparison] = useState<Tagged<
    { id: string; result: SimulationResult }[]
  > | null>(null);
  const [compareMetric, setCompareMetric] = useState<
    "severity" | "resilienceScore" | "accessibility" | "averageTravelTime" | "congestion"
  >("severity");
  const [budget, setBudget] = useState(5);
  const [objective, setObjective] = useState<RecoveryObjective>("resilience");
  const [costOverrides, setCostOverrides] = useState<Record<string, number>>({});
  const [recovery, setRecovery] = useState<Tagged<{
    optimization: RecoveryOptimizationResult;
    sequence: RecoveryStage[];
  }> | null>(null);
  const [runs, setRuns] = useState(100);
  const [seed, setSeed] = useState(2026);
  const [probabilities, setProbabilities] = useState<Record<string, number>>({});
  const [uncertainty, setUncertainty] = useState<Tagged<UncertaintyResult> | null>(null);
  const [robust, setRobust] = useState<Tagged<RobustRecoveryResult> | null>(null);
  const [robustMode, setRobustMode] = useState<"average" | "worst">("average");
  const [facilityId, setFacilityId] = useState("");
  const [presentation, setPresentation] = useState(false);
  const [running, setRunning] = useState<{
    key: string;
    job: string;
    completed: number;
    total: number;
    phase: string;
  } | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const serial = useRef(0);
  const importRef = useRef<HTMLInputElement>(null);
  const identity = useMemo(() => networkIdentifier(network, odPairs), [network, odPairs]);
  const contextKey = `${identity}:${[...current.closedEdgeIds].sort().join(",")}`;
  const storageKey = `resiliroute-decisions-v1:${identity}`;
  const savedScenarios = saved?.key === identity ? saved.value : [];
  const savedKey = `${identity}:${savedScenarios.map((scenario) => `${scenario.createdAt}:${scenario.closedEdgeIds.join(",")}`).join(";")}`;
  const compareResult = comparison?.key === savedKey ? comparison.value : null;
  const edges = useMemo(() => new Map(network.edges.map((edge) => [edge.id, edge])), [network]);
  const closureLinks = useMemo(() => decisionClosureLinks(network), [network]);
  const closureIds = useMemo(() => new Set(closureLinks.map((edge) => edge.id)), [closureLinks]);
  const closedEdges = current.closedEdgeIds.map((id) => edges.get(id)).filter((edge) => !!edge);
  const costs = Object.fromEntries(
    closedEdges.map((edge) => [edge.id, costOverrides[edge.id] ?? inferRecoveryCost(edge)]),
  );
  const recoveryKey = `${contextKey}:${budget}:${objective}:${JSON.stringify(costs)}`;
  const recoveryResult = recovery?.key === recoveryKey ? recovery.value : null;
  const maxRuns = uncertaintyRunLimit(network);
  const failureIds = [...new Set([...current.closedEdgeIds, ...draft])].filter((id) =>
    edges.has(id),
  );
  const failures = failureIds.map((edgeId) => ({
    edgeId,
    probability: (probabilities[edgeId] ?? 50) / 100,
  }));
  const uncertaintyKey = `${contextKey}:${runs}:${seed}:${JSON.stringify(failures)}`;
  const uncertaintyResult = uncertainty?.key === uncertaintyKey ? uncertainty.value : null;
  const robustKey = `${recoveryKey}:${uncertaintyKey}`;
  const robustResult = robust?.key === robustKey ? robust.value : null;
  const evidence = useMemo(
    () => deriveDecisionEvidence(network, baseline, current, { realCity, bbox }),
    [network, baseline, current, realCity, bbox],
  );
  const hasServices = evidence.facilities.length > 0;
  const facility =
    evidence.facilities.find((item) => item.id === facilityId) ?? evidence.facilities[0];
  const currentJob = !busy && running?.key === contextKey ? running : null;
  const hasClosures = current.closedEdgeIds.length > 0;
  const linkName = (id: string) => t(edges.get(id)?.name ?? id);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
          if (!cancelled) setSaved({ key: identity, value: [] });
          return;
        }
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length > MAX_SAVED)
          throw new Error("Invalid saved scenarios");
        const validated = parsed.map((entry) =>
          parseSavedScenario(JSON.stringify(entry), network, odPairs),
        );
        if (!cancelled) setSaved({ key: identity, value: validated });
      } catch {
        if (!cancelled) {
          setSaved({ key: identity, value: [] });
          setNotice({
            en: "Saved scenarios could not be read. You can still analyze and export this session.",
            ja: "保存シナリオを読み込めませんでした。この画面での分析・書き出しは利用できます。",
            error: true,
          });
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [identity, network, odPairs, storageKey]);

  useEffect(() => {
    // A refresh can return to the same closure key. Clear a terminated job's
    // progress as well as its worker; a newer user-started job wins this race.
    const generation = serial.current;
    Promise.resolve().then(() => {
      if (serial.current === generation && !workerRef.current) setRunning(null);
    });
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      serial.current += 1;
    };
  }, [contextKey, busy]);

  function cancel() {
    workerRef.current?.terminate();
    workerRef.current = null;
    serial.current += 1;
    setRunning(null);
  }

  function run(
    request: WithoutId<DecisionWorkerRequest>,
    onResult: (message: Extract<DecisionWorkerResponse, { type: "result" }>) => void,
  ) {
    if (busy) return;
    cancel();
    setNotice(null);
    const sequenceId = ++serial.current;
    const id = String(sequenceId);
    try {
      const worker = new Worker(new URL("../../lib/decision/analysis-worker.ts", import.meta.url), {
        type: "module",
      });
      workerRef.current = worker;
      setRunning({ key: contextKey, job: request.type, phase: "", completed: 0, total: 1 });
      worker.onmessage = (event: MessageEvent<DecisionWorkerResponse>) => {
        const message = event.data;
        if (message.id !== id || serial.current !== sequenceId) return;
        if (message.type === "progress")
          setRunning({
            key: contextKey,
            job: request.type,
            phase: message.phase,
            completed: message.completed,
            total: message.total,
          });
        if (message.type === "result") {
          onResult(message);
          setRunning(null);
          worker.terminate();
          workerRef.current = null;
        }
        if (message.type === "error") {
          setNotice({
            en: `Analysis stopped safely: ${message.message}`,
            ja: "解析を安全に停止しました。入力数・予算・確率を確認して再実行してください。",
            error: true,
          });
          setRunning(null);
          worker.terminate();
          workerRef.current = null;
        }
      };
      worker.onerror = () => {
        if (serial.current !== sequenceId) return;
        setNotice({
          en: "Analysis could not finish. Reduce the selected links or sample count and try again.",
          ja: "解析を完了できませんでした。選択リンク数や試行数を減らして再実行してください。",
          error: true,
        });
        setRunning(null);
        worker.terminate();
        workerRef.current = null;
      };
      worker.postMessage({ ...request, id });
    } catch {
      setNotice({
        en: "This browser could not start the analysis worker. The core simulator remains available.",
        ja: "このブラウザで解析ワーカーを開始できませんでした。基本シミュレーターは引き続き利用できます。",
        error: true,
      });
      setRunning(null);
    }
  }

  function addDraft(id: string) {
    if (!id || !closureIds.has(id) || draft.includes(id)) return;
    if (draft.length >= MAX_CLOSURES) {
      setNotice({
        en: "Select at most 12 simultaneous disruptions.",
        ja: "同時障害は12リンク以内で指定してください。",
        error: true,
      });
      return;
    }
    cancel();
    setDraft([...draft, id]);
    setAddId("");
  }

  function persist(next: SavedScenario[]) {
    setSaved({ key: identity, value: next });
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setNotice({
        en: "Scenario collection saved on this device.",
        ja: "シナリオ一覧をこの端末に保存しました。",
      });
    } catch {
      setNotice({
        en: "Device storage is unavailable. Keep this tab open or export your scenarios.",
        ja: "端末に保存できません。このタブを開いたままにするか、シナリオを書き出してください。",
        error: true,
      });
    }
  }

  function saveScenario() {
    if (savedScenarios.length >= MAX_SAVED) {
      setNotice({
        en: "Compare up to four saved scenarios. Delete one to add another.",
        ja: "保存・比較できるのは4件までです。追加するには1件削除してください。",
        error: true,
      });
      return;
    }
    try {
      const scenario = createSavedScenario(network, odPairs, {
        name:
          name.trim() ||
          w(`Scenario ${savedScenarios.length + 1}`, `シナリオ ${savedScenarios.length + 1}`),
        closedEdgeIds: current.closedEdgeIds,
        bbox,
      });
      cancel();
      persist([...savedScenarios, scenario]);
      setName("");
    } catch (error) {
      setNotice({
        en: errorText(error),
        ja: "シナリオ名と障害リンクを確認してください。",
        error: true,
      });
    }
  }

  async function importScenario(file?: File) {
    if (!file) return;
    if (file.size > MAX_SCENARIO_BYTES) {
      setNotice({
        en: "Scenario files must be no larger than 128 KiB.",
        ja: "シナリオファイルは128KiB以下にしてください。",
        error: true,
      });
      return;
    }
    cancel();
    const requestId = serial.current;
    try {
      const text = await file.text();
      if (serial.current !== requestId) return;
      const scenario = parseSavedScenario(text, network, odPairs);
      cancel();
      onApplyClosures(scenario.closedEdgeIds);
      setDraft(scenario.closedEdgeIds);
      setNotice({
        en: "Scenario restored. Metrics are recalculated from this network; imported metrics are never trusted.",
        ja: "シナリオを復元しました。このネットワークから指標を再計算します。読み込んだ数値をそのまま使用しません。",
      });
    } catch (error) {
      setNotice({
        en: `Scenario import rejected: ${errorText(error)}`,
        ja: "読み込みを拒否しました。形式・バージョン・ネットワークの一致を確認してください。",
        error: true,
      });
    }
  }

  function optimize() {
    if (
      !Number.isInteger(budget) ||
      budget < 0 ||
      budget > MAX_BUDGET ||
      Object.values(costs).some((cost) => !Number.isInteger(cost) || cost < 1 || cost > 5)
    ) {
      setNotice({
        en: "Enter an integer budget from 0 to 60 and costs from 1 to 5.",
        ja: "予算は0〜60、コストは1〜5の整数で入力してください。",
        error: true,
      });
      return;
    }
    run(
      {
        type: "recovery",
        payload: {
          network,
          odPairs: [...odPairs],
          current,
          baseline,
          options: { budget, costs, objective },
        },
      },
      (message) => {
        if (message.job === "recovery") setRecovery({ key: recoveryKey, value: message.payload });
      },
    );
  }

  function sample() {
    if (
      !Number.isInteger(runs) ||
      runs < 1 ||
      runs > maxRuns ||
      !Number.isInteger(seed) ||
      seed < 0 ||
      seed > 4294967295 ||
      failures.some(
        (entry) =>
          !Number.isFinite(entry.probability) || entry.probability < 0 || entry.probability > 1,
      )
    ) {
      setNotice({
        en: `Use 1–${maxRuns} runs, an integer seed, and probabilities between 0 and 100%.`,
        ja: `試行数は1〜${maxRuns}、シードは0以上の整数、確率は0〜100%で入力してください。`,
        error: true,
      });
      return;
    }
    run(
      {
        type: "uncertainty",
        payload: { network, odPairs: [...odPairs], baseline, options: { runs, seed, failures } },
      },
      (message) => {
        if (message.job === "uncertainty")
          setUncertainty({ key: uncertaintyKey, value: message.payload });
      },
    );
  }

  function analyzeRobustness() {
    if (!recoveryResult || !uncertaintyResult) return;
    run(
      {
        type: "robust",
        payload: {
          network,
          odPairs: [...odPairs],
          baseline,
          plans: recoveryResult.optimization.plans,
          uncertainty: uncertaintyResult,
        },
      },
      (message) => {
        if (message.job === "robust") setRobust({ key: robustKey, value: message.payload });
      },
    );
  }

  const reportInput: DecisionReportInput = {
    scenarioName: name.trim() || w("Current multi-link scenario", "現在の複数障害シナリオ"),
    networkLabel,
    network,
    odPairs,
    baseline,
    current,
    evidence,
    criticalLinks: critical,
    realCity,
    bbox,
    ...(recoveryResult ? { sequence: recoveryResult.sequence } : {}),
    ...(robustResult ? { robust: robustResult } : {}),
    ...(recoveryResult
      ? {
          recovery: {
            budget,
            objective,
            method: recoveryResult.optimization.method,
            plans: recoveryResult.optimization.plans,
          },
        }
      : {}),
    ...(uncertaintyResult
      ? {
          uncertainty: {
            runs: uncertaintyResult.runs,
            seed: uncertaintyResult.seed,
            meanResilience: uncertaintyResult.summaries.resilience.mean,
            medianResilience: uncertaintyResult.summaries.resilience.median,
            p10Resilience: uncertaintyResult.summaries.resilience.p10,
            p90Resilience: uncertaintyResult.summaries.resilience.p90,
            probabilityBelow60: uncertaintyResult.probabilityResilienceBelow60,
            probabilityHospitalBelow70: uncertaintyResult.probabilityHospitalAccessibilityBelow70,
            assumptions: uncertaintyResult.assumptions,
            fixedClosedEdgeIds: uncertaintyResult.fixedClosedEdgeIds,
          },
        }
      : {}),
  };

  const tabs: { id: Tab; en: string; ja: string }[] = [
    { id: "disrupt", en: "Disrupt & understand", ja: "障害・影響" },
    { id: "compare", en: "Compare", ja: "比較・保存" },
    { id: "recover", en: "Recover", ja: "復旧計画" },
    { id: "uncertainty", en: "Uncertainty", ja: "不確実性" },
    { id: "report", en: "Report", ja: "レポート" },
  ];

  return (
    <section
      className={`decision-workspace ${presentation ? "decision-presentation" : ""}`}
      data-testid="decision-workspace"
      aria-labelledby={`${rootId}-title`}
    >
      <header className="decision-header">
        <div>
          <p className="eyebrow">{w("DECISION LAB", "意思決定ラボ")}</p>
          <h2 id={`${rootId}-title`}>
            {w("Analyze. Understand. Compare. Recover.", "分析して、理解し、比較し、復旧へ。")}
          </h2>
          <p>
            {w(
              "Explore modeled choices, not automated emergency decisions.",
              "モデル上の選択肢を検討します。緊急時の判断を自動化するものではありません。",
            )}
          </p>
        </div>
        <button
          type="button"
          className="decision-button secondary"
          aria-pressed={presentation}
          onClick={() => setPresentation(!presentation)}
        >
          <Layers size={16} />
          {presentation
            ? w("Exit presentation", "プレゼン表示を終了")
            : w("Presentation mode", "プレゼン表示")}
        </button>
      </header>
      {presentation && (
        <ol className="decision-guide">
          <li>{w("1 · Select disruptions", "1 · 障害を選ぶ")}</li>
          <li>{w("2 · Understand impacts", "2 · 影響を理解")}</li>
          <li>{w("3 · Set a recovery budget", "3 · 復旧予算を指定")}</li>
          <li>{w("4 · Compare & export", "4 · 比較・書き出し")}</li>
        </ol>
      )}
      <div
        className="decision-tabs"
        role="tablist"
        aria-label={w("Decision-support tools", "意思決定支援ツール")}
      >
        {tabs.map((item, index) => (
          <button
            type="button"
            key={item.id}
            id={`${rootId}-tab-${item.id}`}
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`${rootId}-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const nextIndex =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
              setTab(tabs[nextIndex].id);
              document.getElementById(`${rootId}-tab-${tabs[nextIndex].id}`)?.focus();
            }}
          >
            {w(item.en, item.ja)}
          </button>
        ))}
      </div>
      {notice && (
        <div
          className={`decision-notice ${notice.error ? "error" : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          {w(notice.en, notice.ja)}
          <button
            type="button"
            aria-label={w("Dismiss message", "メッセージを閉じる")}
            onClick={() => setNotice(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {busy && (
        <p className="decision-progress" role="status">
          {w(
            "Updating the network simulation. Decision tools will be available when the current result is ready.",
            "ネットワークを再計算しています。現在の結果が揃うと意思決定ツールを利用できます。",
          )}
        </p>
      )}
      {currentJob && (
        <div className="decision-progress" role="status">
          <Activity size={17} />
          <span>
            {w("Calculating", "計算中")} · {number(currentJob.completed, 0)} /{" "}
            {number(currentJob.total, 0)}
          </span>
          <progress max={Math.max(1, currentJob.total)} value={currentJob.completed} />
          <button type="button" className="decision-button secondary" onClick={cancel}>
            {w("Cancel analysis", "解析をキャンセル")}
          </button>
        </div>
      )}
      <div
        id={`${rootId}-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`${rootId}-tab-${tab}`}
        tabIndex={0}
        className="decision-tab-panel"
      >
        <fieldset className="decision-content" disabled={busy}>
          {tab === "disrupt" && (
            <>
              <div className="decision-grid">
                <Panel
                  title={w("Multi-failure scenario", "複数障害シナリオ")}
                  description={w(
                    "Stage several links, then apply them together. Selecting a road on the map does not close it until you apply.",
                    "複数のリンクを選んで一括適用します。地図で選択しただけでは、この一覧に追加されません。",
                  )}
                >
                  <div className="decision-actions">
                    <button
                      type="button"
                      className="decision-button secondary"
                      disabled={
                        !selectedEdgeId ||
                        !closureIds.has(selectedEdgeId) ||
                        draft.includes(selectedEdgeId)
                      }
                      onClick={() => selectedEdgeId && addDraft(selectedEdgeId)}
                    >
                      {w("Add selected map link", "地図で選んだリンクを追加")}
                    </button>
                    <button
                      type="button"
                      className="decision-text-button"
                      onClick={() => {
                        cancel();
                        setDraft([...current.closedEdgeIds]);
                      }}
                    >
                      {w("Use active disruptions", "適用中の障害を取り込む")}
                    </button>
                  </div>
                  <label className="decision-field">
                    {w("Add another link", "別のリンクを追加")}
                    <select
                      value={addId}
                      onChange={(event) => {
                        setAddId(event.target.value);
                        addDraft(event.target.value);
                      }}
                      aria-label={w("Add disruption link", "障害リンクを追加")}
                    >
                      <option value="">{w("Choose a link…", "リンクを選択…")}</option>
                      {closureLinks
                        .filter((edge) => edge.mode !== "pedestrian" && !draft.includes(edge.id))
                        .map((edge) => (
                          <option key={edge.id} value={edge.id}>
                            {t(edge.name)} · {edge.id}
                          </option>
                        ))}
                    </select>
                  </label>
                  {draft.length ? (
                    <ul className="decision-link-list">
                      {draft.map((id) => (
                        <li key={id}>
                          <span>
                            <Check size={13} />
                            {linkName(id)}
                          </span>
                          <button
                            type="button"
                            className="decision-icon-button"
                            aria-label={`${w("Remove from selection", "選択から外す")}: ${linkName(id)}`}
                            onClick={() => {
                              cancel();
                              setDraft(draft.filter((item) => item !== id));
                            }}
                          >
                            <X size={16} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty>
                      {w(
                        "Choose roads, bridges, or rail links above. Up to 12 simultaneous closures.",
                        "道路・橋・鉄道リンクを選んでください。最大12リンクを同時に閉鎖できます。",
                      )}
                    </Empty>
                  )}
                  <button
                    type="button"
                    className="decision-button primary"
                    data-testid="run-multi-failure"
                    onClick={() => {
                      cancel();
                      onApplyClosures(draft);
                    }}
                  >
                    <Play size={16} />
                    {w("Run multi-failure scenario", "複数障害シナリオを実行")}
                    <span>{draft.length}</span>
                  </button>
                </Panel>
                <Panel
                  title={w("Active disruptions", "適用中の障害")}
                  description={w(
                    `${current.closedEdgeIds.length} links closed · ${evidence.affectedODPairs} OD pairs affected`,
                    `${current.closedEdgeIds.length}リンクが閉鎖・${evidence.affectedODPairs}ODペアに影響`,
                  )}
                >
                  {hasClosures ? (
                    <>
                      <ul className="decision-link-list">
                        {closedEdges.map((edge) => (
                          <li key={edge.id}>
                            <button
                              type="button"
                              className="decision-link-name"
                              onClick={() => onHighlightEdge?.(edge.id)}
                            >
                              {t(edge.name)}
                            </button>
                            <button
                              type="button"
                              className="decision-text-button"
                              onClick={() => {
                                cancel();
                                onApplyClosures(
                                  current.closedEdgeIds.filter((id) => id !== edge.id),
                                );
                              }}
                            >
                              {w("Restore", "復旧")}
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className="decision-button secondary"
                        onClick={() => {
                          cancel();
                          setDraft([]);
                          onApplyClosures([]);
                        }}
                      >
                        <RotateCcw size={15} />
                        {w("Restore all", "すべて復旧")}
                      </button>
                    </>
                  ) : (
                    <Empty>
                      {w(
                        "The baseline network is available. Stage a disruption to investigate its impact.",
                        "通常時のネットワークです。障害を設定して影響を調べてください。",
                      )}
                    </Empty>
                  )}
                  <div className="decision-mini-stats">
                    <div>
                      <strong>{number(current.metrics.resilienceScore)}</strong>
                      <span>{w("resilience / 100", "レジリエンス / 100")}</span>
                    </div>
                    <div>
                      <strong>{number(current.metrics.disconnectedDemand, 0)}</strong>
                      <span>{w("disconnected demand", "到達不能需要")}</span>
                    </div>
                    <div>
                      <strong>
                        {hasServices
                          ? delta(current.metrics.accessibility - baseline.metrics.accessibility)
                          : w("N/A", "対象なし")}
                      </strong>
                      <span>{w("accessibility points", "アクセス率の変化")}</span>
                    </div>
                  </div>
                </Panel>
              </div>
              <div className="decision-grid">
                <Panel
                  title={w("Cascading stress", "迂回による二次的な負荷")}
                  description={w(
                    "Open links whose utilization increased after redistribution. Change is in percentage points, not a failure prediction.",
                    "迂回後に利用率が上昇した使用可能リンクです。変化はパーセントポイントであり、破損予測ではありません。",
                  )}
                >
                  <div className="decision-actions">
                    <button
                      type="button"
                      className="decision-button secondary"
                      onClick={() => onLayerChange?.("cascade")}
                    >
                      {w("Show stress layer", "負荷レイヤーを表示")}
                    </button>
                    <button
                      type="button"
                      className="decision-text-button"
                      onClick={() => onLayerChange?.("traffic")}
                    >
                      {w("Traffic layer", "交通量レイヤー")}
                    </button>
                  </div>
                  {evidence.cascades.filter((item) => item.utilizationIncrease > 0).length ? (
                    <div className="decision-table-scroll">
                      <table className="decision-table">
                        <thead>
                          <tr>
                            <th>{w("Open link", "使用可能リンク")}</th>
                            <th>{w("Flow increase", "需要の増加")}</th>
                            <th>{w("Utilization change", "利用率の変化")}</th>
                            <th>{w("Stress", "負荷")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {evidence.cascades
                            .filter((item) => item.utilizationIncrease > 0)
                            .slice(0, 6)
                            .map((item) => (
                              <tr key={item.edgeId}>
                                <th>
                                  <button
                                    type="button"
                                    className="decision-link-name"
                                    onClick={() => onHighlightEdge?.(item.edgeId)}
                                  >
                                    {t(item.name)}
                                  </button>
                                </th>
                                <td>+{number(item.flowIncrease, 0)}</td>
                                <td>
                                  +{number(item.utilizationIncrease)}
                                  {w(" pts", " ポイント")}
                                </td>
                                <td>
                                  <span className={`decision-badge ${item.classification}`}>
                                    {w(
                                      {
                                        stable: "Stable",
                                        elevated: "Elevated",
                                        high: "High stress",
                                        severe: "Severe",
                                      }[item.classification],
                                      {
                                        stable: "安定",
                                        elevated: "上昇",
                                        high: "高負荷",
                                        severe: "深刻",
                                      }[item.classification],
                                    )}
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty>
                      {w(
                        "No increase in open-link utilization in the current scenario.",
                        "現在のシナリオでは使用可能リンクの利用率上昇はありません。",
                      )}
                    </Empty>
                  )}
                </Panel>
                <Panel
                  title={w("Critical infrastructure", "重要インフラ")}
                  description={w(
                    "The existing single-link stress test is normalized across evaluated candidates. Unscreened links have no score.",
                    "既存の単一リンク除去テストを候補間で正規化します。未評価リンクにスコアは付けません。",
                  )}
                >
                  <button
                    type="button"
                    className="decision-button secondary"
                    onClick={() => onLayerChange?.("criticality")}
                  >
                    {w("Show criticality heatmap", "重要度ヒートマップを表示")}
                  </button>
                  {critical.length ? (
                    <ol className="decision-ranked-list">
                      {critical.slice(0, 5).map((link) => (
                        <li key={link.edgeId}>
                          <button
                            type="button"
                            className="decision-link-name"
                            onClick={() => onHighlightEdge?.(link.edgeId)}
                          >
                            {t(link.name)}
                          </button>
                          <strong>{number(link.score)}</strong>
                          <small>
                            {w("Travel time", "移動時間")} {delta(link.travelTimeIncrease)}
                            {w(" min", " 分")} · {w("Access loss", "アクセス低下")}{" "}
                            {number(link.accessibilityLoss)}
                            {w(" pts", " ポイント")}
                          </small>
                          <details className="decision-critical-detail">
                            <summary>{w("Why this link matters", "重要と評価された理由")}</summary>
                            <p>{explainCriticality(link, locale)}</p>
                            <p>
                              {w("Efficiency loss", "効率の低下")}: {number(link.efficiencyLoss)} ·{" "}
                              {w("Additional disconnected demand", "到達不能需要の増加")}:{" "}
                              {number(link.disconnectedDemandIncrease, 0)}
                            </p>
                          </details>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <Empty>
                      {w(
                        "Run the network stress test above to populate this layer.",
                        "上のネットワークストレステストを実行すると表示されます。",
                      )}
                    </Empty>
                  )}
                </Panel>
              </div>
              <Panel
                title={w("Who is hit hardest?", "どの地域への影響が大きい？")}
                description={
                  realCity
                    ? w(
                        "Analysis zones are spatial model subdivisions, not administrative districts or demographic groups.",
                        "分析ゾーンはモデル上の空間分割です。行政区域や人口属性を表すものではありません。",
                      )
                    : w(
                        "Compare modeled origin impacts across Harbor City's existing districts.",
                        "Harbor Cityの既存地区間で、モデル上の出発地への影響を比較します。",
                      )
                }
              >
                <div className="decision-equity-summary">
                  <strong>
                    {w("Worst-hit zone", "最も影響を受ける地区")}:{" "}
                    {evidence.worstZone && evidence.worstZone.impactScore > 0.0001
                      ? t(evidence.worstZone.name).replace(
                          /^Analysis Zone /,
                          locale === "ja" ? "分析ゾーン " : "Analysis Zone ",
                        )
                      : w("No modeled deterioration", "モデル上の悪化なし")}
                  </strong>
                  <span>
                    {w("Impact gap", "影響スコアの差")}: {number(evidence.impactGap)} / 100
                  </span>
                  <span>
                    {w("Access-loss disparity", "アクセス低下の地域差")}:{" "}
                    {number(evidence.accessibilityDisparity)}
                    {w(" pts", " ポイント")}
                  </span>
                </div>
                {hasServices &&
                  evidence.worstZone &&
                  evidence.worstZone.accessibilityLoss >
                    Math.max(0, baseline.metrics.accessibility - current.metrics.accessibility) +
                      0.1 && (
                    <p className="decision-warning">
                      {w(
                        `Citywide access loss is ${number(Math.max(0, baseline.metrics.accessibility - current.metrics.accessibility))} points; the worst-hit zone loses ${number(evidence.worstZone.accessibilityLoss)} points. A city average can hide uneven modeled impacts.`,
                        `都市全体のアクセス低下は${number(Math.max(0, baseline.metrics.accessibility - current.metrics.accessibility))}ポイントですが、最も影響の大きいゾーンでは${number(evidence.worstZone.accessibilityLoss)}ポイント低下します。平均値だけでは局所的な影響が見えないことがあります。`,
                      )}
                    </p>
                  )}
                <div className="decision-table-scroll">
                  <table className="decision-table">
                    <thead>
                      <tr>
                        <th>{w("District / analysis zone", "地区・分析ゾーン")}</th>
                        <th>{w("Travel time before → after", "移動時間：通常時 → 現在")}</th>
                        <th>{w("Accessibility", "アクセス率")}</th>
                        <th>{w("Hospital access", "病院アクセス")}</th>
                        <th>{w("Station access", "駅アクセス")}</th>
                        <th>{w("Disconnected demand", "到達不能需要")}</th>
                        <th>{w("Congestion exposure", "混雑負荷への接触")}</th>
                        <th>{w("Impact diagnostic", "影響診断値")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evidence.zones.map((zone) => (
                        <tr key={zone.id}>
                          <th>
                            {t(zone.name).replace(
                              /^Analysis Zone /,
                              locale === "ja" ? "分析ゾーン " : "Analysis Zone ",
                            )}
                          </th>
                          <td>
                            {number(zone.baseline.travelTime)} → {number(zone.current.travelTime)}
                            {w(" min", " 分")}
                          </td>
                          <td>
                            {zone.current.accessibility === null
                              ? w("N/A", "対象なし")
                              : `${number(zone.baseline.accessibility)} → ${number(zone.current.accessibility)}%`}
                          </td>
                          <td>
                            {zone.current.hospitalAccessibility === null
                              ? w("N/A", "対象なし")
                              : `${number(zone.current.hospitalAccessibility)}%`}
                          </td>
                          <td>
                            {zone.current.stationAccessibility === null
                              ? w("N/A", "対象なし")
                              : `${number(zone.current.stationAccessibility)}%`}
                          </td>
                          <td>{number(zone.current.disconnectedDemand, 0)}</td>
                          <td>
                            {number(zone.baseline.congestionExposure)} →{" "}
                            {number(zone.current.congestionExposure)}%
                          </td>
                          <td>{number(zone.impactScore)} / 100</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
              <Panel
                title={w("Facility-specific access", "施設別アクセス")}
                description={w(
                  "Weighted modeled origins that can reach each facility within its educational travel-time threshold.",
                  "教育用の所要時間基準内に各施設へ到達できる、モデル上の出発地の重み付き割合です。",
                )}
              >
                {facility ? (
                  <>
                    <label className="decision-field">
                      {w("Facility", "施設")}
                      <select
                        value={facility.id}
                        onChange={(event) => setFacilityId(event.target.value)}
                      >
                        {evidence.facilities.map((item) => (
                          <option key={item.id} value={item.id}>
                            {t(item.name)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="decision-mini-stats">
                      <div>
                        <strong>
                          {number(facility.baselineReach)}% → {number(facility.currentReach)}%
                        </strong>
                        <span>
                          {w("modeled reachable origin weight", "モデル上の到達可能な出発地の重み")}
                        </span>
                      </div>
                      <div>
                        <strong>
                          {delta(facility.currentReach - facility.baselineReach)}
                          {w(" pts", " ポイント")}
                        </strong>
                        <span>{w("change from baseline", "通常時からの変化")}</span>
                      </div>
                      <div>
                        <strong>
                          {number(facility.threshold, 0)}
                          {w(" min", " 分")}
                        </strong>
                        <span>{w("educational threshold", "教育用の所要時間基準")}</span>
                      </div>
                    </div>
                    {facility.isolated && (
                      <p className="decision-warning">
                        {w(
                          "Critical access loss · no modeled origin can reach this facility.",
                          "重要施設へのアクセス喪失・この施設へ到達できるモデル上の出発地がありません。",
                        )}
                      </p>
                    )}
                  </>
                ) : (
                  <Empty>
                    {w(
                      "No eligible essential services in this network. No facilities or access values are invented.",
                      "このネットワークには対象の重要施設がありません。施設やアクセス数値を仮に補いません。",
                    )}
                  </Empty>
                )}
              </Panel>
            </>
          )}
          {tab === "compare" && (
            <>
              <div className="decision-grid">
                <Panel
                  title={w("Save the current scenario", "現在のシナリオを保存")}
                  description={w(
                    "Up to four scenarios per network, stored only on this device. The baseline remains a separate reference.",
                    "ネットワークごとに最大4件をこの端末に保存します。通常時は別の比較基準として保持します。",
                  )}
                >
                  <label className="decision-field">
                    {w("Scenario name", "シナリオ名")}
                    <input
                      maxLength={80}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={w("Bridge + corridor closure", "橋＋幹線道路の閉鎖")}
                    />
                  </label>
                  <div className="decision-actions">
                    <button
                      type="button"
                      className="decision-button primary"
                      data-testid="save-decision-scenario"
                      disabled={savedScenarios.length >= MAX_SAVED}
                      onClick={saveScenario}
                    >
                      {w("Save scenario", "シナリオを保存")}
                    </button>
                    <button
                      type="button"
                      className="decision-button secondary"
                      onClick={() => importRef.current?.click()}
                    >
                      {w("Import scenario", "シナリオを読み込む")}
                    </button>
                    <input
                      ref={importRef}
                      className="sr-only"
                      type="file"
                      accept="application/json,.json"
                      aria-label={w("Import scenario JSON", "シナリオJSONを読み込む")}
                      onChange={(event) => {
                        void importScenario(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </div>
                  <p className="decision-caption">
                    {w(
                      "Imports must match the complete network and model fingerprint. Unknown links or versions are rejected.",
                      "読み込みにはネットワークとモデルの識別情報が一致する必要があります。不明なリンクやバージョンは拒否します。",
                    )}
                  </p>
                </Panel>
                <Panel title={w("Saved scenarios", "保存済みシナリオ")}>
                  {savedScenarios.length ? (
                    <ul className="decision-saved-list">
                      {savedScenarios.map((scenario, index) => (
                        <li key={`${scenario.createdAt}-${index}`}>
                          <strong>{scenario.name}</strong>
                          <span>
                            {scenario.closedEdgeIds.length}
                            {w(" links closed", "リンク閉鎖")}
                          </span>
                          <div className="decision-actions">
                            <button
                              type="button"
                              className="decision-text-button"
                              onClick={() => {
                                cancel();
                                setDraft(scenario.closedEdgeIds);
                                onApplyClosures(scenario.closedEdgeIds);
                              }}
                            >
                              {w("Load", "復元")}
                            </button>
                            <button
                              type="button"
                              className="decision-text-button"
                              onClick={() =>
                                download(
                                  `resiliroute-scenario-${index + 1}.json`,
                                  JSON.stringify(scenario, null, 2),
                                  "application/json",
                                )
                              }
                            >
                              {w("Export", "書き出し")}
                            </button>
                            <button
                              type="button"
                              className="decision-text-button danger"
                              aria-label={`${w("Delete scenario", "シナリオを削除")}: ${scenario.name}`}
                              onClick={() => {
                                cancel();
                                persist(savedScenarios.filter((_, item) => item !== index));
                              }}
                            >
                              {w("Delete", "削除")}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty>
                      {w(
                        "Save one closure, then a multi-link scenario to compare their modeled consequences.",
                        "まず単一障害、次に複数障害を保存すると、モデル上の影響を比較できます。",
                      )}
                    </Empty>
                  )}
                </Panel>
              </div>
              <Panel
                title={w("Scenario comparison", "シナリオ比較")}
                description={w(
                  "Every saved closure set is recomputed by the shared simulator. Severity = 100 − resilience; higher means greater modeled impact.",
                  "保存された障害条件を共通シミュレーターで再計算します。深刻度＝100−レジリエンス。高いほどモデル上の影響が大きいことを示します。",
                )}
              >
                <button
                  type="button"
                  className="decision-button primary"
                  data-testid="compare-decision-scenarios"
                  disabled={!savedScenarios.length || !!currentJob}
                  onClick={() =>
                    run(
                      {
                        type: "compare",
                        payload: {
                          network,
                          odPairs: [...odPairs],
                          baseline,
                          scenarios: savedScenarios.map((scenario, index) => ({
                            id: `${index}`,
                            closedEdgeIds: scenario.closedEdgeIds,
                          })),
                        },
                      },
                      (message) => {
                        if (message.job === "compare")
                          setComparison({ key: savedKey, value: message.payload });
                      },
                    )
                  }
                >
                  {w("Recalculate comparison", "比較を再計算")}
                </button>
                {compareResult ? (
                  <>
                    <label className="decision-field compact">
                      {w("Chart metric", "グラフの指標")}
                      <select
                        value={compareMetric}
                        onChange={(event) =>
                          setCompareMetric(event.target.value as typeof compareMetric)
                        }
                      >
                        <option value="severity">
                          {w("Severity (100 − resilience)", "深刻度（100−レジリエンス）")}
                        </option>
                        <option value="resilienceScore">{w("Resilience", "レジリエンス")}</option>
                        <option value="accessibility" disabled={!hasServices}>
                          {w("Accessibility (%)", "アクセス率（%）")}
                        </option>
                        <option value="averageTravelTime">
                          {w("Travel time (minutes)", "移動時間（分）")}
                        </option>
                        <option value="congestion">
                          {w("Congestion delay (%)", "混雑遅延（%）")}
                        </option>
                      </select>
                    </label>
                    <div className="decision-comparison-bars">
                      {[...compareResult]
                        .sort(
                          (a, b) =>
                            a.result.metrics.resilienceScore - b.result.metrics.resilienceScore,
                        )
                        .map((entry, rank) => (
                          <div key={entry.id}>
                            <span>
                              {rank + 1}. {savedScenarios[Number(entry.id)]?.name}
                            </span>
                            <div className="decision-bar-track">
                              <i
                                style={{
                                  width: `${Math.max(0, Math.min(100, ((compareMetric === "severity" ? 100 - entry.result.metrics.resilienceScore : entry.result.metrics[compareMetric]) / Math.max(1, ...compareResult.map((item) => (compareMetric === "severity" ? 100 - item.result.metrics.resilienceScore : item.result.metrics[compareMetric])))) * 100))}%`,
                                }}
                              />
                            </div>
                            <strong>
                              {number(
                                compareMetric === "severity"
                                  ? 100 - entry.result.metrics.resilienceScore
                                  : entry.result.metrics[compareMetric],
                              )}
                            </strong>
                          </div>
                        ))}
                    </div>
                    <div className="decision-table-scroll">
                      <table className="decision-table">
                        <thead>
                          <tr>
                            <th>{w("Scenario", "シナリオ")}</th>
                            {metricLabels.map(([key, en, ja]) => (
                              <th key={key}>{w(en, ja)}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <th>{w("Baseline", "通常時")}</th>
                            {metricLabels.map(([key]) => (
                              <td key={key}>
                                {key === "accessibility" && !hasServices
                                  ? w("N/A", "対象なし")
                                  : number(baseline.metrics[key])}
                              </td>
                            ))}
                          </tr>
                          {compareResult.map((entry) => (
                            <tr key={entry.id}>
                              <th>{savedScenarios[Number(entry.id)]?.name}</th>
                              {metricLabels.map(([key]) => (
                                <td key={key}>
                                  {key === "accessibility" && !hasServices
                                    ? w("N/A", "対象なし")
                                    : number(entry.result.metrics[key])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <Empty>
                    {w(
                      "Save at least one scenario, then recalculate to see an evidence-based comparison.",
                      "シナリオを1件以上保存し、再計算すると実計算に基づく比較が表示されます。",
                    )}
                  </Empty>
                )}
              </Panel>
            </>
          )}
          {tab === "recover" && (
            <>
              <div className="decision-grid">
                <Panel
                  title={w("Recovery budget optimizer", "復旧予算オプティマイザー")}
                  description={w(
                    "Modeled relative recovery cost — not real financial cost. Compare combinations within your resource limit.",
                    "モデル上の相対復旧コストであり、実際の金額ではありません。資源制約内で復旧の組み合わせを比較します。",
                  )}
                >
                  <div className="decision-form-grid">
                    <label className="decision-field">
                      {w("Recovery budget (0–60)", "復旧予算（0〜60）")}
                      <input
                        type="number"
                        min={0}
                        max={MAX_BUDGET}
                        step={1}
                        value={Number.isNaN(budget) ? "" : budget}
                        onChange={(event) => {
                          cancel();
                          setBudget(event.target.value === "" ? NaN : Number(event.target.value));
                        }}
                        data-testid="recovery-budget"
                      />
                    </label>
                    <label className="decision-field">
                      {w("Optimization objective", "最適化の目的")}
                      <select
                        value={objective}
                        onChange={(event) => {
                          cancel();
                          setObjective(event.target.value as RecoveryObjective);
                        }}
                      >
                        <option value="resilience">
                          {w("Maximize resilience", "レジリエンスを最大化")}
                        </option>
                        <option value="accessibility" disabled={!hasServices}>
                          {w("Maximize accessibility", "アクセス率を最大化")}
                        </option>
                        <option value="travelTime">
                          {w("Minimize travel time", "移動時間を最小化")}
                        </option>
                        <option value="efficiency">
                          {w("Maximize network efficiency", "ネットワーク効率を最大化")}
                        </option>
                        <option value="balanced">{w("Balanced", "バランス型")}</option>
                      </select>
                    </label>
                  </div>
                  {objective === "balanced" && (
                    <p className="decision-caption">
                      {w(
                        "Explicit overlapping preference: resilience 40%, access 30%, baseline/current travel-time retention 20%, efficiency retention 10%.",
                        "重複を含む選好重み：レジリエンス40%、アクセス率30%、通常時に対する移動時間保持率20%、効率保持率10%。",
                      )}
                    </p>
                  )}
                  {closedEdges.length ? (
                    <div className="decision-costs">
                      {closedEdges.map((edge) => (
                        <label key={edge.id}>
                          <span>{t(edge.name)}</span>
                          <input
                            type="number"
                            min={1}
                            max={5}
                            step={1}
                            value={Number.isNaN(costs[edge.id]) ? "" : costs[edge.id]}
                            aria-label={`${w("Relative cost", "相対コスト")}: ${t(edge.name)}`}
                            onChange={(event) => {
                              cancel();
                              setCostOverrides({
                                ...costOverrides,
                                [edge.id]:
                                  event.target.value === "" ? NaN : Number(event.target.value),
                              });
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  ) : (
                    <Empty>
                      {w(
                        "Close one or more links to compare recovery options.",
                        "1つ以上のリンクを閉鎖すると復旧候補を比較できます。",
                      )}
                    </Empty>
                  )}
                  <button
                    type="button"
                    className="decision-button primary"
                    data-testid="optimize-budget"
                    disabled={!hasClosures || !!currentJob}
                    onClick={optimize}
                  >
                    <ShieldCheck size={16} />
                    {w("Find best recovery plans", "最適な復旧計画を計算")}
                  </button>
                  <p className="decision-caption">
                    {w(
                      "Small closure sets are enumerated exactly. Larger search spaces use a bounded beam approximation; the result states which method was used.",
                      "小規模な障害集合は全組み合わせを厳密に探索します。大きな探索空間では上限付きビーム近似を使い、結果に手法を明示します。",
                    )}
                  </p>
                </Panel>
                <Panel
                  title={w("Recommended recovery plans", "推奨復旧計画")}
                  description={w(
                    "Top alternatives are simulated independently. Restoring a link is a modeled counterfactual, not a repair guarantee.",
                    "各代替案を独立に計算します。復旧はモデル上の仮定であり、実際の工事効果を保証しません。",
                  )}
                >
                  {recoveryResult ? (
                    <>
                      <p className="decision-method">
                        <Check size={15} />
                        {recoveryResult.optimization.method === "exact"
                          ? w("Exact enumeration", "厳密な全組み合わせ探索")
                          : w(
                              "Approximate beam optimization used",
                              "ビーム探索による近似最適化",
                            )}{" "}
                        · {recoveryResult.optimization.evaluated}
                        {w(" plans evaluated", "計画を評価")}
                      </p>
                      {recoveryResult.optimization.plans.map((plan, index) => (
                        <article className="decision-plan" key={plan.id}>
                          <div>
                            <strong>
                              {w(
                                `Plan ${String.fromCharCode(65 + index)}`,
                                `計画 ${String.fromCharCode(65 + index)}`,
                              )}
                            </strong>
                            <span>
                              {plan.cost} / {number(budget, 0)}
                              {w(" cost points", " コストポイント")}
                            </span>
                          </div>
                          <p>
                            {plan.restoredEdgeIds.length
                              ? plan.restoredEdgeIds.map(linkName).join(" + ")
                              : w("No restoration within this budget", "予算内で復旧を実施しない")}
                          </p>
                          <dl>
                            <div>
                              <dt>{w("Resilience", "レジリエンス")}</dt>
                              <dd>
                                {number(current.metrics.resilienceScore)} →{" "}
                                {number(plan.metrics.resilienceScore)}
                              </dd>
                            </div>
                            <div>
                              <dt>{w("Accessibility", "アクセス率")}</dt>
                              <dd>
                                {hasServices
                                  ? `${number(current.metrics.accessibility)} → ${number(plan.metrics.accessibility)}%`
                                  : w("N/A", "対象なし")}
                              </dd>
                            </div>
                            <div>
                              <dt>{w("Travel time", "移動時間")}</dt>
                              <dd>
                                {number(current.metrics.averageTravelTime)} →{" "}
                                {number(plan.metrics.averageTravelTime)}
                                {w(" min", " 分")}
                              </dd>
                            </div>
                            <div>
                              <dt>{w("Resilience gain / cost", "レジリエンス改善／コスト")}</dt>
                              <dd>
                                {plan.cost
                                  ? number(
                                      (plan.metrics.resilienceScore -
                                        current.metrics.resilienceScore) /
                                        plan.cost,
                                    )
                                  : "—"}
                              </dd>
                            </div>
                          </dl>
                          <button
                            type="button"
                            className="decision-button secondary"
                            disabled={!plan.restoredEdgeIds.length}
                            onClick={() => {
                              cancel();
                              onApplyClosures(
                                current.closedEdgeIds.filter(
                                  (id) => !plan.restoredEdgeIds.includes(id),
                                ),
                              );
                            }}
                          >
                            {w("Apply this recovery plan", "この復旧計画を適用")}
                            <ArrowRight size={14} />
                          </button>
                        </article>
                      ))}
                    </>
                  ) : (
                    <Empty>
                      {w(
                        "Set a budget and run the optimizer. The top three distinct closure combinations will appear here.",
                        "予算を指定して計算してください。異なる復旧組み合わせの上位3案を表示します。",
                      )}
                    </Empty>
                  )}
                </Panel>
              </div>
              {recoveryResult && (
                <Panel
                  title={w("Recovery sequence", "復旧の順序")}
                  description={w(
                    "Sequence for the highest-ranked plan. Stages are abstract decision steps, not estimates of repair days.",
                    "最上位計画の復旧順序です。段階は意思決定のステップであり、復旧日数の予測ではありません。",
                  )}
                >
                  {recoveryResult.sequence.length ? (
                    <>
                      <SequenceChart
                        rows={recoveryResult.sequence}
                        current={current.metrics}
                        w={w}
                        hasServices={hasServices}
                      />
                      <ol className="decision-stage-list">
                        {recoveryResult.sequence.map((stage) => (
                          <li key={stage.edgeId}>
                            <span>
                              {w("Stage", "段階")} {stage.stage}
                            </span>
                            <strong>{linkName(stage.edgeId)}</strong>
                            <small>
                              {delta(stage.resilienceGain)}
                              {w(" resilience", " レジリエンス")}{" "}
                              {hasServices && (
                                <>
                                  · {delta(stage.accessibilityGain)}
                                  {w(" access points", " アクセスポイント")}
                                </>
                              )}{" "}
                              · {number(stage.travelTimeSaved)}
                              {w(" min saved", " 分短縮")}
                            </small>
                            <small>
                              {w("Stage resilience gain / cost", "この段階の改善／コスト")}:{" "}
                              {number(stage.resilienceGain / (costs[stage.edgeId] ?? 1))}
                            </small>
                          </li>
                        ))}
                      </ol>
                      <p className="decision-caption">
                        {recoveryResult.sequence[0]?.method === "exact-subset"
                          ? w(
                              "Exact subset search maximizes cumulative resilience over this selected plan's stages.",
                              "選択計画内の段階ごとの累積レジリエンスを厳密な部分集合探索で最大化します。",
                            )
                          : w(
                              "Greedy next-stage improvement is used for this sequence.",
                              "この順序は次段階の改善を選ぶ貪欲法で求めています。",
                            )}
                      </p>
                    </>
                  ) : (
                    <Empty>
                      {w(
                        "No restoration is selected under this budget.",
                        "この予算では復旧対象が選ばれていません。",
                      )}
                    </Empty>
                  )}
                </Panel>
              )}
            </>
          )}
          {tab === "uncertainty" && (
            <>
              <p className="decision-warning">
                {w(
                  "These probabilities are user-defined scenario assumptions, not predicted infrastructure failure probabilities. Each run samples the selected links independently; other links remain available.",
                  "これらの確率はユーザーが指定する仮想条件であり、インフラの故障確率予測ではありません。各試行で選択リンクを独立に抽選し、その他のリンクは使用可能とします。",
                )}
              </p>
              <div className="decision-grid">
                <Panel
                  title={w("Seeded scenario experiment", "シード付きシナリオ実験")}
                  description={w(
                    `The same seed reproduces the same samples. This network supports at most ${maxRuns} runs per experiment.`,
                    `同じシードで同じ抽選を再現できます。このネットワークでの試行上限は${maxRuns}回です。`,
                  )}
                >
                  <div className="decision-form-grid">
                    <label className="decision-field">
                      {w("Runs", "試行数")}
                      <input
                        type="number"
                        min={1}
                        max={maxRuns}
                        step={1}
                        value={Number.isNaN(runs) ? "" : runs}
                        onChange={(event) => {
                          cancel();
                          setRuns(event.target.value === "" ? NaN : Number(event.target.value));
                        }}
                        data-testid="uncertainty-runs"
                      />
                    </label>
                    <label className="decision-field">
                      {w("Random seed", "乱数シード")}
                      <input
                        type="number"
                        min={0}
                        max={4294967295}
                        step={1}
                        value={Number.isNaN(seed) ? "" : seed}
                        onChange={(event) => {
                          cancel();
                          setSeed(event.target.value === "" ? NaN : Number(event.target.value));
                        }}
                      />
                    </label>
                  </div>
                  {failureIds.length ? (
                    <div className="decision-costs">
                      {failureIds.map((id) => (
                        <label key={id}>
                          <span>{linkName(id)}</span>
                          <div>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={
                                Number.isNaN(probabilities[id]) ? "" : (probabilities[id] ?? 50)
                              }
                              aria-label={`${w("Scenario failure probability", "仮想的な故障確率")}: ${linkName(id)}`}
                              onChange={(event) => {
                                cancel();
                                setProbabilities({
                                  ...probabilities,
                                  [id]:
                                    event.target.value === "" ? NaN : Number(event.target.value),
                                });
                              }}
                            />{" "}
                            %
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <Empty>
                      {w(
                        "Stage links in Disrupt & understand first. Those links become the experiment's failure candidates.",
                        "先に「障害・影響」でリンクを選択してください。選択リンクが実験の障害候補になります。",
                      )}
                    </Empty>
                  )}
                  <button
                    type="button"
                    className="decision-button primary"
                    data-testid="run-uncertainty"
                    disabled={!failureIds.length || !!currentJob}
                    onClick={sample}
                  >
                    {w("Run uncertainty analysis", "不確実性分析を実行")}
                  </button>
                </Panel>
                <Panel title={w("Outcome distribution", "結果の分布")}>
                  {uncertaintyResult ? (
                    <>
                      <div className="decision-mini-stats">
                        <div>
                          <strong>{number(uncertaintyResult.summaries.resilience.mean)}</strong>
                          <span>{w("expected resilience", "レジリエンスの平均")}</span>
                        </div>
                        <div>
                          <strong>
                            {number(uncertaintyResult.summaries.resilience.p10)}–
                            {number(uncertaintyResult.summaries.resilience.p90)}
                          </strong>
                          <span>{w("10th–90th percentile", "10〜90パーセンタイル")}</span>
                        </div>
                        <div>
                          <strong>
                            {number(uncertaintyResult.probabilityResilienceBelow60 * 100)}%
                          </strong>
                          <span>
                            {w("sampled resilience below 60", "レジリエンス60未満の試行割合")}
                          </span>
                        </div>
                      </div>
                      <div
                        className="decision-histogram"
                        role="img"
                        aria-label={w(
                          "Resilience histogram in ten-point bands",
                          "レジリエンスの10点幅ヒストグラム",
                        )}
                      >
                        {Array.from({ length: 10 }, (_, index) => {
                          const count = uncertaintyResult.samples.filter(
                            (sample) =>
                              Math.min(9, Math.floor(sample.metrics.resilienceScore / 10)) ===
                              index,
                          ).length;
                          return (
                            <div key={index}>
                              <div>
                                <i
                                  style={{
                                    height: `${Math.max(count ? 3 : 0, (count / uncertaintyResult.runs) * 100)}%`,
                                  }}
                                />
                                <span>{count || ""}</span>
                              </div>
                              <small>
                                {index * 10}
                                {index === 9 ? "–100" : `–${index * 10 + 9}`}
                              </small>
                            </div>
                          );
                        })}
                      </div>
                      <p className="decision-caption">
                        {uncertaintyResult.runs}
                        {w(" actual runs", "回の実試行")} ·{" "}
                        {w("Median resilience", "レジリエンス中央値")}{" "}
                        {number(uncertaintyResult.summaries.resilience.median)} ·{" "}
                        {w("Worst sampled resilience", "最小レジリエンス")}{" "}
                        {number(uncertaintyResult.summaries.resilience.min)}
                      </p>
                      <details className="decision-critical-detail">
                        <summary>{w("Worst sampled closure set", "最悪試行の閉鎖リンク")}</summary>
                        <p>
                          {uncertaintyResult.worst.closedEdgeIds.length
                            ? uncertaintyResult.worst.closedEdgeIds.map(linkName).join(" · ")
                            : w(
                                "No links closed in this draw",
                                "この試行で閉鎖されたリンクはありません",
                              )}
                        </p>
                        <p>
                          {w(
                            "Worst among these sampled scenarios, not a guaranteed worst case.",
                            "今回の試行で最も悪い結果であり、あらゆる事象に対する最悪ケースの保証ではありません。",
                          )}
                        </p>
                      </details>
                      <p className="decision-caption">
                        {w("Accessibility below 70%", "アクセス率70%未満")}:{" "}
                        {uncertaintyResult.probabilityAccessibilityBelow70 === null
                          ? w(
                              "N/A — no eligible service categories",
                              "対象なし・重要施設カテゴリなし",
                            )
                          : `${number(uncertaintyResult.probabilityAccessibilityBelow70 * 100)}%`}
                      </p>
                      <p className="decision-caption">
                        {w("Hospital accessibility below 70%", "病院アクセス率70%未満")}:{" "}
                        {uncertaintyResult.probabilityHospitalAccessibilityBelow70 === null
                          ? w("N/A — no hospitals", "対象なし・病院なし")
                          : `${number(uncertaintyResult.probabilityHospitalAccessibilityBelow70 * 100)}%`}
                      </p>
                    </>
                  ) : (
                    <Empty>
                      {w(
                        "Run the experiment to see measured sample statistics. No predicted disaster likelihood is displayed.",
                        "実験を実行すると試行結果の統計を表示します。災害発生確率の予測ではありません。",
                      )}
                    </Empty>
                  )}
                </Panel>
              </div>
              <Panel
                title={w("Robust recovery comparison", "不確実性下の復旧計画比較")}
                description={w(
                  "Evaluate the budget optimizer's top plans against identical sampled closures. Restored links are assumed protected in every sample, solely for this experiment.",
                  "予算最適化の上位計画を同じ障害サンプルで比較します。この実験では、復旧リンクが各試行で使用可能と仮定します。",
                )}
              >
                <div className="decision-actions">
                  <button
                    type="button"
                    className="decision-button primary"
                    data-testid="run-robust-recovery"
                    disabled={!uncertaintyResult || !recoveryResult || !!currentJob}
                    onClick={analyzeRobustness}
                  >
                    {w("Test recovery robustness", "復旧計画の頑健性を検証")}
                  </button>
                  <label className="decision-field compact">
                    {w("Rank by", "順位の基準")}
                    <select
                      value={robustMode}
                      onChange={(event) => setRobustMode(event.target.value as "average" | "worst")}
                    >
                      <option value="average">{w("Best on average", "平均で最良")}</option>
                      <option value="worst">{w("Best worst-case", "最悪ケースで最良")}</option>
                    </select>
                  </label>
                </div>
                {robustResult ? (
                  <div className="decision-table-scroll">
                    <table className="decision-table">
                      <thead>
                        <tr>
                          <th>{w("Restoration plan", "復旧計画")}</th>
                          <th>{w("Average resilience", "平均レジリエンス")}</th>
                          <th>{w("Worst sample", "最悪試行")}</th>
                          <th>{w("10th percentile", "10パーセンタイル")}</th>
                          <th>{w("Relative cost", "相対コスト")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...robustResult.plans]
                          .sort((a, b) =>
                            robustMode === "average"
                              ? b.expectedResilience - a.expectedResilience
                              : b.worstResilience - a.worstResilience,
                          )
                          .map((plan) => (
                            <tr key={plan.planId}>
                              <th>
                                {plan.restoredEdgeIds.map(linkName).join(" + ") ||
                                  w("No restoration", "復旧なし")}
                              </th>
                              <td>{number(plan.expectedResilience)}</td>
                              <td>{number(plan.worstResilience)}</td>
                              <td>{number(plan.p10Resilience)}</td>
                              <td>{plan.cost}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty>
                    {w(
                      "First calculate recovery alternatives and an uncertainty experiment. This compares those plans; it does not search all possible robust plans.",
                      "先に復旧計画と不確実性分析を計算してください。ここでは得られた計画を比較し、すべての頑健な計画を探索するものではありません。",
                    )}
                  </Empty>
                )}
              </Panel>
            </>
          )}
          {tab === "report" && (
            <>
              <div className="decision-grid">
                <Panel
                  title={w("Resilience report", "レジリエンス分析レポート")}
                  description={w(
                    "A standalone, print-ready HTML report. Open it and use the browser's Print → Save as PDF. Optional analyses appear only when current, completed results exist.",
                    "単独で開ける印刷用HTMLを生成します。開いてブラウザの「印刷→PDFに保存」を利用できます。任意分析は現在の完了済み結果だけを掲載します。",
                  )}
                >
                  <label className="decision-field">
                    {w("Report scenario name", "レポートのシナリオ名")}
                    <input
                      value={name}
                      maxLength={80}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={w("Current multi-link scenario", "現在の複数障害シナリオ")}
                    />
                  </label>
                  <div className="decision-actions">
                    <button
                      type="button"
                      className="decision-button primary"
                      data-testid="generate-resilience-report"
                      onClick={() =>
                        download(
                          "resiliroute-resilience-report.html",
                          renderResilienceReport(reportInput, locale),
                          "text/html;charset=utf-8",
                        )
                      }
                    >
                      <Download size={16} />
                      {w("Generate resilience report", "分析レポートを生成")}
                    </button>
                    <button
                      type="button"
                      className="decision-button secondary"
                      onClick={() =>
                        download(
                          "resiliroute-analysis.json",
                          exportAnalysisSnapshot(reportInput),
                          "application/json",
                        )
                      }
                    >
                      {w("Export analysis snapshot", "分析スナップショットを書き出し")}
                    </button>
                  </div>
                  <p className="decision-caption">
                    {w(
                      "Includes baseline/current KPIs, zones, facilities, critical links, recovery evidence, assumptions, and limitations. No map tiles, account data, or API keys are embedded.",
                      "通常時と現在の指標、ゾーン、施設、重要リンク、復旧結果、仮定、限界を含みます。地図タイル・アカウント情報・APIキーは含めません。",
                    )}
                  </p>
                </Panel>
                <Panel
                  title={w("Export analysis tables", "分析表を書き出す")}
                  description={w(
                    "CSV tables are suitable for spreadsheets. Values remain modeled simulation outputs.",
                    "CSVは表計算ソフトで利用できます。数値はモデル上のシミュレーション結果です。",
                  )}
                >
                  <div className="decision-export-grid">
                    {(
                      [
                        ["kpi", "KPI comparison", "指標比較"],
                        ["links", "Link states", "リンク状態"],
                        ["zones", "District / zone impacts", "地区・ゾーン影響"],
                        ["facilities", "Facility accessibility", "施設アクセス"],
                        ["recovery", "Recovery alternatives", "復旧代替案"],
                      ] as const
                    ).map(([kind, en, ja]) => (
                      <button
                        key={kind}
                        type="button"
                        className="decision-button secondary"
                        onClick={() =>
                          download(
                            `resiliroute-${kind}.csv`,
                            exportDecisionCSV(reportInput, kind, locale),
                            "text/csv;charset=utf-8",
                          )
                        }
                      >
                        <Download size={14} />
                        {w(en, ja)}
                      </button>
                    ))}
                  </div>
                </Panel>
              </div>
              <Panel title={w("Current evidence", "現在の計算結果")} description={networkLabel}>
                <MetricsTable
                  baseline={baseline.metrics}
                  current={current.metrics}
                  w={w}
                  hasServices={hasServices}
                />
                <p className="decision-warning">
                  {w(
                    "Educational planning prototype. Real City uses real OSM geometry with modeled mobility demand and estimated capacity. Failure probabilities and recovery costs are user assumptions. Not for real-time emergency navigation.",
                    "教育・計画支援用プロトタイプです。実都市ではOSMの実在道路にモデル需要と推定容量を組み合わせます。故障確率と復旧コストはユーザーの仮定です。実際の緊急時の避難誘導には利用できません。",
                  )}
                </p>
              </Panel>
            </>
          )}
        </fieldset>
      </div>
    </section>
  );
}

export default DecisionWorkspace;
