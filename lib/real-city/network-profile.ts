import { areaDimensions } from "@/lib/osm/geo";
import { realCityConfig, regionalHighways, roadDefaults } from "./model-config";
import type { BoundingBox, NetworkImportProfile } from "@/types/real-city";

export function chooseNetworkProfile(bbox: BoundingBox): NetworkImportProfile {
  return areaDimensions(bbox).area > realCityConfig.detailAreaKm2 ? "regional" : "detailed";
}

export function importRoadClasses(profile: NetworkImportProfile): readonly string[] {
  return profile === "regional" ? regionalHighways : Object.keys(roadDefaults);
}
