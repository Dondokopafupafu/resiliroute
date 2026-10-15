"use client";
import { useLocale } from "./locale-provider";

export function DecisionMethodology() {
  const { locale } = useLocale();
  const w = (en: string, ja: string) => (locale === "ja" ? ja : en);
  return (
    <>
      <article>
        <h3>{w("09 · Compare, recover, and explain", "09 · 比較・復旧・説明")}</h3>
        <p>
          {w(
            "The decision workspace reuses the same routing, assignment and metrics for every closure set. Saved scenarios are bound to a fingerprint of the complete network, demand and model configuration. Imported metrics are discarded and recomputed. Severity ordering is 100 minus Resilience Score.",
            "意思決定ワークスペースは、すべての閉鎖組み合わせに同じ経路探索・需要配分・指標計算を使います。保存シナリオはネットワーク・需要・モデル設定の識別値と結び付けます。読み込んだ指標は信用せず再計算します。深刻度は100からレジリエンススコアを引いた値です。",
          )}
        </p>
        <p>
          {w(
            "Recovery costs are editable relative scores from 1 to 5, not financial costs. The optimizer evaluates all affordable subsets through 12 closures for networks of at most 80 edges, 8 closures through 200 edges, and 6 closures on larger networks. Otherwise a bounded beam search returns the best tested plans; its result is explicitly approximate. A plan can contain no restoration when nothing affordable improves the objective.",
            "復旧コストは1〜5の変更可能な相対スコアであり、金額ではありません。80リンク以下では閉鎖12本まで、200リンク以下では8本まで、それ以上では6本まで、予算内の全組み合わせを評価します。それを超える場合は回数制限付きビーム探索で検証した案を比較し、近似であることを表示します。予算内で目的指標が改善しない場合、復旧しない案が選ばれることもあります。",
          )}
        </p>
        <code>Balanced = 0.40 R + 0.30 A + 0.20 T + 0.10 E</code>
        <p>
          {w(
            "R is resilience divided by 100; A is accessibility divided by 100; E is efficiency retention; T is baseline/current travel time. All four terms are capped to [0,1]. These are explicit preferences and are correlated, not independent dimensions. Single-objective choices directly rank their metric. Top plans are distinct repair sets. Sequence optimization maximizes cumulative resilience through the selected repairs using subset dynamic programming up to 8 repairs; larger sets use a disclosed greedy sequence. Stages do not predict repair days.",
            "Rはレジリエンスを100で割った値、Aはアクセス率を100で割った値、Eは効率の維持率、Tは通常時／現在の移動時間です。各項は0〜1に制限します。これらは相関する指標への明示的な選好重みであり、独立な評価軸ではありません。単一目的ではその指標を直接比較します。上位案は異なる復旧集合です。復旧順序は8本までは部分集合の動的計画法で累積レジリエンスを最大化し、それを超える場合は貪欲法であることを明示します。段階は工事日数の予測ではありません。",
          )}
        </p>
      </article>
      <article>
        <h3>{w("10 · Distribution of impact", "10 · 影響の地域差")}</h3>
        <p>
          {w(
            "Harbor City uses its existing districts. Real City analysis uses four equal spatial zones, with empty zones omitted; these are not administrative or demographic regions. Facility catchments use the existing category thresholds and modeled origin weights. Missing facility categories are unavailable, rather than evidence of zero real-world access.",
            "ハーバーシティでは既存の地区を使います。実都市は範囲を等分した4ゾーンを使い、起点のないゾーンを省略します。行政区や人口統計の地域ではありません。施設アクセスは既存の時間しきい値とモデル起点の重みで計算します。施設カテゴリがない場合は利用不可とし、現実のアクセスがゼロであるとは解釈しません。",
          )}
        </p>
        <code>
          Zone impact = 0.50 access loss + 0.30 relative time loss + 0.20 extra disconnected share
        </code>
        <p>
          {w(
            "Access loss is in points; relative time loss is capped at 100 percent; disconnected share is in percent. Negative losses count as zero. The impact gap is the maximum minus minimum zone score. Accessibility disparity is the spread of nonnegative access losses. These diagnostics are not validated social-equity indices. Cascading stress uses the change in v/c in percentage points: below 10 stable, 10–30 elevated, 30–60 high, 60 or more severe. It does not simulate physical secondary failure. Criticality colors normalize the unchanged criticality scores against the highest tested score; untested links remain visibly untested.",
            "アクセス損失はポイント、相対移動時間増加は最大100%、追加の到達不能需要割合は%で表し、改善は損失ゼロとします。影響格差はゾーンスコアの最大と最小の差、アクセス格差は非負のアクセス損失のばらつきです。学術的に検証された公平性指標ではありません。波及負荷はv/cの増分をポイントで示し、10未満は安定、10〜30は上昇、30〜60は高、60以上は著しい増加です。物理的な二次損傷は予測しません。重要度の色は既存スコアを解析済み最大値で正規化し、未解析リンクは区別します。",
          )}
        </p>
      </article>
      <article>
        <h3>{w("11 · Uncertainty and robust comparisons", "11 · 不確実性と頑健な比較")}</h3>
        <p>
          {w(
            "A seeded Monte Carlo experiment independently samples each user-defined link-failure probability and reruns the shared simulation. These probabilities are assumptions, not predicted hazards. Up to 1,000 runs are supported on small networks, 300 on medium networks, and 100 above 200 edges. Percentiles describe this experiment, not confidence intervals about real traffic. A worker reports actual completed runs and can be terminated with Cancel.",
            "シード付きモンテカルロ実験で、ユーザー指定のリンク閉鎖確率を独立に標本化し、共通シミュレーションを再実行します。確率は仮定であり、災害予測ではありません。小規模ネットワークで最大1,000回、中規模で300回、200リンク超で100回を実行できます。パーセンタイルは実験内の分布であり、実交通に対する信頼区間ではありません。ワーカーは実際の完了回数を表示し、キャンセルで停止できます。",
          )}
        </p>
        <p>
          {w(
            "Robust comparison reevaluates the shortlisted recovery plans on the same random draws. Restored links are assumed protected during these draws, explicitly as a user assumption. Plans can be sorted by mean or worst sampled resilience. This compares the shortlist; it is not a globally optimal robust strategy, and the sampled worst case is not a guarantee.",
            "頑健性比較では、候補復旧案を同一の乱数標本で再評価します。標本中の復旧リンクは保護されたものと仮定し、その前提を明示します。平均または標本内の最悪レジリエンスで並べ替えます。候補案間の比較であり、全体の頑健な最適解や最悪ケースの保証ではありません。",
          )}
        </p>
      </article>
    </>
  );
}
