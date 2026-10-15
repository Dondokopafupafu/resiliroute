import { describe, expect, it } from "vitest";
import { locationBounds, osmExportUrl } from "@/lib/real-city/location-input";
import { areaDimensions } from "@/lib/osm/geo";
import { parseOSMFile } from "@/lib/osm/file-import";
import { buildRealCityNetwork } from "@/lib/osm/network-builder";
import { simulate } from "@/lib/simulation/simulate";
import fixture from "./fixtures/osm-small.json";

describe("arbitrary-area selection", () => {
  it("centers a 2 km selection on locations outside the example cities", () => {
    for (const [lat, lng] of [
      [35.6812, 139.7671],
      [51.5074, -0.1278],
      [0, 0],
    ]) {
      const b = locationBounds(`${lat}, ${lng}`);
      expect((b.north + b.south) / 2).toBeCloseTo(lat, 5);
      expect((b.east + b.west) / 2).toBeCloseTo(lng, 5);
      expect(areaDimensions(b).area).toBeCloseTo(4, 2);
    }
  });
  it("accepts only explicit OSM locations without requesting the pasted URL", () => {
    const expected = locationBounds("35.6812,139.7671");
    expect(locationBounds("https://www.openstreetmap.org/#map=16/35.6812/139.7671")).toEqual(
      expected,
    );
    expect(locationBounds("https://openstreetmap.org/?mlat=35.6812&mlon=139.7671")).toEqual(
      expected,
    );
    expect(locationBounds("35.6812， 139.7671")).toEqual(expected);
  });
  it("rejects unsupported locations, private URLs, credentials and invalid coordinates", () => {
    const credentialsExample = new URL("https://openstreetmap.org/#map=15/35/139");
    credentialsExample.username = "test-user";
    credentialsExample.password = "test-value";
    for (const text of [
      "",
      "Tokyo",
      "NaN, 139",
      "90, 0",
      "0, 180",
      "35, 999",
      "35 139",
      "https://example.com/#map=15/35/139",
      "https://openstreetmap.org.evil.test/#map=15/35/139",
      credentialsExample.href,
      "https://openstreetmap.org/way/1",
    ])
      expect(() => locationBounds(text)).toThrow();
  });
  it("creates a bounded OSM export link", () => {
    const b = locationBounds("35.68,139.76");
    expect(new URL(osmExportUrl(b)).searchParams.get("bbox")).toBe(
      `${b.west},${b.south},${b.east},${b.north}`,
    );
  });
});

describe("offline raw OSM JSON", () => {
  const bounds = { south: 35, west: 139, north: 35.02, east: 139.02 };
  it("feeds the same importer and simulator as live data", () => {
    const data = parseOSMFile(JSON.stringify(fixture), bounds);
    const model = buildRealCityNetwork(data.raw, data.bbox);
    const base = simulate(model.network, model.odPairs);
    const closed = simulate(model.network, model.odPairs, ["osm-way-102-0"], base);
    expect(closed.metrics.averageTravelTime).toBeGreaterThan(base.metrics.averageTravelTime);
    expect(closed.edgeStates["osm-way-102-0"].volume).toBe(0);
  });
  it("requires valid bounds and complete, bounded data", () => {
    expect(() => parseOSMFile(JSON.stringify(fixture), null)).toThrow("INVALID_BBOX");
    expect(() => parseOSMFile("not json", bounds)).toThrow("INVALID_RESPONSE");
    expect(() => parseOSMFile('{"remark":"runtime error","elements":[]}', bounds)).toThrow(
      "INVALID_RESPONSE",
    );
    expect(() => parseOSMFile("x".repeat(10 * 1024 * 1024 + 1), bounds)).toThrow("TOO_COMPLEX");
  });
});
