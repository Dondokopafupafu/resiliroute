import { expect, it } from "vitest";
import { validateDecisionNetwork } from "@/lib/decision/recovery";
import { simulate } from "@/lib/simulation/simulate";
import type { Network, NetworkEdge, NetworkNode } from "@/types/network";

it("accepts the importer road limit plus facility connectors and rejects excess graph size", () => {
  // Importer supports 900 road decision nodes + 35 separately connected facilities.
  const nodes: NetworkNode[] = Array.from({ length: 935 }, (_, i) => ({
    id: `node-${i}`,
    name: `Node ${i}`,
    latitude: 35 + i / 100000,
    longitude: 139,
    type: "intersection",
    populationWeight: 0,
    demandWeight: 1,
    essentialService: false,
    district: "Central",
  }));
  const edge = (i: number, source: number, target: number): NetworkEdge => ({
    id: `edge-${i}`,
    name: `Link ${i}`,
    source: `node-${source}`,
    target: `node-${target}`,
    mode: "road",
    distance: 0.1,
    freeFlowTime: 0.2,
    capacity: 100,
    currentVolume: 0,
    available: true,
    riskLevel: "low",
    infrastructureType: "street",
    bidirectional: true,
  });
  const edges = [
    ...Array.from({ length: 934 }, (_, i) => edge(i, i, i + 1)),
    ...Array.from({ length: 501 }, (_, i) => edge(934 + i, i, i + 2)),
  ];
  const network: Network = { nodes, edges, accessibilityCategories: [] };
  const demand = [
    {
      id: "trip",
      origin: "node-0",
      destination: "node-934",
      demand: 10,
      purpose: "commute" as const,
    },
  ];
  expect(() => validateDecisionNetwork(network, demand)).not.toThrow();
  expect(Number.isFinite(simulate(network, demand).metrics.averageTravelTime)).toBe(true);
  expect(() =>
    validateDecisionNetwork({ ...network, edges: [...edges, edge(1435, 0, 1)] }, demand),
  ).toThrow("DECISION_NETWORK_LIMIT");
});
