# Submission screenshots

Use the production app (`pnpm build`, then `pnpm start`) so development overlays do not appear. Retain the synthetic-data disclosure and OpenStreetMap attribution when capturing the map. Included desktop overview captures use 1440×1100 to include the entire map and attribution. Use 1920×1080 for a video frame. All numbers below come from the included dataset.

Choose **English** in the header for submission images. The capture script also creates `earthquake-overview-ja.png`, `ai-brief-ja.png`, and `mobile-earthquake-ja.png` to show the Japanese interface. The language switch preserves the modeled scenario and numbers.

The repository includes actual product captures in [`docs/screenshots/`](docs/screenshots/). To regenerate them while the app is running:

```bash
pnpm screenshots
```

## 1 · Hero + map — `hero-map.png`

**State:** Reset, normal conditions, no selected link.

**Frame:** Header, question, CTA, normal KPI cards, map and controls.

**Purpose:** Immediately explain the product and its first action.

## 2 · Normal scenario — `normal-network.png`

**State:** All 42 links open; traffic flow enabled.

**Frame:** The map and Scenario Control Panel, with operational state and attribution.

**Purpose:** Establish the reference city and show that it is an interactive model.

## 3 · Earthquake scenario — `earthquake-overview.png`

**State:** Click Earthquake, or complete the demo; Harbor Bridge selected.

**Frame:** Changed KPI cards and network with red dashed closures. The earthquake closes Harbor Bridge, East Rail Connector and Coastal Road.

**Purpose:** Show the cascade and actual comparison: 14.2→20.9 min, 94.4→78.9% access, 100→69 resilience.

## 4 · Before/after dashboard — `impact-dashboard.png`

**State:** Earthquake active.

**Frame:** Citywide impact and district accessibility charts, with the East district insight.

**Purpose:** Show unequal effects rather than a single citywide average.

## 5 · Critical infrastructure & recovery — `critical-recovery.png`

**State:** Earthquake active; do not restore a link yet.

**Frame:** Next-link criticality ranking beside Recovery Optimizer.

**Purpose:** Show Harbor Rail’s conditional criticality and Harbor Bridge’s +16.2-point modeled restoration benefit. Hover/click a ranking item for a separate map-linked capture if useful.

## 6 · AI Resilience Brief — `ai-brief.png`

**State:** Earthquake active; analyst response settled.

**Frame:** Summary, exact evidence, impact explanation and planning actions. Keep the source label visible.

**Purpose:** Show simulation-to-understanding. Local mode must remain labeled **Evidence-based local analysis**; do not crop or relabel it as a live LLM response.

## Additional captures

- `mobile-earthquake.png`: full mobile layout after earthquake; demonstrates usable controls, charts and analyst on a narrow viewport.
- Route overlay: East Riverside → General Hospital, normal dashed route and scenario gold route visible.
- Recovery result: click Restore Harbor Bridge and show the improved KPIs.
- Methodology: show the actual formula section and limitations in the dialog.

Avoid fabricated numbers, awards, safe-route claims, or a basemap presented as validated city data. The screenshots should show the same product and assumptions as the video and Devpost description.

## Real City Lab 2.0

With the application running, use `pnpm screenshots:real-city` (and the same optional `RESILIROUTE_URL`) to capture the actual saved Okayama OSM model:

- `real-city-baseline.png`: built network, baseline cards, real geometry and the saved-data source label.
- `real-city-closure.png`: the first computed critical-road candidate closed; changed KPIs and road inspection.
- `real-city-analysis.png`: conditional criticality, independent recovery and the local analyst.
- `real-city-closure-ja.png`: the same modeled closure in Japanese.

The script selects a computed ranking entry and lets the existing worker calculate every result. It does not inject video-style numbers or substitute a fictional OSM fixture. Retain the visible source labels and OpenStreetMap attribution.
