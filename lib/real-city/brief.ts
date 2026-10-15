import type { AIAnalysis, AnalysisContext } from "@/types/analysis";
import type { Locale } from "@/lib/i18n/messages";

export function generateRealCityBrief(context: AnalysisContext, locale: Locale): AIAnalysis {
  const {
    baseline: before,
    current: after,
    bestRecovery: repair,
    criticalInfrastructure: critical,
    redistributedLink: flow,
    realCityEvidence: evidence,
  } = context;
  const f = (n: number) => n.toFixed(1);
  const access = !!evidence?.serviceCategories.length;
  const origin = evidence?.mostAffectedOrigin;
  if (locale === "ja")
    return {
      summary: context.closedEdges.length
        ? `${context.closedEdges.length}本の実道路を仮想閉鎖。平均移動時間は${f(before.averageTravelTime)}分から${f(after.averageTravelTime)}分に変化しました。`
        : "実在する道路形状に合成需要を重ねた基準モデルです。道路を選び、閉鎖の波及効果を試してください。",
      mainImpact: `${access ? `取得できた施設カテゴリへのアクセスは${f(before.accessibility)}%から${f(after.accessibility)}%に変化。` : "重要施設カテゴリが取得できていないため、アクセス分析は対象データなしです。"}到達できない合成需要は${f(after.disconnectedDemand)}モデル単位/時間です。`,
      whyItMatters: flow
        ? `${flow.name}のモデル交通量が${f(flow.before)}から${f(flow.after)}に変化。推定容量に対する利用率は${f(flow.utilization * 100)}%です。迂回の影響が閉鎖地点以外にも波及しています。`
        : "道路の閉鎖効果は合成需要と選択範囲に依存します。平均値の変化が小さくても、個別経路や施設のアクセスを確認する必要があります。",
      mostAffectedArea:
        origin && context.closedEdges.length
          ? `${origin.name}の平均モデル移動時間は${f(origin.travelTimeBefore)}分から${f(origin.travelTimeAfter)}分に変化しました。これは道路から選んだ需要地点であり、実人口や地域の属性を示すものではありません。`
          : "需要地点は住宅道路の空間サンプリングで生成します。地域区分は矩形内の方角による分析セクターです。",
      criticalInfrastructure: critical
        ? `${critical.name}が解析対象の中で最も高い追加影響を示しました。${evidence?.candidateScreening ? "候補道路だけを詳細解析しているため、全道路の順位ではありません。" : "全利用可能道路を一本ずつ仮想閉鎖した結果です。"}損傷確率や道路の安全性は推定していません。`
        : "追加の利用可能道路がないため、ストレステスト対象がありません。",
      recommendedActions: [
        repair
          ? `${repair.name}の復旧で、モデル上のレジリエンスは${f(repair.resilienceGain)}ポイント変化します。実際の復旧費用・作業時間は含まれていません。`
          : critical
            ? `${critical.name}の閉鎖を試し、代替経路と施設アクセスの変化を比較してください。`
            : "まず閉鎖状態とネットワーク接続を確認してください。",
        "範囲の境界を変え、範囲外の迂回路を含めた結果と比較してください。",
        "計画への利用前に、交通需要・容量・施設情報を検証済みの地域データで確認してください。",
      ],
      limitations:
        "道路・施設はOpenStreetMap、交通需要は合成、容量と一部速度は推定です。施設への接続も近隣道路ノードへの簡易モデルです。リアルタイム情報・損傷予測・避難誘導ではありません。実際の緊急時は公式情報に従ってください。",
    };
  return {
    summary: context.closedEdges.length
      ? `${context.closedEdges.length} real-road what-if closures change average modeled travel time from ${f(before.averageTravelTime)} to ${f(after.averageTravelTime)} minutes.`
      : "Real infrastructure geometry meets synthetic demand. Select a road and test how its closure changes the modeled network.",
    mainImpact: `${access ? `Access to the imported service categories changes from ${f(before.accessibility)}% to ${f(after.accessibility)}%.` : "Essential-service accessibility is unavailable: no supported facilities were connected."} Disconnected synthetic demand is ${f(after.disconnectedDemand)} modeled units per hour.`,
    whyItMatters: flow
      ? `Modeled flow on ${flow.name} changes from ${f(flow.before)} to ${f(flow.after)}. Utilization reaches ${f(flow.utilization * 100)}% of estimated capacity. Rerouting carries the impact beyond the closed road.`
      : "Closure effects depend on the synthetic demand and selected boundary. Inspect individual routes and facility access even when aggregate changes are small.",
    mostAffectedArea:
      origin && context.closedEdges.length
        ? `${origin.name} has the largest increase in demand-weighted trip time, from ${f(origin.travelTimeBefore)} to ${f(origin.travelTimeAfter)} minutes. This sampled origin does not represent observed population or demographic characteristics.`
        : "Origins are spatial samples of residential roads. District labels represent directional sectors of the selected rectangle, not administrative communities.",
    criticalInfrastructure: critical
      ? `${critical.name} has the largest additional modeled impact among tested roads. ${evidence?.candidateScreening ? "Only screened candidates were fully tested; this is not an exhaustive ranking." : "Every available road was individually stress-tested."} No failure probability or road safety is inferred.`
      : "No available roads remain for the next-link stress test.",
    recommendedActions: [
      repair
        ? `Consider comparing restoration of ${repair.name}: modeled resilience changes by ${f(repair.resilienceGain)} points. Actual repair costs and duration are not modeled.`
        : critical
          ? `Test a closure of ${critical.name} and compare alternate routes and facility access.`
          : "Review closures and network connectivity first.",
      "Compare a wider selection to test sensitivity to omitted routes outside the boundary.",
      "Validate demand, capacity and facility coverage with local evidence before using results for planning.",
    ],
    limitations:
      "OSM supplies geometry and facilities; demand is synthetic, capacity and some speeds are estimated. Facility access uses nearest-node modeled connectors. No real-time observations, damage prediction or emergency directions. Follow official guidance in an emergency.",
  };
}
