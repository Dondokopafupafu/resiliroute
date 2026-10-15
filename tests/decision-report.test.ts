import { describe, expect, it } from "vitest";
import { harborCity, odPairs } from "@/data/harbor-city";
import { scenarios } from "@/data/scenarios";
import { simulate } from "@/lib/simulation/simulate";
import { deriveDecisionEvidence } from "@/lib/decision/evidence";
import {
  exportAnalysisSnapshot,
  exportDecisionCSV,
  renderResilienceReport,
  spreadsheetSafeCSV,
  type DecisionReportInput,
} from "@/lib/decision/report";

describe("portable resilience reports", () => {
  const baseline = simulate(harborCity, odPairs);
  const current = simulate(harborCity, odPairs, scenarios.earthquake.closedEdgeIds, baseline);
  const input: DecisionReportInput = {
    scenarioName: "Earthquake reference",
    createdAt: "2026-10-15T00:00:00.000Z",
    network: harborCity,
    odPairs,
    baseline,
    current,
    evidence: deriveDecisionEvidence(harborCity, baseline, current),
    recovery: {
      budget: 5,
      objective: "resilience",
      method: "exact",
      plans: [
        {
          id: "a",
          restoredEdgeIds: ["harbor-bridge"],
          cost: 5,
          score: 100,
          metrics: baseline.metrics,
        },
      ],
    },
    uncertainty: {
      runs: 100,
      seed: 2026,
      meanResilience: 82,
      medianResilience: 85,
      p10Resilience: 60,
      p90Resilience: 100,
      probabilityBelow60: 0.1,
      probabilityHospitalBelow70: 0.05,
    },
  };

  it("contains every required section, actual metrics and print-ready model geometry", () => {
    const html = renderResilienceReport(input);
    for (const section of [
      "summary",
      "network",
      "metrics",
      "map",
      "disruptions",
      "criticality",
      "zones",
      "facilities",
      "recovery",
      "uncertainty",
      "methodology",
      "limitations",
    ])
      expect(html).toContain(`id="${section}"`);
    expect(html).toContain(input.scenarioName);
    expect(html).toContain(baseline.metrics.averageTravelTime.toFixed(1));
    expect(html).toContain(current.metrics.averageTravelTime.toFixed(1));
    expect(html).toContain("@media print");
    expect(html).toContain("<svg");
    expect(html).toContain("Red dashed links are closed");
    expect(html).toContain("user-defined scenario assumptions");
    expect(html).not.toMatch(/NaN|Infinity|undefined%/);
    expect(html).not.toMatch(/<script|(?:src|href)="https?:\/\//);
  });

  it("escapes scenario names, road names and arbitrary external text without executing them", () => {
    const malicious = '<script>alert("x")</script><img src=x onerror=alert(1)>';
    const network = {
      ...harborCity,
      edges: harborCity.edges.map((edge) => ({ ...edge, name: malicious })),
    };
    const html = renderResilienceReport({ ...input, scenarioName: malicious, network });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("default-src 'none'");
  });

  it("renders Japanese, N/A missing services and honest OpenStreetMap provenance", () => {
    const html = renderResilienceReport(
      { ...input, realCity: true, evidence: { ...input.evidence, facilities: [] } },
      "ja",
    );
    expect(html).toContain('lang="ja"');
    expect(html).toContain("都市交通レジリエンス分析");
    expect(html).toContain("OpenStreetMap");
    expect(html).toContain("ODbL-1.0");
    expect(html).toContain("N/A");
    expect(html).toContain("実際の金額ではありません");
  });

  it("exports all five CSVs with spreadsheet-injection protection", () => {
    for (const kind of ["kpi", "links", "zones", "facilities", "recovery"] as const) {
      const csv = exportDecisionCSV(input, kind);
      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toContain("\r\n");
      expect(csv).not.toMatch(/NaN|Infinity|undefined%/);
    }
    const csv = spreadsheetSafeCSV([
      ['=HYPERLINK("https://example.invalid")', "  +SUM(1,2)", "@cmd", "-1+1", -3, 'a,"b"\nc'],
    ]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'  +SUM");
    expect(csv).toContain("'@cmd");
    expect(csv).toContain("'-1+1");
    expect(csv).toContain('"-3.000000"');
    expect(csv).toContain('"a,""b""\nc"');
  });

  it("exports a self-contained analysis JSON without serializing nonfinite numbers", () => {
    const parsed = JSON.parse(exportAnalysisSnapshot(input));
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.network.edges).toHaveLength(harborCity.edges.length);
    expect(parsed.odPairs).toEqual(odPairs);
    expect(parsed.networkIdentifier).toMatch(/^sha256:/);
    expect(parsed.current).toEqual(current.metrics);
    expect(parsed.closedEdgeIds).toEqual(current.closedEdgeIds);
    expect(parsed.recovery.plans[0].restoredEdgeIds).toEqual(["harbor-bridge"]);
    expect(parsed.source).toContain("Synthetic");
    expect(exportAnalysisSnapshot(input)).not.toMatch(/NaN|Infinity/);
  });

  it("preserves recovery stages and robust comparisons with honest shortlist limitations", () => {
    const richer: DecisionReportInput = {
      ...input,
      sequence: [
        {
          edgeId: "harbor-bridge",
          stage: 1,
          metrics: baseline.metrics,
          resilienceGain: 5,
          accessibilityGain: 10,
          travelTimeSaved: 2,
          method: "exact-subset",
        },
      ],
      robust: {
        runs: 100,
        assumption: "restored-links-protected-in-user-defined-samples",
        comparedPlans: 1,
        plans: [
          {
            planId: "a",
            restoredEdgeIds: ["harbor-bridge"],
            cost: 5,
            expectedResilience: 85,
            worstResilience: 70,
            p10Resilience: 75,
          },
        ],
      },
    };
    const html = renderResilienceReport(richer);
    expect(html).toContain('id="sequence"');
    expect(html).toContain('id="robust"');
    expect(html).toContain("not all possible plans");
    expect(html).toContain("not predicted days");
    const snapshot = JSON.parse(exportAnalysisSnapshot(richer));
    expect(snapshot.recoverySequence).toEqual(richer.sequence);
    expect(snapshot.robustRecovery).toEqual(richer.robust);
  });

  it("does not export undeclared runtime metadata hidden in the input network", () => {
    const network = {
      ...harborCity,
      apiKey: "never-export-this",
      nodes: harborCity.nodes.map((node) => ({ ...node, auth: "private-node-metadata" })),
    };
    const snapshot = exportAnalysisSnapshot({ ...input, network });
    expect(snapshot).not.toContain("never-export-this");
    expect(snapshot).not.toContain("private-node-metadata");
  });
  it("marks unavailable facility access in CSV instead of reporting a measured zero", () => {
    const absent = { ...input, evidence: { ...input.evidence, facilities: [] } };
    expect(exportDecisionCSV(absent, "kpi")).toContain('"Accessibility (%)","N/A","N/A","N/A"');
    expect(exportDecisionCSV(absent, "recovery")).toContain('"N/A"');
  });
});
