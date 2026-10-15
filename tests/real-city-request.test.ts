import { describe, expect, it } from "vitest";
import fixture from "./fixtures/osm-small.json";
import { buildRealCityNetwork } from "@/lib/osm/network-builder";
import { requestRealCityNetwork } from "@/lib/real-city/network-request";

const bbox = { south: 35, west: 139, north: 35.02, east: 139.02 };

describe("real-city browser request failures", () => {
  it("accepts a validated live or cached network", async () => {
    const snapshot = buildRealCityNetwork(fixture, bbox);
    const result = await requestRealCityNetwork(bbox, undefined, async (_, init) => {
      expect(JSON.parse(String(init?.body))).toEqual(bbox);
      return Response.json({ snapshot, cached: true });
    });
    expect(result.cached).toBe(true);
    expect(result.snapshot.network.edges).toEqual(snapshot.network.edges);
  });

  it("identifies a stopped app server separately from unavailable OSM", async () => {
    await expect(
      requestRealCityNetwork(bbox, undefined, async () => {
        throw new TypeError("Failed to fetch");
      }),
    ).rejects.toThrow("SERVER_UNREACHABLE");
  });

  it("handles HTML error pages without blaming OpenStreetMap", async () => {
    await expect(
      requestRealCityNetwork(
        bbox,
        undefined,
        async () => new Response("<html>Service unavailable</html>", { status: 502 }),
      ),
    ).rejects.toThrow("SERVER_UNREACHABLE");
  });

  it("retains explicit proxy timeout, complexity and OSM error codes", async () => {
    for (const code of ["TIMEOUT", "TOO_COMPLEX", "UPSTREAM_UNAVAILABLE"]) {
      await expect(
        requestRealCityNetwork(bbox, undefined, async () =>
          Response.json({ error: code }, { status: 503 }),
        ),
      ).rejects.toThrow(code);
    }
  });

  it("does not display unknown server text as a trusted error", async () => {
    await expect(
      requestRealCityNetwork(bbox, undefined, async () =>
        Response.json({ error: "unexpected error" }, { status: 500 }),
      ),
    ).rejects.toThrow("SERVER_UNREACHABLE");
  });

  it("keeps request cancellation distinct from connection failure", async () => {
    await expect(
      requestRealCityNetwork(bbox, AbortSignal.abort(), async () => {
        throw new DOMException("Aborted", "AbortError");
      }),
    ).rejects.toThrow("CANCELLED");
  });

  it("rejects malformed successful responses instead of inventing a network", async () => {
    await expect(
      requestRealCityNetwork(bbox, undefined, async () => Response.json({ cached: false })),
    ).rejects.toThrow("INVALID_RESPONSE");
  });
});
