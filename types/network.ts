export type NodeId = string;
export type EdgeId = string;
export type District = "North" | "West" | "Central" | "East" | "Harbor" | "South";
export type NodeType =
  | "intersection"
  | "station"
  | "hospital"
  | "shelter"
  | "school"
  | "residential"
  | "commercial";
export type TransportMode = "road" | "rail" | "pedestrian" | "bus";
export type ScenarioId = "normal" | "earthquake" | "flood" | "rail" | "custom";

export interface NetworkNode {
  id: NodeId;
  name: string;
  latitude: number;
  longitude: number;
  type: NodeType;
  populationWeight: number;
  demandWeight: number;
  essentialService: boolean;
  district: District;
}
export interface NetworkEdge {
  id: EdgeId;
  name: string;
  source: NodeId;
  target: NodeId;
  mode: TransportMode;
  distance: number;
  freeFlowTime: number;
  capacity: number;
  currentVolume: number;
  available: boolean;
  riskLevel: "low" | "medium" | "high";
  infrastructureType: "street" | "bridge" | "rail" | "coastal" | "footpath";
  bidirectional: boolean;
  /** Detailed road shape; absent for the schematic Harbor City network. */
  geometry?: [number, number][];
  osm?: {
    wayId: number;
    highway: string;
    speedKmh: number;
    speedSource: "OSM" | "estimated";
    lanes: number;
    lanesSource: "OSM" | "estimated";
    bridge: boolean;
    tunnel: boolean;
    oneway: boolean;
  };
}
export interface Network {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  /** Missing real-world service categories are excluded, rather than invented. */
  accessibilityCategories?: ("hospital" | "shelter" | "station")[];
}
export interface ODPair {
  id: string;
  origin: NodeId;
  destination: NodeId;
  demand: number;
  purpose: "commute" | "services" | "commerce";
}
export interface Scenario {
  id: ScenarioId;
  name: string;
  description: string;
  closedEdgeIds: EdgeId[];
}
export interface PathResult {
  reachable: boolean;
  nodeIds: NodeId[];
  edgeIds: EdgeId[];
  travelTime: number;
  distance: number;
}
export interface AssignedOD {
  od: ODPair;
  path: PathResult;
  flowPaths: { path: PathResult; volume: number }[];
}
export interface EdgeState {
  id: EdgeId;
  available: boolean;
  volume: number;
  utilization: number;
  travelTime: number;
}
export interface DistrictMetrics {
  district: District;
  population: number;
  averageTravelTime: number;
  accessibility: number;
  disconnectedDemand: number;
  isolationRisk: number;
}
export interface ServiceMetrics {
  nodeId: NodeId;
  name: string;
  type: NodeType;
  reachablePopulation: number;
  threshold: number;
}
export interface SimulationMetrics {
  averageTravelTime: number;
  accessibility: number;
  networkEfficiency: number;
  congestion: number;
  disconnectedDemand: number;
  disconnectedODPairs: number;
  connectedDemandRetention: number;
  resilienceScore: number;
  totalDemand: number;
}
export interface SimulationResult {
  closedEdgeIds: EdgeId[];
  edgeStates: Record<EdgeId, EdgeState>;
  assignments: AssignedOD[];
  metrics: SimulationMetrics;
  districts: DistrictMetrics[];
  services: ServiceMetrics[];
  iterations: number;
}
export interface CriticalLinkResult {
  edgeId: EdgeId;
  name: string;
  score: number;
  travelTimeIncrease: number;
  accessibilityLoss: number;
  efficiencyLoss: number;
  disconnectedDemandIncrease: number;
}
export interface RecoveryResult {
  edgeId: EdgeId;
  name: string;
  resilienceGain: number;
  accessibilityGain: number;
  travelTimeSaved: number;
  result: SimulationResult;
}
