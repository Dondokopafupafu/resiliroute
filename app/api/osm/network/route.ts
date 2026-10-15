import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/ai/request-origin";
import { ImportError } from "@/lib/osm/geo";
import { boundedText } from "@/lib/osm/overpass-client";
import { createNetworkService } from "@/lib/osm/network-service";

export const runtime = "nodejs";
export const maxDuration = 55;
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
    const result = await getNetwork(body, request.signal);
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
