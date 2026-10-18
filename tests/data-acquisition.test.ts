import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/osm-small.json";
import { fetchOverpass } from "@/lib/osm/overpass-client";
import { createNetworkService } from "@/lib/osm/network-service";
import { buildRealCityNetwork } from "@/lib/osm/network-builder";
import { requestRealCityNetwork } from "@/lib/real-city/network-request";
import type { NetworkImportProgress } from "@/lib/real-city/import-progress";
import { realCityConfig } from "@/lib/real-city/model-config";

const bbox = { south: 35, west: 139, north: 35.02, east: 139.02 };
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const temporary: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  for (const directory of temporary.splice(0))
    await rm(directory, { recursive: true, force: true });
});

describe("bounded automatic acquisition", () => {
  it("sends one supported GET with the actual requested bbox and no form body", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(fixture));
    await fetchOverpass(bbox, {
      fetcher,
      endpoints: ["https://example.test/api/interpreter"],
      method: "GET",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [request, init] = fetcher.mock.calls[0];
    expect(new URL(String(request)).searchParams.get("data")).toContain("35,139,35.02,139.02");
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
  });

  it("supports POST-only deployments without issuing duplicate transport retries", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(fixture));
    await fetchOverpass(bbox, {
      fetcher,
      endpoints: ["https://example.test/api/interpreter"],
      method: "POST",
    });
    const [request, init] = fetcher.mock.calls[0];
    expect(String(request)).toBe("https://example.test/api/interpreter");
    expect(init?.method).toBe("POST");
    expect(String(init?.body)).toContain("data=");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("respects an explicit 406 pause without querying another instance", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 406 }));
    await expect(fetchOverpass(bbox, { fetcher })).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
      retryAfterSeconds: 30,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("shares identical requests while cancellation affects only the cancelling subscriber", async () => {
    let resolve!: (response: Response) => void;
    let upstreamSignal: AbortSignal | undefined;
    const fetcher = vi.fn<typeof fetch>(async (_, init) => {
      upstreamSignal = init?.signal ?? undefined;
      return new Promise<Response>((done) => {
        resolve = done;
      });
    });
    const service = createNetworkService(fetcher),
      first = new AbortController(),
      second = new AbortController();
    const a = service(bbox, first.signal);
    const rejection = expect(a).rejects.toThrow("CANCELLED");
    const b = service(bbox, second.signal);
    await tick();
    first.abort();
    await rejection;
    expect(upstreamSignal?.aborted).toBe(false);
    resolve(Response.json(fixture));
    expect((await b).snapshot.network.edges.length).toBeGreaterThan(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("aborts the actual upstream request when every subscriber cancels", async () => {
    let upstreamSignal: AbortSignal | undefined;
    const fetcher = vi.fn<typeof fetch>(async (_, init) => {
      upstreamSignal = init?.signal ?? undefined;
      return new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true }),
      );
    });
    const service = createNetworkService(fetcher),
      controller = new AbortController();
    const request = service(bbox, controller.signal);
    const rejection = expect(request).rejects.toThrow("CANCELLED");
    await tick();
    controller.abort();
    await rejection;
    expect(upstreamSignal?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("reuses a validated normalized disk cache after service restart and strips raw contributor metadata", async () => {
    const directory = await mkdtemp(join(tmpdir(), "resiliroute-cache-test-"));
    temporary.push(directory);
    const raw = structuredClone(fixture) as Record<string, unknown>;
    (raw.elements as Record<string, unknown>[])[0].user = "not-for-publication";
    (raw.elements as Record<string, unknown>[])[0].uid = 12345;
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(raw));
    const first = await createNetworkService(fetcher, { cacheDirectory: directory })(bbox);
    const second = await createNetworkService(fetcher, { cacheDirectory: directory })(bbox);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const files = await readdir(directory);
    expect(files).toHaveLength(1);
    const serialized = await readFile(join(directory, files[0]), "utf8");
    expect(serialized).not.toContain("not-for-publication");
    expect(serialized).not.toContain('"uid"');
    expect(second.snapshot.bbox).toEqual(bbox);
    // A valid snapshot for another selection must never be returned under a
    // poisoned/misnamed cache file, even if all graph values remain valid.
    const poisoned = JSON.parse(serialized);
    poisoned.snapshot.bbox.north = 35.021;
    await writeFile(join(directory, files[0]), JSON.stringify(poisoned));
    const third = await createNetworkService(fetcher, { cacheDirectory: directory })(bbox);
    expect(third.cached).toBe(false);
    expect(third.snapshot.bbox).toEqual(bbox);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("reports real request/build/cache stages rather than timed fake processing steps", async () => {
    const events: NetworkImportProgress[] = [];
    const service = createNetworkService(async () => Response.json(fixture));
    await service(bbox, undefined, (event) => events.push(event));
    expect(events.map((event) => event.stage)).toEqual(["fetching", "building"]);
    expect(events[0].attempt).toBe(1);
    await service(bbox, undefined, (event) => events.push(event));
    expect(events.at(-1)?.stage).toBe("cache");
  });

  it("keeps the full selected bbox when a regional road query is requested", async () => {
    const regional = { south: 35, west: 139, north: 35.08, east: 139.1 };
    let query = "";
    await fetchOverpass(regional, {
      endpoints: ["https://example.test/api/interpreter"],
      fetcher: async (url) => {
        query = new URL(String(url)).searchParams.get("data")!;
        return Response.json(fixture);
      },
      method: "GET",
    });
    expect(query).toContain("35,139,35.08,139.1");
    expect(query).toContain("tertiary");
    expect(query).not.toContain("residential");
  });

  it("falls back to disclosed regional roads for a dense box without reducing its area", async () => {
    let calls = 0;
    const fetcher = vi.fn<typeof fetch>(async () =>
      ++calls === 1
        ? Response.json({
            elements: Array.from(
              { length: realCityConfig.maxElements + 1 },
              () => fixture.elements[0],
            ),
          })
        : Response.json(fixture),
    );
    const result = await createNetworkService(fetcher)(bbox);
    expect(result.snapshot.bbox).toEqual(bbox);
    expect(result.snapshot.importProfile?.mode).toBe("regional");
    expect(result.snapshot.importProfile?.reason).toBe("density");
    expect(result.snapshot.network.edges.some((edge) => edge.osm?.highway === "residential")).toBe(
      false,
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("streamed acquisition client", () => {
  it("cancels a stalled response stream immediately", async () => {
    const controller = new AbortController();
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
    });
    const request = requestRealCityNetwork(
      bbox,
      controller.signal,
      async () => new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } }),
    );
    const rejection = expect(request).rejects.toThrow("CANCELLED");
    await tick();
    controller.abort();
    await rejection;
    expect(cancelled).toBe(true);
  });

  it("accepts chunked progress and validates the final snapshot", async () => {
    const snapshot = buildRealCityNetwork(fixture, bbox);
    const events: NetworkImportProgress[] = [];
    const text = `${JSON.stringify({ type: "progress", stage: "fetching", profile: "detailed", attempt: 1, attempts: 2 })}\n${JSON.stringify({ type: "result", snapshot, cached: false })}\n`;
    const encoded = new TextEncoder().encode(text);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded.slice(0, 37));
        controller.enqueue(encoded.slice(37));
        controller.close();
      },
    });
    const result = await requestRealCityNetwork(
      bbox,
      undefined,
      async () => new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } }),
      (event) => events.push(event),
    );
    expect(result.snapshot.network.edges).toEqual(snapshot.network.edges);
    expect(events).toHaveLength(1);
    expect(events[0].stage).toBe("fetching");
  });

  it("preserves rate-limit feedback from a streamed error", async () => {
    await expect(
      requestRealCityNetwork(
        bbox,
        undefined,
        async () =>
          new Response(
            `${JSON.stringify({ type: "error", error: "RATE_LIMIT", retryAfterSeconds: 900 })}\n`,
            { headers: { "Content-Type": "application/x-ndjson" } },
          ),
      ),
    ).rejects.toMatchObject({ code: "RATE_LIMIT", retryAfterSeconds: 900 });
  });

  it("rejects malformed or incomplete streams instead of manufacturing a network", async () => {
    for (const body of [
      "not json\n",
      '{"type":"progress","stage":"fake","profile":"detailed"}\n',
      '{"type":"progress","stage":"fetching","profile":"detailed"}\n',
    ]) {
      await expect(
        requestRealCityNetwork(
          bbox,
          undefined,
          async () => new Response(body, { headers: { "Content-Type": "application/x-ndjson" } }),
        ),
      ).rejects.toThrow("INVALID_RESPONSE");
    }
  });
});
