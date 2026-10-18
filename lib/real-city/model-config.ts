export const realCityConfig = {
  version: "1.1" as const,
  queryVersion: "vehicle-network-v2",
  maxAreaKm2: 100,
  detailAreaKm2: 25,
  maxRawNodes: 60000,
  maxElements: 80000,
  maxNodes: 5000,
  maxEdges: 8000,
  maxFacilities: 35,
  maxGeometryPoints: 120000,
  maxOrigins: 18,
  maxDestinations: 12,
  maxODPairs: 80,
  maxSnapKm: 0.35,
  fullStressThreshold: 200,
  stressCandidates: 35,
  largeNetworkThreshold: 1800,
  largeStressCandidates: 12,
  maxClosures: 12,
  cacheMs: 20 * 60 * 1000,
  timeoutMs: 14000,
  maxResponseBytes: 20 * 1024 * 1024,
  maxSnapshotBytes: 12 * 1024 * 1024,
  demandScale: 0.75,
  maxDemand: 40000,
  connectorSpeedKmh: 15,
  connectorCapacity: 10000,
} as const;

/** Wide-area analysis intentionally models the arterial network, not every local street. */
export const regionalHighways = [
  "motorway",
  "motorway_link",
  "trunk",
  "trunk_link",
  "primary",
  "primary_link",
  "secondary",
  "secondary_link",
  "tertiary",
  "tertiary_link",
] as const;

// Educational per-lane capacity defaults, NOT measured traffic/capacity.
export const roadDefaults: Readonly<
  Record<string, { speed: number; capacity: number; lanes: number }>
> = {
  motorway: { speed: 80, capacity: 2000, lanes: 4 },
  motorway_link: { speed: 50, capacity: 2000, lanes: 1 },
  trunk: { speed: 60, capacity: 1800, lanes: 2 },
  trunk_link: { speed: 40, capacity: 1800, lanes: 1 },
  primary: { speed: 50, capacity: 1500, lanes: 2 },
  primary_link: { speed: 35, capacity: 1500, lanes: 1 },
  secondary: { speed: 40, capacity: 1200, lanes: 2 },
  secondary_link: { speed: 30, capacity: 1200, lanes: 1 },
  tertiary: { speed: 35, capacity: 900, lanes: 2 },
  tertiary_link: { speed: 25, capacity: 900, lanes: 1 },
  unclassified: { speed: 30, capacity: 650, lanes: 2 },
  residential: { speed: 25, capacity: 450, lanes: 2 },
  living_street: { speed: 15, capacity: 250, lanes: 1 },
};
export const exampleAreas = [
  {
    name: "Okayama · riverside",
    bbox: { south: 34.659, west: 133.925, north: 34.674, east: 133.943 },
  },
  {
    name: "Matsumoto · central",
    bbox: { south: 36.229, west: 137.96, north: 36.242, east: 137.979 },
  },
] as const;
