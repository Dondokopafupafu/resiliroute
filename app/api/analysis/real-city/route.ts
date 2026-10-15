import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/ai/request-origin";
import { isLocale } from "@/lib/i18n/messages";
import { boundedText } from "@/lib/osm/overpass-client";
import { validateSnapshot } from "@/lib/real-city/snapshot";
import { realCityConfig } from "@/lib/real-city/model-config";
import { realCityContext } from "@/lib/real-city/context";
import { screenCriticalCandidates } from "@/lib/real-city/stress-screening";
import { simulate } from "@/lib/simulation/simulate";
import { analyzeCriticalLinks, analyzeRecovery } from "@/lib/simulation/stress-test";
import { generateAnalysis } from "@/lib/ai/provider";
import type { AnalysisResponse } from "@/types/analysis";

export const runtime = "nodejs";
export const maxDuration = 55;
const cache = new Map<string, AnalysisResponse>();
let windowStart = Date.now(),
  calls = 0,
  active = false;
export function GET() {
  return NextResponse.json(
    { enabled: !!process.env.OPENAI_API_KEY },
    { headers: { "Cache-Control": "no-store" } },
  );
}
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
    return NextResponse.json({ error: "Cross-origin request." }, { status: 403 });
  // No API key means no server recomputation or upload is needed: the browser
  // already has the exact deterministic brief. The client keeps it visible.
  if (!process.env.OPENAI_API_KEY)
    return NextResponse.json({ source: "local", useBrowserEvidence: true });
  if (Date.now() - windowStart > 300000) {
    windowStart = Date.now();
    calls = 0;
  }
  if (active || calls >= 8) return NextResponse.json({ source: "local", useBrowserEvidence: true });
  let ownsLock = false;
  try {
    const raw = await boundedText(request.body, realCityConfig.maxSnapshotBytes);
    const body: unknown = JSON.parse(raw);
    if (
      !body ||
      typeof body !== "object" ||
      !("snapshot" in body) ||
      !("closedEdgeIds" in body) ||
      !Array.isArray(body.closedEdgeIds) ||
      body.closedEdgeIds.length > realCityConfig.maxClosures ||
      !("locale" in body) ||
      !isLocale(body.locale)
    )
      throw new Error("Invalid evidence");
    const snapshot = validateSnapshot(body.snapshot);
    if (
      body.closedEdgeIds.some(
        (id) => typeof id !== "string" || !snapshot.network.edges.some((e) => e.id === id && e.osm),
      )
    )
      throw new Error("Invalid road");
    const closed = [...new Set(body.closedEdgeIds as string[])].sort();
    const key = createHash("sha256")
      .update(JSON.stringify([snapshot, closed, body.locale]))
      .digest("hex");
    const cached = cache.get(key);
    if (cached) return NextResponse.json(cached);
    // Body reads can overlap. Recheck the process budget after the await, and
    // release only a lock acquired by this request.
    if (active || calls >= 8)
      return NextResponse.json({ source: "local", useBrowserEvidence: true });
    calls++;
    active = true;
    ownsLock = true;
    // Recompute all evidence from validated graph and IDs, never client KPIs.
    const baseline = simulate(snapshot.network, snapshot.odPairs);
    const current = simulate(snapshot.network, snapshot.odPairs, closed, baseline);
    const screening = screenCriticalCandidates(snapshot.network, current);
    const critical = analyzeCriticalLinks(
      snapshot.network,
      snapshot.odPairs,
      current,
      baseline,
      screening.ids,
    );
    const recovery = analyzeRecovery(snapshot.network, snapshot.odPairs, current, baseline);
    const context = realCityContext(snapshot, baseline, current, critical, recovery, screening);
    const response = await generateAnalysis(context, {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL,
      locale: body.locale,
    });
    if (cache.size >= 12) cache.delete(cache.keys().next().value!);
    cache.set(key, response);
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ source: "local", useBrowserEvidence: true });
  } finally {
    if (ownsLock) active = false;
  }
}
