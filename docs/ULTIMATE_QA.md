# Ultimate Resilience verification — 15 October 2026

This is the current version-3 verification record. [Earlier checks and films](../QA_REPORT.md) describe earlier product versions. Software checks do not validate real-world traffic forecasts or emergency safety.

## Follow-up publication and regression review — 15 October 2026

The follow-up audit passed **112 unit/data tests across 18 files**, **54 production browser tests** (27 desktop and 27 mobile), lint, formatting, strict typecheck and production build. The dependency lockfile was unchanged. `pnpm audit --prod --json` reported zero known advisories at the time of this check; that is not a guarantee against unknown vulnerabilities.

The Harbor analysis endpoint now bounds incoming UTF-8 bytes while reading the stream, including requests without Content-Length. Previously, its character-count limit ran after buffering the entire body. Oversized input now returns 413, and a failed upload stream returns a contained 400 response. Four regression tests cover these cases, malformed JSON and cross-origin rejection.

The publication scanner now also checks commit messages and author/committer display names, without printing detected sensitive values. An additional regression test confirms metadata findings are redacted. The current files and reachable main history had no detected credentials, private email addresses or local user-profile paths. GitHub noreply addresses still identify GitHub accounts; they do not make commit history anonymous. Existing contributor associations were not removed by this audit.

Manual production-browser checks reconfirmed the Harbor earthquake demo and Okayama's saved OSM example. Closing Aioi Bridge changed displayed mean travel time from 2.8 to 3.4 minutes and resilience from 100 to 91; reopening/reset restored the baseline. The existing automated captured-data checks cover Okayama and Matsumoto, recovery, snapshots, localization and responsive behavior. Public Overpass availability and paid cloud-AI responses were not retested in this follow-up.

The 107-test record below describes the earlier upgrade verification, before these five additional tests.

## Environment and checks

Windows, Node.js 24.19, pnpm 11.25, the existing frozen dependency lockfile, Next.js production build and Chromium desktop/mobile projects. No new runtime dependency or paid service was introduced.

| Check                                             | Result                                                           |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                  | Passed                                                           |
| `pnpm lint`                                       | Passed, zero warnings                                            |
| `pnpm format:check`                               | Passed                                                           |
| `pnpm typecheck`                                  | Passed                                                           |
| `pnpm test`                                       | **107 passed across 17 files**                                   |
| `pnpm test:e2e` with production `RESILIROUTE_URL` | **54 passed: 27 desktop + 27 mobile**                            |
| `pnpm build`                                      | Passed; both city pages and the existing three server routes     |
| `pnpm check:public`                               | Staged files and reachable branch history checked; zero findings |

The original 63 unit/data checks and 42 browser checks remain. New checks cover multi-failure staging and application; budget zero, ties, exact/approximate search, affordability and apply; recovery sequence; fixed seeds, probability zero/one, finite distributions and shared-draw robust ranking; real graph workload limits; zone/facility evidence; network identity and invalid imports; report escaping, CSV formula handling and numerical consistency; worker cancellation; Japanese tab navigation; and switching between the two Leaflet city pages.

Tests use local fixtures and attributed saved OSM responses. They do not depend on public Overpass or a paid LLM. Existing failure coverage includes unavailable API/server, timeout, HTTP errors, malformed responses, empty roads, oversized areas/networks, blocked tiles, missing facilities and local storage failure. No live paid OpenAI response is claimed as verified.

## Regression and correctness

The existing Dijkstra, 24-iteration assignment, bounded BPR and metric formulas were not changed. `tests/fixtures/harbor-regression.json` protects baseline and earthquake metrics at the stable checkpoint.

| Harbor metric            |    Baseline |  Earthquake |
| ------------------------ | ----------: | ----------: |
| Mean modeled travel time | 14.2284 min | 20.8575 min |
| Essential-service access |    94.4266% |    78.8853% |
| Network efficiency       |     43.7606 |     37.5281 |
| Congestion delay         |    11.9492% |    29.3037% |
| Resilience               |         100 |     69.4471 |

The new decision layer reruns that same engine for each candidate, rather than synthesizing improvements. Artificial facility connectors stay available in Real City road experiments; they are excluded consistently from the staged-road selector, scenario import and decision-worker validation. This fixes a review finding where a connector could be staged but the parent road controller would silently discard it.

## Actual-network browser review

Both saved examples contain actual OSM data captured on 10 October 2026. They are explicitly labeled as saved data, not new live API calls.

| Sample              | Road intersections | Road segments | Hospital/clinic | Station | Shelter | Origins / OD pairs |
| ------------------- | -----------------: | ------------: | --------------: | ------: | ------: | -----------------: |
| Okayama, 2.75 km²   |                687 |           983 |               2 |       0 |       0 |            18 / 54 |
| Matsumoto, 2.46 km² |                508 |           700 |               4 |       2 |       0 |            18 / 64 |

In the production browser, two Okayama roads (`osm-way-436640413-1` and `osm-way-24164149-0`) were staged and closed together. The UI showed 5.1 minutes, 95.9% access and resilience 76. With budget 5, the top plan restored the first road at relative cost 1, increasing modeled resilience to 100 and access to 100%; applying the plan updated the main simulation. These rounded observations do not imply measured traffic or actual repair costs.

Matsumoto's top screened road closure (`osm-way-149665866-1`) was also operated in the production browser. The UI showed 11.2 minutes and resilience 66, with Japanese labels and the neutral spatial-zone table. Access remained 96.0%; the demo must not describe an access decrease where none is calculated. Existing automated captured-data tests verify both networks' baseline, closure, recovery, reset, snapshots and responsive localization.

Some disrupted scenarios show lower citywide congestion because demand is disconnected or moves to different routes. Travel-time penalties, access and connected demand must be interpreted together. The product and documentation do not claim that every indicator must worsen after every closure.

## Performance and limits

In the final concurrent unit run, complete saved-sample model checks took about 8.3 seconds for Okayama and 5.0 seconds for Matsumoto. These include baseline, candidate stress tests and recovery checks; they are not single-simulation latency measurements or guarantees.

Heavy decision work runs in a cancellable worker. The imported-road limit is 900 nodes / 1,400 edges plus up to 35 facility connectors; at most 80 OD pairs and 12 closures. Exact/beam thresholds and Monte Carlo limits depend on graph size. Start with 1–10 km², two or three closures, and 100 samples. The maximum geographical area is 25 km², subject to density limits. Large repeated experiments may take tens of seconds.

## Security and publication boundary

Five actual UI captures are in [screenshots/ultimate](screenshots/ultimate/): recovery alternatives, uncertainty/robustness, generated report preview, Okayama criticality map and Japanese recovery. Reproduce with `pnpm screenshots:decision` against the production server. The capture workflow asserts calculated results and zero page errors; the images were visually inspected. It does not substitute metrics or stage a fake network request.

The prior stable checkpoint and separate engine, evidence/reporting and UI commits are preserved in the local development-history backup. The current public repository starts from the reviewed version 3.0 source snapshot with GitHub noreply author/committer metadata. Original development commit IDs are not part of this new public history. The retained checkpoint was not amended or overwritten.

The existing public-file checker scans staged content and reachable commit history for credentials, prohibited private files, personal email addresses and private user-directory paths; its output redacts findings. Environment files, keys, local recordings, internal backups and generated logs remain excluded. A zero-finding scan is a safeguard, not proof that arbitrary future text cannot contain personal information. User-entered scenario names and selected network coordinates are intentionally included in user exports, so review those before sharing.

## Scope boundaries

- Robustness compares the three current-scenario shortlisted plans using common samples. It is not global robust optimization.
- Recovery costs, failure probabilities and protected-after-repair assumptions are hypothetical user parameters. Recovery stages are not days.
- Zone disparity is an explainable model diagnostic, not a validated demographic equity score.
- Reports are standalone print-ready HTML with an SVG graph; use browser Print to PDF. They do not contain a basemap tile capture.
- Existing optional cloud/local AI briefs remain; the new advanced evidence has deterministic explanations and report text. A new LLM prompt integrating every advanced result was deferred.
- Sensitivity, new links/capacity interventions, physical cascade failures, shareable URLs and split maps were deferred to preserve the core workflow.
- Browser coverage is Chromium desktop/mobile; no claim of a full Safari/Firefox device matrix.

See [model definitions and 90-second / five-minute demo flows](ULTIMATE_UPGRADE.md).
