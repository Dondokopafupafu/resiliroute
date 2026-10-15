import { roadDefaults } from "./model-config";
import type { OSMTags } from "@/types/real-city";

export function parseMaxspeed(value?: string): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(mph|km\/?h|kph)?$/i);
  if (!match) return null;
  const speed = Number(match[1]) * (match[2]?.toLowerCase() === "mph" ? 1.609344 : 1);
  return speed >= 5 && speed <= 150 ? speed : null;
}
export function parseLanes(value?: string): number | null {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const lanes = Number(value);
  return lanes >= 1 && lanes <= 12 ? lanes : null;
}
export function roadModel(tags: OSMTags) {
  const defaults = roadDefaults[tags.highway] ?? roadDefaults.residential;
  const explicitSpeed = parseMaxspeed(tags.maxspeed);
  const explicitLanes = parseLanes(tags.lanes);
  const oneWay =
    /^(yes|1|true|-1|reverse)$/i.test(tags.oneway ?? "") ||
    (tags.oneway !== "no" && (tags.junction === "roundabout" || tags.highway === "motorway"));
  const lanes =
    explicitLanes ??
    (oneWay && defaults.lanes > 1 ? Math.max(1, defaults.lanes / 2) : defaults.lanes);
  return {
    speedKmh: explicitSpeed ?? defaults.speed,
    speedSource: explicitSpeed === null ? ("estimated" as const) : ("OSM" as const),
    lanes,
    lanesSource: explicitLanes === null ? ("estimated" as const) : ("OSM" as const),
    // The shared undirected-edge model sums lane capacity across both directions.
    capacity: defaults.capacity * lanes,
    oneWay,
    reverse: tags.oneway === "-1" || tags.oneway === "reverse",
    bridge: !!tags.bridge && tags.bridge !== "no",
    tunnel: !!tags.tunnel && tags.tunnel !== "no",
  };
}
