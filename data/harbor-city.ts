import type {
  District,
  Network,
  NetworkEdge,
  NetworkNode,
  NodeType,
  ODPair,
  TransportMode,
} from "@/types/network";

// Entirely synthetic demonstration data. Coordinates anchor a schematic network,
// not surveyed infrastructure. Capacity and demand use person-trips / model hour.
function node(
  id: string,
  name: string,
  latitude: number,
  longitude: number,
  type: NodeType,
  district: District,
  populationWeight = 0,
  demandWeight = 1,
): NetworkNode {
  return {
    id,
    name,
    latitude,
    longitude,
    type,
    district,
    populationWeight,
    demandWeight,
    essentialService: ["hospital", "shelter", "station"].includes(type),
  };
}

export const nodes: NetworkNode[] = [
  node("north-home", "North Heights", 35.491, 139.632, "residential", "North", 5200, 1.1),
  node("north-station", "North Station", 35.488, 139.65, "station", "North", 0, 1.4),
  node("university", "Harbor University", 35.488, 139.675, "school", "North", 0, 1.2),
  node("north-crossing", "North Junction", 35.483, 139.662, "intersection", "North"),
  node("west-home", "West Gardens", 35.473, 139.622, "residential", "West", 6800, 1.3),
  node("old-town", "Old Town", 35.46, 139.626, "commercial", "West", 0, 1.1),
  node("west-station", "West Station", 35.47, 139.64, "station", "West", 0, 1.2),
  node("general-hospital", "General Hospital", 35.462, 139.645, "hospital", "West", 0, 1.4),
  node("riverside-shelter", "Riverside Shelter", 35.478, 139.644, "shelter", "West"),
  node("central-station", "Central Station", 35.472, 139.665, "station", "Central", 0, 1.8),
  node("city-hall", "City Hall", 35.46, 139.662, "commercial", "Central", 0, 1.1),
  node("central-shelter", "Central Shelter", 35.463, 139.674, "shelter", "Central"),
  node("central-home", "Midtown", 35.479, 139.676, "residential", "Central", 4600),
  node("market", "Central Market", 35.467, 139.681, "commercial", "Central", 0, 1.6),
  node("east-home", "East Riverside", 35.474, 139.709, "residential", "East", 8400, 1.5),
  node("east-station", "East Station", 35.48, 139.702, "station", "East", 0, 1.2),
  node("east-junction", "East Junction", 35.462, 139.702, "intersection", "East"),
  node("east-school", "East Community School", 35.486, 139.712, "school", "East"),
  node("emergency-hospital", "Emergency Hospital", 35.453, 139.702, "hospital", "East", 0, 1.3),
  node("harbor-home", "Harbor Residences", 35.444, 139.709, "residential", "Harbor", 6100, 1.2),
  node("harbor-station", "Harbor Station", 35.447, 139.685, "station", "Harbor", 0, 1.4),
  node("industrial", "Industrial Quarter", 35.435, 139.688, "commercial", "Harbor", 0, 1.3),
  node("harbor-shelter", "Harbor Shelter", 35.437, 139.712, "shelter", "Harbor"),
  node("airport", "Airport Connector", 35.434, 139.667, "commercial", "Harbor", 0, 1.1),
];

function edge(
  id: string,
  name: string,
  source: string,
  target: string,
  time: number,
  capacity: number,
  mode: TransportMode = "road",
  infrastructureType: NetworkEdge["infrastructureType"] = "street",
  riskLevel: NetworkEdge["riskLevel"] = "low",
): NetworkEdge {
  const a = nodes.find((n) => n.id === source)!;
  const b = nodes.find((n) => n.id === target)!;
  const latKm = (a.latitude - b.latitude) * 111.32;
  const lonKm = (a.longitude - b.longitude) * 90.7;
  const capacityOverrides: Record<string, number> = {
    "harbor-bridge": 3000,
    "east-rail": 900,
    "riverside-crossing": 780,
    "southern-crossing": 780,
    "east-bypass": 2000,
  };
  const localCapacityFactor = ["north-gardens", "old-town-road"].includes(id) ? 3 : 2;
  return {
    id,
    name,
    source,
    target,
    mode,
    distance: Math.round(Math.hypot(latKm, lonKm) * 120) / 100,
    freeFlowTime: time * 1.32,
    capacity: capacityOverrides[id] ?? capacity * localCapacityFactor,
    currentVolume: 0,
    available: true,
    infrastructureType,
    riskLevel,
    bidirectional: true,
  };
}

export const edges: NetworkEdge[] = [
  edge("north-avenue", "North Avenue", "north-home", "north-station", 4.2, 1300),
  edge("north-gardens", "Garden Road", "north-home", "west-home", 5.8, 1250),
  edge("university-way", "University Way", "north-station", "university", 4.5, 1000, "bus"),
  edge("north-boulevard", "North Boulevard", "north-station", "north-crossing", 3.0, 1700),
  edge("campus-road", "Campus Road", "university", "north-crossing", 3.8, 900),
  edge(
    "north-rail",
    "North Rail",
    "north-station",
    "central-station",
    4.1,
    2200,
    "rail",
    "rail",
    "medium",
  ),
  edge("west-lane", "West Garden Lane", "west-home", "west-station", 4.5, 1400),
  edge("old-town-road", "Old Town Road", "west-home", "old-town", 4.8, 900),
  edge("heritage-road", "Heritage Road", "old-town", "general-hospital", 5.0, 1100),
  edge("hospital-road", "Hospital Road", "west-station", "general-hospital", 3.5, 1400),
  edge("riverside-lane", "Riverside Lane", "west-station", "riverside-shelter", 3.2, 1000),
  edge("shelter-road", "Shelter Road", "riverside-shelter", "north-crossing", 5.3, 1100),
  edge("station-boulevard", "Station Boulevard", "west-station", "central-station", 5.0, 1700),
  edge(
    "west-rail",
    "West Rail Connector",
    "west-station",
    "central-station",
    3.8,
    2000,
    "rail",
    "rail",
  ),
  edge("civic-road", "Civic Road", "general-hospital", "city-hall", 4.2, 1100),
  edge("central-avenue", "Central Avenue", "central-station", "city-hall", 4.0, 1500),
  edge("midtown-lane", "Midtown Lane", "central-station", "central-home", 3.2, 1300),
  edge("market-street", "Market Street", "central-station", "market", 3.3, 1400),
  edge(
    "shelter-walk",
    "Shelter Walk",
    "city-hall",
    "central-shelter",
    4.5,
    700,
    "pedestrian",
    "footpath",
  ),
  edge("market-link", "Market Link", "central-shelter", "market", 2.5, 900),
  edge("midtown-road", "Midtown Road", "central-home", "north-crossing", 4.3, 1300),
  edge("market-bus", "Market Bus Corridor", "central-home", "market", 3.7, 1000, "bus"),
  edge(
    "harbor-bridge",
    "Harbor Bridge",
    "market",
    "east-junction",
    3.6,
    2200,
    "road",
    "bridge",
    "high",
  ),
  edge(
    "riverside-crossing",
    "Riverside Crossing",
    "university",
    "east-station",
    7.3,
    780,
    "road",
    "bridge",
    "high",
  ),
  edge(
    "east-rail",
    "East Rail Connector",
    "central-station",
    "east-station",
    5.0,
    2000,
    "rail",
    "bridge",
    "high",
  ),
  edge("east-avenue", "East Avenue", "east-station", "east-home", 3.5, 1300),
  edge("school-lane", "School Lane", "east-station", "east-school", 3.4, 800),
  edge("community-road", "Community Road", "east-home", "east-school", 4.0, 850),
  edge(
    "east-riverside",
    "East Riverside Road",
    "east-home",
    "east-junction",
    3.8,
    1700,
    "road",
    "street",
    "medium",
  ),
  edge("emergency-way", "Emergency Way", "east-junction", "emergency-hospital", 3.0, 1300),
  edge(
    "coastal-road",
    "Coastal Road",
    "emergency-hospital",
    "harbor-home",
    4.0,
    1300,
    "road",
    "coastal",
    "high",
  ),
  edge("harbor-link", "Harbor Residential Link", "harbor-home", "harbor-station", 5.0, 1200),
  edge(
    "harbor-rail",
    "Harbor Rail",
    "central-station",
    "harbor-station",
    5.6,
    1700,
    "rail",
    "rail",
    "medium",
  ),
  edge(
    "southern-crossing",
    "Southern Crossing",
    "central-shelter",
    "harbor-station",
    9.0,
    780,
    "road",
    "bridge",
    "high",
  ),
  edge(
    "quayside-road",
    "Quayside Road",
    "harbor-station",
    "industrial",
    3.7,
    1100,
    "road",
    "coastal",
    "high",
  ),
  edge(
    "harbor-shelter-road",
    "Harbor Shelter Road",
    "harbor-home",
    "harbor-shelter",
    3.5,
    800,
    "road",
    "coastal",
    "high",
  ),
  edge("industrial-lane", "Industrial Lane", "industrial", "harbor-shelter", 5.0, 950),
  edge("airport-road", "Airport Road", "industrial", "airport", 4.7, 1000),
  edge("airport-express", "Airport Express", "city-hall", "airport", 8.5, 1000, "bus"),
  edge(
    "port-bypass",
    "Port Bypass",
    "east-junction",
    "harbor-station",
    6.2,
    1300,
    "road",
    "coastal",
    "medium",
  ),
  edge("north-local", "North Local Road", "north-crossing", "central-station", 4.2, 1100),
  edge("east-bypass", "East Bypass", "east-school", "east-junction", 5.1, 2000),
];

export const harborCity: Network = { nodes, edges };
export const districtOrder: District[] = ["North", "West", "Central", "East", "Harbor"];

// Transparent gravity-inspired demand: population × destination attraction.
// OD volumes are deliberately synthetic, not measured or calibrated traffic.
const destinations: { id: string; factor: number; purpose: ODPair["purpose"] }[] = [
  { id: "central-station", factor: 0.065, purpose: "commute" },
  { id: "market", factor: 0.055, purpose: "commerce" },
  { id: "general-hospital", factor: 0.018, purpose: "services" },
  { id: "emergency-hospital", factor: 0.014, purpose: "services" },
  { id: "city-hall", factor: 0.025, purpose: "commerce" },
  { id: "industrial", factor: 0.026, purpose: "commute" },
  { id: "university", factor: 0.014, purpose: "commute" },
];
export const odPairs: ODPair[] = nodes
  .filter((n) => n.type === "residential")
  .flatMap((origin) => {
    const localStation = nodes.find((n) => n.type === "station" && n.district === origin.district)!;
    return [...destinations, { id: localStation.id, factor: 0.032, purpose: "commute" as const }]
      .filter(
        (d, i, all) => d.id !== origin.id && all.findIndex((other) => other.id === d.id) === i,
      )
      .map((destination) => {
        const attraction = nodes.find((n) => n.id === destination.id)!.demandWeight;
        return {
          id: `${origin.id}-${destination.id}`,
          origin: origin.id,
          destination: destination.id,
          demand: Math.round(
            origin.populationWeight * origin.demandWeight * destination.factor * attraction,
          ),
          purpose: destination.purpose,
        };
      });
  })
  .concat([
    {
      id: "north-station-market",
      origin: "north-station",
      destination: "market",
      demand: 320,
      purpose: "commerce",
    },
    {
      id: "west-station-market",
      origin: "west-station",
      destination: "market",
      demand: 370,
      purpose: "commerce",
    },
    {
      id: "east-station-city-hall",
      origin: "east-station",
      destination: "city-hall",
      demand: 450,
      purpose: "commute",
    },
    {
      id: "harbor-station-market",
      origin: "harbor-station",
      destination: "market",
      demand: 310,
      purpose: "commerce",
    },
  ]);

export const modelConfig = {
  assignmentIterations: 24,
  bprAlpha: 0.15,
  bprBeta: 4,
  maxVolumeCapacityRatio: 2.5,
  unreachablePenaltyMinutes: 60,
  efficiencyReferenceMinutes: 10,
  serviceThresholds: { hospital: 20, shelter: 15, station: 12 },
  retentionExponent: 2,
  resilienceWeights: {
    accessibility: 0.35,
    efficiency: 0.25,
    travelTime: 0.25,
    connectivity: 0.15,
  },
  criticalityWeights: { travelTime: 0.35, accessibility: 0.35, efficiency: 0.2, connectivity: 0.1 },
} as const;
