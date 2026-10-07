import { describe, expect, it } from 'vitest';
import { BLOCK, GRID_N, RING_HALF, blockCenter } from '../city/grid';
import { CROSS_SPEED, canStartCrossing, buildWalkGraph } from './paths';

describe('walk graph', () => {
  const graph = buildWalkGraph();

  it('builds a node per corner and side point', () => {
    expect(graph.nodes.size).toBe(GRID_N * GRID_N * (4 + 12));
    expect(graph.edges.size).toBeGreaterThan(graph.nodes.size);
  });

  it('has consistent edge references', () => {
    for (const edge of graph.edges.values()) {
      expect(graph.nodes.has(edge.a)).toBe(true);
      expect(graph.nodes.has(edge.b)).toBe(true);
      expect(edge.points.length).toBeGreaterThanOrEqual(2);
      expect(edge.length).toBeGreaterThan(0);
    }
  });

  it('is fully connected', () => {
    const first = [...graph.nodes.keys()][0]!;
    const seen = new Set<string>([first]);
    const queue = [first];
    while (queue.length > 0) {
      const id = queue.shift()!;
      for (const edgeId of graph.nodes.get(id)!.edges) {
        const edge = graph.edges.get(edgeId)!;
        const other = edge.a === id ? edge.b : edge.a;
        if (!seen.has(other)) {
          seen.add(other);
          queue.push(other);
        }
      }
    }
    expect(seen.size).toBe(graph.nodes.size);
  });

  it('crossings span a road between corner nodes', () => {
    const crossing = graph.edges.get('x:1:1:N')!;
    expect(crossing.crossing).toBeDefined();
    expect(crossing.crossing!.axis).toBe('NS');
    expect(crossing.length).toBeCloseTo(13.2, 5);
    expect(crossing.points[0]!.z).toBeCloseTo(crossing.points[1]!.z, 5);
    expect(crossing.a).toMatch(/:(nw|ne|sw|se)$/);
    expect(crossing.b).toMatch(/:(nw|ne|sw|se)$/);
    const a = graph.nodes.get(crossing.a)!;
    const b = graph.nodes.get(crossing.b)!;
    expect(Math.abs(a.pos.x - b.pos.x)).toBeCloseTo(13.2, 5);
  });

  it('crossing endpoints sit on block corners', () => {
    for (const edge of graph.edges.values()) {
      if (!edge.crossing) continue;
      for (const nodeId of [edge.a, edge.b]) {
        const node = graph.nodes.get(nodeId)!;
        const bi = Math.round((node.pos.x + 40) / 40);
        const bj = Math.round((node.pos.z + 40) / 40);
        const dx = Math.abs(Math.abs(node.pos.x - blockCenter(bi)) - RING_HALF);
        const dz = Math.abs(Math.abs(node.pos.z - blockCenter(bj)) - RING_HALF);
        expect(dx).toBeLessThan(1e-6);
        expect(dz).toBeLessThan(1e-6);
      }
    }
  });

  it('ring edges stay within block bounds', () => {
    for (const edge of graph.edges.values()) {
      if (edge.crossing) continue;
      for (const point of edge.points) {
        const localX = Math.abs(point.x - 40 * Math.round(point.x / 40));
        const localZ = Math.abs(point.z - 40 * Math.round(point.z / 40));
        expect(localX).toBeLessThanOrEqual(BLOCK / 2);
        expect(localZ).toBeLessThanOrEqual(BLOCK / 2);
      }
    }
  });

  it('includes crossings only at intersections with all four blocks', () => {
    expect(graph.edges.has('x:1:1:N')).toBe(true);
    expect(graph.edges.has('x:1:1:S')).toBe(true);
    expect(graph.edges.has('x:1:1:E')).toBe(true);
    expect(graph.edges.has('x:1:1:W')).toBe(true);
    expect(graph.edges.has('x:0:0:N')).toBe(false);
    expect(graph.edges.has('x:0:0:W')).toBe(false);
    expect(graph.edges.has('x:0:1:E')).toBe(true);
    expect(graph.edges.has('x:1:0:S')).toBe(true);
  });
});

describe('canStartCrossing', () => {
  const crossing = {
    axis: 'NS' as const,
    intersectionId: '1:1',
    center: { x: -20, z: -26.5 },
    duration: 13.2 / CROSS_SPEED,
  };

  it('refuses while the crossed road has green or yellow', () => {
    expect(canStartCrossing(crossing, 'green', 20, 50)).toBe(false);
    expect(canStartCrossing(crossing, 'yellow', 20, 50)).toBe(false);
  });

  it('refuses when the green window is too short to finish', () => {
    expect(canStartCrossing(crossing, 'red', 5, 50)).toBe(false);
  });

  it('refuses when a vehicle is close', () => {
    expect(canStartCrossing(crossing, 'red', 20, 4)).toBe(false);
  });

  it('allows a safe crossing', () => {
    expect(canStartCrossing(crossing, 'red', 13, 20)).toBe(true);
  });
});
