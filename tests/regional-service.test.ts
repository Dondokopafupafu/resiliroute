import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/osm-small.json";
import { createRegionalService, regionalDownloadLimits } from "@/lib/osm/regional-service";
import { parseOSMResponse } from "@/lib/osm/osm-parser";
import { ImportError } from "@/lib/osm/geo";
import type { NetworkImportProgress } from "@/lib/real-city/import-progress";

const bbox = { south: 35, west: 139, north: 35.02, east: 139.02 };
const region = {
  id: "test-region",
  name: "Fixture region",
  url: "https://download.geofabrik.de/test-region-latest.osm.pbf",
};
// Only the bounded container-header check is exercised here. The extractor is
// injected; real PBF parsing has its own fixtures and integration tests.
const pack = Buffer.from([0, 0, 0, 13, 10, 9, ...Buffer.from("OSMHeader"), 24, 1, 0]);
const extractor = async () => ({
  raw: parseOSMResponse(fixture),
  timestamp: "2026-10-10T00:00:00.000Z",
  excludedRelationFacilities: null,
  bytesRead: pack.length * 2,
});
const temporary: string[] = [];
async function directory() {
  const path = await mkdtemp(join(tmpdir(), "resiliroute-region-test-"));
  temporary.push(path);
  return path;
}
afterEach(async () => {
  for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true });
});
function response(method?: string, content: Uint8Array = pack) {
  return new Response(method === "HEAD" ? null : new Uint8Array(content), {
    headers: {
      "Content-Length": String(content.length),
      "Last-Modified": "Thu, 15 Oct 2026 10:00:00 GMT",
    },
  });
}

describe("explicit regional download workflow", () => {
  it("preflights bytes without downloading, then reuses the same pack and graph", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_, init) => response(init?.method));
    const extract = vi.fn(extractor);
    const progress: NetworkImportProgress[] = [];
    const service = createRegionalService({
      directory: await directory(),
      fetcher,
      catalog: async () => region,
      extractor: extract,
    });
    const inspection = await service.preflight(bbox);
    expect(inspection.region).toMatchObject({ bytes: pack.length, cached: false, available: true });
    expect(fetcher.mock.calls.every(([, init]) => init?.method === "HEAD")).toBe(true);
    const result = await service.build(bbox, region.id, undefined, (event) => progress.push(event));
    expect(result?.snapshot.osmMetadata.regionalExtract?.provider).toBe("Geofabrik");
    expect(result?.snapshot.bbox).toEqual(bbox);
    expect(result?.snapshot.osmMetadata.timestamp).toBe("2026-10-10T00:00:00.000Z");
    expect(progress.map((event) => event.stage)).toContain("downloading");
    expect(progress.map((event) => event.stage)).toContain("extracting");
    expect((await service.preflight(bbox)).region.cached).toBe(true);
    expect((await service.tryCached(bbox))?.cached).toBe(true);
    const nextBounds = { ...bbox, south: 35.0001 };
    const nextArea = await service.tryCached(nextBounds);
    expect(nextArea?.snapshot.bbox).toEqual(nextBounds);
    expect(extract).toHaveBeenCalledTimes(2); // Same pack, new selected rectangle.
    expect(fetcher).toHaveBeenCalledTimes(2); // HEAD + one GET, no repeat download.
  });

  it("rejects mismatched client region IDs before a file request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const service = createRegionalService({
      directory: await directory(),
      fetcher,
      catalog: async () => region,
      extractor,
    });
    await expect(service.build(bbox, "different-region")).rejects.toThrow("INVALID_BBOX");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("follows only bounded same-region official dated-file redirects", async () => {
    const urls: string[] = [];
    const service = createRegionalService({
      directory: await directory(),
      catalog: async () => region,
      extractor,
      fetcher: async (url, init) => {
        urls.push(String(url));
        return String(url).includes("-latest")
          ? new Response(null, {
              status: 307,
              headers: { Location: "/test-region-261015.osm.pbf" },
            })
          : response(init?.method);
      },
    });
    expect((await service.preflight(bbox)).region.bytes).toBe(pack.length);
    expect(urls).toEqual([region.url, "https://download.geofabrik.de/test-region-261015.osm.pbf"]);
  });

  it("rejects external and unrelated-region redirects without following them", async () => {
    for (const location of [
      "https://example.org/test-region.osm.pbf",
      "/another-region-261015.osm.pbf",
      Object.assign(new URL("https://download.geofabrik.de/test-region-261015.osm.pbf"), {
        username: "fixture-user",
        password: "fixture-password",
      }).toString(),
    ]) {
      const fetcher = vi.fn<typeof fetch>(
        async () => new Response(null, { status: 307, headers: { Location: location } }),
      );
      const service = createRegionalService({
        directory: await directory(),
        catalog: async () => region,
        extractor,
        fetcher,
      });
      await expect(service.preflight(bbox)).rejects.toThrow("INVALID_RESPONSE");
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });

  it("shows an over-limit pack as unavailable and never downloads it", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(null, {
          headers: { "Content-Length": String(regionalDownloadLimits.maxBytes + 1) },
        }),
    );
    const service = createRegionalService({
      directory: await directory(),
      catalog: async () => region,
      extractor,
      fetcher,
    });
    expect((await service.preflight(bbox)).region.available).toBe(false);
    await expect(service.build(bbox, region.id)).rejects.toThrow("TOO_COMPLEX");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("cleans up an interrupted partial download and permits no second concurrent job", async () => {
    const path = await directory();
    const controller = new AbortController();
    let started!: () => void;
    const downloading = new Promise<void>((resolve) => {
      started = resolve;
    });
    const fetcher: typeof fetch = async (_, init) =>
      init?.method === "HEAD"
        ? response("HEAD")
        : new Response(
            new ReadableStream<Uint8Array>({
              start(stream) {
                stream.enqueue(pack.slice(0, 9));
              },
            }),
            { headers: { "Content-Length": String(pack.length) } },
          );
    const service = createRegionalService({
      directory: path,
      catalog: async () => region,
      extractor,
      fetcher,
    });
    const build = service.build(bbox, region.id, controller.signal, (event) => {
      if (event.stage === "downloading") started();
    });
    const rejected = expect(build).rejects.toThrow("CANCELLED");
    await downloading;
    await expect(service.build(bbox, region.id)).rejects.toMatchObject({
      code: "RATE_LIMIT",
      retryAfterSeconds: 5,
    });
    controller.abort();
    await rejected;
    expect(
      (await readdir(path)).some((name) => name.endsWith(".tmp") || name.endsWith(".osm.pbf")),
    ).toBe(false);
  });

  it("does not cache a 200 response containing HTML instead of a PBF", async () => {
    const path = await directory();
    const content = new TextEncoder().encode("<html>upstream maintenance</html>");
    const service = createRegionalService({
      directory: path,
      catalog: async () => region,
      extractor,
      fetcher: async (_, init) => response(init?.method, content),
    });
    await expect(service.build(bbox, region.id)).rejects.toThrow("INVALID_RESPONSE");
    expect((await readdir(path)).filter((name) => !name.endsWith(".log"))).toEqual([]);
  });

  it("invalidates a corrupt cached pack and lets the next explicit prepare download again", async () => {
    let attempts = 0;
    const path = await directory();
    const fetcher = vi.fn<typeof fetch>(async (_, init) => response(init?.method));
    const service = createRegionalService({
      directory: path,
      catalog: async () => region,
      fetcher,
      extractor: async () => {
        if (++attempts === 1) throw new ImportError("INVALID_RESPONSE");
        return extractor();
      },
    });
    await expect(service.build(bbox, region.id)).rejects.toThrow("INVALID_RESPONSE");
    expect(
      (await readdir(path)).filter((name) => /^[a-f0-9]{64}\.(json|osm\.pbf)$/.test(name)),
    ).toEqual([]);
    expect((await service.preflight(bbox)).region.cached).toBe(false);
    expect((await service.build(bbox, region.id))?.snapshot.network.edges.length).toBeGreaterThan(
      0,
    );
    expect(fetcher.mock.calls.filter(([, init]) => init?.method !== "HEAD")).toHaveLength(2);
  });

  it("limits new downloads to two per server hour while allowing cached reuse", async () => {
    let selected = region;
    const service = createRegionalService({
      directory: await directory(),
      catalog: async () => selected,
      extractor,
      fetcher: async (_, init) => response(init?.method),
    });
    await service.build(bbox, selected.id);
    selected = {
      ...region,
      id: "second",
      url: "https://download.geofabrik.de/second-latest.osm.pbf",
    };
    await service.build(bbox, selected.id);
    expect((await service.tryCached(bbox))?.cached).toBe(true);
    selected = {
      ...region,
      id: "third",
      url: "https://download.geofabrik.de/third-latest.osm.pbf",
    };
    await expect(service.build(bbox, selected.id)).rejects.toMatchObject({ code: "RATE_LIMIT" });
  });
});
