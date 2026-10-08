import { describe, expect, it } from 'vitest';
import { buildLaneGraph, oppositeArm, type Arm } from './graph';
import { GRID_N, INTERSECTION_NODE_DIST, LANE_OFFSET, roadCenter } from '../city/grid';

const D = INTERSECTION_NODE_DIST;

const ARRIVE_HEADING: Record<Arm, { x: number; z: number }> = {
  N: { x: 0, z: 1 },
  S: { x: 0, z: -1 },
  E: { x: -1, z: 0 },
  W: { x: 1, z: 0 },
};

function leftOf(h: { x: number; z: number }): { x: number; z: number } {
  return { x: h.z, z: -h.x };
}

function expectedInbound(xc: number, zc: number, arm: Arm): { x: number; z: number } {
  const h = ARRIVE_HEADING[arm];
  const l = leftOf(h);
  return { x: xc - h.x * D + l.x * LANE_OFFSET, z: zc - h.z * D + l.z * LANE_OFFSET };
}

function expectedOutbound(xc: number, zc: number, arm: Arm): { x: number; z: number } {
  const h = ARRIVE_HEADING[arm];
  const l = leftOf(h);
  return { x: xc - h.x * D - l.x * LANE_OFFSET, z: zc - h.z * D - l.z * LANE_OFFSET };
}

describe('UK left-hand traffic', () => {
  const graph = buildLaneGraph();

  it('inbound nodes sit on the left of the direction of travel', () => {
    for (let i = 0; i <= GRID_N; i++) {
      for (let j = 0; j <= GRID_N; j++) {
        const xc = roadCenter(i);
        const zc = roadCenter(j);
        for (const arm of ['N', 'S', 'E', 'W'] as const) {
          const node = graph.nodes.get(`in:${i}:${j}:${arm}`)!;
          const expected = expectedInbound(xc, zc, arm);
          expect(node.pos.x).toBeCloseTo(expected.x, 5);
          expect(node.pos.z).toBeCloseTo(expected.z, 5);
        }
      }
    }
  });

  it('outbound nodes sit on the left of the direction of travel', () => {
    for (let i = 0; i <= GRID_N; i++) {
      for (let j = 0; j <= GRID_N; j++) {
        const xc = roadCenter(i);
        const zc = roadCenter(j);
        for (const arm of ['N', 'S', 'E', 'W'] as const) {
          const node = graph.nodes.get(`out:${i}:${j}:${arm}`)!;
          const expected = expectedOutbound(xc, zc, arm);
          expect(node.pos.x).toBeCloseTo(expected.x, 5);
          expect(node.pos.z).toBeCloseTo(expected.z, 5);
        }
      }
    }
  });

  it('southbound traffic uses the east side of a north/south road', () => {
    for (let i = 0; i <= GRID_N; i++) {
      for (let j = 0; j <= GRID_N; j++) {
        const xc = roadCenter(i);
        const southboundIn = graph.nodes.get(`in:${i}:${j}:N`)!;
        const southboundOut = graph.nodes.get(`out:${i}:${j}:S`)!;
        expect(southboundIn.pos.x).toBeCloseTo(xc + LANE_OFFSET, 5);
        expect(southboundOut.pos.x).toBeCloseTo(xc + LANE_OFFSET, 5);
      }
    }
  });

  it('northbound traffic uses the west side of a north/south road', () => {
    for (let i = 0; i <= GRID_N; i++) {
      for (let j = 0; j <= GRID_N; j++) {
        const xc = roadCenter(i);
        const northboundIn = graph.nodes.get(`in:${i}:${j}:S`)!;
        const northboundOut = graph.nodes.get(`out:${i}:${j}:N`)!;
        expect(northboundIn.pos.x).toBeCloseTo(xc - LANE_OFFSET, 5);
        expect(northboundOut.pos.x).toBeCloseTo(xc - LANE_OFFSET, 5);
      }
    }
  });

  it('eastbound traffic uses the north side of an east/west road', () => {
    for (let i = 0; i <= GRID_N; i++) {
      for (let j = 0; j <= GRID_N; j++) {
        const zc = roadCenter(j);
        const eastboundIn = graph.nodes.get(`in:${i}:${j}:W`)!;
        const eastboundOut = graph.nodes.get(`out:${i}:${j}:E`)!;
        expect(eastboundIn.pos.z).toBeCloseTo(zc - LANE_OFFSET, 5);
        expect(eastboundOut.pos.z).toBeCloseTo(zc - LANE_OFFSET, 5);
      }
    }
  });

  it('westbound traffic uses the south side of an east/west road', () => {
    for (let i = 0; i <= GRID_N; i++) {
      for (let j = 0; j <= GRID_N; j++) {
        const zc = roadCenter(j);
        const westboundIn = graph.nodes.get(`in:${i}:${j}:E`)!;
        const westboundOut = graph.nodes.get(`out:${i}:${j}:W`)!;
        expect(westboundIn.pos.z).toBeCloseTo(zc + LANE_OFFSET, 5);
        expect(westboundOut.pos.z).toBeCloseTo(zc + LANE_OFFSET, 5);
      }
    }
  });

  it('road edges connect matching left-side lanes', () => {
    for (const edge of graph.edges.values()) {
      if (edge.kind !== 'road') continue;
      const from = graph.nodes.get(edge.from)!;
      const to = graph.nodes.get(edge.to)!;
      if (edge.axis === 'NS') {
        expect(from.pos.x).toBeCloseTo(to.pos.x, 5);
      } else {
        expect(from.pos.z).toBeCloseTo(to.pos.z, 5);
      }
    }
  });

  it('every turn connector joins the correct left-side lanes', () => {
    for (const edge of graph.edges.values()) {
      if (edge.kind !== 'turn') continue;
      const [i, j, inArm, outArm] = edge.id.replace('t:', '').split(':');
      const xc = roadCenter(Number(i));
      const zc = roadCenter(Number(j));
      const from = graph.nodes.get(edge.from)!;
      const to = graph.nodes.get(edge.to)!;
      const expectedFrom = expectedInbound(xc, zc, inArm as Arm);
      const expectedTo = expectedOutbound(xc, zc, outArm as Arm);
      expect(from.pos.x).toBeCloseTo(expectedFrom.x, 5);
      expect(from.pos.z).toBeCloseTo(expectedFrom.z, 5);
      expect(to.pos.x).toBeCloseTo(expectedTo.x, 5);
      expect(to.pos.z).toBeCloseTo(expectedTo.z, 5);
    }
  });

  it('classifies maneuvers from travel headings', () => {
    for (const edge of graph.edges.values()) {
      if (edge.kind !== 'turn') continue;
      const [, , inArm, outArm] = edge.id.replace('t:', '').split(':');
      const inH = ARRIVE_HEADING[inArm as Arm];
      const outH = ARRIVE_HEADING[outArm as Arm];
      const outDir = { x: -outH.x, z: -outH.z };
      const cross = inH.x * outDir.z - inH.z * outDir.x;
      const expected: 'straight' | 'left' | 'right' =
        outArm === oppositeArm(inArm as Arm) ? 'straight' : cross < 0 ? 'left' : 'right';
      expect(edge.maneuver).toBe(expected);
      expect(edge.needsYield).toBe(expected === 'right');
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

  it('bus loop edges each use the correct left-side lane', () => {
    const loop = ['r:EW:2:2:3:E', 't:3:2:W:S', 'r:NS:3:2:3:S', 't:3:3:N:W', 'r:EW:3:2:3:W', 't:2:3:E:N', 'r:NS:2:2:3:N', 't:2:2:S:E'];
    for (const id of loop) {
      const edge = graph.edges.get(id)!;
      expect(edge).toBeDefined();
      const from = graph.nodes.get(edge.from)!;
      const to = graph.nodes.get(edge.to)!;
      const parts = edge.id.split(':');
      if (edge.id.startsWith('r:EW')) {
        const zc = roadCenter(Number(parts[2]));
        const eastbound = edge.id.endsWith(':E');
        const side = eastbound ? zc - LANE_OFFSET : zc + LANE_OFFSET;
        expect(from.pos.z).toBeCloseTo(side, 5);
        expect(to.pos.z).toBeCloseTo(side, 5);
      } else if (edge.id.startsWith('r:NS')) {
        const xc = roadCenter(Number(parts[2]));
        const southbound = edge.id.endsWith(':S');
        const side = southbound ? xc + LANE_OFFSET : xc - LANE_OFFSET;
        expect(from.pos.x).toBeCloseTo(side, 5);
        expect(to.pos.x).toBeCloseTo(side, 5);
      }
    }
  });

  it('opposite arm mapping is correct', () => {
    expect(oppositeArm('N')).toBe('S');
    expect(oppositeArm('S')).toBe('N');
    expect(oppositeArm('E')).toBe('W');
    expect(oppositeArm('W')).toBe('E');
  });
});
