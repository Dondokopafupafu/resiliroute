# ResiliRoute — Creator Colosseum Pitch & Demo

**Master:** 04:54 · 1920×1080 · 30fps · H.264/AAC · 611 English narrated words at 140 words per voiced minute.

Actual app footage: 255/294 seconds (86.7%). Harbor City: 12 seconds; Real City Lab: 243 seconds. English above Japanese captions, in a separate lower strip. Original ambient score approximately 19 dB below speech.

## Verified implementation and case selection

The filmed production application implements two modes, OSM server import, simplified road graphs with detailed geometry, one-way routing, modeled OD demand, 24-step assignment, bounded BPR costs, essential access, efficiency/resilience, candidate stress tests, independent recoveries, local/optional LLM briefs, bilingual UI and network snapshots.

Okayama was chosen because the captured bounds contain a river crossing, real hospitals, a legible road network and measurable detours. The 2.75 km² model has 687 road decision nodes, 983 road segments, 18 modeled origins and 54 OD pairs. Station/shelter categories are absent and are not invented.

Bridge: 相生橋 · OSM way 83697074. Network travel: 2.8 → 3.4 min. Resilience: 100 → 91. Medical journey: 4.4 → 7.2 min.

Alternative-road flow: 595 → 3010 modeled units/hour. With two closures: access 95.9%, resilience 74. Leading independent repair adds 17.4 resilience and 4.1 access points.

The live import is shown once; later takes import the captured actual OSM snapshot through the product interface. No API response, metric, label or graph geometry is mocked for this film. The cursor/rings are capture overlays at actual pointer positions. Crops and cuts remove waiting; the footage is not sped up.

## Timeline, narration, subtitles and shot list

### 00:00–00:25 · One link. Citywide consequences.

**Screen action:** Actual Okayama map; inspect the real bridge, close it, and reveal recomputed KPIs. The opening question is visible immediately.

**Editing:** Cuts and 0.18-second fades only. Keep product content above y=858; captions start below y=888. All numerical callouts are read from the survey evidence. On-screen slides are English; actual OSM proper names retain their source spelling.

**0.00–6.27s**

English narration/subtitle: A city can depend on one bridge, one road, or one rail connection.

Japanese subtitle: 都市の移動は、一本の橋や道路、鉄道の接続に支えられていることがあります。

**6.27–17.45s**

English narration/subtitle: When that link fails, the question reaches beyond a line on the map. The effects can travel further. One local failure can have system-wide consequences.

Japanese subtitle: 接続が失われると、問題は地図上の一本の線を越えます。一か所の寸断が、離れた場所を含む交通網全体へ広がります。

**17.45–25.00s**

English narration/subtitle: How does the entire network change, and who loses access? That is the question behind ResiliRoute.

Japanese subtitle: 交通網全体がどう変わり、誰が移動しにくくなるのか。それがResiliRouteの問いです。

### 00:25–00:55 · Failures cascade through a network.

**Screen action:** 12-second cascade diagram, then actual rerouting footage. Describe possible effects, without claiming every citywide congestion average increases.

**Editing:** Cuts and 0.18-second fades only. Keep product content above y=858; captions start below y=888. All numerical callouts are read from the survey evidence. On-screen slides are English; actual OSM proper names retain their source spelling.

**25.00–33.79s**

English narration/subtitle: A single closure can push trips onto other corridors. A road that was lightly used can become a bottleneck.

Japanese subtitle: 一本の道路が閉じると交通が別の道路へ移り、空いていた道路がボトルネックになることがあります。

**33.79–42.79s**

English narration/subtitle: Some journeys become longer. Others become impossible within the modeled network. Access to hospitals and essential services can become uneven.

Japanese subtitle: 移動時間が延びたり、モデル内では到達できなくなったりします。病院などへのアクセスにも差が生まれます。

**42.79–49.64s**

English narration/subtitle: A normal map shows the missing road, but makes these cascading consequences difficult to see.

Japanese subtitle: 普通の地図で閉鎖箇所は分かっても、連鎖する影響は見えにくいものです。

**49.64–55.00s**

English narration/subtitle: That makes communicating infrastructure vulnerability a challenge, especially for essential-service access.

Japanese subtitle: 交通網の弱点、特に重要施設へのアクセス低下を伝えるのは容易ではありません。

### 00:55–01:20 · ResiliRoute / Urban Mobility Resilience Simulator

**Screen action:** 12 seconds of the working Harbor City earthquake demo, then the Real City Lab welcome interface. Both are the same application.

**Editing:** Cuts and 0.18-second fades only. Keep product content above y=858; captions start below y=888. All numerical callouts are read from the survey evidence. On-screen slides are English; actual OSM proper names retain their source spelling.

**55.00–60.83s**

English narration/subtitle: I built ResiliRoute, an urban mobility resilience simulator, to explore those consequences.

Japanese subtitle: こうした影響を調べるために、都市交通レジリエンスシミュレーターResiliRouteを開発しました。

**60.83–68.14s**

English narration/subtitle: It calculates changes in travel time, access, congestion, efficiency, and resilience when transport links become unavailable.

Japanese subtitle: 交通リンクが使えなくなったとき、移動時間、アクセス、混雑、効率、レジリエンスの変化を計算します。

**68.14–71.17s**

English narration/subtitle: Harbor City provides a controlled demonstration.

Japanese subtitle: Harbor Cityは、再現性のある架空都市デモです。

**71.17–80.00s**

English narration/subtitle: Real City Lab extends the same simulation engine to real infrastructure, using OpenStreetMap. Routes and demand are recalculated, together.

Japanese subtitle: 実都市ラボでは同じエンジンでOSMの実在道路を使い、経路と需要を再計算します。

### 01:20–01:36 · 01 / Select a real urban area

**Screen action:** Demonstrate two-corner selection on the map and choosing the Okayama example. The following build uses the named example bounds, not the provisional rectangle.

**Editing:** Cuts and 0.18-second fades only. Keep product content above y=858; captions start below y=888. All numerical callouts are read from the survey evidence. On-screen slides are English; actual OSM proper names retain their source spelling.

**80.00–87.36s**

English narration/subtitle: Here, I select a small area of Okayama in Japan. Both riverbanks are included.

Japanese subtitle: ここでは岡山の小さな範囲を選び、川の両岸を含めます。

**87.36–96.00s**

English narration/subtitle: Users can draw two corners on the map, adjust the bounds, or start from an example area.

Japanese subtitle: 地図上の二つの角を指定したり、範囲を調整したり、サンプル範囲から始めたりできます。

### 01:36–01:52 · 02 / Build the mobility network

**Screen action:** Click Build Mobility Network. A real, successful uncached server request is recorded. Cut a portion of the wait, then show the actual imported graph. Large input-count callouts come from the exported snapshot.

**Editing:** Cuts and 0.18-second fades only. Keep product content above y=858; captions start below y=888. All numerical callouts are read from the survey evidence. On-screen slides are English; actual OSM proper names retain their source spelling.

**96.00–103.79s**

English narration/subtitle: Build Mobility Network retrieves roads and facilities through the server. Geometry is preserved along each road.

Japanese subtitle: ネットワーク構築ボタンでサーバー経由で道路と施設を取得し、各道路の形状を保ちます。

**103.79–112.00s**

English narration/subtitle: This area produces six hundred eighty-seven intersections, nine hundred eighty-three road segments, and eighteen modeled residential origins.

Japanese subtitle: この範囲から687の交差点、983の道路区間、18のモデル需要地点を作成します。

### 01:52–02:08 · 03 / Close a real road

**Screen action:** Click the actual bridge SVG path, inspect its real name and OSM ID, then click Simulate closure. Reveal measured before/after callouts only in the results cut.

**Editing:** Cuts and 0.18-second fades only. Keep product content above y=858; captions start below y=888. All numerical callouts are read from the survey evidence. On-screen slides are English; actual OSM proper names retain their source spelling.

**112.00–119.79s**

English narration/subtitle: Now I select this real river crossing and simulate its closure. Closed links carry zero modeled flow.

Japanese subtitle: 実在する川の橋を選んで閉鎖をシミュレーションします。閉鎖区間のモデル交通量はゼロになります。

**119.79–128.00s**

English narration/subtitle: Average modeled travel time rises from two point eight to three point four minutes. Resilience falls to ninety-one.

Japanese subtitle: 平均モデル移動時間は2.8分から3.4分へ増え、レジリエンスは91に下がります。

### 02:08–02:24 · 04 / Follow the rerouting

**Screen action:** Compare the modeled residential origin and Kawasaki Medical School General Medical Center destination. Gray dashed baseline and solid navy scenario paths. Verify the actual UI says 4.4 → 7.2 minutes.

**Editing:** Cuts and 0.18-second fades only. Keep product content above y=858; captions start below y=888. All numerical callouts are read from the survey evidence. On-screen slides are English; actual OSM proper names retain their source spelling.

**128.00–136.43s**

English narration/subtitle: The same hospital journey now takes seven point two minutes instead of four point four.

Japanese subtitle: 同じ病院への経路は、4.4分から7.2分へ延びます。

**136.43–144.00s**

English narration/subtitle: Traffic has moved to alternative corridors, creating consequences well beyond the closed bridge.

Japanese subtitle: 交通が代替経路へ移り、閉鎖した橋以外にも影響が広がっています。

### 02:24–02:36 · 05 / Look beyond the citywide average

**Screen action:** Inspect the actual alternative road and its modeled flow, then show district/access charts. The local increase is real although the citywide congestion index decreases.

**Editing:** Cuts and 0.18-second fades only. Keep product content above y=858; captions start below y=888. All numerical callouts are read from the survey evidence. On-screen slides are English; actual OSM proper names retain their source spelling.

**144.00–151.93s**

English narration/subtitle: One alternative road carries about three thousand modeled trips per hour, up from roughly six hundred.

Japanese subtitle: ある代替道路の毎時モデル需要は、約600から約3,000へ増えています。

**151.93–156.00s**

English narration/subtitle: Overall averages can hide this concentrated pressure.

Japanese subtitle: 都市全体の平均値だけでは、この局所的な負荷を見落とします。

### 02:36–02:52 · 06 / Stress-test critical infrastructure

**Screen action:** Show the screened critical-road ranking and click its top row to highlight the actual road on the map. A 35-candidate screen is disclosed, not presented as exhaustive.

**Editing:** Cuts and 0.18-second fades only. Keep product content above y=858; captions start below y=888. All numerical callouts are read from the survey evidence. On-screen slides are English; actual OSM proper names retain their source spelling.

**156.00–164.21s**

English narration/subtitle: The stress test removes candidate roads individually and recalculates their additional impact. Scores measure consequences, not failure probabilities.

Japanese subtitle: 候補道路を一本ずつ取り除いて追加の影響を計算します。スコアは影響の大きさであり、被害の発生確率ではありません。

**164.21–172.00s**

English narration/subtitle: For this larger network, thirty-five candidates are screened, rather than claiming an exhaustive ranking of every road.

Japanese subtitle: この規模では35本の候補を絞って解析します。すべての道路を網羅した順位ではありません。

### 02:52–03:12 · 07 / Compare recovery priorities

**Screen action:** Close the top additional road, compare two independent one-road repairs, then click the leading restoration. Show 95.9% access and the computed +17.4 resilience/+4.1 access gains.

**Editing:** Cuts and 0.18-second fades only. Keep product content above y=858; captions start below y=888. All numerical callouts are read from the survey evidence. On-screen slides are English; actual OSM proper names retain their source spelling.

**172.00–177.73s**

English narration/subtitle: After a second closure, essential-service access falls to ninety-five point nine percent.

Japanese subtitle: 二本目を閉鎖すると、重要施設へのアクセスは95.9%に下がります。

**177.73–184.98s**

English narration/subtitle: Recovery analysis compares reopening each road independently. These gains are comparisons, not a combined repair plan.

Japanese subtitle: 各道路を一本ずつ再開した効果を比較します。独立した比較であり、複数道路をまとめた復旧計画ではありません。

**184.98–192.00s**

English narration/subtitle: The leading restoration recovers seventeen point four resilience points, and four point one access points.

Japanese subtitle: 最も効果の大きい復旧で、レジリエンスは17.4ポイント、アクセスは4.1ポイント回復します。

### 03:12–03:35 · A transparent simulation pipeline

**Screen action:** Ten seconds of the eight-stage architecture diagram, followed by the real Methodology dialog. Display the verified 63 unit tests and 42 desktop/mobile browser checks.

**Editing:** Cuts and 0.18-second fades only. Keep product content above y=858; captions start below y=888. All numerical callouts are read from the survey evidence. On-screen slides are English; actual OSM proper names retain their source spelling.

**192.00–201.32s**

English narration/subtitle: Roads become graph edges; intersections become nodes. Dijkstra routing finds paths, and modeled travel demand is assigned over twenty-four iterations.

Japanese subtitle: 道路をグラフの辺、交差点をノードに変換し、Dijkstraで経路を探索。モデル需要を24回の反復で配分します。

**201.32–207.82s**

English narration/subtitle: A bounded volume-capacity function adjusts travel costs. Closed roads are excluded from every route.

Japanese subtitle: 上限を設けた交通量・容量の関係で移動コストを更新します。すべての経路から閉鎖道路を除外します。

**207.82–215.00s**

English narration/subtitle: Automated tests cover routing, imports, closures, recovery, and bilingual interactions. All metric definitions are documented.

Japanese subtitle: 自動テストで経路、取り込み、閉鎖、復旧、日英操作を確認しています。各指標の定義も公開しています。

### 03:35–04:02 · Evidence first. Human-readable interpretation.

**Screen action:** Show the actual local resilience brief, then Data & assumptions. The optional server LLM is described, not portrayed as a live provider call.

**Editing:** Cuts and 0.18-second fades only. Keep product content above y=858; captions start below y=888. All numerical callouts are read from the survey evidence. On-screen slides are English; actual OSM proper names retain their source spelling.

**215.00–221.90s**

English narration/subtitle: The analyst converts numerical evidence into a planning brief. This recording uses local analysis.

Japanese subtitle: 分析機能が数値の根拠を短い計画レポートへまとめます。この録画ではローカル分析を使っています。

**221.90–227.64s**

English narration/subtitle: An optional server-side language model explains the same results, with automatic fallback.

Japanese subtitle: 任意のサーバー側LLMでも同じ結果を説明でき、失敗すると自動でローカル分析に戻ります。

**227.64–233.81s**

English narration/subtitle: Geometry and facilities come from OpenStreetMap. Capacity, demand, and some speeds are modeled.

Japanese subtitle: 道路形状と施設はOpenStreetMapのデータです。容量、需要、一部の速度はモデル上の推定です。

**233.81–242.00s**

English narration/subtitle: Assumptions are visible: this is educational what-if analysis, with no disaster prediction. Outside-area routes are excluded too.

Japanese subtitle: 前提を明示した教育用の仮定分析です。災害予測は行わず、選択範囲の外を通る経路も対象外です。

### 04:02–04:37 · A reusable platform / Proposed path to adoption

**Screen action:** Export the real network snapshot, show a short proposed education/professional/organization model, then demonstrate Japanese/English switching. No customers, revenue, existing commercial plans or pilots are claimed.

**Editing:** Cuts and 0.18-second fades only. Keep product content above y=858; captions start below y=888. All numerical callouts are read from the survey evidence. On-screen slides are English; actual OSM proper names retain their source spelling.

**242.00–247.75s**

English narration/subtitle: Potential users include planners, local governments, researchers, educators, and preparedness organizations.

Japanese subtitle: 想定する利用者は、都市計画担当者、自治体、研究者、教育機関、防災団体です。

**247.75–254.87s**

English narration/subtitle: Real City Lab makes the project reusable: each small area becomes a new, reproducible analysis.

Japanese subtitle: Real City Labによって、さまざまな小地域で再現できる分析基盤へ進化しました。

**254.87–260.27s**

English narration/subtitle: My next step is educational workshops and feedback from planning professionals.

Japanese subtitle: 次は教育ワークショップと都市計画の専門家からの意見収集を考えています。

**260.27–267.39s**

English narration/subtitle: A future model could offer free education, professional analysis, and support for custom organizational data.

Japanese subtitle: 将来は無料の教育版、専門的な分析、組織ごとの独自データ支援という展開が考えられます。

**267.39–277.00s**

English narration/subtitle: These are proposed directions, before customer validation. Before expanding, I would validate model usefulness, data quality, and repeated workshop use.

Japanese subtitle: これは利用者検証前の構想です。拡大する前に、モデルの有用性、データ品質、継続的なワークショップ利用を確かめます。

### 04:37–04:54 · Select a city. Break a link. Understand the impact.

**Screen action:** Actual disrupted network, then a five-second end card. Show the correct GitHub URL, earlier ImpactHack version and AI-assisted development disclosure.

**Editing:** Cuts and 0.18-second fades only. Keep product content above y=858; captions start below y=888. All numerical callouts are read from the survey evidence. On-screen slides are English; actual OSM proper names retain their source spelling.

**277.00–284.77s**

English narration/subtitle: Cities cannot prevent every disruption. They can understand which connections matter and where access is vulnerable.

Japanese subtitle: 都市はすべての寸断を防げません。しかし、重要な接続やアクセスの弱点を理解できます。

**284.77–289.23s**

English narration/subtitle: ResiliRoute makes those consequences visible before a disruption happens.

Japanese subtitle: ResiliRouteは、寸断が起きる前にその影響を見える形にします。

**289.23–294.00s**

English narration/subtitle: Select a city. Break a link. Understand the impact.

Japanese subtitle: 街を選び、接続を閉じて、影響を理解する。

## Evidence and disclosures

Evidence: `assets/network.json`, `evidence.json`, `live-build-proof.json`, `route-ui-proof.json`, captured UI stills and recording manifest. The survey calls the existing pure simulation functions; it does not implement a second simulator.

OpenStreetMap supplies geometry, classification, facilities and available speed/lane tags. Capacity, demand, proxies and connectors are modeled. Boundary clipping excludes detours outside the rectangle. No traffic accuracy, disaster probability or safety certification is claimed.

An earlier version was developed for ImpactHack 2026. AI-assisted tools were used for implementation, debugging, testing and iteration; product decisions, evaluation and submission are directed by the creator. The recorded analyst is deterministic local analysis; the optional cloud LLM remains separate.

Startup tiers and pilot activities are future proposals pending customer validation. The video does not claim existing municipal use or commercial contracts.

The competition recommends a five-minute pitch and asks prior work/tools to be credited: [official overview](https://creatorcolosseumshowdown.devpost.com/) and [rules](https://creatorcolosseumshowdown.devpost.com/rules).
