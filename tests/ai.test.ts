import { describe, expect, it, vi } from "vitest";
import { harborCity, odPairs } from "@/data/harbor-city";
import { scenarios } from "@/data/scenarios";
import { simulate } from "@/lib/simulation/simulate";
import { analyzeCriticalLinks, analyzeRecovery } from "@/lib/simulation/stress-test";
import { createAnalysisContext, generateLocalAnalysis, isAIAnalysis } from "@/lib/ai/analysis";
import { generateAnalysis } from "@/lib/ai/provider";
import { isSameOrigin } from "@/lib/ai/request-origin";

const baseline = simulate(harborCity, odPairs);
const quake = simulate(harborCity, odPairs, scenarios.earthquake.closedEdgeIds, baseline);
const context = createAnalysisContext(
  "Earthquake",
  baseline,
  quake,
  analyzeCriticalLinks(harborCity, odPairs, quake, baseline),
  analyzeRecovery(harborCity, odPairs, quake, baseline),
);

describe("Evidence-grounded analysis", () => {
  it("accepts legitimate browser origins and rejects cross-origin or malformed requests", () => {
    expect(isSameOrigin("http://127.0.0.1:3001", "127.0.0.1:3001", "http:")).toBe(true);
    expect(isSameOrigin("https://resiliroute.example", "resiliroute.example", "https")).toBe(true);
    expect(isSameOrigin("http://127.0.0.1:3000", "127.0.0.1:3001", "http")).toBe(false);
    expect(isSameOrigin("https://other.example", "resiliroute.example", "https")).toBe(false);
    expect(isSameOrigin("null", "resiliroute.example", "https")).toBe(false);
    expect(isSameOrigin("https://resiliroute.example/path", "resiliroute.example", "https")).toBe(
      false,
    );
    expect(isSameOrigin(null, "resiliroute.example", "https")).toBe(true);
  });
  it("returns valid structured local analysis based on measured changes", () => {
    const analysis = generateLocalAnalysis(context);
    expect(isAIAnalysis(analysis)).toBe(true);
    expect(analysis.summary).toContain(quake.metrics.averageTravelTime.toFixed(1));
    expect(analysis.recommendedActions[0]).toContain(context.bestRecovery!.name);
    const normal = generateLocalAnalysis(
      createAnalysisContext("Normal conditions", baseline, baseline, [], []),
    );
    expect(normal.summary).not.toBe(analysis.summary);
    expect(normal.mainImpact).toContain("100 by definition");
    expect(isAIAnalysis({ summary: "incomplete" })).toBe(false);
  });
  it("works without credentials and falls back on upstream failure", async () => {
    expect((await generateAnalysis(context)).source).toBe("local");
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
    const result = await generateAnalysis(context, { apiKey: "test-key", fetcher });
    expect(result.source).toBe("local");
    expect(isAIAnalysis(result.analysis)).toBe(true);
  });
  it("generates Japanese analysis from the same measured evidence and preserves fallback language", async () => {
    const japanese = generateLocalAnalysis(context, "ja");
    expect(isAIAnalysis(japanese)).toBe(true);
    expect(japanese.summary).toContain(quake.metrics.averageTravelTime.toFixed(1));
    expect(japanese.summary).toContain("3リンク");
    expect(japanese.whyItMatters).toContain("港バイパス");
    expect(japanese.recommendedActions[0]).toContain("ハーバー橋");
    expect(japanese.limitations).toContain("公式情報");
    expect(context.bestRecovery!.name).toBe("Harbor Bridge");
    expect((await generateAnalysis(context, { locale: "ja" })).analysis).toEqual(japanese);
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
    expect(
      (await generateAnalysis(context, { locale: "ja", apiKey: "test-key", fetcher })).analysis,
    ).toEqual(japanese);
    const input = JSON.parse(String(fetcher.mock.calls[0][1]!.body));
    expect(input.instructions).toContain("Japanese (日本語)");
    expect(JSON.parse(input.input).bestRecovery.name).toBe("ハーバー橋");
    expect(JSON.parse(input.input).current.averageTravelTime).toBe(quake.metrics.averageTravelTime);
  });
  it("accepts Japanese structured output and falls back when the requested language is missing", async () => {
    const local = generateLocalAnalysis(context, "ja");
    const brief = {
      ...local,
      summary: "残る接続に需要が移ります。",
      mainImpact: "重要施設へのアクセスが低下します。",
      whyItMatters: "混雑の影響が別の地域に波及します。",
      mostAffectedArea: "東部の影響が大きい結果です。",
      criticalInfrastructure: "港鉄道線が次の障害で重要になります。",
      recommendedActions: ["ハーバー橋の復旧を検討できます。"],
    };
    const response = (value: unknown) =>
      new Response(
        JSON.stringify({
          output: [{ content: [{ type: "output_text", text: JSON.stringify(value) }] }],
        }),
      );
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(brief));
    // The provider always replaces limitations with the trusted local copy.
    fetcher.mockResolvedValue(response({ ...brief, limitations: "架空の教育用モデルです。" }));
    expect(
      (await generateAnalysis(context, { locale: "ja", apiKey: "test-key", fetcher })).source,
    ).toBe("openai");
    fetcher.mockResolvedValue(
      response({ ...brief, summary: "English only", limitations: "Synthetic model." }),
    );
    expect(
      (await generateAnalysis(context, { locale: "ja", apiKey: "test-key", fetcher })).source,
    ).toBe("local");
    fetcher.mockResolvedValue(
      response({ ...brief, summary: "９９９人が孤立。", limitations: "架空モデルです。" }),
    );
    expect(
      (await generateAnalysis(context, { locale: "ja", apiKey: "test-key", fetcher })).source,
    ).toBe("local");
  });
  it("validates structured output and rejects invented numeric claims", async () => {
    const good = {
      summary: "The remaining crossings absorb displaced demand.",
      mainImpact: "Access to essential services declines.",
      whyItMatters: "Congestion spreads beyond the original closure.",
      mostAffectedArea: "The supplied district analysis highlights unequal impacts.",
      criticalInfrastructure: "The next-link stress test identifies a remaining weak point.",
      recommendedActions: ["Consider the highest-ranked modeled recovery."],
      limitations: "Synthetic educational model.",
    };
    const response = (value: unknown) =>
      new Response(
        JSON.stringify({
          output: [{ content: [{ type: "output_text", text: JSON.stringify(value) }] }],
        }),
      );
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(good));
    const result = await generateAnalysis(context, { apiKey: "test-key", fetcher });
    expect(result.source).toBe("openai");
    expect(result.analysis.limitations).toContain("official local guidance");
    fetcher.mockResolvedValue(response({ ...good, summary: "999 people are stranded." }));
    expect((await generateAnalysis(context, { apiKey: "test-key", fetcher })).source).toBe("local");
    fetcher.mockResolvedValue(response({ summary: "incomplete" }));
    expect((await generateAnalysis(context, { apiKey: "test-key", fetcher })).source).toBe("local");
  });
});
