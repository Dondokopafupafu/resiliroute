import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/ai/request-origin";
import { ImportError, validateBoundingBox } from "@/lib/osm/geo";
import { boundedText } from "@/lib/osm/overpass-client";
import { createNetworkService } from "@/lib/osm/network-service";
import { regionalNetworkService } from "@/lib/osm/regional-service";
import type { NetworkProgressListener } from "@/lib/real-city/import-progress";

export const runtime = "nodejs";
export const maxDuration = 300;
const getNetwork = createNetworkService();
const statuses = {
  INVALID_BBOX: 400,
  AREA_TOO_LARGE: 400,
  TOO_COMPLEX: 422,
  EMPTY_ROADS: 422,
  INVALID_RESPONSE: 502,
  UPSTREAM_UNAVAILABLE: 503,
  SERVER_UNREACHABLE: 503,
  TIMEOUT: 504,
  CANCELLED: 499,
  RATE_LIMIT: 429,
  INVALID_SNAPSHOT: 400,
  INVALID_OSM_FILE: 400,
};
export async function POST(request: NextRequest) {
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? request.nextUrl.protocol;
  if (
    !isSameOrigin(
      request.headers.get("origin"),
      request.headers.get("host") ?? request.nextUrl.host,
      protocol,
    )
  )
    return NextResponse.json({ error: "INVALID_BBOX" }, { status: 403 });
  try {
    if (Number(request.headers.get("content-length")) > 4096) throw new ImportError("INVALID_BBOX");
    let body: unknown;
    try {
      body = JSON.parse(await boundedText(request.body, 4096));
    } catch {
      throw new ImportError("INVALID_BBOX");
    }
    validateBoundingBox(body);
    const input = body as { source?: unknown; regionId?: unknown };
    if (input.source !== undefined && input.source !== "regional-extract")
      throw new ImportError("INVALID_BBOX");
    if (
      input.source === "regional-extract" &&
      (typeof input.regionId !== "string" || input.regionId.length > 180 || !input.regionId.length)
    )
      throw new ImportError("INVALID_BBOX");
    const acquire = async (signal?: AbortSignal, progress?: NetworkProgressListener) => {
      if (input.source === "regional-extract") {
        const result = await regionalNetworkService.build(
          body,
          input.regionId as string,
          signal,
          progress,
        );
        if (!result) throw new ImportError("EMPTY_ROADS");
        return result;
      }
      const cachedRegional = await regionalNetworkService.tryCached(body, signal, progress);
      return cachedRegional ?? getNetwork(body, signal, progress);
    };
    if (request.headers.get("accept")?.includes("application/x-ndjson")) {
      const cancellation = new AbortController();
      const signal = AbortSignal.any([request.signal, cancellation.signal]);
      let closed = false;
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const encoder = new TextEncoder();
          const send = (event: unknown) => {
            if (!closed && !signal.aborted)
              controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          };
          try {
            const result = await acquire(signal, (progress) =>
              send({ type: "progress", ...progress }),
            );
            send({ type: "result", ...result });
          } catch (error) {
            send({
              type: "error",
              error: error instanceof ImportError ? error.code : "UPSTREAM_UNAVAILABLE",
              ...(error instanceof ImportError && error.retryAfterSeconds
                ? { retryAfterSeconds: error.retryAfterSeconds }
                : {}),
            });
          } finally {
            if (!closed) {
              closed = true;
              controller.close();
            }
          }
        },
        cancel() {
          closed = true;
          cancellation.abort();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson",
          "Cache-Control": "no-store",
          "X-Accel-Buffering": "no",
        },
      });
    }
    const result = await acquire(request.signal);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof ImportError ? error.code : "UPSTREAM_UNAVAILABLE";
    // No coordinates, user identifiers, payloads or upstream error dumps logged.
    return NextResponse.json(
      { error: code },
      {
        status: statuses[code],
        headers: {
          "Cache-Control": "no-store",
          ...(code === "RATE_LIMIT"
            ? {
                "Retry-After": String(
                  error instanceof ImportError ? (error.retryAfterSeconds ?? 300) : 300,
                ),
              }
            : {}),
        },
      },
    );
  }
}
