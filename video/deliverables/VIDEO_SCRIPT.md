# ResiliRoute — Official ImpactHack Product Film

**Master:** 3:50 / 1920×1080 / 30 fps / H.264 + AAC. English narration at 143 words per voiced minute. English subtitles above Japanese subtitles; both are burned in throughout. All title-card text is English.

493 narrated words. Original quiet ambient score; no external song, siren or explosion effects. Actual app capture is visible for 196 seconds (85% of the film).

## Source evidence

Normal → Earthquake: travel 14.2 → 20.9 min; access 94.4 → 78.9%; efficiency 43.8 → 37.5; congestion delay 11.9 → 29.3%; resilience 100 → 69. Source: actual downloaded `assets/normal-results.json` and `assets/earthquake-results.json`.

Next critical remaining link: Harbor Rail (32.8 impact index). Best independent repair: Harbor Bridge (+16.2 resilience points). Most affected district: East. All OD pairs remain connected; timely access still falls.

## Editing rules

Record the production app in English at 1920×1080, browser scale 100%. Keep the actual cursor visible and move only to relevant controls. Never replace map paths, rankings or app metrics. Crops/light enlargement focus attention; no 3D or dramatic effects. Product content stays above y=858; the caption plate begins at y=888. Scene-boundary fades are 0.18 seconds. Map attribution remains visible in the edit.

## 0:00–0:14 · One failure. Citywide consequences.

**Visual / actual operation:** Actual normal map. At about 0:06, close Harbor Bridge using its real inspector. Change the English hook overlay at 0:09.5.

**Narration and subtitle cues:**

- 0.00–9.52s · English: One failed road, bridge, or rail link can change how an entire city moves, even far from the damaged link.
  Japanese: 道路や橋、鉄道の一本が止まるだけで、離れた場所を含め、都市全体の移動が変わることがあります。

- 9.52–14.00s · English: The impact does not stop at the disruption.
  Japanese: 影響は、寸断された場所だけにはとどまりません。

**Editing:** Retain the actual product state. Align voice to the cue timing; captions begin slightly before speech and continue through the short pause. Do not cover controls with captions.

## 0:14–0:31 · Transportation failures cascade.

**Visual / actual operation:** English cascade diagram: bridge closure → traffic redistribution → essential access loss. Quiet navy title card.

**Narration and subtitle cues:**

- 14.00–22.08s · English: Traffic shifts to other corridors. Congestion grows, journeys take longer, and essential services become harder to reach.
  Japanese: 交通が別の道路に集中し、混雑と移動時間が増え、重要施設に行きにくくなります。

- 22.08–31.00s · English: A local failure can create a much wider problem for communities. Those effects are often hidden by citywide averages.
  Japanese: 一か所の寸断が地域全体の問題になります。その影響は、都市全体の平均値だけでは見えないこともあります。

**Editing:** Retain the actual product state. Align voice to the cue timing; captions begin slightly before speech and continue through the short pause. Do not cover controls with captions.

## 0:31–0:44 · ResiliRoute

**Visual / actual operation:** Existing SVG brand and name on the left; moving actual Harbor City map on the right. No invented city illustration.

**Narration and subtitle cues:**

- 31.00–39.81s · English: I built ResiliRoute to make these cascading effects visible, and help people explore transportation resilience before a disruption happens.
  Japanese: こうした連鎖を見える形にし、災害前に交通網の強さと弱さを考えるために、ResiliRouteを開発しました。

- 39.81–44.00s · English: It is a tool for understanding network vulnerability.
  Japanese: 交通ネットワークの弱点を理解するためのツールです。

**Editing:** Retain the actual product state. Align voice to the cue timing; captions begin slightly before speech and continue through the short pause. Do not cover controls with captions.

## 0:44–1:09 · 01 / Model the city

**Visual / actual operation:** Actual normal-condition map and controls. Inspect Harbor Bridge, then deselect it. Large baseline callouts use the downloaded normal report.

**Narration and subtitle cues:**

- 44.00–51.00s · English: Here is Harbor City: a synthetic demonstration network with twenty-four nodes and forty-two transport links.
  Japanese: これは架空のHarbor Cityです。24個のノードと42本の交通リンクで構成されています。

- 51.00–56.92s · English: Residential areas generate travel demand. Stations, hospitals, shelters, and commercial districts provide destinations.
  Japanese: 住宅地域から交通需要が生まれ、駅、病院、避難所、商業地区などが目的地になります。

- 56.92–63.26s · English: Under normal conditions, the model calculates an average journey of fourteen point two minutes.
  Japanese: 通常時のモデルでは、平均移動時間は14.2分と計算されます。

- 63.26–69.00s · English: Each journey contributes demand to the links it uses, creating network-wide volumes.
  Japanese: 各移動の需要を通過リンクに加え、ネットワーク全体の交通量を計算します。

**Editing:** Retain the actual product state. Align voice to the cue timing; captions begin slightly before speech and continue through the short pause. Do not cover controls with captions.

## 1:09–1:40 · 02 / Disrupt the network

**Visual / actual operation:** Click Run Earthquake Demo. Show real staged closure animation and recalculated KPIs. Keep reference callouts initially; show computed before/after after the disruption. Cut closer to the completed map at 1:18.

**Narration and subtitle cues:**

- 69.00–76.54s · English: Now I run the earthquake demo. Harbor Bridge, a rail connector, and a coastal road become unavailable.
  Japanese: 地震デモを実行します。Harbor Bridge、鉄道の接続区間、海岸沿いの道路が使えなくなります。

- 76.54–83.53s · English: Routes are recalculated, and travel demand is reassigned to the remaining links. The results change immediately.
  Japanese: 残ったリンクで経路を再計算し、交通需要を再配分します。結果もすぐに変わります。

- 83.53–92.61s · English: Average travel time rises to twenty point nine minutes. Essential access falls from ninety-four point four to seventy-eight point nine percent.
  Japanese: 平均移動時間は20.9分に増加。重要施設へのアクセスは94.4%から78.9%へ低下します。

- 92.61–96.24s · English: The map also shows which links are closed.
  Japanese: 地図上でも、閉鎖されたリンクを確認できます。

- 96.24–100.00s · English: These are calculated outputs, not preset disaster scores.
  Japanese: これは固定された災害スコアではなく、実際の計算結果です。

**Editing:** Retain the actual product state. Align voice to the cue timing; captions begin slightly before speech and continue through the short pause. Do not cover controls with captions.

## 1:40–2:04 · 03 / Follow the cascading impact

**Visual / actual operation:** Inspect Port Bypass and its actual volume/capacity values. Deselect it, click Route overlay, and highlight the baseline/scenario hospital route comparison.

**Narration and subtitle cues:**

- 100.00–110.15s · English: The affected traffic does not simply disappear. On Port Bypass, demand increases from about four hundred to over three thousand trips per hour.
  Japanese: 影響を受けた交通は消えません。Port Bypassでは、毎時約400の需要が3,000以上へ増えます。

- 110.15–117.62s · English: This alternative corridor becomes overloaded. Comparing routes shows how the same hospital journey becomes a longer detour.
  Japanese: 代替道路が容量を超えます。経路を比較すると、同じ病院への移動にも長い迂回が必要になります。

- 117.62–124.00s · English: Orange corridors highlight demand at or above capacity, revealing bottlenecks beyond the original closure.
  Japanese: オレンジの線は需要が容量以上の区間です。元の寸断地点以外のボトルネックも見えます。

**Editing:** Retain the actual product state. Align voice to the cue timing; captions begin slightly before speech and continue through the short pause. Do not cover controls with captions.

## 2:04–2:27 · 04 / Measure the system impact

**Visual / actual operation:** Actual before/after charts and district accessibility. Hover a chart, then open View district travel time & isolation.

**Narration and subtitle cues:**

- 124.00–131.63s · English: The dashboard compares travel time, congestion, accessibility, network efficiency, and resilience before and after the disruption.
  Japanese: ダッシュボードで、移動時間、混雑、アクセス、ネットワーク効率、レジリエンスの変化を比較できます。

- 131.63–140.21s · English: Resilience falls from a baseline of one hundred to sixty-nine. Every indicator has a published definition in the methodology.
  Japanese: 通常時を100とするレジリエンスは69へ低下します。各指標の定義はMethodologyで確認できます。

- 140.21–147.00s · English: Accessibility measures population-weighted access to hospitals, shelters, and stations within their specified travel-time thresholds.
  Japanese: アクセシビリティは、病院・避難所・駅へ所定の時間内に行ける割合を、人口で重み付けした指標です。

**Editing:** Retain the actual product state. Align voice to the cue timing; captions begin slightly before speech and continue through the short pause. Do not cover controls with captions.

## 2:27–2:50 · 05 / Stress-test. Prioritize. Recover.

**Visual / actual operation:** Click Analyze all available links. Click the top Harbor Rail ranking row; the app scrolls to and highlights that link. Return to ranking/recovery and hover Restore Harbor Bridge without changing the scenario.

**Narration and subtitle cues:**

- 147.00–156.31s · English: The stress test removes each available link individually, reruns the simulation, and ranks its additional impact on the current scenario.
  Japanese: 使用可能なリンクを一本ずつ取り除いて再計算し、現在の状況に加わる影響を順位付けします。

- 156.31–164.89s · English: Harbor Rail is now the most critical remaining link. Separately, restoring Harbor Bridge offers the largest modeled recovery benefit.
  Japanese: 残ったリンクで最も重要なのはHarbor Railです。一方、一本だけ復旧するならHarbor Bridgeの効果が最大です。

- 164.89–170.00s · English: The ranking measures modeled consequences, not the probability of failure.
  Japanese: 順位が表すのは、モデル上の影響であり、寸断が起きる確率ではありません。

**Editing:** Retain the actual product state. Align voice to the cue timing; captions begin slightly before speech and continue through the short pause. Do not cover controls with captions.

## 2:50–3:10 · 06 / Look beyond the citywide average

**Visual / actual operation:** Actual most-affected East district insight and expanded district table. Scroll to the essential-services panel showing Emergency Hospital access 61.4% → 27.0%.

**Narration and subtitle cues:**

- 170.00–179.97s · English: The East district is hit hardest. Its average travel time almost doubles, while essential access drops from one hundred to sixty-seven percent.
  Japanese: 最も影響を受けるのはEast地区です。平均移動時間がほぼ倍増し、重要施設へのアクセスは100%から67%へ下がります。

- 179.97–185.91s · English: The hospital analysis reveals which communities lose access within the model's travel-time threshold.
  Japanese: 病院の分析では、モデルの時間基準内に到達できなくなる地域への影響が見えます。

- 185.91–190.00s · English: Mobility resilience is also an issue of equity.
  Japanese: 交通網のレジリエンスは、地域間の公平性にも関わる問題です。

**Editing:** Retain the actual product state. Align voice to the cue timing; captions begin slightly before speech and continue through the short pause. Do not cover controls with captions.

## 3:10–3:33 · 07 / Turn evidence into a planning brief

**Visual / actual operation:** Actual AI Resilience Brief in local-analysis mode. First crop the summary, evidence and explanation cards; then crop the possible actions and limitations. Do not imply that a live LLM was called.

**Narration and subtitle cues:**

- 190.00–199.31s · English: The resilience analyst turns structured simulation evidence into a concise brief: what changed, why it matters, and possible planning actions.
  Japanese: 分析機能が、構造化した計算結果を、変化の内容、重要性、考えられる対応策の短いレポートにまとめます。

- 199.31–207.89s · English: This demo uses the deterministic local analyst. An optional server-side language model uses the same evidence, with automatic fallback.
  Japanese: このデモは決定論的なローカル分析です。同じ根拠を使うサーバー側のLLMにも接続でき、失敗時は自動で切り替わります。

- 207.89–213.00s · English: The language model explains results; it does not calculate them.
  Japanese: LLMの役割は結果の説明です。数値の計算はシミュレーターが行います。

**Editing:** Retain the actual product state. Align voice to the cue timing; captions begin slightly before speech and continue through the short pause. Do not cover controls with captions.

## 3:33–3:45 · From network to understanding

**Visual / actual operation:** Six native architecture blocks highlight sequentially every two seconds: network model, shortest path, demand assignment, congestion, accessibility, evidence-based brief.

**Narration and subtitle cues:**

- 213.00–218.58s · English: Graph routing, demand assignment, congestion modeling, and accessibility analysis drive the results.
  Japanese: グラフ探索、需要配分、混雑モデル、アクセス分析が結果を生みます。

- 218.58–225.00s · English: All computations use transparent, documented rules. This educational prototype supports understanding, not emergency navigation.
  Japanese: 計算には公開した明確なルールを使います。防災教育と理解のための試作で、緊急時の案内ではありません。

**Editing:** Retain the actual product state. Align voice to the cue timing; captions begin slightly before speech and continue through the short pause. Do not cover controls with captions.

## 3:45–3:50 · Understand disruption before it happens.

**Visual / actual operation:** English brand/end card. Last narration finishes before the final fade. End precisely at 3:50.

**Narration and subtitle cues:**

- 225.00–230.00s · English: ResiliRoute. Helping communities understand disruption before it happens.
  Japanese: ResiliRoute。災害が起こる前に、地域が交通網への影響を理解するために。

**Editing:** Retain the actual product state. Align voice to the cue timing; captions begin slightly before speech and continue through the short pause. Do not cover controls with captions.

## Submission notes

The local analyst is deterministic; the optional language model is server-side and has automatic local fallback. The film uses synthetic mobility data and a simplified traffic model. This is educational decision support, not official emergency guidance or verified safe navigation.

Use `THUMBNAIL.png` for the video/Devpost cover. Upload the MP4 as the demo. Separate SRTs and this script are supplied for accessibility and future editing.
