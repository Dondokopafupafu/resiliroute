# In-app area workflow verification — 19 October 2026

This record covers the completed area-selection, acquisition and closure workflow. Live-provider observations below were captured on 16 October; the final regression and publication checks were repeated on 19 October. Earlier records describe earlier limits and dependencies. Software verification does not validate real-world traffic forecasts or emergency safety.

## Completed workflow

Users pan and zoom the map, select the visible area or two corners, resize the rectangle by dragging its four handles, and build that exact area. No external website or manual file download is required for the integrated acquisition paths.

Ordinary Build reuses an available regional pack before trying the bounded Overpass proxy. A fresh regional download needs a separate size preview and explicit confirmation inside the app. Geofabrik's official catalog selects a containing extract; arbitrary download URLs are rejected. Packs over 32 MiB are transferred in sequential 16 MiB parts with checked ranges and a consistent source version. Cancellation removes the owned partial file. Invalid cached PBF content invalidates that pack instead of repeatedly reusing it.

The selected road's close/reopen action is directly above the map. The nearby impact panel compares the same network before and after closure, counts changed OD paths and roads carrying additional modeled flow, and warns about newly unreachable OD pairs. “See what changed” focuses this panel. Import errors receive focus and remain distinguishable from a successful model. Current metrics unlock further road actions while the worker completes critical-link analysis.

## Actual OSM browser checks

These were actual extracted networks, not mocked API successes. Each case was built, exported as a snapshot, closed through the UI, reset to resilience 100, switched to Japanese and checked at a 390-pixel mobile width. Captures had no page exceptions or horizontal overflow.

| Area            | Bounds: south, west, north, east | Area      | Road nodes / road links | Selected closure  | Displayed travel time | Essential-service access | Resilience |
| --------------- | -------------------------------- | --------- | ----------------------- | ----------------- | --------------------- | ------------------------ | ---------- |
| Central Tokyo   | 35.66, 139.72, 35.72, 139.80     | 48.20 km² | 3,828 / 5,202           | 首都高速4号新宿線 | 8.2 → 13.3 min        | 88.6 → 79.0%             | 100 → 68   |
| Kochi area      | 33.52, 133.48, 33.60, 133.60     | 98.91 km² | 1,226 / 1,526           | 高知自動車道      | 23.5 → 26.7 min       | 53.8 → 45.9%             | 100 → 76   |
| Saitama / Omiya | 35.90, 139.61, 35.918, 139.632   | 3.97 km²  | 896 / 1,256             | さいたま春日部線  | 2.5 → 12.0 min        | 100.0 → 100.0%           | 100 → 64   |

Tokyo showed seven changed modeled OD paths, 42 extra-flow roads and three additional unreachable OD pairs. Kochi showed four, 52 and three respectively. Saitama showed 23, 13 and 12. Saitama's category accessibility did not fall: it must not be described as having an accessibility decrease. Unreachable journeys contribute the model's finite penalty to average travel time.

The Kochi run included a fresh 91.6 MB regional download, extraction and initial simulation, taking about 103 seconds. Tokyo's already-downloaded 519.4 MB regional source took about 101 seconds to extract and prepare during concurrent verification. A different Saitama rectangle used ordinary Build and the same Kantō source without another regional download, taking about 71 seconds. These are observations on one development machine, not latency guarantees. A small Monaco case also verified the pipeline and closure before the two-pack retention policy replaced its source pack.

On 19 October, ordinary Build was repeated for Saitama using the retained Kantō pack, without another source download. Extraction and initial simulation took about 135 seconds while the full regression suite ran concurrently. The same closure again produced 2.5 → 12.0 minutes, unchanged 100% category accessibility and resilience 100 → 64; reset restored 100. The final English capture and Japanese mobile capture were inspected, with no page exceptions or horizontal overflow. This also checks source reuse across an app-server restart.

## Diagnosed and fixed limits

Tokyo initially exceeded the interim 3,000-node / 5,000-road guard. Its actual 3,828-node / 5,202-road model was profiled before raising the supported maximum to **5,000 road nodes / 8,000 road links**, plus up to 35 facility connectors. The direct engine diagnostic measured roughly 0.93 seconds for baseline, 0.78 seconds for a closure and 10.3 seconds for 12 stress-test candidates. Concurrent tests can be slower. The main UI remains outside that worker.

The area maximum is **100 km²**, subject to density limits. Above 25 km², or when detailed streets exceed limits, the disclosed major-road profile excludes residential/local streets within the same rectangle. It does not shrink the bounds silently. Roads outside the rectangle and relation-form facilities are not reconstructed. At most 35 facilities are connected; omitted facilities can reflect this cap or connection distance, not real-world isolation. Larger networks screen 12 candidates; their ranking is not exhaustive.

## Final automated checks

| Check                                 | Result                                               |
| ------------------------------------- | ---------------------------------------------------- |
| Frozen dependency installation        | Passed                                               |
| ESLint, formatting, strict TypeScript | Passed                                               |
| Unit/data/security tests              | 168 passed across 24 files                           |
| Production Chromium E2E               | 72 passed: 36 desktop + 36 mobile                    |
| Production build                      | Passed                                               |
| Production dependency audit           | No known advisories reported at verification time    |
| Server deployment trace review        | Eight manifests; zero private/cache/credential paths |

Regression coverage includes shared Harbor metrics, arbitrary rectangles, draggable corners, bilingual closure/results, error focus, regional download confirmation, oversized sources, HTTP range consistency, cache reuse, malformed PBF, cancellation, rate limits, snapshot validation, recovery, reports and existing saved real-city examples. Public-provider availability is not inferred from mocked tests. Optional paid cloud AI was not called for this verification.

## Remaining operational boundaries

- Public Overpass services returned errors or throttling during investigation. The app does not bypass their cooldown or substitute another city as a successful live response.
- A containing regional pack must be at most 600 MiB. Not every world region is available within that limit. The first download and a new-area extraction can take minutes.
- Regional packs require writable server storage: two retained packs, with a temporary third during replacement. Serverless read-only/short-duration hosts need a suitable deployment or the Overpass path. This is not a claim of scalable public hosting.
- The server limits regional work to one job, 280 seconds per job and two new download starts per process per hour. Packs are reusable for seven days; derived graphs for 20 minutes. Limits are per process, not a distributed quota.
- Geometry and supported facilities are imported OSM data. Speeds may use defaults; capacities and mobility demand are modeled. Facility omissions, disconnected components and boundary effects are disclosed.
- Local source packs, raw diagnostics and screenshots remain Git-ignored. Credentials and private operator files are excluded from both source publication and deployment tracing. Automated scanning reduces risk but cannot prove the absence of every possible secret format.

See [the Japanese operation guide](IN_APP_AREA_WORKFLOW.md), [data pipeline](../README.md#real-city-lab) and the retained earlier [custom-area](CUSTOM_AREA_QA.md) and [decision-workspace](ULTIMATE_QA.md) records.
