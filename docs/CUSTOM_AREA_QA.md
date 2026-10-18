# Arbitrary-area import verification — 16 October 2026

Historical record: the [completed in-app workflow verification](IN_APP_AREA_QA.md) supersedes this record's limits, dependency and test totals.

This follow-up concerns location selection and file import. The simulation formulas, synthetic Harbor dataset, existing saved cities and decision algorithms are unchanged. See the [previous version-3 audit](ULTIMATE_QA.md) for broader modeling limitations.

## What changed

- Select any supported mapped area by panning/zooming or by pasting decimal latitude/longitude or a full OpenStreetMap map URL. The two example cities are shortcuts, not a geographic limit.
- Starting rectangle selection no longer resets a panned map to the previous rectangle. Coordinate/URL entry starts with a 2 × 2 km rectangle; users can adjust it.
- Import bounded OSM XML or raw Overpass JSON locally, then run the same graph builder in a cancellable worker and the existing simulation pipeline. XML bounds replace the current selection; ordinary Overpass JSON needs a matching selected rectangle.
- Ignore XML attributes unrelated to this model, including contributor metadata and contact information. Real area exports can contain relations with hundreds of multilingual tags; these no longer cause an otherwise usable road import to fail. Structural, file-size, geometry and graph limits still apply.
- Use the current documented Private.coffee fallback endpoint. Try each configured service once; HTTP 429 stops retry/failover and sets a process-local cooldown that honors Retry-After.

## Automated verification

| Check                    | Result                           |
| ------------------------ | -------------------------------- |
| Unit/data suite          | 120 tests across 19 files passed |
| Production browser suite | 60 tests: 30 desktop + 30 mobile |
| ESLint                   | Passed, zero warnings            |
| Strict TypeScript        | Passed                           |
| Prettier                 | Passed                           |
| Production build         | Passed                           |

New regression coverage includes coordinate and OSM URL validation, map panning during rectangle selection, explicit local XML import during API failure, irrelevant relation-tag filtering, closure/recalculation/reset, rejected unsafe XML preserving the existing network, fallback endpoint selection and HTTP 429 cooldown. Existing Okayama/Matsumoto snapshots and Harbor baseline regressions remain covered. Browser import tests use a small fixture; they do not claim that live Overpass is available.

The Git privacy fixture suite exceeded its original five-second timeout under Windows process-startup load. Its allowance is now 15 seconds; all leak-detection assertions remain unchanged. This is a test-runner allowance, not a simulator performance claim.

## Actual external-data check

A single official OSM map API export returned HTTP 200 for a small public Tokyo area: west 139.759, south 35.676, east 139.765, north 35.682. This is approximately 0.36 km² around the Marunouchi/Hibiya road network. The 4.47 MiB XML was imported through the actual production UI without changing model inputs or injecting results.

The generated summary contained 50 road decision nodes, 58 road links, two stations, 11 modeled origins and 27 OD pairs. No hospitals or shelters were present in this imported model. Road inspection, closure, recalculation, snapshot export and reset completed. The small rectangle had four connected components; routes beyond the boundary are excluded. Large travel-time effects in such a case can reflect the model's disconnected-demand penalty, not observed delay.

The real-data browser run produced no page errors. English/Japanese screenshots were inspected, and the 390-pixel-wide Japanese location controls had no horizontal overflow. Local raw XML and verification captures are kept outside the published repository. The exported network excludes OSM contributor accounts and contact tags.

## Verified limits and unresolved dependency

Direct Overpass probes from this execution environment returned HTTP errors, timeouts or rate limiting. Therefore live arbitrary-area Overpass acquisition remains **unverified as working here**. The separate official OSM map export succeeded, and the user-file route was verified; this does not establish that either public service is always available.

No API key is required for these public OSM services. Coordinate/URL navigation does not send a geocoder request. Place-name search is not implemented. Imported files may be up to 10 MiB; the same 25 km² maximum and graph-complexity limits apply. XML facility relations without centers, compressed PBF and history/change files are unsupported. Imported provenance is file-supplied, not independently authenticated. Road geometry is real source data; capacity, demand and analysis remain modeled estimates, not emergency guidance.
