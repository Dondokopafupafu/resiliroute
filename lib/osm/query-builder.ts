import { validateBoundingBox } from "./geo";
import { chooseNetworkProfile, importRoadClasses } from "@/lib/real-city/network-profile";
import type { BoundingBox, NetworkImportProfile } from "@/types/real-city";

export function buildOverpassQuery(
  input: BoundingBox,
  profile: NetworkImportProfile = chooseNetworkProfile(input),
): string {
  const b = validateBoundingBox(input);
  const box = [b.south, b.west, b.north, b.east].join(",");
  const roads = importRoadClasses(profile).join("|");
  // Retain node IDs as well as coordinates: crossings connect only when OSM
  // shares a node, so bridges/tunnels do not intersect just because shapes cross.
  return `[out:json][timeout:12][maxsize:33554432];
way["highway"~"^(${roads})$"](${box})->.roads;
(.roads; .roads >; nwr["amenity"~"^(hospital|clinic|school|university)$"](${box}); nwr["railway"~"^(station|halt)$"](${box}); nwr["emergency"="shelter"](${box}););
out body center;`;
}
