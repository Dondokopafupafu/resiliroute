import { ImportError, validateBoundingBox } from "./geo";
import { parseOSMResponse } from "./osm-parser";
import { realCityConfig } from "@/lib/real-city/model-config";
import type { BoundingBox, OSMNode, OSMResponse, OSMWay } from "@/types/real-city";

export interface ImportedOSMFile {
  raw: OSMResponse;
  bbox: BoundingBox;
}

// Area XML contains unrelated objects with hundreds of multilingual name tags.
// Retain only the attributes consumed by the road/facility model. Contact details,
// contributor metadata and unrelated tags have no role in the simulation.
const modelTags = new Set([
  "name",
  "highway",
  "maxspeed",
  "oneway",
  "junction",
  "lanes",
  "bridge",
  "tunnel",
  "access",
  "motor_vehicle",
  "vehicle",
  "amenity",
  "railway",
  "emergency",
]);

/** Only raw geometry/tags survive. Contributor accounts and edit metadata are discarded. */
export function parseOSMFile(text: string, selectedBounds: BoundingBox | null): ImportedOSMFile {
  if (new TextEncoder().encode(text).byteLength > realCityConfig.maxResponseBytes)
    throw new ImportError("TOO_COMPLEX");
  if (!text.trimStart().startsWith("<")) {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new ImportError("INVALID_RESPONSE");
    }
    return { raw: parseOSMResponse(raw), bbox: validateBoundingBox(selectedBounds) };
  }
  // No DTD, custom entity expansion, or external references. DOMParser does not execute scripts.
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new ImportError("INVALID_RESPONSE");
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror, error, remark") || doc.documentElement.tagName !== "osm")
    throw new ImportError("INVALID_RESPONSE");
  const children = Array.from(doc.documentElement.children);
  if (children.length > realCityConfig.maxElements + 10) throw new ImportError("TOO_COMPLEX");
  const numeric = (element: Element, name: string): number => {
    const value = element.getAttribute(name);
    if (value === null || !value.trim()) throw new ImportError("INVALID_RESPONSE");
    return Number(value);
  };
  const bounds = children.find((e) => e.tagName === "bounds");
  const bbox = validateBoundingBox(
    bounds
      ? {
          south: numeric(bounds, "minlat"),
          west: numeric(bounds, "minlon"),
          north: numeric(bounds, "maxlat"),
          east: numeric(bounds, "maxlon"),
        }
      : selectedBounds,
  );
  const elements: OSMResponse["elements"] = [];
  for (const element of children) {
    const type = element.tagName;
    if (!["node", "way", "relation"].includes(type)) continue;
    const tags: Record<string, string> = {};
    const nodes: number[] = [];
    if (element.children.length > 10200) throw new ImportError("TOO_COMPLEX");
    for (const child of element.children) {
      if (child.tagName === "tag") {
        const key = child.getAttribute("k"),
          value = child.getAttribute("v");
        if (key === null || value === null || Object.hasOwn(tags, key))
          throw new ImportError("INVALID_RESPONSE");
        if (!modelTags.has(key)) continue;
        Object.defineProperty(tags, key, { value, enumerable: true });
      } else if (child.tagName === "nd") nodes.push(numeric(child, "ref"));
    }
    const id = numeric(element, "id");
    if (type === "node")
      elements.push({ type, id, tags, lat: numeric(element, "lat"), lon: numeric(element, "lon") });
    else if (type === "way") elements.push({ type, id, tags, nodes });
    else {
      // Relations without explicit centers are omitted from facility snapping.
      // Do not invent coordinates from incomplete relation members in area exports.
      const center = Array.from(element.children).find((e) => e.tagName === "center");
      elements.push({
        type: "relation",
        id,
        tags,
        ...(center ? { center: { lat: numeric(center, "lat"), lon: numeric(center, "lon") } } : {}),
      });
    }
  }
  const raw = parseOSMResponse({ elements });
  const nodes = new Map(
    raw.elements.filter((e): e is OSMNode => e.type === "node").map((n) => [n.id, n]),
  );
  // API XML provides way members rather than a center. Use their bounding-box center,
  // matching the Overpass out-center convention; only complete ways can supply a center.
  for (const way of raw.elements.filter((e): e is OSMWay => e.type === "way")) {
    const points = way.nodes.map((id) => nodes.get(id));
    if (points.length && points.every((n): n is OSMNode => !!n))
      way.center = {
        lat: (Math.min(...points.map((n) => n.lat)) + Math.max(...points.map((n) => n.lat))) / 2,
        lon: (Math.min(...points.map((n) => n.lon)) + Math.max(...points.map((n) => n.lon))) / 2,
      };
  }
  return { raw, bbox };
}
