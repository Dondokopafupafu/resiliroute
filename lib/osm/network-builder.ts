import { geometryDistance, haversine, ImportError, inside, validateBoundingBox } from "./geo";
import { parseOSMResponse } from "./osm-parser";
import { realCityConfig, roadDefaults } from "@/lib/real-city/model-config";
import { roadModel } from "@/lib/real-city/road-model";
import { generateDemand } from "@/lib/real-city/demand-generator";
import type { District, Network, NetworkNode } from "@/types/network";
import type {
  BoundingBox,
  ImportedFacility,
  OSMNode,
  OSMTags,
  OSMWay,
  RealCityNetwork,
} from "@/types/real-city";

function districtFor(lat: number, lon: number, b: BoundingBox): District {
  const x = (lon - b.west) / (b.east - b.west) - 0.5;
  const y = (lat - b.south) / (b.north - b.south) - 0.5;
  if (Math.max(Math.abs(x), Math.abs(y)) < 0.18) return "Central";
  return Math.abs(y) > Math.abs(x) ? (y > 0 ? "North" : "South") : x > 0 ? "East" : "West";
}
function facilityType(tags: OSMTags): ImportedFacility["type"] | null {
  if (["hospital", "clinic"].includes(tags.amenity)) return "hospital";
  if (["station", "halt"].includes(tags.railway)) return "station";
  if (tags.emergency === "shelter") return "shelter";
  if (["school", "university"].includes(tags.amenity)) return "school";
  return null;
}
export function countComponents(network: Network): number {
  const adj = new Map(network.nodes.map((n) => [n.id, [] as string[]]));
  network.edges.forEach((e) => {
    adj.get(e.source)!.push(e.target);
    adj.get(e.target)!.push(e.source);
  });
  const visited = new Set<string>();
  let count = 0;
  for (const node of network.nodes) {
    if (visited.has(node.id)) continue;
    count++;
    const queue = [node.id];
    visited.add(node.id);
    for (let i = 0; i < queue.length; i++)
      for (const id of adj.get(queue[i])!)
        if (!visited.has(id)) {
          visited.add(id);
          queue.push(id);
        }
  }
  return count;
}

/** Same OSM node IDs connect ways; detailed shape nodes are retained only in geometry. */
export function buildRealCityNetwork(
  raw: unknown,
  input: BoundingBox,
  createdAt = new Date().toISOString(),
): RealCityNetwork {
  const bbox = validateBoundingBox(input);
  const data = parseOSMResponse(raw);
  const rawNodes = new Map(
    data.elements.filter((e): e is OSMNode => e.type === "node").map((n) => [n.id, n]),
  );
  const ways = data.elements.filter(
    (e): e is OSMWay =>
      e.type === "way" &&
      Object.hasOwn(roadDefaults, e.tags?.highway ?? "") &&
      !["no", "private"].includes(e.tags?.access) &&
      !["no", "private"].includes(e.tags?.motor_vehicle) &&
      !["no", "private"].includes(e.tags?.vehicle),
  );
  const memberships = new Map<number, number>();
  const neighbors = new Map<number, Set<number>>();
  ways.forEach((w) => {
    new Set(w.nodes).forEach((id) => memberships.set(id, (memberships.get(id) ?? 0) + 1));
    w.nodes.forEach((id, i) => {
      const set = neighbors.get(id) ?? new Set<number>();
      if (i > 0) set.add(w.nodes[i - 1]);
      if (i < w.nodes.length - 1) set.add(w.nodes[i + 1]);
      neighbors.set(id, set);
    });
  });
  const network: Network = { nodes: [], edges: [], accessibilityCategories: [] };
  const decisions = new Map<number, NetworkNode>();
  const addNode = (id: number) => {
    if (decisions.has(id)) return decisions.get(id)!;
    const p = rawNodes.get(id)!;
    const node: NetworkNode = {
      id: `osm-node-${id}`,
      name: `Intersection · ${id}`,
      latitude: p.lat,
      longitude: p.lon,
      type: "intersection",
      populationWeight: 0,
      demandWeight: 0,
      essentialService: false,
      district: districtFor(p.lat, p.lon, bbox),
    };
    decisions.set(id, node);
    network.nodes.push(node);
    return node;
  };
  let clippedWays = 0;
  for (const way of ways) {
    const model = roadModel(way.tags);
    const runs: number[][] = [];
    let run: number[] = [];
    for (const id of way.nodes) {
      const p = rawNodes.get(id);
      if (!p) throw new ImportError("INVALID_RESPONSE");
      if (inside(bbox, p.lat, p.lon)) run.push(id);
      else {
        if (run.length > 1) runs.push(run);
        run = [];
      }
    }
    if (run.length > 1) runs.push(run);
    if (runs.reduce((s, r) => s + r.length, 0) !== way.nodes.length) clippedWays++;
    let segmentIndex = 0;
    for (const ids of runs) {
      let start = 0;
      // Closed OSM rings need more than a self-loop to support routing.
      const ringMidpoint = ids[0] === ids.at(-1) ? Math.floor(ids.length / 2) : -1;
      for (let i = 1; i < ids.length; i++) {
        if (
          i !== ids.length - 1 &&
          i !== ringMidpoint &&
          (memberships.get(ids[i]) ?? 0) < 2 &&
          (neighbors.get(ids[i])?.size ?? 0) === 2
        )
          continue;
        const shapeIds = ids.slice(start, i + 1);
        if (model.reverse) shapeIds.reverse();
        const geometry: [number, number][] = shapeIds.map((id) => {
          const n = rawNodes.get(id)!;
          return [n.lat, n.lon];
        });
        const distance = geometryDistance(geometry);
        if (distance > 0.0001 && shapeIds[0] !== shapeIds.at(-1)) {
          const source = addNode(shapeIds[0]),
            target = addNode(shapeIds.at(-1)!);
          network.edges.push({
            id: `osm-way-${way.id}-${segmentIndex++}`,
            name: way.tags.name?.slice(0, 160) || `Unnamed ${way.tags.highway} road · ${way.id}`,
            source: source.id,
            target: target.id,
            mode: "road",
            distance,
            freeFlowTime: Math.max(0.001, (distance / model.speedKmh) * 60),
            capacity: model.capacity,
            currentVolume: 0,
            available: true,
            riskLevel: "low",
            infrastructureType: model.bridge ? "bridge" : "street",
            bidirectional: !model.oneWay,
            geometry,
            osm: {
              wayId: way.id,
              highway: way.tags.highway,
              speedKmh: model.speedKmh,
              speedSource: model.speedSource,
              lanes: model.lanes,
              lanesSource: model.lanesSource,
              bridge: model.bridge,
              tunnel: model.tunnel,
              oneway: model.oneWay,
            },
          });
        }
        start = i;
      }
    }
  }
  if (!network.edges.length || network.nodes.length < 3) throw new ImportError("EMPTY_ROADS");
  if (
    network.nodes.length > realCityConfig.maxNodes ||
    network.edges.length > realCityConfig.maxEdges
  )
    throw new ImportError("TOO_COMPLEX");
  if (
    network.edges.reduce((sum, e) => sum + (e.geometry?.length ?? 0), 0) >
    realCityConfig.maxGeometryPoints
  )
    throw new ImportError("TOO_COMPLEX");
  const intersections = network.nodes.length,
    roadLinks = network.edges.length;
  const roadNodes = [...network.nodes];
  const facilities: ImportedFacility[] = [];
  let excludedFacilities = 0;
  for (const e of data.elements) {
    const tags = e.tags ?? {},
      type = facilityType(tags);
    if (!type) continue;
    const coord = e.type === "node" ? { lat: e.lat, lon: e.lon } : e.center;
    if (!coord || !inside(bbox, coord.lat, coord.lon)) continue;
    const sorted = roadNodes
      .map((n) => ({
        node: n,
        distance: haversine([n.latitude, n.longitude], [coord.lat, coord.lon]),
      }))
      .sort((a, b) => a.distance - b.distance || a.node.id.localeCompare(b.node.id));
    const nearest = sorted[0];
    if (
      nearest.distance > realCityConfig.maxSnapKm ||
      facilities.length >= realCityConfig.maxFacilities
    ) {
      excludedFacilities++;
      continue;
    }
    const id = `osm-facility-${e.type}-${e.id}`;
    const name =
      tags.name?.slice(0, 160) || `${tags.amenity ?? tags.railway ?? "Shelter"} · ${e.id}`;
    facilities.push({
      id,
      osmId: e.id,
      osmType: e.type,
      name,
      type,
      category: tags.amenity ?? tags.railway ?? "shelter",
      latitude: coord.lat,
      longitude: coord.lon,
      roadNodeId: nearest.node.id,
      snapDistanceKm: nearest.distance,
    });
    network.nodes.push({
      id,
      name,
      latitude: coord.lat,
      longitude: coord.lon,
      type,
      populationWeight: 0,
      demandWeight: 1,
      essentialService: type !== "school",
      district: nearest.node.district,
    });
    const distance = Math.max(0.0001, nearest.distance);
    network.edges.push({
      id: `connector-${id}`,
      name: `Modeled connector · ${name}`,
      source: nearest.node.id,
      target: id,
      mode: "road",
      distance,
      freeFlowTime: Math.max(0.001, (distance / realCityConfig.connectorSpeedKmh) * 60),
      capacity: realCityConfig.connectorCapacity,
      currentVolume: 0,
      available: true,
      riskLevel: "low",
      infrastructureType: "street",
      bidirectional: true,
      geometry: [
        [nearest.node.latitude, nearest.node.longitude],
        [coord.lat, coord.lon],
      ],
    });
  }
  network.accessibilityCategories = ["hospital", "shelter", "station"].filter((t) =>
    facilities.some((f) => f.type === t),
  ) as Network["accessibilityCategories"];
  const odPairs = generateDemand(network);
  if (!odPairs.length) throw new ImportError("EMPTY_ROADS");
  const roads = network.edges.filter((e) => e.osm);
  const coverage = (count: number) => (100 * count) / roads.length;
  return {
    schemaVersion: 1,
    realCityModelVersion: "1.0",
    bbox,
    createdAt,
    osmMetadata: {
      source: "OpenStreetMap",
      timestamp:
        typeof data.osm3s?.timestamp_osm_base === "string" ? data.osm3s.timestamp_osm_base : null,
      attribution: "© OpenStreetMap contributors",
      license: "ODbL-1.0",
      queryVersion: realCityConfig.queryVersion,
    },
    network,
    facilities,
    odPairs,
    coverage: {
      speedTagsPercent: coverage(roads.filter((e) => e.osm?.speedSource === "OSM").length),
      laneTagsPercent: coverage(roads.filter((e) => e.osm?.lanesSource === "OSM").length),
      namesPercent: coverage(roads.filter((e) => !e.name.startsWith("Unnamed ")).length),
    },
    stats: {
      rawNodes: rawNodes.size,
      intersections,
      roadLinks,
      origins: network.nodes.filter((n) => n.type === "residential").length,
      components: countComponents(network),
      excludedFacilities,
      clippedWays,
    },
    demandModel: {
      source: "synthetic",
      totalDemand: odPairs.reduce((s, p) => s + p.demand, 0),
      weightSource: "residential road length proxy",
      capacityUnit: "modeled vehicle-equivalents/hour",
    },
  };
}
