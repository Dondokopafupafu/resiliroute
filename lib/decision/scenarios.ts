import { modelConfig } from "@/data/harbor-city";
import { validateBoundingBox } from "@/lib/osm/geo";
import type { Network, ODPair } from "@/types/network";
import type { BoundingBox } from "@/types/real-city";
import { decisionConfig } from "./config";
import { decisionClosureLinks } from "./closure-links";

export const scenarioLimits = {
  maxBytes: 131072,
  maxSaved: decisionConfig.maxComparedScenarios,
  maxNameLength: 80,
  maxClosedLinks: decisionConfig.maxClosedLinks,
} as const;
export const decisionModelVersion = decisionConfig.modelVersion;
export interface SavedScenario {
  schemaVersion: 1;
  modelVersion: typeof decisionModelVersion;
  networkIdentifier: string;
  name: string;
  closedEdgeIds: string[];
  bbox?: BoundingBox;
  createdAt: string;
  modelConfig: typeof modelConfig;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

/** Synchronous SHA-256 keeps network identity available in browser workers and UI alike. */
function sha256(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const length = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(length);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(length - 8, Math.floor(bytes.length / 0x20000000));
  view.setUint32(length - 4, (bytes.length * 8) >>> 0);
  const initial = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const rotate = (number: number, count: number) => (number >>> count) | (number << (32 - count));
  const words = new Uint32Array(64);
  for (let offset = 0; offset < length; offset += 64) {
    for (let i = 0; i < 16; i++) words[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = words[i - 15],
        y = words[i - 2];
      words[i] =
        words[i - 16] +
        (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) +
        words[i - 7] +
        (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10));
    }
    let [a, b, c, d, e, f, g, h] = initial;
    for (let i = 0; i < 64; i++) {
      const one =
        (h +
          (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) +
          ((e & f) ^ (~e & g)) +
          constants[i] +
          words[i]) |
        0;
      const two =
        ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + one) | 0;
      d = c;
      c = b;
      b = a;
      a = (one + two) | 0;
    }
    for (const [i, value] of [a, b, c, d, e, f, g, h].entries())
      initial[i] = (initial[i] + value) | 0;
  }
  return initial.map((value) => (value >>> 0).toString(16).padStart(8, "0")).join("");
}

export function networkIdentifier(network: Network, odPairs: readonly ODPair[] = []): string {
  const sort = <T extends { id: string }>(items: readonly T[]) =>
    [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return `sha256:${sha256(canonical({ modelVersion: decisionModelVersion, modelConfig, network: { ...network, nodes: sort(network.nodes), edges: sort(network.edges), accessibilityCategories: network.accessibilityCategories ? [...network.accessibilityCategories].sort() : undefined }, odPairs: sort(odPairs) }))}`;
}

export function createSavedScenario(
  network: Network,
  odPairs: readonly ODPair[],
  input: { name: string; closedEdgeIds: readonly string[]; bbox?: BoundingBox; createdAt?: string },
): SavedScenario {
  return validateScenario(
    {
      schemaVersion: 1,
      modelVersion: decisionModelVersion,
      networkIdentifier: networkIdentifier(network, odPairs),
      modelConfig,
      ...input,
      name: input.name.trim(),
      closedEdgeIds: [...new Set(input.closedEdgeIds)].sort(),
      createdAt: input.createdAt ?? new Date().toISOString(),
    },
    network,
    odPairs,
  );
}

function validateScenario(
  input: unknown,
  network: Network,
  odPairs: readonly ODPair[],
): SavedScenario {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("INVALID_SCENARIO");
  const item = input as Partial<SavedScenario>;
  if (item.schemaVersion !== 1 || item.modelVersion !== decisionModelVersion)
    throw new Error("SCENARIO_VERSION_MISMATCH");
  if (
    item.networkIdentifier !== networkIdentifier(network, odPairs) ||
    canonical(item.modelConfig) !== canonical(modelConfig)
  )
    throw new Error("SCENARIO_NETWORK_MISMATCH");
  if (
    typeof item.name !== "string" ||
    !item.name.trim() ||
    item.name.length > scenarioLimits.maxNameLength ||
    /[\u0000-\u001f]/.test(item.name) ||
    typeof item.createdAt !== "string" ||
    item.createdAt.length > 40 ||
    !Number.isFinite(Date.parse(item.createdAt))
  )
    throw new Error("INVALID_SCENARIO");
  const ids = new Set(decisionClosureLinks(network).map((edge) => edge.id));
  if (
    !Array.isArray(item.closedEdgeIds) ||
    item.closedEdgeIds.length > scenarioLimits.maxClosedLinks ||
    item.closedEdgeIds.some((id) => typeof id !== "string" || !ids.has(id)) ||
    new Set(item.closedEdgeIds).size !== item.closedEdgeIds.length
  )
    throw new Error("INVALID_SCENARIO_LINKS");
  let bbox: BoundingBox | undefined;
  if (item.bbox !== undefined) {
    try {
      bbox = validateBoundingBox(item.bbox);
    } catch {
      throw new Error("INVALID_SCENARIO");
    }
    const bounds = bbox;
    if (
      network.nodes.some(
        (node) =>
          node.latitude < bounds.south - 1e-6 ||
          node.latitude > bounds.north + 1e-6 ||
          node.longitude < bounds.west - 1e-6 ||
          node.longitude > bounds.east + 1e-6,
      )
    )
      throw new Error("SCENARIO_NETWORK_MISMATCH");
  }
  // Return an allowlisted data object; supplied metrics/URLs/prototype fields are discarded.
  return {
    schemaVersion: 1,
    modelVersion: decisionModelVersion,
    networkIdentifier: item.networkIdentifier,
    name: item.name.trim(),
    createdAt: item.createdAt,
    closedEdgeIds: [...item.closedEdgeIds].sort(),
    modelConfig,
    ...(bbox ? { bbox } : {}),
  };
}

export function parseSavedScenario(
  text: string,
  network: Network,
  odPairs: readonly ODPair[],
): SavedScenario {
  if (new TextEncoder().encode(text).byteLength > scenarioLimits.maxBytes)
    throw new Error("SCENARIO_TOO_LARGE");
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error("INVALID_SCENARIO");
  }
  return validateScenario(input, network, odPairs);
}

export interface ScenarioStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
const storageKey = (network: Network, odPairs: readonly ODPair[]) =>
  `resiliroute.scenarios.v1.${networkIdentifier(network, odPairs)}`;
export function loadSavedScenarios(
  storage: ScenarioStorage,
  network: Network,
  odPairs: readonly ODPair[],
): SavedScenario[] {
  try {
    const raw = storage.getItem(storageKey(network, odPairs));
    if (
      !raw ||
      new TextEncoder().encode(raw).byteLength > scenarioLimits.maxBytes * scenarioLimits.maxSaved
    )
      return [];
    const items: unknown = JSON.parse(raw);
    if (!Array.isArray(items) || items.length > scenarioLimits.maxSaved) return [];
    return items.map((item) => validateScenario(item, network, odPairs));
  } catch {
    return [];
  }
}
export function persistSavedScenarios(
  storage: ScenarioStorage,
  network: Network,
  odPairs: readonly ODPair[],
  scenarios: readonly SavedScenario[],
): boolean {
  try {
    if (scenarios.length > scenarioLimits.maxSaved) return false;
    const validated = scenarios.map((item) => validateScenario(item, network, odPairs));
    storage.setItem(storageKey(network, odPairs), JSON.stringify(validated));
    return true;
  } catch {
    return false;
  }
}
