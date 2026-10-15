import { translate } from "@/lib/i18n/messages";
import type { AIAnalysis, AnalysisContext } from "@/types/analysis";

const f = (value: number) => value.toFixed(1);
const count = (value: number) => Math.round(value).toLocaleString("ja-JP");
const name = (value: string) => translate("ja", value);

// Uses the same measured evidence and branches as the English local analyst.
// Translation changes presentation only, never simulation inputs or metrics.
export function generateJapaneseAnalysis(context: AnalysisContext): AIAnalysis {
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
      ? "つながっている都市にも弱点があります。障害を加えて、局所的な停止がハーバーシティ全体にどう波及するかを確認しましょう。"
      : changed
        ? `${context.closedEdges.length}リンクの閉鎖が、都市全体の移動に影響しています。モデル上の平均移動時間は${f(before.averageTravelTime)}分から${f(after.averageTravelTime)}分へ${after.averageTravelTime >= before.averageTravelTime ? "増加" : "減少"}しました。`
        : "今回の閉鎖による都市全体への影響は、モデル上では小さい結果です。ただし、特定の施設や経路は影響を受ける場合があります。",
    mainImpact: disrupted
      ? `重要施設へのアクセスは${f(before.accessibility)}%から${f(after.accessibility)}%へ変化しました。${after.disconnectedDemand > 0 ? `モデル上の毎時${count(after.disconnectedDemand)}人トリップが到達不能です。` : "すべてのODペアは接続されていますが、つながっているだけでは時間内の到達を保証できません。"}`
      : `通常時のネットワークは、モデル上の毎時${count(before.totalDemand)}人トリップを扱います。アクセスは${f(before.accessibility)}%、レジリエンスは通常時を基準とする定義により100です。`,
    whyItMatters: redistribution
      ? `交通需要が${name(redistribution.name)}へ移り、毎時${count(redistribution.before)}から${count(redistribution.after)}人トリップへ増加しています。容量利用率は${count(redistribution.utilization * 100)}%です。${service ? `${name(service.name)}では、${service.threshold}分以内に到達できる人口の割合が${f(service.before - service.after)}ポイント低下しました。` : "残りの幹線が迂回需要を引き受け、閉鎖箇所以外にも影響が広がります。"}`
      : disrupted
        ? "残る接続が交通需要を受け持ちます。都市全体の平均が少ししか変わらなくても、地域別アクセスや個別の経路を確認する必要があります。"
        : "次の1リンクが失われると、どこで追加の影響が最大になるかを障害テストで計算します。通常の経路検索では見えない弱点を把握できます。",
    mostAffectedArea:
      disrupted && changed
        ? `${name(district.name)}は、移動時間増加・アクセス低下・到達不能需要を合成した影響が最大の地域です。平均移動時間は${f(district.travelTimeBefore)}分から${f(district.travelTimeAfter)}分へ変化しました。`
        : disrupted
          ? "都市全体の変化は小さい結果です。地域別の数値も確認し、平均値に表れない影響を検討してください。"
          : "通常時には障害による影響はありません。リンクを閉鎖すると、地域ごとの不均等な影響を比較できます。",
    criticalInfrastructure: critical
      ? `${name(critical.name)}は、現在利用可能なリンクの障害テストで最上位です。これを除去すると、都市全体の平均移動時間は${f(Math.abs(critical.travelTimeIncrease))}分${critical.travelTimeIncrease >= 0 ? "増加" : "減少"}し、アクセスは${f(Math.abs(critical.accessibilityLoss))}ポイント${critical.accessibilityLoss >= 0 ? "低下" : "改善"}します。`
      : "現在のネットワークには、障害テストの対象となる利用可能なリンクがありません。",
    recommendedActions: bestRecovery
      ? [
          `まず${name(bestRecovery.name)}の復旧を検討できます。モデル上のレジリエンスは${f(bestRecovery.resilienceGain)}ポイント、アクセスは${f(bestRecovery.accessibilityGain)}ポイント改善します。`,
          redistribution
            ? `${name(redistribution.name)}の一時的な容量拡大や需要管理を検討し、入力を変更して再計算してください。`
            : "一時的な容量拡大や需要管理を検討する前に、地域別の影響を比較してください。",
          service
            ? `${name(service.name)}へのアクセス低下を、地域の計画担当者と検証済みのインフラデータで調べてください。`
            : "重要施設へのアクセスを、地域の計画担当者と検証済みのインフラデータで確認してください。",
        ]
      : [
          critical
            ? `モデル上の1リンク障害で最上位の${name(critical.name)}について、代替策を検討できます。`
            : "追加の障害を比較する前に、ネットワークの接続を回復させてください。",
          "洪水や鉄道障害のシナリオを実行し、異なる障害パターンを比較してください。",
          "計画判断に使う前に、架空の入力を検証済みの地域の需要・容量データに置き換えてください。",
        ],
    limitations:
      "架空データと固定回数の簡易交通モデルによる分析です。検討可能な計画上の対応策であり、検証済みの緊急時の指示ではありません。実際の緊急時は自治体などの公式情報に従ってください。",
  };
}

export function japaneseContext(context: AnalysisContext): AnalysisContext {
  return {
    ...context,
    scenario: name(context.scenario),
    closedEdges: context.closedEdges.map(name),
    mostAffectedDistrict: {
      ...context.mostAffectedDistrict,
      name: name(context.mostAffectedDistrict.name),
    },
    affectedServices: context.affectedServices.map((service) => ({
      ...service,
      name: name(service.name),
    })),
    criticalInfrastructure: context.criticalInfrastructure
      ? { ...context.criticalInfrastructure, name: name(context.criticalInfrastructure.name) }
      : null,
    redistributedLink: context.redistributedLink
      ? { ...context.redistributedLink, name: name(context.redistributedLink.name) }
      : null,
    bestRecovery: context.bestRecovery
      ? { ...context.bestRecovery, name: name(context.bestRecovery.name) }
      : null,
  };
}
