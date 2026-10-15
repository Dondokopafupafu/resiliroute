import type { EdgeId, Scenario, ScenarioId } from "@/types/network";

export const scenarios: Record<ScenarioId, Scenario> = {
  normal: {
    id: "normal",
    name: "Normal conditions",
    description: "All links available. Your reference city.",
    closedEdgeIds: [],
  },
  earthquake: {
    id: "earthquake",
    name: "Earthquake",
    description:
      "A bridge failure and a rail outage force cross-river demand onto the remaining crossings.",
    closedEdgeIds: ["harbor-bridge", "east-rail", "coastal-road"],
  },
  flood: {
    id: "flood",
    name: "Flood",
    description: "River and coastal flooding remove four low-lying connections.",
    closedEdgeIds: [
      "riverside-crossing",
      "southern-crossing",
      "quayside-road",
      "harbor-shelter-road",
    ],
  },
  rail: {
    id: "rail",
    name: "Rail disruption",
    description:
      "Three rail connections stop; their synthetic demand shifts onto roads and bus corridors.",
    closedEdgeIds: ["north-rail", "east-rail", "harbor-rail"],
  },
  custom: {
    id: "custom",
    name: "Custom scenario",
    description:
      "Select a link on the map, then close or reopen it. Every change recalculates the model.",
    closedEdgeIds: [],
  },
};

export function toggleClosure(ids: EdgeId[], edgeId: EdgeId): EdgeId[] {
  return ids.includes(edgeId) ? ids.filter((id) => id !== edgeId) : [...ids, edgeId];
}
