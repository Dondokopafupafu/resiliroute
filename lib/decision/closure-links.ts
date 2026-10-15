import type { Network, NetworkEdge } from "@/types/network";

/** Imported networks contain artificial facility connectors without OSM way metadata.
 * Keep those routing links available, consistently with the Real City road controls. */
export function decisionClosureLinks(network: Network): NetworkEdge[] {
  const imported = network.edges.some((edge) => edge.osm !== undefined);
  return network.edges.filter((edge) => edge.available && (!imported || edge.osm !== undefined));
}
