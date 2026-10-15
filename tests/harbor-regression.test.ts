import { expect, it } from "vitest";
import { harborCity, odPairs } from "@/data/harbor-city";
import { scenarios } from "@/data/scenarios";
import { simulate } from "@/lib/simulation/simulate";
import stable from "./fixtures/harbor-regression.json";

it("preserves checkpoint Harbor City baseline, earthquake and reset metrics", () => {
  const baseline = simulate(harborCity, odPairs);
  const earthquake = simulate(harborCity, odPairs, scenarios.earthquake.closedEdgeIds, baseline);
  for (const [key, value] of Object.entries(stable.baseline))
    expect(baseline.metrics[key as keyof typeof stable.baseline]).toBeCloseTo(value, 8);
  for (const [key, value] of Object.entries(stable.earthquake))
    expect(earthquake.metrics[key as keyof typeof stable.earthquake]).toBeCloseTo(value, 8);
  expect(simulate(harborCity, odPairs, [], baseline).metrics).toEqual(baseline.metrics);
});
