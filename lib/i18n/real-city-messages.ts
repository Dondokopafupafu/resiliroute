export const realCityJapanese: Readonly<Record<string, string>> = {
  "Baseline route": "通常時の経路",
  "Scenario route": "閉鎖後の経路",
  Status: "状態",
  "Shared simulation engine · Harbor City reference":
    "共通シミュレーション · Harbor Cityの基準モデル",
  "The following formulas are shared by both modes. The Harbor City network description refers to the synthetic demo; Real City Lab uses the imported graph and demand assumptions above.":
    "以下の式は両モードで共通です。Harbor Cityのネットワーク説明は合成デモを指します。実都市ラボでは、上記の取り込み交通網と需要モデルを使用します。",
  "Extra modeled demand-minutes caused by the BPR function, relative to free-flow demand-minutes. These are synthetic flows, not observed delays. Change is in percentage points.":
    "BPR式によるモデル需要・時間の増加を、自由走行時と比較した割合です。合成交通流による計算で、観測遅延ではありません。増減はパーセントポイントです。",
  "Hospital analysis unavailable": "病院分析は対象データなし",
  "Circles · modeled origins & essential facilities": "丸印 · モデル需要地点と重要施設",
  "No location permission required. Bounds are sent when building; optional cloud AI also receives the network.":
    "位置情報の許可は不要です。構築時に範囲を送信し、任意のクラウドAIにはネットワークも送信します。",
  "No supported facilities were imported. Accessibility is unavailable.":
    "対象の重要施設が取得できていないため、アクセス分析は対象データなしです。",
  "Candidate links are removed individually and all network metrics recalculated. Large networks use a screened subset, not an exhaustive ranking. Scores combine modeled travel-time increase, access and efficiency loss, and disconnected demand; they are not failure probabilities.":
    "候補道路を一本ずつ除き、全ネットワーク指標を再計算します。大きな交通網では候補のみを詳しく解析するため、全道路の順位ではありません。スコアはモデル上の時間増加、アクセス・効率低下、到達不能需要を組み合わせたもので、損傷確率ではありません。",
  "Change analysis area": "分析範囲を変更",
  "No imported service categories · retention neutral": "対象施設なし · 保持率は中立扱い",
  "Load a saved OSM example (no API)": "取得済みOSMサンプルを開く（API不要）",
  "Saved actual OSM sample · captured 10 Oct 2026":
    "実際に取得したOSMサンプル · 2026年10月10日取得",
  "Use optional cloud AI": "クラウドAIを使用する（任意）",
  "Enabling sends this network and modeled results to the configured AI provider.":
    "有効にすると、ネットワークとモデル結果を設定済みAIサービスへ送信します。",
  "Local evidence analyst active · cloud AI is not configured.":
    "ローカル分析が有効です · クラウドAIは未設定です。",
  Unknown: "不明",
  "Clear all disruptions": "すべての閉鎖を解除",
  "Route Explorer": "経路を比較",
  "Close a real road to compare modeled recovery strategies.":
    "実道路を閉鎖して、モデル上の復旧効果を比較してください。",
  "City mode": "都市モード",
  "Demo City": "デモ都市",
  "Real City Lab": "実都市ラボ",
  "RESILIROUTE 3.0 · REAL CITY LAB": "RESILIROUTE 3.0 · 実都市ラボ",
  "Scenario failure probability": "シナリオ上の故障確率",
  "User-defined assumption": "ユーザーが指定する仮定",
  "Relative recovery cost": "相対復旧コスト",
  "User-defined score, not financial cost": "ユーザー指定の相対スコア（金額ではありません）",
  "From a synthetic city": "架空の都市から",
  "to any city.": "実在する都市へ。",
  "Select an area. Build its mobility network. Stress-test its resilience.":
    "範囲を選び、交通網を構築。寸断への強さと復旧効果を分析します。",
  Select: "範囲選択",
  Build: "構築",
  "Stress-test": "影響分析",
  "Real infrastructure geometry + modeled mobility demand":
    "実在する道路形状 × モデル化した交通需要",
  "Road geometry and facilities come from OpenStreetMap. Traffic capacity and demand are modeled estimates. ResiliRoute is an educational planning prototype, not real-time traffic or emergency navigation.":
    "道路形状・施設情報にはOpenStreetMapを使用しています。交通容量・需要はモデル上の推定値です。ResiliRouteは教育・分析用プロトタイプであり、リアルタイム交通情報や避難誘導ではありません。",
  "Select an Analysis Area": "分析範囲を選択",
  "START WITH AN AREA": "分析する範囲を選ぶ",
  "Analyze a real urban network": "実在する街の交通網を分析",
  "Draw a rectangle on the map to build a mobility network from OpenStreetMap.":
    "地図上で矩形の範囲を指定し、OpenStreetMapから交通ネットワークを構築します。",
  "Select area on map": "地図で範囲を選ぶ",
  "Cancel selection": "範囲選択を終了",
  "Click two opposite corners to select a rectangle.":
    "矩形の対角となる2か所をクリックしてください。",
  "Try an example area": "サンプル範囲を選ぶ",
  "Choose an area…": "範囲を選択…",
  "Okayama · riverside": "岡山 · 川沿い",
  "Matsumoto · central": "松本 · 中心部",
  "Edit bounding coordinates": "範囲の座標を編集",
  south: "南端",
  west: "西端",
  north: "北端",
  east: "東端",
  Width: "幅",
  Height: "高さ",
  "Approx. area": "概算面積",
  "Recommended: 1–10 km² · maximum: 25 km²": "推奨：1〜10 km² · 最大：25 km²",
  "Build Mobility Network": "交通ネットワークを構築",
  "Fetching roads & building the intersection graph": "道路取得・交差点ネットワークを構築中",
  "Reading saved network snapshot": "保存されたネットワークを読み込み中",
  "Running baseline simulation": "通常時のシミュレーションを実行中",
  "Redistributing modeled demand": "モデル交通需要を再配分中",
  "Stress-testing road closures": "道路閉鎖の影響を解析中",
  "Comparing recovery priorities": "復旧効果を比較中",
  "Processing actual data and model calculations": "取得データの処理とモデル計算を実行しています",
  Cancel: "キャンセル",
  "Reset closures": "閉鎖をリセット",
  "Export Network Snapshot": "ネットワークを保存",
  "Import Snapshot": "保存データを読み込む",
  "Snapshots reproduce the network and baseline offline. Imported provenance is not independently verified.":
    "保存データから通信なしでネットワークと通常時を再現できます。ファイル記載の出典は独立に検証していません。",
  "Use Demo City Instead": "デモ都市を使う",
  "Select a valid rectangle with two opposite corners.":
    "対角となる2か所で、有効な矩形範囲を選択してください。",
  "Selected area is too large. Choose an area smaller than 25 km² for interactive analysis.":
    "分析範囲が大きすぎます。25 km²以下の範囲を選択してください。",
  "This area contains too many roads for interactive analysis. Select a smaller area.":
    "範囲内の道路が多すぎます。より小さな範囲を選択してください。",
  "No usable connected road network was found. Select another area.":
    "利用できる道路ネットワークが見つかりません。別の範囲を選択してください。",
  "OpenStreetMap returned incomplete data. Try again or choose another area.":
    "OpenStreetMapから不完全なデータが返されました。再試行するか、範囲を変更してください。",
  "OpenStreetMap is temporarily unavailable. Try again, import a snapshot, or use Demo City.":
    "OpenStreetMapの取得サービスを利用できません。再試行、保存データの読込、デモ都市をご利用ください。",
  "Cannot reach the ResiliRoute server. Check your connection and, if running locally, make sure the app server is running. Then retry.":
    "ResiliRouteのサーバーに接続できません。通信を確認し、ローカルで使用している場合はアプリのサーバーを起動してから再試行してください。",
  "Shrink selected area": "範囲を小さくする",
  "Halve the width and height, then build again. No roads are fetched until you press Build.":
    "幅と高さを半分にして再構築できます。構築ボタンを押すまで道路データは取得しません。",
  "The road request timed out. Try a smaller area or import a saved snapshot.":
    "道路の取得がタイムアウトしました。範囲を小さくするか、保存データを読み込んでください。",
  "Network build cancelled.": "ネットワーク構築を中止しました。",
  "The data service is busy. Wait a few minutes or use a saved snapshot.":
    "データサービスが混雑しています。数分待つか、保存データを使ってください。",
  "This snapshot is invalid or uses an unsupported model version.":
    "保存データが無効、またはモデルのバージョンが未対応です。",
  "WHAT-IF DISRUPTION": "仮想的な道路閉鎖",
  "Click a road. See the ripple.": "道路を選び、波及効果を見る。",
  "Manual closures · no damage prediction": "手動の仮想閉鎖 · 損傷予測ではありません",
  "Inspect real road": "実道路を選択",
  "Select a road on the map to inspect its data and simulate a closure.":
    "地図上の道路を選び、属性を確認して閉鎖をシミュレーションできます。",
  "No roads closed": "閉鎖中の道路はありません",
  Reopen: "再開",
  "Reopen road": "道路を再開",
  "Simulate closure": "閉鎖をシミュレーション",
  "OSM class": "OSM道路分類",
  Length: "長さ",
  "Estimated speed": "モデル速度",
  "Estimated capacity": "推定容量",
  "Lanes (total)": "車線数（合計）",
  Direction: "通行方向",
  "One-way": "一方通行",
  "Two-way shared capacity": "双方向・共通容量",
  Bridge: "橋",
  Tunnel: "トンネル",
  Yes: "はい",
  No: "いいえ",
  "Current modeled flow": "現在のモデル交通量",
  "modeled units/h": "モデル単位/時間",
  "Calculating…": "計算中…",
  estimated: "推定",
  OSM: "OSMタグ",
  Available: "利用可能",
  Unavailable: "対象データなし",
  "N/A": "対象データなし",
  "Map layers": "地図レイヤー",
  "Bridges only": "橋のみ",
  "Essential facilities": "重要施設",
  Roads: "道路",
  "High modeled utilization": "モデル利用率が高い道路",
  "Demand proxy": "需要の重み",
  "H · hospital / clinic · S · station": "住宅需要地点・重要施設を表示",
  "Some background tiles are unavailable. The network analysis remains usable.":
    "背景地図の一部を取得できません。ネットワークの分析は引き続き利用できます。",
  "REAL CITY NETWORK READY": "実都市ネットワークを構築しました",
  "Network summary": "ネットワークの概要",
  "Analysis area": "分析面積",
  Intersections: "交差点・分岐点",
  "Road links": "道路区間",
  "Hospitals & clinics": "病院・診療所",
  Stations: "駅",
  Shelters: "避難所",
  "Residential origins": "住宅需要地点",
  "Modeled OD pairs": "モデルODペア",
  "Live OpenStreetMap import": "OpenStreetMapから実際に取得",
  "Cached OpenStreetMap import": "取得済みOSMデータのキャッシュ",
  "Imported snapshot · provenance supplied by file": "保存データを読込 · 出典はファイル記載",
  "Road geometry & facilities: OpenStreetMap. Travel demand: synthetic model.":
    "道路形状・施設：OpenStreetMap。交通需要：合成モデル。",
  "Boundary-limited model: routes outside the selected rectangle are excluded.":
    "範囲境界で制限したモデルです。矩形外の経路は含みません。",
  "{count} disconnected components · {excluded} facilities not connected":
    "非接続の道路網：{count}群 · 未接続施設：{excluded}件",
  "CASCADING IMPACT ANALYSIS": "連鎖する影響を分析",
  "A real road. A network-wide consequence.": "実在の道路が止まると、交通網はどう変わる？",
  "Every comparison uses the same imported network and synthetic demand.":
    "同じ道路ネットワークと合成需要で、通常時と閉鎖後を比較します。",
  "Accessibility categories": "アクセス分析対象",
  "Directional sectors are model groups, not administrative districts.":
    "地域区分は方角による分析グループであり、行政区域ではありません。",
  "Demand-proxy-weighted access, averaged only across imported hospital/clinic, shelter and station categories. Thresholds: 20, 15 and 12 minutes. Missing categories are excluded; no facilities means N/A.":
    "需要の重みを使い、取得した病院・診療所（20分）、避難所（15分）、駅（12分）への到達割合を平均します。未取得カテゴリは除外し、全施設がない場合は対象データなしです。",
  "Demand-proxy share able to reach each imported facility within its model threshold.":
    "各施設へモデル時間内に到達できる、需要の重みの割合です。",
  "No supported essential facilities were connected. Accessibility is unavailable.":
    "対応する重要施設を接続できていません。アクセス分析は対象データなしです。",
  "Criticality analysis screened {count} candidate links from {total} available roads":
    "利用可能道路{total}本から{count}候補を選び、詳細な重要度解析を実行",
  "Full stress test: {count} available road links": "全利用可能道路{count}本のストレステスト",
  "Calculation time": "計算時間",
  "Analyze candidate links": "候補道路を再解析",
  "Data & assumptions": "データとモデルの仮定",
  "See what is observed and what is modeled": "実在データと推定モデルを確認",
  "Road geometry & intersections": "道路形状・交差点",
  "Road classification": "道路分類",
  "Hospitals, clinics & stations": "病院・診療所・駅",
  OpenStreetMap: "OpenStreetMap",
  Speed: "速度",
  "OSM maxspeed / estimated": "OSM速度タグ / 推定",
  Lanes: "車線数",
  "OSM / estimated": "OSMタグ / 推定",
  "Traffic capacity": "交通容量",
  "Modeled estimate": "モデル上の推定",
  "Facility connections": "施設への接続",
  "Nearest road node · modeled": "最寄り道路ノード · モデル接続",
  "Traffic demand": "交通需要",
  "Synthetic demand over real infrastructure": "実在インフラに合成需要を設定",
  "Residential weights": "住宅需要の重み",
  "Local road length proxy · not population": "周辺道路長を利用 · 実人口ではありません",
  Accessibility: "アクセシビリティ",
  "Modeled · available service categories only": "モデル計算 · 取得カテゴリのみ",
  "Data coverage": "OSM属性の取得率",
  "Speed tags available": "速度タグあり",
  "Lane tags available": "車線タグあり",
  "Road names available": "道路名あり",
  "Capacity estimated": "容量を推定",
  "OSM data timestamp": "OSMデータ時点",
  South: "南セクター",
  "No location permission required. Coordinates are sent only when you build a network.":
    "位置情報の許可は不要です。ネットワーク構築時のみ選択座標を送信します。",
  "Real City Data Pipeline": "実都市データの処理手順",
  "OpenStreetMap → road extraction → intersection graph → speed/capacity estimation → demand proxy generation → traffic assignment → resilience analysis":
    "OpenStreetMap → 道路抽出 → 交差点グラフ → 速度・容量推定 → 合成需要生成 → 交通配分 → レジリエンス分析",
  "Estimated road capacity": "道路容量の推定",
  "Real City Lab uses OpenStreetMap geometry and road classifications. Traffic capacity is estimated from road class and lane information and should not be interpreted as observed traffic counts.":
    "実都市ラボはOpenStreetMapの道路形状・道路分類を使用します。交通容量は道路分類と車線情報から推定し、観測された交通量として扱うことはできません。",
  "Speed and direction": "速度・通行方向",
  "Speeds use OSM maxspeed tags when available and road-class defaults otherwise. One-way tags, reversed one-way roads and roundabouts determine graph direction. Bidirectional roads share the sum of lane capacities; direction-specific queues are not modeled.":
    "速度はOSMのmaxspeedタグを優先し、欠損時は道路分類別の初期値を使用します。一方通行・逆向き一方通行・ラウンドアバウトに対応。双方向リンクは全車線の合計容量を共有し、方向別の待ち行列はモデル化しません。",
  "Demand and facilities": "需要・施設",
  "Origins are deterministic spatial samples of residential roads, weighted by adjacent residential road length. This is a demand proxy, not population. Total synthetic demand equals 0.75 × median shared road capacity × sampled origin count, capped at 40,000 modeled units/hour. Nearest supported destinations generate up to 80 reachable baseline OD pairs. Facilities connect to the nearest graph node within 350 m using a modeled connector; this does not verify an entrance or safe access.":
    "住宅道路を空間的にサンプリングし、隣接する住宅道路長から需要の重みを設定します。実人口ではありません。総合成需要は0.75×道路の共通容量の中央値×需要地点数、最大40,000モデル単位/時間。近隣の対応目的地へ最大80の通常時に到達可能なODペアを生成します。施設は350m以内の最寄りノードへ簡易接続し、入口や安全なアクセスを確認するものではありません。",
  "Accessibility and missing data": "施設アクセス・欠損データ",
  "Hospital/clinic: 20 minutes. Shelter: 15 minutes. Station: 12 minutes. These educational thresholds apply to the modeled demand proxy. Only imported service categories are averaged. A missing category is Unavailable; if all categories are absent, accessibility is N/A and its resilience-retention term is neutral.":
    "病院・診療所20分、避難所15分、駅12分の教育用しきい値で、モデル需要の到達割合を計算します。取得カテゴリだけを平均し、未取得カテゴリは対象データなし。すべてない場合はアクセス指標を対象データなしと表示し、レジリエンスのアクセス保持項は中立に扱います。",
  "Network boundaries and stress tests": "範囲の境界・ストレステスト",
  "Road geometry is simplified between intersections while detailed polylines are retained. Only in-bounds runs with at least two OSM nodes are included; roads and detours outside the rectangle are excluded. All available roads are tested at 200 or fewer road links. Larger networks screen 35 candidates using assigned flow × free-flow time, bridge tags and endpoint connectivity, then run the full model on each candidate. Rankings are conditional and may miss unscreened roads. Facility connectors are excluded from closure rankings.":
    "交差点間の形状ノードを統合し、詳細な道路形状は保持します。範囲内にOSMノードが2つ以上ある連続区間のみ使用し、範囲外の道路・迂回路は除外。200道路リンク以下では全利用可能道路を解析します。それ以上は交通量×自由走行時間、橋タグ、端点の接続を使い35候補を選んで詳細計算します。未選択の重要道路を見逃す可能性があります。施設のモデル接続は閉鎖ランキングから除外します。",
  "Snapshots, privacy and limitations": "保存データ・プライバシー・制約",
  "Snapshots save model version 1.0, bounds, OSM metadata, graph, facilities and synthetic demand. No credentials are included. File-supplied provenance is not independently verified. Requests use a bounded server proxy, up to three upstream attempts and a 20-minute process cache. No location permission, coordinates in server logs, real-time traffic, disaster probability, infrastructure condition, demographic inference or safety judgment. The recommended area is 1–10 km², at most 25 km²; complexity limits can require a smaller selection.":
    "保存データにはモデル1.0、範囲、OSMメタデータ、グラフ、施設、合成需要を含み、認証情報は含みません。ファイルの出典は独立に検証していません。取得はサーバー経由、最大3回の試行と20分のプロセス内キャッシュを使用します。位置情報許可や座標のサーバーログ保存は行いません。リアルタイム交通、災害確率、設備状態、人口属性、安全性は分析しません。推奨1〜10km²、最大25km²ですが、道路密度によってはさらに小さな範囲が必要です。",
};
