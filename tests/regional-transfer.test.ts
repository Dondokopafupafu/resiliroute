import { describe, expect, it, vi } from "vitest";
import { ImportError } from "@/lib/osm/geo";
import { transferRegionalPack } from "@/lib/osm/regional-transfer";

const file = new Uint8Array(Array.from({ length: 18 }, (_, index) => index));
const latest = "https://download.geofabrik.de/test-latest.osm.pbf";
const pinned = "https://download.geofabrik.de/test-261015.osm.pbf";
const limits = { rangeThresholdBytes: 4, chunkBytes: 5, partTimeoutMs: 1000 };
const okay = async (response: Response) => {
  if (!response.ok)
    throw new ImportError(response.status === 429 ? "RATE_LIMIT" : "UPSTREAM_UNAVAILABLE");
};
function ranged(
  start: number,
  end: number,
  options: { range?: string; etag?: string; bytes?: Uint8Array } = {},
) {
  return new Response(new Uint8Array(options.bytes ?? file.slice(start, end + 1)), {
    status: 206,
    headers: {
      "Content-Range": options.range ?? `bytes ${start}-${end}/${file.length}`,
      "Content-Length": String(end - start + 1),
      ETag: options.etag ?? '"v1"',
      "Last-Modified": "Thu, 15 Oct 2026 10:00:00 GMT",
    },
  });
}
function offsets(init: RequestInit) {
  return new Headers(init.headers).get("Range")!.slice(6).split("-").map(Number);
}

describe("bounded sequential regional download", () => {
  it("assembles exactly the requested ranges and pins the dated source", async () => {
    const chunks: Uint8Array[] = [],
      progress: number[] = [],
      urls: string[] = [];
    const request = vi.fn(async (url: string, init: RequestInit) => {
      urls.push(url);
      const [start, end] = offsets(init);
      if (start > 0) expect(new Headers(init.headers).get("If-Range")).toBe('"v1"');
      return { response: ranged(start, end), url: pinned };
    });
    const result = await transferRegionalPack({
      url: latest,
      bytes: file.length,
      maxBytes: 100,
      signal: new AbortController().signal,
      request,
      checkResponse: okay,
      write: async (part) => {
        chunks.push(part);
      },
      onBytes: (bytes) => progress.push(bytes),
      limits,
    });
    expect(result.bytes).toBe(file.length);
    expect(Buffer.concat(chunks)).toEqual(Buffer.from(file));
    expect(progress).toEqual([5, 10, 15, 18]);
    expect(urls).toEqual([latest, pinned, pinned, pinned]);
    expect(request).toHaveBeenCalledTimes(4);
  });

  it("accepts a server ignoring the first Range as one bounded full download", async () => {
    const request = vi.fn(async () => ({
      response: new Response(file, { headers: { "Content-Length": String(file.length) } }),
      url: pinned,
    }));
    const output: Uint8Array[] = [];
    const result = await transferRegionalPack({
      url: latest,
      bytes: file.length,
      maxBytes: 100,
      signal: new AbortController().signal,
      request,
      checkResponse: okay,
      write: async (part) => {
        output.push(part);
      },
      limits,
    });
    expect(result.bytes).toBe(file.length);
    expect(output).toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("uses a normal single request for small packs", async () => {
    const request = vi.fn(async (_: string, init: RequestInit) => {
      expect(new Headers(init.headers).has("Range")).toBe(false);
      return {
        response: new Response(file, { headers: { "Content-Length": String(file.length) } }),
        url: pinned,
      };
    });
    await transferRegionalPack({
      url: latest,
      bytes: file.length,
      maxBytes: 100,
      signal: new AbortController().signal,
      request,
      checkResponse: okay,
      write: async () => {},
      limits: { ...limits, rangeThresholdBytes: 100 },
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed offset or changed total before writing", async () => {
    for (const range of ["bytes 1-5/18", "bytes 0-4/19", "bytes */18", "bytes 0-3/18"]) {
      const write = vi.fn(async () => {});
      await expect(
        transferRegionalPack({
          url: latest,
          bytes: file.length,
          maxBytes: 100,
          signal: new AbortController().signal,
          request: async () => ({ response: ranged(0, 4, { range }), url: pinned }),
          checkResponse: okay,
          write,
          limits,
        }),
      ).rejects.toThrow("INVALID_RESPONSE");
      expect(write).not.toHaveBeenCalled();
    }
  });

  it("rejects a changed version, ETag or full-file response after the first part", async () => {
    for (const change of ["url", "etag", "whole"]) {
      const write = vi.fn(async () => {});
      const request = vi.fn(async (_: string, init: RequestInit) => {
        const [start, end] = offsets(init);
        return {
          response:
            change === "whole" && start > 0
              ? new Response(file)
              : ranged(start, end, { etag: change === "etag" && start > 0 ? '"v2"' : '"v1"' }),
          url: change === "url" && start > 0 ? pinned.replace("261015", "261016") : pinned,
        };
      });
      await expect(
        transferRegionalPack({
          url: latest,
          bytes: file.length,
          maxBytes: 100,
          signal: new AbortController().signal,
          request,
          checkResponse: okay,
          write,
          limits,
        }),
      ).rejects.toThrow("INVALID_RESPONSE");
      expect(request).toHaveBeenCalledTimes(2);
      expect(write).toHaveBeenCalledTimes(1);
    }
  });

  it("rejects a truncated range rather than treating it as a complete file", async () => {
    await expect(
      transferRegionalPack({
        url: latest,
        bytes: file.length,
        maxBytes: 100,
        signal: new AbortController().signal,
        request: async () => ({ response: ranged(0, 4, { bytes: file.slice(0, 3) }), url: pinned }),
        checkResponse: okay,
        write: async () => {},
        limits,
      }),
    ).rejects.toThrow("INVALID_RESPONSE");
  });

  it("cancels a partially received chunk without starting another request", async () => {
    const controller = new AbortController();
    let closed = false;
    const request = vi.fn(async () => ({
      response: new Response(
        new ReadableStream<Uint8Array>({
          start(stream) {
            stream.enqueue(file.slice(0, 2));
          },
          cancel() {
            closed = true;
          },
        }),
        { status: 206, headers: { "Content-Range": "bytes 0-4/18" } },
      ),
      url: pinned,
    }));
    await expect(
      transferRegionalPack({
        url: latest,
        bytes: file.length,
        maxBytes: 100,
        signal: controller.signal,
        request,
        checkResponse: okay,
        write: async () => {
          controller.abort();
        },
        limits,
      }),
    ).rejects.toThrow("CANCELLED");
    expect(closed).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("does not retry a rate-limited chunk", async () => {
    const request = vi.fn(async () => ({
      response: new Response(null, { status: 429 }),
      url: pinned,
    }));
    await expect(
      transferRegionalPack({
        url: latest,
        bytes: file.length,
        maxBytes: 100,
        signal: new AbortController().signal,
        request,
        checkResponse: okay,
        write: async () => {},
        limits,
      }),
    ).rejects.toThrow("RATE_LIMIT");
    expect(request).toHaveBeenCalledTimes(1);
  });
});
