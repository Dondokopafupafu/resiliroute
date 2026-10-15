// An explicit film evidence export, excluded from the app's normal test suite.
import { it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { validateSnapshot } from "@/lib/real-city/snapshot";
import { simulate } from "@/lib/simulation/simulate";
import { analyzeCriticalLinks, analyzeRecovery } from "@/lib/simulation/stress-test";
import { screenCriticalCandidates } from "@/lib/real-city/stress-screening";
import { realCityContext } from "@/lib/real-city/context";
import { generateLocalAnalysis } from "@/lib/ai/analysis";
import { buildGraph, shortestPath } from "@/lib/graph/shortest-path";

it("exports actual simulation evidence for the film", () => {
  const dir = "video/creator-colosseum/assets";
  const snapshot = validateSnapshot(
    JSON.parse(readFileSync(`${dir}/network.json`, "utf8").replace(/^\uFEFF/, "")),
  );
  const { network, odPairs } = snapshot;
  const baseline = simulate(network, odPairs);
  const bridges = network.edges.filter((e) => e.osm?.bridge && e.distance > 0.03);
  const bridgeSurvey = bridges.map((e) => ({
    id: e.id,
    name: e.name,
    metrics: simulate(network, odPairs, [e.id], baseline).metrics,
  }));
  console.info(JSON.stringify(bridgeSurvey));
  const chosen =
    process.env.FILM_ROAD ??
    bridgeSurvey.sort((a, b) => a.metrics.resilienceScore - b.metrics.resilienceScore)[0].id;
  const current = simulate(network, odPairs, [chosen], baseline);
  const screened = screenCriticalCandidates(network, current);
  const ranking = analyzeCriticalLinks(network, odPairs, current, baseline, screened.ids);
  const recovery = analyzeRecovery(network, odPairs, current, baseline);
  const secondary = ranking[0].edgeId;
  const multiple = simulate(network, odPairs, [chosen, secondary], baseline);
  const multiRecovery = analyzeRecovery(network, odPairs, multiple, baseline);
  const flows = network.edges
    .filter((e) => e.osm && e.id !== chosen)
    .map((e) => ({
      id: e.id,
      name: e.name,
      before: baseline.edgeStates[e.id],
      after: current.edgeStates[e.id],
      increase: current.edgeStates[e.id].volume - baseline.edgeStates[e.id].volume,
    }))
    .sort((a, b) => b.increase - a.increase);
  const beforeGraph = buildGraph(network);
  const afterGraph = buildGraph(network, [chosen]);
  const changedRoutes = baseline.assignments
    .map((a) => {
      const before = shortestPath(
        beforeGraph,
        a.od.origin,
        a.od.destination,
        (e) => baseline.edgeStates[e.id].travelTime,
      );
      const after = shortestPath(
        afterGraph,
        a.od.origin,
        a.od.destination,
        (e) => current.edgeStates[e.id].travelTime,
      );
      return {
        od: a.od,
        destinationName: network.nodes.find((n) => n.id === a.od.destination)?.name,
        before,
        after,
        extra: after.travelTime - before.travelTime,
      };
    })
    .filter(
      (a) =>
        a.before.reachable &&
        a.after.reachable &&
        a.before.edgeIds.includes(chosen) &&
        network.nodes.find((n) => n.id === a.od.destination)?.type === "hospital",
    )
    .sort((a, b) => b.extra - a.extra);
  const context = realCityContext(snapshot, baseline, current, ranking, recovery, screened);
  const evidence = {
    capturedAt: snapshot.createdAt,
    model: snapshot.realCityModelVersion,
    stats: snapshot.stats,
    baseline: baseline.metrics,
    current: current.metrics,
    closed: network.edges.find((e) => e.id === chosen),
    secondary: network.edges.find((e) => e.id === secondary),
    multiple: multiple.metrics,
    ranking,
    screened,
    recovery: recovery.map(({ result, ...r }) => ({ ...r, metrics: result.metrics })),
    multiRecovery: multiRecovery.map(({ result, ...r }) => ({ ...r, metrics: result.metrics })),
    flows: flows.slice(0, 8),
    routes: changedRoutes.slice(0, 5),
    services: { before: baseline.services, after: current.services },
    districts: current.districts,
    brief: generateLocalAnalysis(context, "en"),
    bridgeSurvey,
  };
  expect(current.metrics.resilienceScore).toBeLessThan(100);
  expect(network.nodes.find((n) => n.id === changedRoutes[0].od.destination)?.type).toBe(
    "hospital",
  );
  writeFileSync(`${dir}/evidence.json`, JSON.stringify(evidence, null, 2));
  console.info(
    JSON.stringify({
      chosen: evidence.closed?.name,
      baseline: evidence.baseline,
      current: evidence.current,
      route: changedRoutes[0],
      flow: flows[0],
      recovery: evidence.multiRecovery,
    }),
  );
}, 120000);
