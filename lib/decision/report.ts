import { modelConfig } from "@/data/harbor-city";
import type {
  CriticalLinkResult,
  Network,
  ODPair,
  SimulationMetrics,
  SimulationResult,
} from "@/types/network";
import type { BoundingBox } from "@/types/real-city";
import type { DecisionEvidence } from "./evidence";
import { decisionConfig } from "./config";
import type { RecoveryPlan, RecoveryStage } from "./recovery";
import type { FailureAssumption, RobustRecoveryResult } from "./uncertainty";
import { networkIdentifier } from "./scenarios";

export interface ReportUncertainty {
  runs: number;
  seed: number;
  meanResilience: number;
  medianResilience: number;
  p10Resilience: number;
  p90Resilience: number;
  probabilityBelow60?: number;
  probabilityHospitalBelow70?: number | null;
  assumptions?: readonly FailureAssumption[];
  fixedClosedEdgeIds?: readonly string[];
}
export interface DecisionReportInput {
  scenarioName: string;
  networkLabel?: string;
  createdAt?: string;
  network: Network;
  odPairs?: readonly ODPair[];
  baseline: SimulationResult;
  current: SimulationResult;
  evidence: DecisionEvidence;
  criticalLinks?: readonly CriticalLinkResult[];
  recovery?: { budget: number; objective: string; method?: string; plans: readonly RecoveryPlan[] };
  uncertainty?: ReportUncertainty;
  sequence?: readonly RecoveryStage[];
  robust?: RobustRecoveryResult;
  realCity?: boolean;
  bbox?: BoundingBox;
}
export type ReportCSVKind = "kpi" | "links" | "zones" | "facilities" | "recovery";
type Locale = "en" | "ja";
type Cell = string | number | null;
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
const number = (value: number | null | undefined, digits = 1) =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "N/A";
const delta = (before: number, after: number) =>
  `${after > before ? "+" : ""}${number(after - before)}`;
const labels = {
  en: {
    title: "Urban Mobility Resilience Analysis",
    scenario: "Scenario",
    date: "Analysis date",
    summary: "Executive summary",
    network: "Network & data sources",
    metrics: "Before / after metrics",
    baseline: "Baseline",
    current: "Scenario",
    difference: "Difference",
    metric: "Metric",
    critical: "Critical infrastructure",
    zones: "District / analysis-zone impact",
    facilities: "Essential-service accessibility",
    recovery: "Recovery budget plans",
    uncertainty: "Uncertainty experiment",
    methodology: "Methodology",
    limitations: "Limitations",
    geometry: "Network geometry",
    print: "Print / Save as PDF",
    closed: "Closed links",
    noCritical:
      "No criticality stress test was supplied. Untested links are not assigned criticality.",
    noRecovery: "No recovery optimization was supplied.",
    noUncertainty: "No uncertainty experiment was supplied.",
    name: "Name",
    score: "Score",
    reach: "Reachable demand proxy (%)",
    loss: "Access loss (points)",
    travel: "Travel time (min)",
    access: "Accessibility (%)",
    efficiency: "Network efficiency",
    congestion: "Congestion delay (%)",
    resilience: "Resilience Score",
    connected: "Connected demand (%)",
    disconnected: "Disconnected modeled demand",
    origins: "Residential demand origins",
    caveat: "Educational planning prototype. Not for real-time emergency navigation.",
    hospital: "Hospital",
    station: "Station",
    shelter: "Shelter",
    currentAccess: "Scenario access (%)",
    exposure: "Route-weighted v/c exposure (%)",
    impact: "Diagnostic impact score",
    isolated: "Critical access loss",
    yes: "Yes",
    no: "No",
    alternatives: "Alternatives",
    cost: "Relative cost",
    budget: "Recovery budget",
    plan: "Plan",
    restore: "Restore",
    rows: "No applicable data in this network.",
    unknown: "Unknown",
    boundary: "Selected bounds",
    strategy: "Optimization objective",
    simulated: "All outcomes below are modeled estimates, not measured traffic observations.",
    worst: "Worst-hit zone",
    cascade: "Secondary-stress links",
    affected: "Affected OD pairs",
    top: "Most critical tested link",
    sequence: "Recovery results are independent plans, not construction-time forecasts.",
    source:
      "Real road geometry and facilities: OpenStreetMap. Speeds: OSM / estimated. Capacity: estimated. Demand: synthetic. Failure assumptions and relative recovery cost: user-defined.",
    synthetic:
      "Synthetic Harbor City network, facilities, capacity and demand. Results describe this demonstration model.",
    mapLabel: "Geographic model geometry; no background tiles. Red dashed links are closed.",
    imports: "© OpenStreetMap contributors · ODbL-1.0",
    unavailable: "No matching service category: N/A, not zero accessibility.",
  },
  ja: {
    title: "都市交通レジリエンス分析",
    scenario: "シナリオ",
    date: "分析日時",
    summary: "分析概要",
    network: "ネットワークとデータ出典",
    metrics: "災害前後の指標",
    baseline: "通常時",
    current: "シナリオ",
    difference: "変化量",
    metric: "指標",
    critical: "重要インフラ",
    zones: "地区・分析ゾーンへの影響",
    facilities: "重要施設へのアクセス",
    recovery: "復旧予算プラン",
    uncertainty: "不確実性実験",
    methodology: "計算方法",
    limitations: "制約",
    geometry: "ネットワーク形状",
    print: "印刷・PDFに保存",
    closed: "閉鎖リンク",
    noCritical:
      "重要度のストレステスト結果はありません。未解析リンクには重要度を割り当てていません。",
    noRecovery: "復旧最適化は未実行です。",
    noUncertainty: "不確実性実験は未実行です。",
    name: "名称",
    score: "スコア",
    reach: "到達可能な需要代理値（%）",
    loss: "アクセス低下（ポイント）",
    travel: "移動時間（分）",
    access: "アクセシビリティ（%）",
    efficiency: "ネットワーク効率",
    congestion: "混雑遅延（%）",
    resilience: "レジリエンススコア",
    connected: "到達可能需要（%）",
    disconnected: "到達不能なモデル需要",
    origins: "住宅需要の起点",
    caveat: "教育・計画用プロトタイプです。実際の避難誘導には使えません。",
    hospital: "病院",
    station: "駅",
    shelter: "避難所",
    currentAccess: "シナリオアクセス（%）",
    exposure: "経路重み付きv/c負荷（%）",
    impact: "診断用影響スコア",
    isolated: "重要アクセス喪失",
    yes: "はい",
    no: "いいえ",
    alternatives: "代替プラン",
    cost: "相対コスト",
    budget: "復旧予算",
    plan: "プラン",
    restore: "復旧対象",
    rows: "このネットワークには該当データがありません。",
    unknown: "不明",
    boundary: "選択範囲",
    strategy: "最適化目的",
    simulated: "以下の結果はすべてモデル推定であり、観測交通データではありません。",
    worst: "最も影響の大きいゾーン",
    cascade: "二次負荷が増加したリンク",
    affected: "影響を受けたODペア",
    top: "解析済みリンクで最も重要",
    sequence: "復旧結果は個別の比較プランであり、実工事の期間予測ではありません。",
    source:
      "実道路形状・施設：OpenStreetMap。速度：OSMまたは推定。容量：推定。需要：合成。障害の仮定と相対復旧コスト：ユーザー指定。",
    synthetic:
      "Harbor Cityの道路・施設・容量・需要は合成データです。結果はこのデモモデルに限ります。",
    mapLabel: "背景タイルを使わないモデルの地理形状です。赤の破線は閉鎖リンクを示します。",
    imports: "© OpenStreetMap contributors · ODbL-1.0",
    unavailable: "該当する施設がないカテゴリは、アクセス0ではなくN/Aで表示します。",
  },
} as const;

function metricRows(locale: Locale): [string, keyof SimulationMetrics][] {
  const text = labels[locale];
  return [
    [text.travel, "averageTravelTime"],
    [text.access, "accessibility"],
    [text.efficiency, "networkEfficiency"],
    [text.congestion, "congestion"],
    [text.resilience, "resilienceScore"],
    [text.connected, "connectedDemandRetention"],
    [text.disconnected, "disconnectedDemand"],
  ];
}
function table(headings: readonly string[], rows: readonly Cell[][]): string {
  return `<div class="table-wrap"><table><thead><tr>${headings.map((heading) => `<th scope="col">${escape(heading)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escape(typeof cell === "number" ? number(cell) : (cell ?? "N/A"))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function modelMap(input: DecisionReportInput, locale: Locale): string {
  const nodes = new Map(input.network.nodes.map((node) => [node.id, node]));
  const points = input.network.nodes;
  if (!points.length) return "";
  const minLat = Math.min(...points.map((node) => node.latitude)),
    maxLat = Math.max(...points.map((node) => node.latitude));
  const minLon = Math.min(...points.map((node) => node.longitude)),
    maxLon = Math.max(...points.map((node) => node.longitude));
  const meanLat = (((minLat + maxLat) / 2) * Math.PI) / 180;
  const width = Math.max(0.00001, (maxLon - minLon) * Math.cos(meanLat)),
    height = Math.max(0.00001, maxLat - minLat);
  const scale = Math.min(940 / width, 380 / height);
  const xOffset = 30 + (940 - width * scale) / 2,
    yOffset = 20 + (380 - height * scale) / 2;
  const project = ([lat, lon]: readonly number[]) =>
    `${number(xOffset + (lon - minLon) * Math.cos(meanLat) * scale, 2)},${number(yOffset + (maxLat - lat) * scale, 2)}`;
  const closed = new Set(input.current.closedEdgeIds);
  const paths = input.network.edges.map((edge) => {
    const source = nodes.get(edge.source),
      target = nodes.get(edge.target);
    if (!source || !target) return "";
    const geometry = edge.geometry ?? [
      [source.latitude, source.longitude],
      [target.latitude, target.longitude],
    ];
    return `<polyline points="${escape(geometry.map(project).join(" "))}" fill="none" stroke="${closed.has(edge.id) ? "#bd3546" : "#426a86"}" stroke-width="${closed.has(edge.id) ? 3 : 1.3}"${closed.has(edge.id) ? ' stroke-dasharray="7 4"' : ""}><title>${escape(edge.name)}</title></polyline>`;
  });
  return `<svg viewBox="0 0 1000 420" role="img" aria-label="${escape(labels[locale].geometry)}" xmlns="http://www.w3.org/2000/svg"><rect width="1000" height="420" rx="12" fill="#edf3f5"/>${paths.join("")}</svg>`;
}

/** A self-contained HTML document with a restrictive CSP: data is escaped, never executed. */
export function renderResilienceReport(input: DecisionReportInput, locale: Locale = "en"): string {
  const text = labels[locale];
  const createdAt = input.createdAt ?? new Date().toISOString();
  const date = Number.isFinite(Date.parse(createdAt))
    ? new Date(createdAt).toISOString()
    : text.unknown;
  const edgeNames = new Map(input.network.edges.map((edge) => [edge.id, edge.name]));
  const critical = input.criticalLinks ?? [];
  const section = (id: string, title: string, body: string) =>
    `<section id="${id}"><h2>${escape(title)}</h2>${body}</section>`;
  const p = (content: string) => `<p>${escape(content)}</p>`;
  const kpi = table(
    [text.metric, text.baseline, text.current, text.difference],
    metricRows(locale).map(([label, key]) => [
      label,
      input.baseline.metrics[key],
      input.current.metrics[key],
      delta(input.baseline.metrics[key], input.current.metrics[key]),
    ]),
  );
  const summary = table(
    [text.metric, text.current],
    [
      [text.closed, input.current.closedEdgeIds.length],
      [text.affected, input.evidence.affectedODPairs],
      [
        text.worst,
        (input.evidence.worstZone?.impactScore ?? 0) > 0
          ? input.evidence.worstZone!.name
          : locale === "ja"
            ? "悪化なし"
            : "No modeled deterioration",
      ],
      [text.top, critical[0]?.name ?? "N/A"],
      [text.cascade, input.evidence.summary.stressedLinks],
    ],
  );
  const stats = table(
    [text.metric, text.current],
    [
      [text.name, input.networkLabel ?? (input.realCity ? "Real City Lab" : "Harbor City")],
      [locale === "ja" ? "ノード" : "Nodes", input.network.nodes.length],
      [locale === "ja" ? "リンク" : "Links", input.network.edges.length],
      [text.origins, input.network.nodes.filter((node) => node.type === "residential").length],
      ...(input.bbox
        ? [
            [
              text.boundary,
              `${input.bbox.south}, ${input.bbox.west}, ${input.bbox.north}, ${input.bbox.east}`,
            ] as Cell[],
          ]
        : []),
    ],
  );
  const zoneTable = table(
    [
      text.name,
      text.travel,
      text.currentAccess,
      text.loss,
      text.hospital,
      text.station,
      text.disconnected,
      text.exposure,
      text.impact,
    ],
    input.evidence.zones.map((zone) => [
      zone.name,
      zone.current.travelTime,
      zone.current.accessibility,
      zone.accessibilityLoss,
      zone.current.hospitalAccessibility,
      zone.current.stationAccessibility,
      zone.current.disconnectedDemand,
      zone.current.congestionExposure,
      zone.impactScore,
    ]),
  );
  const facilityTable = input.evidence.facilities.length
    ? table(
        [
          text.name,
          locale === "ja" ? "種別" : "Type",
          locale === "ja" ? "時間閾値（分）" : "Threshold (min)",
          `${text.baseline} (%)`,
          `${text.current} (%)`,
          text.loss,
          text.isolated,
        ],
        input.evidence.facilities.map((facility) => [
          facility.name,
          facility.type === "hospital"
            ? text.hospital
            : facility.type === "station"
              ? text.station
              : text.shelter,
          facility.threshold,
          facility.baselineReach,
          facility.currentReach,
          facility.loss,
          facility.isolated ? text.yes : text.no,
        ]),
      )
    : p(text.rows);
  const criticalTable = critical.length
    ? table(
        [
          text.name,
          text.score,
          locale === "ja" ? "移動時間増加（分）" : "Travel-time increase (min)",
          text.loss,
          locale === "ja" ? "効率低下" : "Efficiency loss",
          text.disconnected,
        ],
        critical
          .slice(0, 5)
          .map((link) => [
            link.name,
            link.score,
            link.travelTimeIncrease,
            link.accessibilityLoss,
            link.efficiencyLoss,
            link.disconnectedDemandIncrease,
          ]),
      )
    : p(text.noCritical);
  const recovery = input.recovery;
  const plans = recovery?.plans ?? [];
  const objectiveLabels: Record<string, string> =
    locale === "ja"
      ? {
          resilience: "レジリエンス最大化",
          accessibility: "アクセス最大化",
          travelTime: "移動時間最小化",
          efficiency: "効率最大化",
          balanced: "バランス",
        }
      : {
          resilience: "Maximize resilience",
          accessibility: "Maximize accessibility",
          travelTime: "Minimize travel time",
          efficiency: "Maximize efficiency",
          balanced: "Balanced",
        };
  const methodLabels: Record<string, string> =
    locale === "ja"
      ? { exact: "完全探索", beam: "近似ビーム探索" }
      : { exact: "Exact enumeration", beam: "Approximate beam search" };
  const recoveryContent = recovery
    ? p(
        `${text.budget}: ${number(recovery.budget, 0)} · ${text.strategy}: ${objectiveLabels[recovery.objective] ?? recovery.objective} · ${recovery.method ? (methodLabels[recovery.method] ?? recovery.method) : "—"}`,
      ) +
      p(
        locale === "ja"
          ? "相対復旧コストはモデル上の点数であり、実際の金額ではありません。"
          : "Modeled relative recovery cost — not real financial cost.",
      ) +
      table(
        [
          text.plan,
          text.restore,
          text.cost,
          text.resilience,
          text.access,
          text.travel,
          text.efficiency,
        ],
        plans
          .slice(0, 3)
          .map((plan, index) => [
            String.fromCharCode(65 + index),
            plan.restoredEdgeIds.map((id) => edgeNames.get(id) ?? id).join("; ") || "—",
            plan.cost,
            plan.metrics.resilienceScore,
            plan.metrics.accessibility,
            plan.metrics.averageTravelTime,
            plan.metrics.networkEfficiency,
          ]),
      ) +
      p(text.sequence)
    : p(text.noRecovery);
  const sequenceContent = input.sequence?.length
    ? section(
        "sequence",
        locale === "ja" ? "復旧段階" : "Recovery sequence",
        table(
          [
            locale === "ja" ? "段階" : "Stage",
            text.restore,
            text.resilience,
            text.access,
            text.travel,
            locale === "ja" ? "レジリエンス改善" : "Marginal resilience gain",
          ],
          input.sequence.map((stage) => [
            stage.stage,
            edgeNames.get(stage.edgeId) ?? stage.edgeId,
            stage.metrics.resilienceScore,
            stage.metrics.accessibility,
            stage.metrics.averageTravelTime,
            stage.resilienceGain,
          ]),
        ) +
          p(
            locale === "ja"
              ? "段階は仮想的な順序で、実際の日数や工事期間ではありません。"
              : "Stages are hypothetical ordering units, not predicted days or construction durations.",
          ),
      )
    : "";
  const robustContent = input.robust?.plans.length
    ? section(
        "robust",
        locale === "ja" ? "復旧プランの頑健性" : "Recovery-plan robustness",
        table(
          [
            text.plan,
            text.restore,
            text.cost,
            locale === "ja" ? "平均レジリエンス" : "Expected resilience",
            locale === "ja" ? "最悪ケース" : "Worst sampled resilience",
            "P10",
          ],
          input.robust.plans.map((plan) => [
            plan.planId,
            plan.restoredEdgeIds.map((id) => edgeNames.get(id) ?? id).join("; ") || "—",
            plan.cost,
            plan.expectedResilience,
            plan.worstResilience,
            plan.p10Resilience,
          ]),
        ) +
          p(
            locale === "ja"
              ? `選んだ${input.robust.comparedPlans}プランを${input.robust.runs}試行で比較しました。全組み合わせに対する最適性は示しません。復旧リンクは指定試行では保護されるという仮定です。`
              : `Compared ${input.robust.comparedPlans} shortlisted plans across ${input.robust.runs} samples, not all possible plans. Restored links are assumed protected in these user-defined samples.`,
          ),
      )
    : "";
  const uncertainty = input.uncertainty;
  const uncertaintyContent = uncertainty
    ? p(
        locale === "ja"
          ? "確率はユーザーが指定したシナリオ仮定であり、インフラ破損の予測確率ではありません。"
          : "These probabilities are user-defined scenario assumptions, not predicted infrastructure failure probabilities.",
      ) +
      table(
        [text.metric, text.current],
        [
          [locale === "ja" ? "試行回数" : "Runs", uncertainty.runs],
          [locale === "ja" ? "乱数シード" : "Seed", uncertainty.seed],
          [locale === "ja" ? "平均レジリエンス" : "Mean resilience", uncertainty.meanResilience],
          [locale === "ja" ? "中央値" : "Median resilience", uncertainty.medianResilience],
          ["P10", uncertainty.p10Resilience],
          ["P90", uncertainty.p90Resilience],
          [
            locale === "ja" ? "P(レジリエンス < 60)" : "P(Resilience < 60)",
            uncertainty.probabilityBelow60 !== undefined
              ? `${number(uncertainty.probabilityBelow60 * 100)}%`
              : "N/A",
          ],
          [
            locale === "ja" ? "P(病院アクセス < 70%)" : "P(Hospital accessibility < 70%)",
            uncertainty.probabilityHospitalBelow70 != null
              ? `${number(uncertainty.probabilityHospitalBelow70 * 100)}%`
              : "N/A",
          ],
        ],
      )
    : p(text.noUncertainty);
  const assumptionContent = uncertainty?.assumptions?.length
    ? table(
        [text.name, locale === "ja" ? "仮定障害確率（%）" : "Assumed failure probability (%)"],
        uncertainty.assumptions.map((assumption) => [
          edgeNames.get(assumption.edgeId) ?? assumption.edgeId,
          assumption.probability * 100,
        ]),
      ) +
      (uncertainty.fixedClosedEdgeIds?.length
        ? p(
            `${locale === "ja" ? "全試行で閉鎖" : "Fixed closed in every sample"}: ${uncertainty.fixedClosedEdgeIds.map((id) => edgeNames.get(id) ?? id).join("; ")}`,
          )
        : "")
    : "";
  const methodology =
    locale === "ja"
      ? [
          "利用可能なリンク上でDijkstra最短経路を求め、既存の24反復MSA需要配分を使用します。",
          "BPR: t = t₀ × (1 + 0.15 × min(v/c, 2.5)⁴)。混雑遅延は配分需要の人分重み付き時間と自由流時間から計算します。",
          "アクセシビリティは、病院20分・避難所15分・駅12分の閾値以内に施設へ到達できる住宅需要代理値の重み付き比率です。施設カテゴリが存在しない場合はN/Aです。",
          "ネットワーク効率は、到達可能なODの demand × 10/(10+t) を総需要で割った0〜100の指標です。到達不能は0に寄与し、平均移動時間には60分のペナルティを使用します。",
          "レジリエンスは通常時に対する二乗保持率を、アクセス35%・効率25%・移動時間25%・到達性15%で合成します。通常時は100です。",
          "重要度は1本ずつ追加閉鎖した影響を、移動時間35%・アクセス35%・効率20%・到達不能需要10%で合成します。大きい実都市ネットワークでは候補を選別するため、未解析リンクは低重要度とはみなしません。",
          "ゾーン影響スコア = アクセス低下50% + 0〜100に制限した移動時間増加率30% + 到達不能需要増加率20%。ゾーン間格差は最大損失と最小損失の差です。学術的に検証済みの公平性指標ではありません。",
          "二次負荷は、閉鎖されていないリンクのv/c増加を10・30・60パーセントポイントで区分します。物理破壊の予測ではありません。",
          "復旧予算は小規模組み合わせの完全探索、大規模時は制限付き近似探索です。Balancedはレジリエンス40%・アクセス30%・移動時間保持率20%・効率保持率10%で、レジリエンスと構成要素を重ねて重視する選好です。",
          "AIを利用する場合も計算値はシミュレーターが生成します。AIは与えられた根拠の解釈に限定され、APIなしでもローカル説明エンジンが動作します。",
        ]
      : [
          "Dijkstra routing over available links feeds the existing 24-iteration MSA travel-demand assignment.",
          "BPR: t = t₀ × (1 + 0.15 × min(v/c, 2.5)⁴). Congestion delay compares assigned demand-weighted travel minutes against free-flow minutes.",
          "Accessibility is the weighted residential demand proxy able to reach each available essential-service category within its educational threshold: hospital 20 min, shelter 15 min, station 12 min. Missing service categories are N/A.",
          "Network efficiency = 100 × Σ(demand × 10/(10+t)) / total demand; disconnected OD pairs contribute zero. Disconnected trips use a 60-minute penalty for mean travel time.",
          "Resilience combines squared baseline retention: accessibility 35%, efficiency 25%, travel time 25%, connectivity 15%. Baseline is 100 by definition.",
          "Criticality tests one additional link closure: normalized travel impact 35%, access loss 35%, efficiency loss 20%, disconnected demand 10%. Larger real networks use candidate screening; untested roads are not assumed low-criticality.",
          "Zone impact = 50% access loss + 30% travel-time increase rate clamped to 0–100 + 20% disconnected-demand increase rate. The impact gap is the maximum minus minimum zone loss. This is a diagnostic, not a validated academic equity index.",
          "Secondary stress classifies open-link v/c increases at 10, 30 and 60 percentage points. It does not predict physical infrastructure failure.",
          "Budget recovery uses exact enumeration for supported small jobs and bounded approximate search otherwise. Balanced weights are resilience 40%, accessibility 30%, travel-time retention 20%, efficiency retention 10%; this preference deliberately reweights resilience and some of its components.",
          "AI, if used, interprets supplied numerical evidence; it does not generate the simulation metrics. A deterministic local analyst works without an AI API.",
        ];
  const limits =
    locale === "ja"
      ? [
          "この分析は、リアルタイム交通・実人口・実災害確率・道路安全性・工事費・復旧日数を提供しません。",
          "道路形状が実在する場合も、交通需要と容量は推定または合成です。実交通予測として検証されていません。",
          "実都市の分析ゾーンは機械的な空間分割であり、行政区や人口属性を表しません。",
          "復旧プランや仮定確率は、モデル・対象範囲・需要に依存します。実際の防災情報には自治体等の公式情報を使用してください。",
        ]
      : [
          "This report does not provide real-time traffic, actual population, predicted disaster probabilities, road safety, construction costs, or recovery dates.",
          "Real infrastructure geometry does not imply observed demand or capacity. The simplified model is not calibrated as a real traffic forecast.",
          "Real City analysis zones are neutral spatial subdivisions, not administrative areas or demographic groups.",
          "Recovery recommendations and assumed probabilities depend on the model, selected extent and demand. Follow official local information during emergencies.",
        ];
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><title>ResiliRoute — ${escape(input.scenarioName)}</title><style>body{font:14px/1.6 system-ui,"Yu Gothic",sans-serif;color:#193247;background:#edf2f5;margin:0}main{max-width:1080px;margin:24px auto;background:#fff;padding:44px;border-radius:14px}h1{font-size:34px;line-height:1.2;margin:12px 0}h2{font-size:21px;margin:0 0 14px}section{margin-top:34px;break-inside:avoid}p{margin:10px 0}.eyebrow{font-weight:700;letter-spacing:.12em;color:#39738b}.subtle{color:#536a7a}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border-bottom:1px solid #dce5eb;padding:9px 7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#edf3f7}tr{break-inside:avoid}.table-wrap{overflow:auto}svg{width:100%;height:auto;max-height:440px}.notice{padding:12px 16px;background:#eff7fa;border-left:3px solid #26798c}li{margin-bottom:8px}header{border-bottom:2px solid #16374c;padding-bottom:24px}footer{margin-top:40px;border-top:1px solid #ccd9e1;padding-top:16px;font-size:12px}.print-note{font-size:12px;text-align:right}@page{size:A4 landscape;margin:13mm}@media print{body{background:#fff}main{margin:0;padding:0;max-width:none;border-radius:0}.print-note{display:none}section{break-inside:auto}h2{break-after:avoid}table{font-size:10px}.table-wrap{overflow:visible}svg{max-height:300px}}</style></head><body><main><p class="print-note">${escape(text.print)}: Ctrl/Cmd + P</p><header><div class="eyebrow">RESILIROUTE</div><h1>${escape(text.title)}</h1><p><strong>${escape(text.scenario)}:</strong> ${escape(input.scenarioName)}</p><p class="subtle">${escape(text.date)}: ${escape(date)} · ${escape(decisionConfig.modelVersion)}</p><p class="notice">${escape(text.caveat)}</p></header>${section("summary", text.summary, p(text.simulated) + summary)}${section("network", text.network, stats + p(input.realCity ? text.source : text.synthetic) + (input.realCity ? p(text.imports) : ""))}${section("metrics", text.metrics, kpi)}${section("map", text.geometry, modelMap(input, locale) + p(text.mapLabel))}${section("disruptions", text.closed, input.current.closedEdgeIds.length ? `<ul>${input.current.closedEdgeIds.map((id) => `<li>${escape(edgeNames.get(id) ?? id)} <span class="subtle">(${escape(id)})</span></li>`).join("")}</ul>` : p("—"))}${section("criticality", text.critical, criticalTable)}${section("zones", text.zones, zoneTable + p(`${locale === "ja" ? "影響スコアの格差" : "Diagnostic impact gap"}: ${number(input.evidence.impactGap)} · ${locale === "ja" ? "アクセス低下の格差" : "Accessibility-loss disparity"}: ${number(input.evidence.accessibilityDisparity)} ${locale === "ja" ? "ポイント" : "points"}`))}${section("facilities", text.facilities, facilityTable + p(text.unavailable))}${section("recovery", text.recovery, recoveryContent)}${sequenceContent}${robustContent}${section("uncertainty", text.uncertainty, uncertaintyContent + assumptionContent)}${section("methodology", text.methodology, `<ol>${methodology.map((item) => `<li>${escape(item)}</li>`).join("")}</ol>`)}${section("limitations", text.limitations, `<ul>${limits.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>`)}<footer>ResiliRoute · ${escape(text.caveat)}${input.realCity ? `<br>${escape(text.imports)}` : ""}</footer></main></body></html>`;
}

/** Quote all fields and neutralize spreadsheet formula prefixes, including after whitespace. */
export function spreadsheetSafeCSV(rows: readonly (readonly Cell[])[]): string {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let cell = typeof value === "number" ? number(value, 6) : String(value ?? "");
            if (typeof value !== "number" && /^[\s\u0000-\u001f\uFEFF]*[=+\-@]/.test(cell))
              cell = `'${cell}`;
            return `"${cell.replace(/"/g, '""')}"`;
          })
          .join(","),
      )
      .join("\r\n")
  );
}

export function exportDecisionCSV(
  input: DecisionReportInput,
  kind: ReportCSVKind,
  locale: Locale = "en",
): string {
  const text = labels[locale];
  const names = new Map(input.network.edges.map((edge) => [edge.id, edge.name]));
  let rows: Cell[][];
  if (kind === "kpi")
    rows = [
      [text.metric, text.baseline, text.current, text.difference],
      ...metricRows(locale).map(([label, key]): Cell[] => [
        label,
        key === "accessibility" && !input.evidence.facilities.length
          ? "N/A"
          : input.baseline.metrics[key],
        key === "accessibility" && !input.evidence.facilities.length
          ? "N/A"
          : input.current.metrics[key],
        key === "accessibility" && !input.evidence.facilities.length
          ? "N/A"
          : input.current.metrics[key] - input.baseline.metrics[key],
      ]),
    ];
  else if (kind === "links")
    rows = [
      [
        "ID",
        text.name,
        locale === "ja" ? "状態" : "Status",
        locale === "ja" ? "通常時モデル交通量" : "Baseline modeled flow",
        locale === "ja" ? "シナリオモデル交通量" : "Scenario modeled flow",
        locale === "ja" ? "交通量増加" : "Flow increase",
        locale === "ja" ? "通常時利用率（%）" : "Baseline utilization (%)",
        locale === "ja" ? "シナリオ利用率（%）" : "Scenario utilization (%)",
        locale === "ja" ? "利用率の変化（ポイント）" : "Utilization change (points)",
        locale === "ja" ? "二次負荷" : "Secondary stress",
      ],
      ...input.network.edges.map((edge): Cell[] => {
        const before = input.baseline.edgeStates[edge.id],
          after = input.current.edgeStates[edge.id];
        const cascade = input.evidence.cascades.find((item) => item.edgeId === edge.id);
        return [
          edge.id,
          edge.name,
          after?.available
            ? locale === "ja"
              ? "利用可能"
              : "Open"
            : locale === "ja"
              ? "閉鎖"
              : "Closed",
          before?.volume ?? 0,
          after?.volume ?? 0,
          (after?.volume ?? 0) - (before?.volume ?? 0),
          (before?.utilization ?? 0) * 100,
          (after?.utilization ?? 0) * 100,
          ((after?.utilization ?? 0) - (before?.utilization ?? 0)) * 100,
          cascade
            ? locale === "ja"
              ? { stable: "安定", elevated: "増加", high: "高負荷", severe: "深刻" }[
                  cascade.classification
                ]
              : cascade.classification
            : locale === "ja"
              ? "閉鎖"
              : "closed",
        ];
      }),
    ];
  else if (kind === "zones")
    rows = [
      [
        "ID",
        text.name,
        `${text.baseline} ${text.travel}`,
        `${text.current} ${text.travel}`,
        `${text.baseline} ${text.access}`,
        `${text.current} ${text.access}`,
        text.loss,
        text.hospital,
        text.station,
        text.disconnected,
        text.exposure,
        text.impact,
      ],
      ...input.evidence.zones.map((zone): Cell[] => [
        zone.id,
        zone.name,
        zone.baseline.travelTime,
        zone.current.travelTime,
        zone.baseline.accessibility,
        zone.current.accessibility,
        zone.accessibilityLoss,
        zone.current.hospitalAccessibility,
        zone.current.stationAccessibility,
        zone.current.disconnectedDemand,
        zone.current.congestionExposure,
        zone.impactScore,
      ]),
    ];
  else if (kind === "facilities")
    rows = [
      [
        "ID",
        text.name,
        locale === "ja" ? "種別" : "Type",
        locale === "ja" ? "時間閾値（分）" : "Threshold (min)",
        locale === "ja" ? "通常時到達率（%）" : "Baseline reach (%)",
        locale === "ja" ? "シナリオ到達率（%）" : "Scenario reach (%)",
        text.loss,
        text.isolated,
      ],
      ...input.evidence.facilities.map((facility): Cell[] => [
        facility.id,
        facility.name,
        facility.type === "hospital"
          ? text.hospital
          : facility.type === "station"
            ? text.station
            : text.shelter,
        facility.threshold,
        facility.baselineReach,
        facility.currentReach,
        facility.loss,
        facility.isolated ? text.yes : text.no,
      ]),
    ];
  else
    rows = [
      [
        text.plan,
        text.restore,
        text.cost,
        text.resilience,
        text.access,
        text.travel,
        text.efficiency,
      ],
      ...(input.recovery?.plans ?? []).map((plan, index): Cell[] => [
        String.fromCharCode(65 + index),
        plan.restoredEdgeIds.map((id) => names.get(id) ?? id).join("; "),
        plan.cost,
        plan.metrics.resilienceScore,
        input.evidence.facilities.length ? plan.metrics.accessibility : "N/A",
        plan.metrics.averageTravelTime,
        plan.metrics.networkEfficiency,
      ]),
    ];
  return spreadsheetSafeCSV(rows);
}

export function exportAnalysisSnapshot(input: DecisionReportInput): string {
  // Export reproducible evidence, never runtime state, API keys, or executable content.
  const network: Network = {
    nodes: input.network.nodes.map(
      ({
        id,
        name,
        latitude,
        longitude,
        type,
        populationWeight,
        demandWeight,
        essentialService,
        district,
      }) => ({
        id,
        name,
        latitude,
        longitude,
        type,
        populationWeight,
        demandWeight,
        essentialService,
        district,
      }),
    ),
    edges: input.network.edges.map(
      ({
        id,
        name,
        source,
        target,
        mode,
        distance,
        freeFlowTime,
        capacity,
        currentVolume,
        available,
        riskLevel,
        infrastructureType,
        bidirectional,
        geometry,
        osm,
      }) => ({
        id,
        name,
        source,
        target,
        mode,
        distance,
        freeFlowTime,
        capacity,
        currentVolume,
        available,
        riskLevel,
        infrastructureType,
        bidirectional,
        geometry: geometry?.map(([lat, lon]) => [lat, lon]),
        ...(osm
          ? {
              osm: {
                wayId: osm.wayId,
                highway: osm.highway,
                speedKmh: osm.speedKmh,
                speedSource: osm.speedSource,
                lanes: osm.lanes,
                lanesSource: osm.lanesSource,
                bridge: osm.bridge,
                tunnel: osm.tunnel,
                oneway: osm.oneway,
              },
            }
          : {}),
      }),
    ),
    accessibilityCategories: input.network.accessibilityCategories
      ? [...input.network.accessibilityCategories]
      : undefined,
  };
  return JSON.stringify(
    {
      schemaVersion: 1,
      modelVersion: decisionConfig.modelVersion,
      createdAt: input.createdAt ?? new Date().toISOString(),
      scenarioName: input.scenarioName,
      networkLabel: input.networkLabel,
      source: input.realCity
        ? "OpenStreetMap infrastructure / modeled mobility"
        : "Synthetic Harbor City",
      bbox: input.bbox,
      modelConfig,
      networkIdentifier: networkIdentifier(network, input.odPairs),
      network,
      odPairs: input.odPairs?.map(({ id, origin, destination, demand, purpose }) => ({
        id,
        origin,
        destination,
        demand,
        purpose,
      })),
      baseline: input.baseline.metrics,
      current: input.current.metrics,
      closedEdgeIds: input.current.closedEdgeIds,
      evidence: input.evidence,
      criticalLinks: input.criticalLinks ?? [],
      recovery: input.recovery,
      uncertainty: input.uncertainty,
      recoverySequence: input.sequence,
      robustRecovery: input.robust,
      limitations: labels.en.caveat,
    },
    (_, value: unknown) => (typeof value === "number" && !Number.isFinite(value) ? null : value),
    2,
  );
}
