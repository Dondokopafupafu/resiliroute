import { geometryDistance, ImportError, inside, validateBoundingBox } from "@/lib/osm/geo";
import { realCityConfig, roadDefaults } from "./model-config";
import { countComponents } from "@/lib/osm/network-builder";
import { importRoadClasses } from "./network-profile";
import type { RealCityNetwork } from "@/types/real-city";

const finite = (n: unknown, min = 0, max = 1e9): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
const text = (v: unknown, length = 180): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= length;
export function validateSnapshot(input: unknown): RealCityNetwork {
  const fail = (): never => {
    throw new ImportError("INVALID_SNAPSHOT");
  };
  if (!input || typeof input !== "object") return fail();
  // Validation treats imported snapshots as data only. No URLs, scripts or
  // arbitrary object keys are evaluated or used to fetch resources.
  const s = input as RealCityNetwork;
  if (
    s.schemaVersion !== 1 ||
    !["1.0", realCityConfig.version].includes(s.realCityModelVersion) ||
    !text(s.createdAt, 40) ||
    !Number.isFinite(Date.parse(s.createdAt))
  )
    return fail();
  let bbox;
  try {
    bbox = validateBoundingBox(s.bbox);
  } catch {
    return fail();
  }
  if (
    s.osmMetadata?.source !== "OpenStreetMap" ||
    s.osmMetadata.license !== "ODbL-1.0" ||
    s.osmMetadata.attribution !== "© OpenStreetMap contributors" ||
    !["vehicle-network-v1", realCityConfig.queryVersion].includes(s.osmMetadata.queryVersion) ||
    (s.osmMetadata.timestamp !== null && !text(s.osmMetadata.timestamp, 80))
  )
    return fail();
  if (s.realCityModelVersion === "1.1" && !s.importProfile) return fail();
  const regional = s.osmMetadata.regionalExtract;
  if (
    regional &&
    (regional.provider !== "Geofabrik" ||
      !text(regional.regionId, 150) ||
      !/^[a-z0-9]+(?:[-/][a-z0-9]+)*$/.test(regional.regionId) ||
      !text(regional.regionName, 200) ||
      (regional.fileDate !== null &&
        (!text(regional.fileDate, 80) || !Number.isFinite(Date.parse(regional.fileDate)))) ||
      !text(regional.downloadedAt, 80) ||
      !Number.isFinite(Date.parse(regional.downloadedAt)) ||
      (regional.excludedRelationFacilities !== null &&
        (!Number.isSafeInteger(regional.excludedRelationFacilities) ||
          !finite(regional.excludedRelationFacilities))))
  )
    return fail();
  if (s.importProfile) {
    const profile = s.importProfile;
    if (
      !["detailed", "regional"].includes(profile.mode) ||
      !["area", "density", "requested"].includes(profile.reason) ||
      !Array.isArray(profile.includedHighways) ||
      profile.includedHighways.join(",") !== importRoadClasses(profile.mode).join(",") ||
      (profile.excludedRoadWays !== null &&
        (!Number.isSafeInteger(profile.excludedRoadWays) ||
          !finite(profile.excludedRoadWays, 0, realCityConfig.maxElements)))
    )
      return fail();
  }
  if (
    !s.network ||
    !Array.isArray(s.network.nodes) ||
    !Array.isArray(s.network.edges) ||
    !Array.isArray(s.facilities) ||
    !Array.isArray(s.odPairs)
  )
    return fail();
  if (
    s.network.nodes.length < 3 ||
    s.network.nodes.length > realCityConfig.maxNodes + realCityConfig.maxFacilities ||
    s.network.edges.length > realCityConfig.maxEdges + realCityConfig.maxFacilities ||
    !s.network.edges.length ||
    s.facilities.length > realCityConfig.maxFacilities ||
    !s.odPairs.length ||
    s.odPairs.length > realCityConfig.maxODPairs
  )
    return fail();
  const nodeIds = new Set<string>(),
    edgeIds = new Set<string>(),
    odIds = new Set<string>();
  for (const n of s.network.nodes) {
    if (
      !n ||
      !text(n.id) ||
      !text(n.name) ||
      nodeIds.has(n.id) ||
      ![
        "intersection",
        "station",
        "hospital",
        "shelter",
        "school",
        "residential",
        "commercial",
      ].includes(n.type) ||
      !["North", "West", "Central", "East", "South"].includes(n.district) ||
      !finite(n.latitude, -85, 85) ||
      !finite(n.longitude, -180, 180) ||
      !inside(bbox, n.latitude, n.longitude) ||
      !finite(n.populationWeight, 0, 1e6) ||
      !finite(n.demandWeight, 0, 1e6) ||
      typeof n.essentialService !== "boolean" ||
      (n.essentialService && !["hospital", "shelter", "station"].includes(n.type))
    )
      return fail();
    nodeIds.add(n.id);
  }
  let geometryCount = 0;
  for (const e of s.network.edges) {
    if (
      !e ||
      !text(e.id) ||
      !text(e.name) ||
      edgeIds.has(e.id) ||
      !nodeIds.has(e.source) ||
      !nodeIds.has(e.target) ||
      e.source === e.target ||
      e.mode !== "road" ||
      !finite(e.distance, 0.00001, 100) ||
      !finite(e.freeFlowTime, 0.00001, 500) ||
      !finite(e.capacity, 1, 200000) ||
      e.currentVolume !== 0 ||
      e.available !== true ||
      e.riskLevel !== "low" ||
      !["bridge", "street"].includes(e.infrastructureType) ||
      typeof e.bidirectional !== "boolean" ||
      !Array.isArray(e.geometry) ||
      e.geometry.length < 2
    )
      return fail();
    geometryCount += e.geometry.length;
    if (
      geometryCount > realCityConfig.maxGeometryPoints ||
      e.geometry.some(
        (p) =>
          !Array.isArray(p) ||
          p.length !== 2 ||
          !finite(p[0], -85, 85) ||
          !finite(p[1], -180, 180) ||
          !inside(bbox, p[0], p[1]),
      )
    )
      return fail();
    if (e.osm) {
      const o = e.osm;
      if (
        !Number.isSafeInteger(o.wayId) ||
        o.wayId <= 0 ||
        !Object.hasOwn(roadDefaults, o.highway) ||
        (s.importProfile && !s.importProfile.includedHighways.includes(o.highway)) ||
        !finite(o.speedKmh, 5, 150) ||
        !["OSM", "estimated"].includes(o.speedSource) ||
        !finite(o.lanes, 1, 12) ||
        !["OSM", "estimated"].includes(o.lanesSource) ||
        typeof o.bridge !== "boolean" ||
        typeof o.tunnel !== "boolean" ||
        typeof o.oneway !== "boolean" ||
        o.oneway === e.bidirectional ||
        Math.abs(geometryDistance(e.geometry) - e.distance) > 1e-6
      )
        return fail();
    } else if (!e.id.startsWith("connector-osm-facility-")) return fail();
    edgeIds.add(e.id);
  }
  for (const p of s.odPairs) {
    if (
      !p ||
      !text(p.id, 400) ||
      odIds.has(p.id) ||
      !nodeIds.has(p.origin) ||
      !nodeIds.has(p.destination) ||
      p.origin === p.destination ||
      !finite(p.demand, 0.000001, 40000) ||
      !["commute", "services", "commerce"].includes(p.purpose)
    )
      return fail();
    odIds.add(p.id);
  }
  const facilityIds = new Set<string>();
  for (const f of s.facilities) {
    const node = s.network.nodes.find((n) => n.id === f?.id);
    if (
      !f ||
      facilityIds.has(f.id) ||
      !node ||
      node.type !== f.type ||
      !["hospital", "station", "shelter", "school"].includes(f.type) ||
      !text(f.name) ||
      !text(f.category) ||
      !["node", "way", "relation"].includes(f.osmType) ||
      !Number.isSafeInteger(f.osmId) ||
      f.osmId <= 0 ||
      !nodeIds.has(f.roadNodeId) ||
      !finite(f.snapDistanceKm, 0, realCityConfig.maxSnapKm) ||
      f.latitude !== node.latitude ||
      f.longitude !== node.longitude
    )
      return fail();
    facilityIds.add(f.id);
  }
  const categories = ["hospital", "shelter", "station"].filter((t) =>
    s.facilities.some((f) => f.type === t),
  );
  if (
    !Array.isArray(s.network.accessibilityCategories) ||
    s.network.accessibilityCategories.join(",") !== categories.join(",")
  )
    return fail();
  if (
    s.demandModel?.source !== "synthetic" ||
    !["residential road length proxy", "road length proxy"].includes(s.demandModel.weightSource) ||
    s.demandModel.capacityUnit !== "modeled vehicle-equivalents/hour"
  )
    return fail();
  const totalDemand = s.odPairs.reduce((sum, p) => sum + p.demand, 0);
  if (!finite(totalDemand, 0.001, 40000.01)) return fail();
  const roads = s.network.edges.filter((e) => e.osm);
  if (!roads.length) return fail();
  // Copy only recognized fields on export, and recalculate derived summaries.
  return {
    schemaVersion: 1,
    realCityModelVersion: s.realCityModelVersion,
    ...(s.importProfile
      ? {
          importProfile: {
            mode: s.importProfile.mode,
            includedHighways: [...s.importProfile.includedHighways],
            reason: s.importProfile.reason,
            excludedRoadWays: s.importProfile.excludedRoadWays,
          },
        }
      : {}),
    bbox,
    createdAt: s.createdAt,
    osmMetadata: {
      source: "OpenStreetMap",
      timestamp: s.osmMetadata.timestamp,
      attribution: "© OpenStreetMap contributors",
      license: "ODbL-1.0",
      queryVersion: s.osmMetadata.queryVersion,
      ...(regional
        ? {
            regionalExtract: {
              provider: "Geofabrik" as const,
              regionId: regional.regionId,
              regionName: regional.regionName,
              fileDate: regional.fileDate,
              downloadedAt: regional.downloadedAt,
              excludedRelationFacilities: regional.excludedRelationFacilities,
            },
          }
        : {}),
    },
    network: {
      accessibilityCategories: categories as RealCityNetwork["network"]["accessibilityCategories"],
      nodes: s.network.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        latitude: n.latitude,
        longitude: n.longitude,
        type: n.type,
        district: n.district,
        populationWeight: n.populationWeight,
        demandWeight: n.demandWeight,
        essentialService: n.essentialService,
      })),
      edges: s.network.edges.map((e) => ({
        id: e.id,
        name: e.name,
        source: e.source,
        target: e.target,
        mode: e.mode,
        distance: e.distance,
        freeFlowTime: e.freeFlowTime,
        capacity: e.capacity,
        currentVolume: 0,
        available: true,
        riskLevel: "low",
        infrastructureType: e.infrastructureType,
        bidirectional: e.bidirectional,
        geometry: e.geometry!.map((p) => [p[0], p[1]]),
        ...(e.osm
          ? {
              osm: {
                wayId: e.osm.wayId,
                highway: e.osm.highway,
                speedKmh: e.osm.speedKmh,
                speedSource: e.osm.speedSource,
                lanes: e.osm.lanes,
                lanesSource: e.osm.lanesSource,
                bridge: e.osm.bridge,
                tunnel: e.osm.tunnel,
                oneway: e.osm.oneway,
              },
            }
          : {}),
      })),
    },
    facilities: s.facilities.map((f) => ({
      id: f.id,
      osmId: f.osmId,
      osmType: f.osmType,
      name: f.name,
      type: f.type,
      category: f.category,
      latitude: f.latitude,
      longitude: f.longitude,
      roadNodeId: f.roadNodeId,
      snapDistanceKm: f.snapDistanceKm,
    })),
    odPairs: s.odPairs.map((p) => ({
      id: p.id,
      origin: p.origin,
      destination: p.destination,
      demand: p.demand,
      purpose: p.purpose,
    })),
    coverage: {
      speedTagsPercent:
        (roads.filter((e) => e.osm?.speedSource === "OSM").length / roads.length) * 100,
      laneTagsPercent:
        (roads.filter((e) => e.osm?.lanesSource === "OSM").length / roads.length) * 100,
      namesPercent:
        (roads.filter((e) => !e.name.startsWith("Unnamed ")).length / roads.length) * 100,
    },
    stats: {
      rawNodes: finite(s.stats?.rawNodes, 0, realCityConfig.maxRawNodes) ? s.stats.rawNodes : 0,
      intersections: s.network.nodes.filter((n) => n.id.startsWith("osm-node-")).length,
      roadLinks: roads.length,
      origins: s.network.nodes.filter((n) => n.type === "residential").length,
      components: countComponents(s.network),
      excludedFacilities: finite(s.stats?.excludedFacilities) ? s.stats.excludedFacilities : 0,
      clippedWays: finite(s.stats?.clippedWays) ? s.stats.clippedWays : 0,
    },
    demandModel: {
      source: "synthetic",
      totalDemand,
      weightSource: s.demandModel.weightSource,
      capacityUnit: "modeled vehicle-equivalents/hour",
    },
  };
}
