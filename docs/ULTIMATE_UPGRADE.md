# Ultimate Resilience upgrade

Version 3.0 adds a decision layer to the existing application. It reuses the same network data, `simulate`, Dijkstra, 24-step assignment, congestion and metric definitions. The prior stable version and its checkpoint remain in the local development-history backup without amendment or squashing. This public repository starts from the reviewed version 3.0 snapshot.

## What is implemented

| Question                           | Evidence in the product                                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Several links fail together?       | Stage up to 12 links, apply once, restore one/all. Existing presets remain.                                     |
| Where is the impact unequal?       | District/neutral-zone travel time, access, hospital/station access, disconnected demand and access-loss spread. |
| Which links matter most?           | Existing single-link stress tests, five relative map bands, untested state, component explanations.             |
| What fits a recovery budget?       | Five objectives, relative costs, exact/beam optimizer, three alternatives and apply-plan action.                |
| How uncertain is a recommendation? | Seeded independent-failure experiment; shared-draw robust shortlist comparison.                                 |
| Which scenario is worse?           | Four saved scenarios plus baseline; severity = 100 − resilience, separate metric views.                         |
| Who benefits from a plan?          | Apply a recovery plan, inspect updated zone/facility results, save it for comparison.                           |
| Can a planner review it?           | Standalone print report, modeled network SVG, five CSVs and evidence JSON.                                      |

## Architecture and files

- `lib/decision/config.ts`: costs, preference weights, version and workload limits.
- `recovery.ts`: shared-simulator cache, objective ranking, affordable subsets/beam search, subset-DP sequence.
- `uncertainty.ts`: seeded sampling, interpolated quantiles, threshold probabilities, common-draw repair comparison.
- `analysis-worker.ts`: typed jobs/progress/results; cancellation terminates the worker.
- `evidence.ts`: flow change, utilization-point thresholds, zones, facility-specific access and criticality explanation.
- `scenarios.ts`: deterministic canonical SHA-256 identity, allowlisted validation, local persistence helpers.
- `report.ts`: escaped HTML with restrictive CSP, CSV formula protection and allowlisted evidence serialization.
- `components/decision/`: one reusable bilingual workspace. Parents supply the network and apply closures; calculations do not fork by city mode.
- Shared map controls select traffic, criticality or cascade stress; Before/After affects only map evidence.

No additional production dependencies or paid services were added.

## Algorithm definitions

### Recovery

Every candidate repair set removes those edges from the active closure set and reruns the existing simulator against the original baseline. The empty repair set is valid. Ties prefer lower cost, then deterministic IDs.

Exact limits: 12 closures for ≤80 graph edges; 8 for ≤200; 6 above 200. Larger jobs use a beam of 12 with at most 512 evaluations on ≤200 edges or 128 on larger graphs. These limits include facility connectors in graph size. The result reports exact/beam, evaluated plans and limits. Beam returns the best evaluated plans, without an optimality guarantee.

Single objectives directly rank resilience, access, efficiency or decreasing travel time. The monotone travel score is `100 / (1 + currentTime / baselineTime)`, with a positive denominator guard. Balanced is `100 × (0.4 R/100 + 0.3 A/100 + 0.2 min(1,T0/T) + 0.1 min(1,E/E0))`. Each term is bounded. Overlapping component weights are preference choices. With no facilities, accessibility is N/A and its numerical balanced contribution is the same zero for every plan; selecting accessibility alone cannot distinguish those plans.

The sequence maximizes the sum of stage resilience for the top plan using subset dynamic programming through eight repairs; larger plans use greedy marginal selection. This is a sequence of model states, not a scheduling or construction-duration optimizer. Sequence objective remains cumulative resilience even when the plan was chosen for another objective.

### Uncertainty and robust comparison

The seeded PRNG samples each candidate link independently. The UI samples active or staged links, leaving other links available. Repeated closure sets reuse a bounded cache. At most 1,000/300/100 runs are allowed in the three graph-size bands. Quantiles use linear interpolation of sorted samples; threshold probabilities are fractions of runs. Worst sampled means the smallest simulated resilience.

The robust comparison reevaluates at most the three shortlisted plans using the identical sampled closure sets and assumes repaired links protected in those samples. It ranks by mean or minimum sampled resilience. This is a controlled comparison, **not a globally optimal robust recovery strategy**. Independence, probabilities and protection are user-defined scenario assumptions. No physical failure probability is inferred from OSM.

### Cascades, zones and facilities

Secondary stress measures changes on still-open links: flow and `100 × (scenario v/c − baseline v/c)`. Thresholds are 10, 30 and 60 points. It does not automatically close overloaded roads or predict physical destruction.

Harbor uses existing districts. Real City uses a 2×2 spatial grid with empty origin zones omitted. Diagnostic impact = `0.5 × nonnegative access loss + 0.3 × capped relative time increase + 0.2 × additional disconnected share`, in points/percent. Impact gap is maximum minus minimum diagnostic; accessibility disparity is the range of nonnegative access losses. These are not validated social-equity indices or inferred demographics.

Facility access is computed for each facility using the existing thresholds (hospital/clinic 20 min, shelter 15, station 12). Missing categories are N/A. A positive baseline catchment falling to zero is labeled critical access loss in this model, not a real-world safety verdict.

## Data and limits

Real geometry, road classification, available direction/speed/lanes tags and facilities come from OSM. Missing speed/lanes and all capacities are estimated. Origin weights and OD demand are synthetic. Closure choices, failure probabilities and recovery costs are assumptions. No current location is requested.

Recommended analysis area remains 1–10 km², maximum 25 km². Road topology limits remain 900 nodes / 1,400 road edges, plus up to 35 facility nodes/connectors. Decision tools support that full imported graph limit, 80 OD pairs and 12 closures. Start with a few failures and 100 Monte Carlo runs. Dense uncertainty/beam jobs can take tens of seconds; progress is actual work and Cancel stops them. No universal sub-second claim is made.

Reports contain names and coordinates from the selected network and user-entered scenario names. They omit runtime credentials, account data and map tiles. Saved-scenario JSON (≤128 KiB) validates version, known IDs and full network/model/demand identity; imported metrics are discarded. Network snapshot import remains the existing separate format. The evidence JSON bundle is export-only.

## Completed scope and deliberate boundaries

Priority S and the required recovery sequence are implemented. Priority A includes uncertainty, shortlist robustness, facility-specific access, load redistribution, recovery stages and saved scenarios. Criticality uses the existing all-link/screened model rather than a new invented ranking.

Deferred: global robust-plan search, physical cascading failure, sensitivity experiments, capacity/hardening/temporary-link interventions, shareable URLs, split-screen maps, demographic equity claims and a new LLM prompt consuming all advanced results. The existing optional cloud/local brief is preserved. New criticality narratives and report explanations are deterministic evidence-based text. Print-ready HTML uses browser PDF printing; there is no direct server PDF renderer.

## 90-second demonstration

1. **0–15s:** Real City Lab → load saved Okayama example. Say this is an attributed actual OSM snapshot with synthetic demand, not a live API recording.
2. **15–30s:** Use the existing critical ranking to inspect a road; add it and another road in Decision Lab. Run multi-failure. Show baseline/current deltas.
3. **30–45s:** Show cascade stress and the criticality layer; explain that untested roads are gray. Inspect the most affected modeled zone/facility.
4. **45–65s:** Recover → budget 5 → compare exact top alternatives (or explicit approximation if the chosen workload requires it). Show the recovery-stage curve.
5. **65–80s:** Run a prepared small seeded uncertainty experiment; compare the shortlist by mean and worst sampled outcome. Identify the assumptions.
6. **80–90s:** Report → generate HTML → explain Print to PDF and provenance. For a guaranteed fast offline stage demo, Harbor's Earthquake preset runs the identical decision layer.

## Five-minute competition flow

| Time      | Screen / message                                                                                                                             |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:25 | Road-network map. A local failure changes travel, access and recovery priorities across a network.                                           |
| 0:25–0:55 | Real City Lab, OSM source and modeled-demand disclosure. Select/build or explicitly load a captured example.                                 |
| 0:55–1:50 | Stage multiple closures, apply, show actual KPI deltas, traffic redistribution and facility access. Read only the current calculated values. |
| 1:50–2:30 | Criticality map, tested candidate count, neutral-zone disparity. Save and compare two scenarios.                                             |
| 2:30–3:20 | Budget 5, costs as relative points, exact/approximate label, top plans, benefit/cost and recovery sequence.                                  |
| 3:20–3:55 | Seeded uncertainty and same-draw robustness. Clarify hypothetical independent probabilities and shortlist limits.                            |
| 3:55–4:20 | Existing evidence-based AI brief and print report; algorithms compute numbers, prose interprets them.                                        |
| 4:20–4:50 | Potential education, community-preparedness and professional-analysis users. Future deployment tiers are proposals, not existing customers.  |
| 4:50–4:58 | Product name, repository and short prior-work/AI-assisted-development disclosure.                                                            |

The existing 4:54 film remains a version-2 artifact. This document is the new version-3 demo flow, not a claim that the old film shows these additions.
