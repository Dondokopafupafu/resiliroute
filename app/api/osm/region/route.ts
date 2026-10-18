import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/ai/request-origin";
import { ImportError } from "@/lib/osm/geo";
import { boundedText } from "@/lib/osm/overpass-client";
import { regionalNetworkService } from "@/lib/osm/regional-service";

export const runtime = "nodejs";
export const maxDuration = 40;

/** Metadata only: never starts a regional-pack download. */
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
    const result = await regionalNetworkService.preflight(body, request.signal);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof ImportError ? error.code : "UPSTREAM_UNAVAILABLE";
    return NextResponse.json(
      { error: code },
      {
        status: ["INVALID_BBOX", "AREA_TOO_LARGE"].includes(code)
          ? 400
          : code === "RATE_LIMIT"
            ? 429
            : code === "CANCELLED"
              ? 499
              : 503,
        headers: {
          "Cache-Control": "no-store",
          ...(error instanceof ImportError && error.retryAfterSeconds
            ? { "Retry-After": String(error.retryAfterSeconds) }
            : {}),
        },
      },
    );
  }
}
