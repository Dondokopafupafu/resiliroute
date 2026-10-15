import { validateBoundingBox } from "@/lib/osm/geo";
import type { BoundingBox } from "@/types/real-city";

/** Parse locally: never fetch a pasted URL or send it to a geocoder. */
export function locationBounds(value: string): BoundingBox {
  const text = value.trim();
  if (!text || text.length > 1000) throw new Error("INVALID_LOCATION");
  let coordinates = text;
  if (/^https?:\/\//i.test(text)) {
    const url = new URL(text);
    if (
      !["openstreetmap.org", "www.openstreetmap.org"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      throw new Error("INVALID_LOCATION");
    const map = url.hash.match(
      /^#map=\d+(?:\.\d+)?\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)(?:&.*)?$/,
    );
    if (map) coordinates = `${map[1]},${map[2]}`;
    else if (url.searchParams.has("mlat") && url.searchParams.has("mlon"))
      coordinates = `${url.searchParams.get("mlat")},${url.searchParams.get("mlon")}`;
    else throw new Error("INVALID_LOCATION");
  }
  const pair = coordinates.match(/^([+-]?\d+(?:\.\d+)?)\s*[,，]\s*([+-]?\d+(?:\.\d+)?)$/);
  if (!pair) throw new Error("INVALID_LOCATION");
  const lat = Number(pair[1]),
    lng = Number(pair[2]);
  // A reproducible 2 × 2 km starting selection, independent of the URL zoom level.
  const dy = 1 / 111.195;
  const dx = dy / Math.cos((lat * Math.PI) / 180);
  return validateBoundingBox({ south: lat - dy, north: lat + dy, west: lng - dx, east: lng + dx });
}

export function osmExportUrl(bbox: BoundingBox): string {
  const b = validateBoundingBox(bbox);
  return `https://www.openstreetmap.org/export?bbox=${b.west},${b.south},${b.east},${b.north}`;
}
