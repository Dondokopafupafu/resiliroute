import { describe, expect, it } from "vitest";
import okayama from "../public/real-city/okayama.json";
import matsumoto from "../public/real-city/matsumoto.json";
import { validateSnapshot } from "@/lib/real-city/snapshot";
import { simulate } from "@/lib/simulation/simulate";
import { analyzeCriticalLinks, analyzeRecovery } from "@/lib/simulation/stress-test";
import { screenCriticalCandidates } from "@/lib/real-city/stress-screening";
import { realCityContext } from "@/lib/real-city/context";
import { generateLocalAnalysis, isAIAnalysis } from "@/lib/ai/analysis";
describe("Captured actual OSM networks (offline)", () => {
  for (const [name, data] of [
    ["Okayama", okayama],
    ["Matsumoto", matsumoto],
  ] as const) {
    it(`${name}: shared simulation, road closure and recovery`, () => {
      const snapshot = validateSnapshot(data),
        started = performance.now();
      const baseline = simulate(snapshot.network, snapshot.odPairs);
      const screen = screenCriticalCandidates(snapshot.network, baseline);
      expect(screen.screened).toBe(true);
      expect(screen.ids.length).toBe(35);
      const ranking = analyzeCriticalLinks(
        snapshot.network,
        snapshot.odPairs,
        baseline,
        baseline,
        screen.ids,
      );
      const after = simulate(snapshot.network, snapshot.odPairs, [ranking[0].edgeId], baseline);
      const recovery = analyzeRecovery(snapshot.network, snapshot.odPairs, after, baseline);
      expect(after.edgeStates[ranking[0].edgeId].volume).toBe(0);
      expect(after.metrics.resilienceScore).toBeLessThan(100);
      expect(after.metrics.totalDemand).toBe(baseline.metrics.totalDemand);
      expect(recovery[0].resilienceGain).toBeGreaterThan(0);
      expect(simulate(snapshot.network, snapshot.odPairs, [], baseline).metrics).toEqual(
        baseline.metrics,
      );
      const context = realCityContext(snapshot, baseline, after, ranking, recovery, screen);
      expect(isAIAnalysis(generateLocalAnalysis(context, "en"))).toBe(true);
      expect(generateLocalAnalysis(context, "ja").summary).toMatch(/[ぁ-んァ-ヶ一-龯]/u);
      console.info(
        JSON.stringify({
          city: name,
          totalMs: Math.round(performance.now() - started),
          baseline: baseline.metrics,
          closure: ranking[0].name,
          after: after.metrics,
          recoveryGain: recovery[0].resilienceGain,
        }),
      );
    }, 120000);
  }
});
