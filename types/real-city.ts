import type { Network, NodeType, ODPair } from "./network";

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}
export type OSMTags = Record<string, string>;
export interface OSMNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: OSMTags;
}
export interface OSMWay {
  type: "way";
  id: number;
  nodes: number[];
  tags: OSMTags;
  center?: { lat: number; lon: number };
}
export interface OSMRelation {
  type: "relation";
  id: number;
  tags: OSMTags;
  center?: { lat: number; lon: number };
}
export interface OSMResponse {
  elements: (OSMNode | OSMWay | OSMRelation)[];
  osm3s?: { timestamp_osm_base?: string };
  remark?: string;
}
export interface ImportedFacility {
  id: string;
  osmId: number;
  osmType: "node" | "way" | "relation";
  name: string;
  type: Extract<NodeType, "hospital" | "station" | "shelter" | "school">;
  category: string;
  latitude: number;
  longitude: number;
  roadNodeId: string;
  snapDistanceKm: number;
}
export interface DataCoverage {
  speedTagsPercent: number;
  laneTagsPercent: number;
  namesPercent: number;
}
export type NetworkImportProfile = "detailed" | "regional";
export interface NetworkProfileProvenance {
  mode: NetworkImportProfile;
  includedHighways: string[];
  reason: "area" | "density" | "requested";
  /** Null when filtering happened at the source, so omitted ways were never counted. */
  excludedRoadWays: number | null;
}
export interface RealCityNetwork {
  schemaVersion: 1;
  realCityModelVersion: "1.0" | "1.1";
  importProfile?: NetworkProfileProvenance;
  bbox: BoundingBox;
  createdAt: string;
  osmMetadata: {
    source: "OpenStreetMap";
    timestamp: string | null;
    attribution: "© OpenStreetMap contributors";
    license: "ODbL-1.0";
    queryVersion: string;
    regionalExtract?: {
      provider: "Geofabrik";
      regionId: string;
      regionName: string;
      /** File modification date; distinct from the OSM replication timestamp. */
      fileDate: string | null;
      downloadedAt: string;
      /** Null means relation-facility coverage within the selection is unknown. */
      excludedRelationFacilities: number | null;
    };
  };
  network: Network;
  facilities: ImportedFacility[];
  odPairs: ODPair[];
  coverage: DataCoverage;
  stats: {
    rawNodes: number;
    intersections: number;
    roadLinks: number;
    origins: number;
    components: number;
    excludedFacilities: number;
    clippedWays: number;
  };
  demandModel: {
    source: "synthetic";
    totalDemand: number;
    weightSource: "residential road length proxy" | "road length proxy";
    capacityUnit: "modeled vehicle-equivalents/hour";
  };
}
export type ImportErrorCode =
  | "INVALID_BBOX"
  | "AREA_TOO_LARGE"
  | "TOO_COMPLEX"
  | "EMPTY_ROADS"
  | "INVALID_RESPONSE"
  | "UPSTREAM_UNAVAILABLE"
  | "SERVER_UNREACHABLE"
  | "TIMEOUT"
  | "CANCELLED"
  | "RATE_LIMIT"
  | "INVALID_SNAPSHOT"
  | "INVALID_OSM_FILE";
