import { describe, expect, it } from 'vitest';
import { buildLaneGraph, oppositeArm } from './graph';
import { GRID_N, LANE_OFFSET, roadCenter } from '../city/grid';

describe('UK left-hand traffic', () => {
  const graph = buildLaneGraph();

  it('northbound lane is on the east side of the road', () => {
    for (let i = 0; i <= GRID_N; i++) {
      for (let j = 0; j < GRID_N; j++) {
        const xc = roadCenter(i);
        const southNode = graph.nodes.get(`in:${i}:${j}:S`)!;
        expect(southNode.pos.x).toBeCloseTo(xc + LANE_OFFSET, 5);
      }
    }
  });

  it('southbound lane is on the west side of the road', () => {
    for (let i = 0; i <= GRID_N; i++) {
      for (let j = 0; j < GRID_N; j++) {
        const xc = roadCenter(i);
        const northNode = graph.nodes.get(`in:${i}:${j}:N`)!;
        expect(northNode.pos.x).toBeCloseTo(xc - LANE_OFFSET, 5);
      }
    }
  });

  it('eastbound lane is on the north side of the road', () => {
    for (let i = 0; i < GRID_N; i++) {
      for (let j = 0; j <= GRID_N; j++) {
        const zc = roadCenter(j);
        const westNode = graph.nodes.get(`in:${i}:${j}:W`)!;
        expect(westNode.pos.z).toBeCloseTo(zc - LANE_OFFSET, 5);
      }
    }
  });

  it('westbound lane is on the south side of the road', () => {
    for (let i = 0; i < GRID_N; i++) {
      for (let j = 0; j <= GRID_N; j++) {
        const zc = roadCenter(j);
        const eastNode = graph.nodes.get(`in:${i}:${j}:E`)!;
        expect(eastNode.pos.z).toBeCloseTo(zc + LANE_OFFSET, 5);
      }
    }
  });

  it('right turns yield to opposing traffic', () => {
    for (const edge of graph.edges.values()) {
      if (edge.kind !== 'turn') continue;
      if (edge.maneuver === 'right') {
        expect(edge.needsYield).toBe(true);
      }
    }
  });

  it('left turns do not yield to opposing traffic', () => {
    for (const edge of graph.edges.values()) {
      if (edge.kind !== 'turn') continue;
      if (edge.maneuver === 'left') {
        expect(edge.needsYield).toBe(false);
      }
    }
  });

  it('left turn geometry stays on the near side', () => {
    const edge = graph.edges.get('t:2:2:N:E')!;
    expect(edge.maneuver).toBe('left');
    const [, j] = edge.intersectionId!.split(':').map(Number);
    const zc = roadCenter(j);
    const nearSide = zc - LANE_OFFSET;
    for (const point of edge.points) {
      expect(point.z).toBeLessThanOrEqual(nearSide + 0.1);
    }
  });

  it('right turn geometry sweeps to the far side', () => {
    const edge = graph.edges.get('t:2:2:N:W')!;
    expect(edge.maneuver).toBe('right');
    const inNode = graph.nodes.get(edge.from)!;
    const outNode = graph.nodes.get(edge.to)!;
    const farZ = Math.max(inNode.pos.z, outNode.pos.z);
    const mid = edge.points[Math.floor(edge.points.length / 2)]!;
    expect(mid.z).toBeGreaterThanOrEqual(farZ - 3.5);
  });

  it('turn connectors stay within carriageway space', () => {
    for (const edge of graph.edges.values()) {
      if (edge.kind !== 'turn') continue;
      for (const point of edge.points) {
        const [i, j] = edge.intersectionId!.split(':').map(Number);
        const xc = roadCenter(i);
        const zc = roadCenter(j);
        const halfRoad = 6.5 + 1.75 + 0.5;
        expect(Math.abs(point.x - xc)).toBeLessThanOrEqual(halfRoad + 0.1);
        expect(Math.abs(point.z - zc)).toBeLessThanOrEqual(halfRoad + 0.1);
      }
    }
  });

  it('straight traffic stays in the correct lane through the junction', () => {
    const edge = graph.edges.get('t:2:2:S:N')!;
    expect(edge.maneuver).toBe('straight');
    const inNode = graph.nodes.get(edge.from)!;
    const outNode = graph.nodes.get(edge.to)!;
    expect(inNode.pos.x).toBeCloseTo(outNode.pos.x, 5);
  });

  it('opposite arm mapping is correct', () => {
    expect(oppositeArm('N')).toBe('S');
    expect(oppositeArm('S')).toBe('N');
    expect(oppositeArm('E')).toBe('W');
    expect(oppositeArm('W')).toBe('E');
  });
});
