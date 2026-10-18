import { buildGraph, shortestPathsFrom } from "@/lib/graph/shortest-path";
import { haversine } from "@/lib/osm/geo";
import { realCityConfig } from "./model-config";
import type { Network, NetworkNode, ODPair } from "@/types/network";

export function spatialSample(nodes: readonly NetworkNode[], count: number): NetworkNode[] {
  if (!nodes.length) return [];
  const pool = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  const selected = [pool.shift()!];
  while (pool.length && selected.length < count) {
    let bestIndex = 0,
      bestDistance = -1;
    pool.forEach((node, i) => {
      const nearest = Math.min(
        ...selected.map((s) =>
          haversine([s.latitude, s.longitude], [node.latitude, node.longitude]),
        ),
      );
      if (nearest > bestDistance) {
        bestDistance = nearest;
        bestIndex = i;
      }
    });
    selected.push(pool.splice(bestIndex, 1)[0]);
  }
  return selected;
}

export function generateDemand(network: Network): ODPair[] {
  const roadNodes = network.nodes.filter((n) => n.id.startsWith("osm-node-"));
  const residentialWeights = new Map<string, number>();
  const roadWeights = new Map<string, number>();
  for (const edge of network.edges.filter((e) => e.osm)) {
    for (const id of [edge.source, edge.target])
      roadWeights.set(id, (roadWeights.get(id) ?? 0) + edge.distance / 2);
  }
  for (const edge of network.edges.filter(
    (e) => e.osm?.highway === "residential" || e.osm?.highway === "living_street",
  )) {
    for (const id of [edge.source, edge.target])
      residentialWeights.set(id, (residentialWeights.get(id) ?? 0) + edge.distance / 2);
  }
  const candidates = roadNodes.filter((n) => residentialWeights.has(n.id));
  const origins = spatialSample(
    candidates.length >= 2 ? candidates : roadNodes,
    Math.min(realCityConfig.maxOrigins, Math.max(1, roadNodes.length - 2)),
  );
  origins.forEach((n, i) => {
    n.type = "residential";
    n.name = `Modeled origin ${String(i + 1).padStart(2, "0")}`;
    // Regional arterial networks have no residential layer. Road length then
    // supplies a disclosed demand proxy, never census population.
    const weights = candidates.length >= 2 ? residentialWeights : roadWeights;
    n.populationWeight = Math.max(1, (weights.get(n.id) ?? 0.1) * 100);
    n.demandWeight = 1;
  });
  const originIds = new Set(origins.map((n) => n.id));
  const proxies = spatialSample(
    roadNodes.filter((n) => !originIds.has(n.id)),
    3,
  );
  proxies.forEach((n, i) => {
    n.type = "commercial";
    n.name = `Destination proxy ${i + 1}`;
    n.demandWeight = 1;
  });
  const destinations = spatialSample(
    network.nodes.filter((n) => n.essentialService || n.type === "school"),
    realCityConfig.maxDestinations - proxies.length,
  ).concat(proxies);
  const graph = buildGraph(network);
  const pairs: ODPair[] = [];
  origins.forEach((origin) => {
    const nearest = [...destinations]
      .filter((d) => d.id !== origin.id)
      .sort(
        (a, b) =>
          haversine([origin.latitude, origin.longitude], [a.latitude, a.longitude]) -
            haversine([origin.latitude, origin.longitude], [b.latitude, b.longitude]) ||
          a.id.localeCompare(b.id),
      );
    const chosen = new Map<string, NetworkNode>();
    const routes = shortestPathsFrom(
      graph,
      origin.id,
      nearest.map((d) => d.id),
    );
    for (const type of ["hospital", "station", "shelter", "commercial", "school"]) {
      const dest = nearest.find((d) => d.type === type && routes[d.id].reachable);
      if (dest) chosen.set(dest.id, dest);
    }
    for (const dest of chosen.values()) {
      if (pairs.length >= realCityConfig.maxODPairs) break;
      pairs.push({
        id: `od-${origin.id}-${dest.id}`,
        origin: origin.id,
        destination: dest.id,
        demand:
          origin.populationWeight * (dest.type === "hospital" || dest.type === "shelter" ? 0.5 : 1),
        purpose:
          dest.type === "commercial"
            ? "commerce"
            : dest.type === "station"
              ? "commute"
              : "services",
      });
    }
  });
  const capacities = network.edges
    .filter((e) => e.osm)
    .map((e) => e.capacity)
    .sort((a, b) => a - b);
  // Scale to 0.75 median shared-link capacity per sampled origin. This is a
  // scenario input, not a fit to measured traffic or desired KPI values.
  const total = Math.min(
    realCityConfig.maxDemand,
    (capacities[Math.floor(capacities.length / 2)] ?? 450) *
      origins.length *
      realCityConfig.demandScale,
  );
  const weightSum = pairs.reduce((sum, p) => sum + p.demand, 0);
  return pairs.map((p) => ({ ...p, demand: (total * p.demand) / weightSum }));
}
