import { describe, expect, it } from 'vitest';
import { BUS_STOP_EDGE, busLoopEdgeIds, buildLaneGraph, oppositeArm, type Arm } from './graph';

describe('lane graph', () => {
  const graph = buildLaneGraph();

  it('builds nodes and edges', () => {
    expect(graph.nodes.size).toBeGreaterThan(0);
    expect(graph.edges.size).toBeGreaterThan(100);
    expect(graph.intersections.length).toBe(16);
  });

  it('has consistent edge references', () => {
    for (const edge of graph.edges.values()) {
      expect(graph.nodes.has(edge.from)).toBe(true);
      expect(graph.nodes.has(edge.to)).toBe(true);
      expect(edge.points.length).toBeGreaterThanOrEqual(2);
      expect(edge.length).toBeGreaterThan(0);
    }
  });

  it('never leaves a vehicle without a continuation', () => {
    for (const edge of graph.edges.values()) {
      const node = graph.nodes.get(edge.to)!;
      expect(node.out.length).toBeGreaterThan(0);
    }
  });

  it('every edge is reachable from any edge (strongly connected)', () => {
    const start = graph.edges.get('r:EW:1:1:2:W');
    expect(start).toBeDefined();
    const seen = new Set<string>();
    const queue = [start!.from];
    const seenNodes = new Set<string>();
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (seenNodes.has(nodeId)) continue;
      seenNodes.add(nodeId);
      for (const edgeId of graph.nodes.get(nodeId)!.out) {
        seen.add(edgeId);
        queue.push(graph.edges.get(edgeId)!.to);
      }
    }
    for (const id of graph.edges.keys()) {
      expect(seen.has(id)).toBe(true);
    }
  });

  it('classifies turn maneuvers from headings', () => {
    const southboundLeft = graph.edges.get('t:1:1:N:E');
    expect(southboundLeft?.maneuver).toBe('left');
    expect(southboundLeft?.needsYield).toBe(true);
    const southboundRight = graph.edges.get('t:1:1:N:W');
    expect(southboundRight?.maneuver).toBe('right');
    const northboundStraight = graph.edges.get('t:1:1:S:N');
    expect(northboundStraight?.maneuver).toBe('straight');
    expect(oppositeArm('N')).toBe('S');
    expect(oppositeArm('E')).toBe('W');
  });

  it('excludes U-turns at intersections', () => {
    for (const edge of graph.edges.values()) {
      if (edge.kind !== 'turn') continue;
      const from = edge.from.split(':')[3] as Arm;
      const to = edge.to.split(':')[3] as Arm;
      expect(from).not.toBe(to);
    }
  });

  it('turn geometry connects the correct nodes', () => {
    for (const edge of graph.edges.values()) {
      const from = graph.nodes.get(edge.from)!;
      const to = graph.nodes.get(edge.to)!;
      const first = edge.points[0]!;
      const last = edge.points[edge.points.length - 1]!;
      expect(Math.hypot(first.x - from.pos.x, first.z - from.pos.z)).toBeLessThan(1e-6);
      expect(Math.hypot(last.x - to.pos.x, last.z - to.pos.z)).toBeLessThan(1e-6);
    }
  });

  it('bus loop is a valid closed route with a usable stop', () => {
    const route = busLoopEdgeIds();
    expect(route.length).toBeGreaterThanOrEqual(8);
    for (let i = 0; i < route.length; i++) {
      const edge = graph.edges.get(route[i]!);
      expect(edge).toBeDefined();
      const next = graph.edges.get(route[(i + 1) % route.length]!)!;
      expect(edge!.to).toBe(next.from);
    }
    expect(route).toContain(BUS_STOP_EDGE);
    const stopEdge = graph.edges.get(BUS_STOP_EDGE)!;
    expect(stopEdge.kind).toBe('road');
    const shelterX = 2;
    const stopS = shelterX - stopEdge.points[0]!.x;
    expect(stopS).toBeGreaterThan(4.5);
    expect(stopS).toBeLessThanOrEqual(stopEdge.length - 4.3);
  });
});
