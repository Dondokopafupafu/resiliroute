import { describe, expect, it } from "vitest";
import { decisionEdgeColor, criticalColors, cascadeColors } from "@/lib/decision/map-style";
import { criticalityBand } from "@/lib/decision/evidence";
describe("decision map evidence", () => {
  it("preserves closed links on all analysis layers", () => {
    for (const layer of ["traffic", "criticality", "cascade"] as const)
      expect(decisionEdgeColor(layer, false, "traffic", 100, 100, 100, "closed")).toBe("closed");
  });
  it("does not assign criticality to untested links or magnify zero-impact networks", () => {
    expect(criticalityBand(undefined, 90)).toBe("untested");
    expect(criticalityBand(0, 0)).toBe("low");
    expect(decisionEdgeColor("criticality", true, "traffic", undefined, 90, 0, "closed")).toBe(
      criticalColors.untested,
    );
    expect(criticalityBand(90, 90)).toBe("critical");
  });
  it("classifies flow redistribution in percentage points of utilization", () => {
    expect(decisionEdgeColor("cascade", true, "traffic", 0, 0, 9.9, "closed")).toBe(
      cascadeColors.stable,
    );
    expect(decisionEdgeColor("cascade", true, "traffic", 0, 0, 30, "closed")).toBe(
      cascadeColors.high,
    );
    expect(decisionEdgeColor("cascade", true, "traffic", 0, 0, 60, "closed")).toBe(
      cascadeColors.severe,
    );
  });
});
