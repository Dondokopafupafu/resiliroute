# ResiliRoute

**Urban Mobility Resilience Simulator**

_When one link fails, how does the whole city change?_

This narrative describes the original Harbor City contest demonstration. **Version 2.0 adds Real City Lab**: OSM road and facility import, automatic graph building, modeled demand on real infrastructure, real-road closures, provenance and reproducible snapshots. See [REAL_CITY_UPGRADE.md](REAL_CITY_UPGRADE.md) for the separate upgrade scope and verification. Disclose existing work when entering a competition that requires new development.

## Inspiration

Cities rely on networks, but disruptions are often described one location at a time. A bridge closure can shift demand onto another corridor, increase delays far from the damage, and make a hospital harder to reach. For communities and students, that chain of consequences is difficult to see.

I wanted to make transportation resilience something people could explore, question and understand. Japan-inspired rail dependency, river crossings and coastal neighborhoods shaped Harbor City, the fictional network used in ResiliRoute.

## What it does

ResiliRoute stress-tests a city’s mobility network. Users can run a short earthquake demo, compare flood or rail disruption, or close individual links on the map. The application recalculates routes, redistributes synthetic travel demand, estimates congestion and compares essential-service access across districts.

The included earthquake scenario increases modeled average travel time from 14.2 to 20.9 minutes and lowers essential-service accessibility from 94.4% to 78.9%. Every OD pair still has a path—showing why connectivity alone is not enough. East district’s average modeled trip nearly doubles.

The analysis goes further: remove every available link individually to identify the next weak point, then independently reopen each closed link to compare recoveries. Restoring Harbor Bridge produces the largest modeled resilience improvement in the earthquake scenario.

A structured resilience brief explains what changed, how demand moved, who is affected and which possible response deserves investigation. It uses a deterministic local analyst by default and an optional, server-side OpenAI model grounded in the same computed evidence.

## How we built it

I built ResiliRoute as a solo student project using Next.js App Router, React and strict TypeScript. Leaflet displays the network over OpenStreetMap, Recharts compares before/after indicators, and a consistent civic analytics interface keeps the main story visible.

The simulation is separate from the UI. An original Dijkstra implementation finds least-cost paths. Twenty-four successive-average assignment iterations redistribute 43 synthetic OD pairs and update a bounded BPR congestion function. Accessibility weights population and service thresholds; network efficiency uses a demand-weighted harmonic index. Criticality and recovery are full model reruns, not fixed labels or rankings.

The optional OpenAI route recomputes trusted metrics from validated link IDs, requests schema-constrained JSON and falls back automatically. Exact numbers stay in calculated evidence cards; LLM prose is rejected if it introduces numeric claims. No API key is exposed to the client.

AI coding assistance supported architecture, implementation, debugging, tests and documentation. The product also uses AI meaningfully: translating an explainable simulation into a concise planning brief. Its local mode is explicitly labeled as deterministic analysis rather than an LLM.

## Challenges we ran into

- **Making the cascade real.** A closure needed to change flows elsewhere, not just change a line’s color. Route-flow averaging preserves demand while recomputing congestion.
- **Avoiding misleading averages.** Unreachable demand receives an explicit penalty and its disconnected share remains visible. District and facility analysis show impacts that citywide averages hide.
- **Designing credible synthetic data.** I adjusted network capacity and redundancy, then tested connectivity, flow conservation, bounded costs and disruption sensitivity. Displayed results come from inputs and algorithms.
- **Explaining composite scores.** Every threshold, normalization, weight and retention exponent appears in Methodology. The reference resilience score is 100 by definition, not a claim that the normal city is perfectly safe.
- **Keeping the demo dependable.** The full flow works without credentials. Tile failures retain the schematic network; invalid AI responses retain the computed local brief; Skip and Reset cancel pending demo timers.

## Accomplishments that we're proud of

- A working one-click demonstration of cascading network impacts, backed by actual calculations.
- A scenario-dependent stress-test ranking and independently computed recovery priorities.
- An equity lens connecting infrastructure disruption to hospital, shelter and district access.
- An analyst layer that explains evidence without pretending to predict disasters or certify safe routes.
- Unit/data/provider/localization and desktop/mobile browser checks, including isolation, recovery, export, language switching and fallback behavior. The original suite remains in the version 2.0 regression checks; exact current counts appear in [QA_REPORT.md](QA_REPORT.md).
- A complete, responsive product with an inspectable methodology and reproducible dataset.

## What we learned

Resilience is not simply the existence of another path. The capacity, time and social consequences of that path matter. A network can remain connected while timely access declines, and the most critical remaining link changes after a disruption.

I also learned to distinguish a compelling demonstration from a validated operational model. Transparent assumptions, tests and honest limitations make the prototype more useful than exaggerated claims.

## What's next for ResiliRoute

Real City Lab now imports OSM geometry and facilities while clearly labeling demand and capacity as modeled inputs. Richer service thresholds, uncertainty analysis and verified local demand would improve planning relevance. A future recovery model could compare limited repair budgets and combinations of repairs rather than independent single-link interventions.

ResiliRoute is an educational decision-support prototype. Harbor City uses synthetic static data; Real City Lab combines OSM infrastructure with modeled mobility. It is not real-time traffic forecasting, an official emergency system or evacuation guidance. Actual emergencies require official local information.

## Technologies used

The interface also supports Japanese and English, including place labels, methodology and evidence-grounded briefs. Switching language keeps the current simulation intact.

Next.js, React, TypeScript, Tailwind CSS, Leaflet, React-Leaflet, OpenStreetMap, Recharts, Lucide, Vitest, Playwright, graph theory, Dijkstra, successive-average traffic assignment, BPR congestion modeling, population-weighted accessibility, network stress testing, OpenAI Responses API with Structured Outputs, deterministic local analysis.
