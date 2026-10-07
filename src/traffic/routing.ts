import type { LaneEdge, LaneGraph } from './graph';

const REFERENCE_SPEED = 7.5;

export function edgeCost(edge: LaneEdge): number {
  const base = edge.length / REFERENCE_SPEED;
  if (edge.kind !== 'turn') return base;
  if (edge.maneuver === 'left') return base + 2.4;
  if (edge.maneuver === 'right') return base + 1.3;
  return base + 0.9;
}

export function nearestNodeId(graph: LaneGraph, x: number, z: number): string {
  let best = '';
  let bestDistance = Infinity;
  for (const node of graph.nodes.values()) {
    const dx = node.pos.x - x;
    const dz = node.pos.z - z;
    const distance = dx * dx + dz * dz;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = node.id;
    }
  }
  return best;
}

export function findRoute(
  graph: LaneGraph,
  fromEdgeId: string,
  destNodeId: string,
  closedEdgeIds?: ReadonlySet<string>,
): string[] | null {
  const start = graph.edges.get(fromEdgeId);
  if (!start) return null;
  if (closedEdgeIds?.has(fromEdgeId)) return null;
  const startNode = start.to;
  if (startNode === destNodeId) return [fromEdgeId];

  const distance = new Map<string, number>([[startNode, 0]]);
  const previousEdge = new Map<string, string>();
  const settled = new Set<string>();
  const queue: string[] = [startNode];

  while (queue.length > 0) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < queue.length; i++) {
      const d = distance.get(queue[i]!)!;
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    }
    const nodeId = queue.splice(bestIndex, 1)[0]!;
    if (settled.has(nodeId)) continue;
    settled.add(nodeId);
    if (nodeId === destNodeId) break;

    const node = graph.nodes.get(nodeId);
    if (!node) continue;
    for (const edgeId of node.out) {
      if (closedEdgeIds?.has(edgeId)) continue;
      const edge = graph.edges.get(edgeId)!;
      const candidate = bestDistance + edgeCost(edge);
      const current = distance.get(edge.to);
      if (current === undefined || candidate < current) {
        distance.set(edge.to, candidate);
        previousEdge.set(edge.to, edgeId);
        queue.push(edge.to);
      }
    }
  }

  if (!distance.has(destNodeId)) return null;

  const path: string[] = [];
  let nodeId = destNodeId;
  while (nodeId !== startNode) {
    const edgeId = previousEdge.get(nodeId);
    if (edgeId === undefined) return null;
    path.unshift(edgeId);
    nodeId = graph.edges.get(edgeId)!.from;
  }
  return [fromEdgeId, ...path];
}

export function routeContainsClosed(
  route: readonly string[],
  fromIndex: number,
  closedEdgeIds: ReadonlySet<string>,
): boolean {
  for (let i = fromIndex; i < route.length; i++) {
    if (closedEdgeIds.has(route[i]!)) return true;
  }
  return false;
}
