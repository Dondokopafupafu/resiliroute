import type { EdgeId, Network, NetworkEdge, NodeId, PathResult } from "@/types/network";

export interface RoutingGraph {
  nodeIds: Set<NodeId>;
  adjacency: Map<NodeId, { neighbor: NodeId; edge: NetworkEdge }[]>;
  order: Map<NodeId, number>;
}
export type WeightFunction = (edge: NetworkEdge) => number;

export function buildGraph(network: Network, closedEdgeIds: readonly EdgeId[] = []): RoutingGraph {
  const closed = new Set(closedEdgeIds);
  const nodeIds = new Set(network.nodes.map((n) => n.id));
  const adjacency: RoutingGraph["adjacency"] = new Map([...nodeIds].map((id) => [id, []]));
  for (const edge of network.edges) {
    if (
      !edge.available ||
      closed.has(edge.id) ||
      !nodeIds.has(edge.source) ||
      !nodeIds.has(edge.target)
    )
      continue;
    adjacency.get(edge.source)!.push({ neighbor: edge.target, edge });
    if (edge.bidirectional) adjacency.get(edge.target)!.push({ neighbor: edge.source, edge });
  }
  return { nodeIds, adjacency, order: new Map([...nodeIds].map((id, i) => [id, i])) };
}

// Binary-heap Dijkstra, O((V + E) log V). Ties follow original node insertion
// order, preserving Harbor City's deterministic routes on larger real graphs.
// A compiled graph can be reused across OD assignments and service calculations.
export function shortestPath(
  graph: RoutingGraph,
  start: NodeId,
  goal: NodeId,
  weightFunction: WeightFunction = (edge) => edge.freeFlowTime,
): PathResult {
  return shortestPathsFrom(graph, start, [goal], weightFunction)[goal];
}

/** One Dijkstra search per origin can serve multiple OD destinations. */
export function shortestPathsFrom(
  graph: RoutingGraph,
  start: NodeId,
  goals: readonly NodeId[],
  weightFunction: WeightFunction = (edge) => edge.freeFlowTime,
): Record<NodeId, PathResult> {
  const unreachable: PathResult = {
    reachable: false,
    nodeIds: [],
    edgeIds: [],
    travelTime: Infinity,
    distance: 0,
  };
  if (!graph.nodeIds.has(start))
    return Object.fromEntries(goals.map((goal) => [goal, unreachable]));
  const targets = new Set(goals.filter((id) => graph.nodeIds.has(id)));
  const settled = new Set<NodeId>();
  const order = graph.order;
  type Entry = { id: NodeId; cost: number };
  const heap: Entry[] = [];
  const less = (a: Entry, b: Entry) =>
    a.cost < b.cost || (a.cost === b.cost && order.get(a.id)! < order.get(b.id)!);
  const push = (entry: Entry) => {
    heap.push(entry);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (!less(heap[i], heap[parent])) break;
      [heap[i], heap[parent]] = [heap[parent], heap[i]];
      i = parent;
    }
  };
  const pop = () => {
    const first = heap[0],
      last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      while (true) {
        let next = i;
        const left = i * 2 + 1,
          right = left + 1;
        if (left < heap.length && less(heap[left], heap[next])) next = left;
        if (right < heap.length && less(heap[right], heap[next])) next = right;
        if (next === i) break;
        [heap[i], heap[next]] = [heap[next], heap[i]];
        i = next;
      }
    }
    return first;
  };
  push({ id: start, cost: 0 });
  const distance = new Map<NodeId, number>([[start, 0]]);
  const previous = new Map<NodeId, { node: NodeId; edge: NetworkEdge }>();
  while (heap.length) {
    const { id: current, cost: best } = pop();
    if (settled.has(current) || best !== distance.get(current)) continue;
    settled.add(current);
    targets.delete(current);
    if (!targets.size) break;
    for (const { neighbor, edge } of graph.adjacency.get(current) ?? []) {
      if (settled.has(neighbor)) continue;
      const weight = weightFunction(edge);
      if (weight < 0) throw new Error("Dijkstra requires nonnegative travel costs.");
      if (!Number.isFinite(weight)) continue;
      const nextDistance = best + weight;
      if (nextDistance < (distance.get(neighbor) ?? Infinity)) {
        distance.set(neighbor, nextDistance);
        previous.set(neighbor, { node: current, edge });
        push({ id: neighbor, cost: nextDistance });
      }
    }
  }
  return Object.fromEntries(
    goals.map((goal) => {
      if (goal === start)
        return [
          goal,
          { reachable: true, nodeIds: [start], edgeIds: [], travelTime: 0, distance: 0 },
        ];
      if (!previous.has(goal)) return [goal, unreachable];
      const nodeIds = [goal],
        edgeIds: EdgeId[] = [];
      let totalDistance = 0,
        cursor = goal;
      while (cursor !== start) {
        const step = previous.get(cursor)!;
        nodeIds.unshift(step.node);
        edgeIds.unshift(step.edge.id);
        totalDistance += step.edge.distance;
        cursor = step.node;
      }
      return [
        goal,
        {
          reachable: true,
          nodeIds,
          edgeIds,
          travelTime: distance.get(goal)!,
          distance: totalDistance,
        },
      ];
    }),
  );
}
