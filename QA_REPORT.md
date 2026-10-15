# Verification record

**Current version 3.0:** see [Ultimate Resilience verification](docs/ULTIMATE_QA.md) for 107 unit/data checks, 54 production browser checks, decision-workspace review and current limitations. The dated sections below are historical; statements such as "Recovery Budget Lab is future work" apply only to those earlier versions.

## Product quality follow-up — 11 October 2026

Clearing a numeric bounding coordinate previously passed `NaN` into Leaflet and crashed the workspace. Invalid/partially edited coordinates now remain form state and never reach map bounds; dimensions display a dash while Build stays disabled. Cancelling a saved-example request previously allowed a late response to overwrite a subsequent snapshot. Saved samples, live builds and file imports now share cancellation and stale-response guards. Saved-file progress is labeled as reading a snapshot, rather than fetching OSM roads.

Two failing browser regressions reproduced these bugs before the fixes; both now pass on desktop and mobile. The full production suite passed **42 browser checks (21 desktop, 21 mobile)**. The shared unit/data suite passed **63 checks across nine files**. Frozen-lockfile installation, lint, formatting, strict typecheck and production build passed. A centering regression also verifies the Methodology dialog stays centered after the CSS reset; route overlays now have explicit bilingual baseline/scenario legend labels.

The Creator Colosseum filming workflow successfully made a new uncached live Okayama import. It verified 687 intersections, 983 roads, 18 demand origins and 54 OD pairs. Closing the actual 相生橋 segment changed modeled mean travel from 2.8 to 3.4 minutes. The displayed hospital journey to 川崎医科大学 総合医療センター changed from 4.4 to 7.2 minutes. The destination was checked against the imported facility category before narration. Local corridor flow rose from about 595 to 3,010 modeled units/hour; citywide congestion decreased, so the film describes local redistribution rather than claiming all indicators worsen.

The new editable **4:54 Creator Colosseum film** is separate from the earlier 3:50 ImpactHack film. Its script, bilingual subtitles, source evidence, thumbnail and final-media validation are in `video/creator-colosseum/`. Large recordings and finished MP4 media remain outside Git. Numerical facts come from the existing simulation and verified UI, while business tiers/pilots are explicitly future proposals.

Final-media checks decoded all **8,820 frames** of the 1920×1080, 30fps H.264/AAC master with zero decode errors. All 41 English/Japanese cue pairs match the narration data; English lines stay within the reserved caption plate and never overlap the Japanese row. Voice/music measured −17.2/−36.0 LUFS. Three Chromium playback segments covering closure, recovery and the analyst each had zero dropped frames. A 28-frame review sheet and full-size inspection of route/recovery/brief frames verified the edited layout. Actual app footage occupies 255 of 294 seconds (86.7%).

## ResiliRoute 2.0 — 10 October 2026

The latest upgrade keeps the Harbor City baseline and adds Real City Lab. Checks run on Windows, Node.js 24.19, pnpm 11.25.0 and the existing dependency lockfile. This verifies software and model behavior, not real-world traffic accuracy or emergency safety.

| Check                                    | Result                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`         | Passed; no new dependencies                                                          |
| `pnpm lint`                              | Passed, zero warnings                                                                |
| `pnpm format:check`                      | Passed                                                                               |
| `pnpm typecheck`                         | Passed                                                                               |
| `pnpm test`                              | 63 passed across 9 files, including the original 28                                  |
| `pnpm test:e2e` on the production server | 38 passed: 19 desktop and 19 mobile Chromium checks, including the original 20       |
| `pnpm build`                             | Passed, with `/`, `/real-city` and three API routes                                  |
| Actual Overpass import                   | Okayama and Matsumoto bounds successfully imported through the server route          |
| Browser interaction                      | Real imports, calculated closures, recovery and Japanese/English inspected in Chrome |
| Product captures                         | Four new real-city screenshots generated from actual OSM snapshots; no page errors   |

The 35 new unit checks cover area/bbox limits, Overpass query and malformed responses, intersection splitting, reverse one-way and roundabout rules, geometry distances, speed/lane/capacity estimates, facility snapping, finite demand, missing services, snapshot validation, complexity protection, bounded timeout/retry/cancellation/cache, two actual OSM samples and real-city AI evidence boundaries. Request-layer regressions distinguish a stopped app server from an upstream outage, HTML gateway pages, cancellation and untrusted error text. The 18 new E2E checks use both desktop and mobile projects: mocked imports and actual captured OSM replay, map-road closure, redistribution, recovery, baseline reset, route selection, snapshots, area selection, too-large areas, five API failure codes, N/A facilities, localization, connection-error retry and safe centered area reduction. Public Overpass is not called by the automated suite.

### Follow-up: new-area import failure

When the reported failure was inspected, the local preview was no longer listening. After restarting, the selected area could be fetched from OSM but exceeded the graph-complexity guard. Browser transport failures now show a ResiliRoute-server connection message, separately from an explicit Overpass outage. A **Shrink selected area** action halves width and height without issuing a request or replacing the last successful network. A smaller 1.46 km² selection in the same region successfully imported 376 decision nodes, 533 road segments, five hospital/clinic facilities and 52 modeled OD pairs through the live API. Closing the highest-ranked screened road changed displayed modeled time from 2.1 to 8.9 minutes and resilience from 100 to 65; its independent restoration gain was 35.1 points. Local preview was restarted outside the transient command session. No coordinates or location history were saved to application logs.

Two production-only issues were identified and fixed: mobile navigation inherited an old rule hiding links, and Leaflet SVG classes needed creation-time `className` props rather than style updates. The production suite verifies mode navigation, direct map clicks and closed-link class changes. Worker computation runs without blocking the interface; stale workers terminate when inputs change. Missing access appears as N/A in cards, charts and analyst evidence.

### Actual captured-data model evidence

These are computed what-if results for the highest-ranked screened baseline candidate in each saved sample. They do not describe observed conditions. Some demand becomes disconnected and retains the explicit 60-minute model penalty; a lower congestion indicator alone does not mean the network improved.

| Metric                           | Okayama before |  Okayama closed | Matsumoto before | Matsumoto closed |
| -------------------------------- | -------------: | --------------: | ---------------: | ---------------: |
| Road segments                    |            983 |   982 available |              700 |    699 available |
| Average modeled time             |     2.8300 min |      5.0845 min |       2.9384 min |      11.2413 min |
| Supported-service access         |           100% |        95.8756% |         96.0009% |         96.0009% |
| Efficiency                       |        78.9947 |         76.3094 |          78.5057 |          68.1394 |
| Congestion delay                 |       55.4299% |        49.2170% |         54.5361% |         44.6803% |
| Resilience                       |            100 |         76.4092 |              100 |          65.9256 |
| Disconnected modeled demand/hour |              0 |        723.8237 |                0 |        2619.9550 |
| One-road restoration gain        |              — | +23.5908 points |                — |  +34.0744 points |

Closures are `osm-way-436640413-1` in Okayama and `osm-way-149665866-1` in Matsumoto. Both analyses screen 35 candidates; this is not an exhaustive criticality ranking. Demand totals remain approximately 17,550 modeled units/hour. Actual saved datasets contain 687/508 decision nodes, 2/4 hospital-or-clinic facilities and 0/2 stations, respectively. No tagged shelter is imported in either example; that missing category is shown explicitly. All original Harbor City numerical audit values below remain unchanged.

The first live server requests took approximately 3.6 and 4.9 seconds locally. A production browser Okayama build recorded 7.39 seconds for worker analysis; the captured closure analysis recorded 6.49 seconds. Timings vary with topology, hardware and concurrent work. KPIs appear before candidate ranking finishes. These measurements are not a citywide prediction or service guarantee.

### Reproduction and boundaries

Use the commands below, plus `pnpm format:check` and `pnpm screenshots:real-city`. Run one Playwright process at a time; concurrent processes writing the same report directory interfere with traces. Saved examples are labeled as captured OSM data, and the separate tiny fictional fixture is used only for tests.

The unchanged stable Harbor City checkpoint and separate Real City upgrade commits remain in the local development-history backup. The checkpoint was not amended or overwritten. This historical QA record predates the reviewed version 3.0 public snapshot; it does not claim a hosted deployment. Original development commit IDs are not part of the snapshot's public history.

No live paid OpenAI call was made. Optional cloud analysis is off by default and uses a server-only key; mock tests verify grounding and fallback. Capacity, demand, some speeds and nearest-node connectors are modeled. Boundary clipping excludes outside detours; incomplete OSM tags, clinic/hospital grouping, one-road independent recoveries, process-local API controls and Chromium-only mobile verification remain limitations. Recovery Budget Lab is future work.

## Original Harbor City verification — 6 October 2026

Verified on Windows with Node.js 24.19 and the pnpm dependency lockfile, most recently on 6 October 2026 after adding Japanese/English switching. This report describes software behavior, not real-world traffic accuracy or emergency safety.

## Automated checks

| Check                                    | Result                                              |
| ---------------------------------------- | --------------------------------------------------- |
| Dependency installation, frozen lockfile | Passed                                              |
| ESLint, zero warnings permitted          | Passed                                              |
| Prettier source formatting               | Passed                                              |
| Strict TypeScript, no emit               | Passed                                              |
| Vitest unit and dataset audit            | 28 passed across 5 files                            |
| Playwright, production server            | 20 passed: 10 desktop and 10 mobile Chromium checks |
| Optimized Next.js production build       | Passed                                              |

The browser checks use the actual production application, not a simulated UI. They cover the seven-step earthquake sequence, changing computed KPIs, three closed SVG links, direct map-link selection and facility popups, normal/scenario route overlays, custom closures and restoration, same-origin routing, all disruption presets, conditional stress testing, clear/reset, dialogs and Escape, JSON downloads, narrow layout overflow, blocked map tiles, isolated origins, trusted API recomputation, Skip and cancellation of stale demo timers. The main demo records page errors and requires none.

The data audit checks unique IDs, valid endpoints, reference connectivity and facility reachability, conserved demand and finite link costs. Graph tests cover one-way links, nonnegative custom weights, closed edges and unreachable nodes. AI provider tests mock structured outputs and failures.

The later publication-safeguard verification adds four passing tests: anonymous author/committer history and empty templates, blocked private files and personal information with redacted output, older personal commit metadata, and credentials deleted from the current tree but still present in history. These tooling changes do not alter the app's simulation or interface; the production browser results above describe the last app verification.

Localization checks cover all static UI translations, dataset names and scenario descriptions; Japanese local evidence, Japanese provider prompts/output validation and fallback language; preserved closures, route endpoints and KPIs when switching; translated map labels, legends and Methodology; saved language after reload; separate API language caches and invalid locale rejection. Browser tests also switch languages during a running demo with browser storage disabled and check both languages at 320px width. The narrow English timeline originally overflowed; removing connector arrows at that breakpoint fixes it while retaining every numbered step.

## Reproducible model evidence

| Indicator             |      Normal |  Earthquake |
| --------------------- | ----------: | ----------: |
| Average assigned trip | 14.2284 min | 20.8575 min |
| Essential access      |    94.4266% |    78.8853% |
| Efficiency            |     43.7606 |     37.5281 |
| Congestion delay      |    11.9492% |    29.3037% |
| Resilience            |         100 |     69.4471 |
| Disconnected demand   |           0 |           0 |

The earthquake closes Harbor Bridge, East Rail Connector and Coastal Road. Port Bypass receives about 3,674 person-trips per model hour, compared with 426 before disruption. East district's average trip grows from 14.8 to 29.2 minutes. Independently reopening Harbor Bridge improves resilience by 16.2177 points and access by 6.5380 points. None of these is a hardcoded display value.

## Visual and interactive verification

Inspected the production application in the in-app browser at desktop and narrow mobile sizes. Confirmed map fit, closed-link styling, route overlays, source-labeled local brief, Japanese controls and translated network names. Browser regression checks require no page errors in the demo and language-switch flows. Reviewed the actual overview, chart, critical/recovery and analyst captures; ten images are included in `docs/screenshots/`, including Japanese desktop, analyst and mobile captures.

Production-only verification caught missing Leaflet path CSS classes. They are now provided at path construction rather than in later style updates. The passing production browser checks retain regression coverage for closures, overlays and dotted rail patterns. Map resize callbacks also stop after component cleanup. The API origin check uses the external request host rather than Next's internal localhost URL; unit and browser checks cover legitimate same-origin requests and rejection of unrelated origins.

## Repeat the checks

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start --port 3001
```

In a second terminal, set `RESILIROUTE_URL=http://127.0.0.1:3001` using your shell's environment-variable syntax, then run `pnpm test:e2e` and `pnpm screenshots`. In PowerShell, use `$env:RESILIROUTE_URL='http://127.0.0.1:3001'`. Without that variable, E2E uses a dev server on port 3000.

## Verification boundaries

- No real OpenAI key was supplied. The live paid API path is implemented and mock-tested; a real upstream model response remains unverified.
- No public web deployment or Devpost form submission is claimed. The completed 3:50 product film, bilingual subtitles, narration, thumbnail and video checks are provided in `video/deliverables/`; large media is kept outside Git. See `video/README.md` for the editable source and reproduction steps.
- Tests do not establish regulatory compliance, validated traffic prediction, convergence to equilibrium, real infrastructure safety or mobile Safari compatibility. Mobile automation uses Chromium.
- Background OpenStreetMap availability is external; intentional tile failures were tested and the schematic network remains functional.
- Production AI cost controls are per server process. A substantial public deployment requires shared limiting and hosting/account configuration.
