import { describe, expect, it } from 'vitest';
import { blockCenter } from '../city/grid';
import { buildLaneGraph } from './graph';
import { findRoute, nearestNodeId, routeContainsClosed } from './routing';

const graph = buildLaneGraph();

describe('routing', () => {
  it('produces a contiguous route to a destination anchor', () => {
    const dest = nearestNodeId(graph, blockCenter(2), blockCenter(2));
    const route = findRoute(graph, 'r:EW:1:1:2:W', dest);
    expect(route).not.toBeNull();
    expect(route![0]).toBe('r:EW:1:1:2:W');
    for (let i = 1; i < route!.length; i++) {
      const prev = graph.edges.get(route![i - 1]!)!;
      const next = graph.edges.get(route![i]!)!;
      expect(next.from).toBe(prev.to);
    }
    const last = graph.edges.get(route![route!.length - 1]!)!;
    expect(last.to).toBe(dest);
  });

  it('returns a trivial route when already at the destination node', () => {
    const edge = graph.edges.get('r:EW:1:1:2:W')!;
    expect(findRoute(graph, edge.id, edge.to)).toEqual([edge.id]);
  });

  it('avoids closed edges and picks a different path', () => {
    const dest = 'out:1:1:N';
    const open = findRoute(graph, 'r:EW:1:1:2:W', dest);
    expect(open).not.toBeNull();
    expect(open!.length).toBeGreaterThan(1);
    const blocked = open![open!.length - 1]!;
    const closed = new Set([blocked]);
    const rerouted = findRoute(graph, 'r:EW:1:1:2:W', dest, closed);
    expect(rerouted).not.toBeNull();
    expect(rerouted!.some((id) => closed.has(id))).toBe(false);
    expect(rerouted!.join('>')).not.toBe(open!.join('>'));
  });

  it('returns null when the destination is unreachable', () => {
    const closed = new Set(['r:EW:0:0:1:W']);
    expect(findRoute(graph, 'r:EW:1:1:2:W', 'in:0:0:E', closed)).toBeNull();
  });

  it('scans only the remaining route for closures', () => {
    const route = ['a', 'b', 'c'];
    expect(routeContainsClosed(route, 1, new Set(['b']))).toBe(true);
    expect(routeContainsClosed(route, 2, new Set(['b']))).toBe(false);
    expect(routeContainsClosed(route, 0, new Set(['a']))).toBe(true);
  });

  it('finds the nearest node to a point', () => {
    const node = nearestNodeId(graph, 0, 0);
    const position = graph.nodes.get(node)!;
    const distance = Math.hypot(position.pos.x, position.pos.z);
    expect(distance).toBeLessThan(25);
  });
});
