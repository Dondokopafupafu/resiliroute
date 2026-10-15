import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { harborCity, modelConfig, odPairs } from "@/data/harbor-city";
import { decisionConfig } from "@/lib/decision/config";
import {
  createSavedScenario,
  loadSavedScenarios,
  networkIdentifier,
  parseSavedScenario,
  persistSavedScenarios,
  scenarioLimits,
} from "@/lib/decision/scenarios";
import type { Network } from "@/types/network";
import { buildRealCityNetwork } from "@/lib/osm/network-builder";
import { decisionClosureLinks } from "@/lib/decision/closure-links";
import { validClosureIds } from "@/lib/decision/recovery";
import fixture from "./fixtures/osm-small.json";

describe("saved decision scenarios", () => {
  const input = {
    name: "Bridge closure",
    closedEdgeIds: ["harbor-bridge"],
    createdAt: "2026-10-15T00:00:00.000Z",
  };
  const saved = createSavedScenario(harborCity, odPairs, input);
  it("keeps artificial facility connectors out of real-road scenarios and uncertainty inputs", () => {
    const snapshot = buildRealCityNetwork(
      fixture,
      { south: 35, west: 139, north: 35.02, east: 139.02 },
      "2026-10-10T00:00:00Z",
    );
    const connector = snapshot.network.edges.find((edge) => !edge.osm)!;
    expect(connector).toBeDefined();
    expect(decisionClosureLinks(snapshot.network).every((edge) => edge.osm)).toBe(true);
    expect(() => validClosureIds(snapshot.network, [connector.id])).toThrow(
      "INVALID_DECISION_CLOSURES",
    );
    const realSaved = createSavedScenario(snapshot.network, snapshot.odPairs, {
      ...input,
      closedEdgeIds: [],
    });
    expect(() =>
      parseSavedScenario(
        JSON.stringify({ ...realSaved, closedEdgeIds: [connector.id] }),
        snapshot.network,
        snapshot.odPairs,
      ),
    ).toThrow("INVALID_SCENARIO_LINKS");
    expect(decisionClosureLinks(harborCity)).toHaveLength(harborCity.edges.length);
  });
  it("exports and imports an allowlisted scenario without trusting supplied metrics", () => {
    const imported = parseSavedScenario(
      JSON.stringify({
        ...saved,
        metrics: { resilienceScore: -100000 },
        maliciousURL: "javascript:alert(1)",
      }),
      harborCity,
      odPairs,
    );
    expect(imported).toEqual(saved);
    expect(imported).not.toHaveProperty("metrics");
  });
  it("fingerprints full geometry, direction, OD demand and weights, independent of array ordering", () => {
    const id = networkIdentifier(harborCity, odPairs);
    expect(id).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(
      networkIdentifier(
        {
          ...harborCity,
          nodes: [...harborCity.nodes].reverse(),
          edges: [...harborCity.edges].reverse(),
        },
        [...odPairs].reverse(),
      ),
    ).toBe(id);
    const edge = harborCity.edges[0];
    const changed: Network = {
      ...harborCity,
      edges: harborCity.edges.map((item) =>
        item.id === edge.id
          ? {
              ...item,
              geometry: [
                [0, 0],
                [1, 1],
              ],
            }
          : item,
      ),
    };
    expect(networkIdentifier(changed, odPairs)).not.toBe(id);
    expect(
      networkIdentifier(
        harborCity,
        odPairs.map((od, index) => (index === 0 ? { ...od, demand: od.demand + 1 } : od)),
      ),
    ).not.toBe(id);
    expect(
      networkIdentifier(
        {
          ...harborCity,
          nodes: harborCity.nodes.map((node, index) =>
            index === 0 ? { ...node, populationWeight: node.populationWeight + 1 } : node,
          ),
        },
        odPairs,
      ),
    ).not.toBe(id);
  });
  it("implements a SHA-256 content fingerprint that matches Node's reference hash", () => {
    const network = { nodes: [], edges: [] };
    const fingerprint = networkIdentifier(network, []);
    const sortKeys = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(sortKeys)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value)
                .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                .map(([key, item]) => [key, sortKeys(item)]),
            )
          : value;
    const reference = JSON.stringify(
      sortKeys({ modelVersion: decisionConfig.modelVersion, modelConfig, network, odPairs: [] }),
    );
    expect(fingerprint.slice(7)).toBe(createHash("sha256").update(reference).digest("hex"));
  });
  it("rejects unknown versions, mismatched network and unknown or duplicate IDs", () => {
    const parse = (value: unknown) => () =>
      parseSavedScenario(JSON.stringify(value), harborCity, odPairs);
    expect(parse({ ...saved, schemaVersion: 2 })).toThrow("SCENARIO_VERSION_MISMATCH");
    expect(parse({ ...saved, modelVersion: "future" })).toThrow("SCENARIO_VERSION_MISMATCH");
    expect(parse({ ...saved, networkIdentifier: "other-network" })).toThrow(
      "SCENARIO_NETWORK_MISMATCH",
    );
    expect(parse({ ...saved, modelConfig: {} })).toThrow("SCENARIO_NETWORK_MISMATCH");
    expect(parse({ ...saved, closedEdgeIds: ["unknown"] })).toThrow("INVALID_SCENARIO_LINKS");
    expect(parse({ ...saved, closedEdgeIds: ["harbor-bridge", "harbor-bridge"] })).toThrow(
      "INVALID_SCENARIO_LINKS",
    );
  });
  it("rejects malformed, oversized, invalid names/dates/bounds and excess closures", () => {
    expect(() => parseSavedScenario("{", harborCity, odPairs)).toThrow("INVALID_SCENARIO");
    expect(() =>
      parseSavedScenario(" ".repeat(scenarioLimits.maxBytes + 1), harborCity, odPairs),
    ).toThrow("SCENARIO_TOO_LARGE");
    for (const update of [
      { name: "" },
      { name: "a".repeat(81) },
      { name: "a\nname" },
      { createdAt: "bad" },
      { bbox: { south: 50, north: 20, west: 0, east: 1 } },
    ])
      expect(() =>
        parseSavedScenario(JSON.stringify({ ...saved, ...update }), harborCity, odPairs),
      ).toThrow("INVALID_SCENARIO");
    expect(() =>
      parseSavedScenario(
        JSON.stringify({
          ...saved,
          closedEdgeIds: harborCity.edges.slice(0, 13).map((edge) => edge.id),
        }),
        harborCity,
        odPairs,
      ),
    ).toThrow("INVALID_SCENARIO_LINKS");
    expect(() =>
      parseSavedScenario(
        JSON.stringify({ ...saved, bbox: { south: 0, north: 0.001, west: 0, east: 0.001 } }),
        harborCity,
        odPairs,
      ),
    ).toThrow("SCENARIO_NETWORK_MISMATCH");
  });
  it("safely persists, reloads, deletes and survives blocked or corrupt storage", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    expect(persistSavedScenarios(storage, harborCity, odPairs, [saved])).toBe(true);
    expect(loadSavedScenarios(storage, harborCity, odPairs)).toEqual([saved]);
    expect(persistSavedScenarios(storage, harborCity, odPairs, [])).toBe(true);
    expect(loadSavedScenarios(storage, harborCity, odPairs)).toEqual([]);
    expect(
      persistSavedScenarios(
        storage,
        harborCity,
        odPairs,
        Array.from({ length: 5 }, () => saved),
      ),
    ).toBe(false);
    const blocked = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(loadSavedScenarios(blocked, harborCity, odPairs)).toEqual([]);
    expect(persistSavedScenarios(blocked, harborCity, odPairs, [saved])).toBe(false);
    expect(
      loadSavedScenarios({ ...storage, getItem: () => "not JSON" }, harborCity, odPairs),
    ).toEqual([]);
  });
});
