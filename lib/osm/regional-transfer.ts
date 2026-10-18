import { ImportError } from "./geo";

export const regionalTransferLimits = {
  rangeThresholdBytes: 32 * 1024 * 1024,
  chunkBytes: 16 * 1024 * 1024,
  partTimeoutMs: 30000,
} as const;

interface PackResponse {
  response: Response;
  url: string;
}
/** Sequential HTTP ranges, not parallel mirrors or automatic retries. */
export async function transferRegionalPack(options: {
  url: string;
  bytes: number;
  maxBytes: number;
  signal: AbortSignal;
  request: (url: string, init: RequestInit) => Promise<PackResponse>;
  checkResponse: (response: Response) => Promise<void>;
  write: (chunk: Uint8Array) => Promise<void>;
  onBytes?: (bytes: number) => void;
  // Inject small transfer sizes in unit tests without making large allocations.
  limits?: { rangeThresholdBytes: number; chunkBytes: number; partTimeoutMs: number };
}): Promise<{ bytes: number; lastModified: string | null }> {
  const limits = options.limits ?? regionalTransferLimits;
  if (
    !Number.isSafeInteger(options.bytes) ||
    options.bytes <= 0 ||
    options.bytes > options.maxBytes ||
    !Number.isSafeInteger(limits.chunkBytes) ||
    limits.chunkBytes <= 0 ||
    limits.rangeThresholdBytes < 0
  )
    throw new ImportError("TOO_COMPLEX");
  const ranged = options.bytes > limits.rangeThresholdBytes;
  let received = 0,
    pinnedUrl: string | undefined,
    etag: string | null = null,
    modified: string | null = null;
  do {
    if (options.signal.aborted) throw new ImportError("CANCELLED");
    const start = received;
    const end = ranged
      ? Math.min(options.bytes - 1, start + limits.chunkBytes - 1)
      : options.bytes - 1;
    const timeout = AbortSignal.timeout(limits.partTimeoutMs);
    const signal = AbortSignal.any([options.signal, timeout]);
    try {
      const headers: Record<string, string> = {
        Accept: "application/octet-stream",
        "User-Agent": "ResiliRoute/3.0 (+https://github.com/Dondokopafupafu/resiliroute)",
      };
      if (ranged) headers.Range = `bytes=${start}-${end}`;
      if (start > 0) {
        if (etag && !etag.startsWith("W/")) headers["If-Range"] = etag;
        else if (modified) headers["If-Range"] = modified;
      }
      const { response, url } = await options.request(pinnedUrl ?? options.url, {
        headers,
        signal,
        cache: "no-store",
      });
      await options.checkResponse(response);
      let expected = options.bytes;
      let wholeFile = !ranged;
      const reject = async (): Promise<never> => {
        await response.body?.cancel();
        throw new ImportError("INVALID_RESPONSE");
      };
      if (pinnedUrl && url !== pinnedUrl) return reject();
      if (
        start > 0 &&
        ((etag && response.headers.get("etag") !== etag) ||
          (modified && response.headers.get("last-modified") !== modified))
      )
        return reject();
      if (ranged && response.status === 206) {
        const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(
          response.headers.get("content-range") ?? "",
        );
        if (
          !match ||
          Number(match[1]) !== start ||
          Number(match[2]) !== end ||
          Number(match[3]) !== options.bytes
        )
          return reject();
        expected = end - start + 1;
      } else if (response.status === 200 && start === 0) {
        // A service may ignore Range. Accept a bounded full file only before
        // writing any earlier chunk; never append a fresh file mid-transfer.
        wholeFile = true;
      } else return reject();
      const length = response.headers.get("content-length");
      if (!response.body || (length !== null && Number(length) !== expected)) return reject();
      if (!pinnedUrl) {
        pinnedUrl = url;
        etag = response.headers.get("etag");
        modified = response.headers.get("last-modified");
      }
      const reader = response.body.getReader();
      const cancel = () => {
        void reader.cancel().catch(() => undefined);
      };
      signal.addEventListener("abort", cancel, { once: true });
      let partBytes = 0;
      try {
        while (true) {
          if (signal.aborted) throw new ImportError("CANCELLED");
          const { done, value } = await reader.read();
          if (done) break;
          partBytes += value.byteLength;
          if (partBytes > expected || received + value.byteLength > options.maxBytes)
            throw new ImportError("TOO_COMPLEX");
          await options.write(value);
          received += value.byteLength;
          options.onBytes?.(received);
        }
      } finally {
        signal.removeEventListener("abort", cancel);
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
      if (signal.aborted) throw new ImportError("CANCELLED");
      if (partBytes !== expected) throw new ImportError("INVALID_RESPONSE");
      if (wholeFile) break;
    } catch (error) {
      if (options.signal.aborted) throw new ImportError("CANCELLED");
      if (timeout.aborted) throw new ImportError("TIMEOUT");
      throw error instanceof ImportError ? error : new ImportError("UPSTREAM_UNAVAILABLE");
    }
  } while (received < options.bytes);
  if (received !== options.bytes) throw new ImportError("INVALID_RESPONSE");
  return { bytes: received, lastModified: modified };
}
