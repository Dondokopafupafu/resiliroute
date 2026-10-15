import { NextRequest, NextResponse } from "next/server";
import { harborCity, odPairs } from "@/data/harbor-city";
import { scenarios } from "@/data/scenarios";
import { simulate } from "@/lib/simulation/simulate";
import { analyzeCriticalLinks, analyzeRecovery } from "@/lib/simulation/stress-test";
import { createAnalysisContext } from "@/lib/ai/analysis";
import { generateAnalysis } from "@/lib/ai/provider";
import { isSameOrigin } from "@/lib/ai/request-origin";
import { boundedText } from "@/lib/osm/overpass-client";
import { ImportError } from "@/lib/osm/geo";
import { isLocale } from "@/lib/i18n/messages";
import type { AnalysisResponse } from "@/types/analysis";
import type { ScenarioId } from "@/types/network";

export const runtime = "nodejs";
const maxRequestBytes = 4096;
const baseline = simulate(harborCity, odPairs);
const cache = new Map<string, { expires: number; response: AnalysisResponse }>();
const pending = new Map<string, Promise<AnalysisResponse>>();
let upstreamCalls = 0;
let upstreamWindow = Date.now();

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? request.nextUrl.protocol;
  if (!isSameOrigin(origin, request.headers.get("host") ?? request.nextUrl.host, protocol))
    return NextResponse.json(
      { error: "Cross-origin requests are not supported." },
      { status: 403 },
    );
  if (Number(request.headers.get("content-length")) > maxRequestBytes)
    return NextResponse.json({ error: "Scenario input is too large." }, { status: 413 });
  let text: string;
  try {
    // Bound streamed bytes before buffering the full payload, including requests
    // without Content-Length. A disconnected upload must not escape as a 500.
    text = await boundedText(request.body, maxRequestBytes);
  } catch (error) {
    return error instanceof ImportError && error.code === "TOO_COMPLEX"
      ? NextResponse.json({ error: "Scenario input is too large." }, { status: 413 })
      : NextResponse.json({ error: "Invalid scenario input." }, { status: 400 });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON input." }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("scenarioId" in body) ||
    typeof body.scenarioId !== "string" ||
    !Object.hasOwn(scenarios, body.scenarioId) ||
    !("closedEdgeIds" in body) ||
    !Array.isArray(body.closedEdgeIds) ||
    body.closedEdgeIds.length > harborCity.edges.length ||
    ("locale" in body && !isLocale(body.locale)) ||
    body.closedEdgeIds.some(
      (id) => typeof id !== "string" || !harborCity.edges.some((e) => e.id === id),
    )
  ) {
    return NextResponse.json(
      { error: "Select a valid scenario and network links." },
      { status: 400 },
    );
  }
  const scenarioId = body.scenarioId as ScenarioId;
  const locale = "locale" in body && isLocale(body.locale) ? body.locale : "en";
  const closed = [...new Set(body.closedEdgeIds as string[])].sort();
  // Never trust client-supplied metrics or prose. Recompute from valid link IDs.
  const key = `${locale}:${scenarioId}:${closed.join(",")}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now())
    return NextResponse.json(cached.response, { headers: { "Cache-Control": "no-store" } });
  if (Date.now() - upstreamWindow > 60000) {
    upstreamWindow = Date.now();
    upstreamCalls = 0;
  }
  let task = pending.get(key);
  if (!task) {
    task = (async () => {
      const current = simulate(harborCity, odPairs, closed, baseline);
      const context = createAnalysisContext(
        scenarios[scenarioId].name,
        baseline,
        current,
        analyzeCriticalLinks(harborCity, odPairs, current, baseline),
        analyzeRecovery(harborCity, odPairs, current, baseline),
      );
      // A bounded per-process budget limits accidental API spend; local analysis
      // remains available. Distributed deployments need a shared rate limiter.
      const apiKey = upstreamCalls < 12 ? process.env.OPENAI_API_KEY : undefined;
      if (apiKey) upstreamCalls++;
      const result = await generateAnalysis(context, {
        apiKey,
        model: process.env.OPENAI_MODEL,
        locale,
      });
      if (cache.size >= 64) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: Date.now() + 300000, response: result });
      return result;
    })();
    pending.set(key, task);
  }
  try {
    return NextResponse.json(await task, { headers: { "Cache-Control": "no-store" } });
  } finally {
    pending.delete(key);
  }
}
