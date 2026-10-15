import { ImportError } from "./geo";
import { realCityConfig } from "@/lib/real-city/model-config";
import type { OSMResponse, OSMTags } from "@/types/real-city";

function tagsValid(tags: unknown): tags is OSMTags {
  return (
    tags === undefined ||
    (!!tags &&
      typeof tags === "object" &&
      !Array.isArray(tags) &&
      Object.keys(tags).length <= 200 &&
      Object.values(tags).every((v) => typeof v === "string" && v.length < 2000))
  );
}
const pointValid = (p: unknown): boolean =>
  !!p &&
  typeof p === "object" &&
  "lat" in p &&
  "lon" in p &&
  typeof p.lat === "number" &&
  Number.isFinite(p.lat) &&
  Math.abs(p.lat) <= 90 &&
  typeof p.lon === "number" &&
  Number.isFinite(p.lon) &&
  Math.abs(p.lon) <= 180;
export function parseOSMResponse(input: unknown): OSMResponse {
  if (
    !input ||
    typeof input !== "object" ||
    !("elements" in input) ||
    !Array.isArray(input.elements) ||
    ("remark" in input && input.remark)
  )
    throw new ImportError("INVALID_RESPONSE");
  if (input.elements.length > realCityConfig.maxElements) throw new ImportError("TOO_COMPLEX");
  const ids = new Set<string>();
  let nodes = 0;
  for (const e of input.elements) {
    if (
      !e ||
      typeof e !== "object" ||
      !["node", "way", "relation"].includes(e.type) ||
      !Number.isSafeInteger(e.id) ||
      e.id <= 0 ||
      !tagsValid(e.tags)
    )
      throw new ImportError("INVALID_RESPONSE");
    const key = `${e.type}:${e.id}`;
    if (ids.has(key)) throw new ImportError("INVALID_RESPONSE");
    ids.add(key);
    if (e.type === "node") {
      nodes++;
      if (!pointValid(e)) throw new ImportError("INVALID_RESPONSE");
    }
    if (
      e.type === "way" &&
      (!Array.isArray(e.nodes) ||
        e.nodes.length > 10000 ||
        e.nodes.some((id: unknown) => !Number.isSafeInteger(id)))
    )
      throw new ImportError("INVALID_RESPONSE");
    if (e.center && !pointValid(e.center)) throw new ImportError("INVALID_RESPONSE");
  }
  if (nodes > realCityConfig.maxRawNodes) throw new ImportError("TOO_COMPLEX");
  return input as OSMResponse;
}
