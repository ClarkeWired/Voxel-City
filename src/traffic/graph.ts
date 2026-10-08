import type { Axis, Pt } from '../core/geo';
import { polylineLength } from '../core/geo';
import { GRID_N, INTERSECTION_NODE_DIST, LANE_OFFSET, roadCenter } from '../city/grid';

export type Arm = 'N' | 'S' | 'E' | 'W';
export type Maneuver = 'straight' | 'left' | 'right';

export interface LaneNode {
  id: string;
  pos: Pt;
  out: string[];
  in: string[];
}

export interface LaneEdge {
  id: string;
  kind: 'road' | 'turn';
  axis: Axis;
  from: string;
  to: string;
  points: Pt[];
  length: number;
  maneuver?: Maneuver;
  needsYield?: boolean;
  intersectionId?: string;
}

export interface IntersectionInfo {
  id: string;
  ix: number;
  iz: number;
  x: number;
  z: number;
}

export interface LaneGraph {
  nodes: Map<string, LaneNode>;
  edges: Map<string, LaneEdge>;
  intersections: IntersectionInfo[];
}

export const ARMS: readonly Arm[] = ['N', 'S', 'E', 'W'];

export const ARRIVE_HEADING: Record<Arm, Pt> = {
  N: { x: 0, z: 1 },
  S: { x: 0, z: -1 },
  E: { x: -1, z: 0 },
  W: { x: 1, z: 0 },
};

export const D = INTERSECTION_NODE_DIST;

export function oppositeArm(arm: Arm): Arm {
  switch (arm) {
    case 'N':
      return 'S';
    case 'S':
      return 'N';
    case 'E':
      return 'W';
    case 'W':
      return 'E';
  }
}

export function axisOfArm(arm: Arm): Axis {
  return arm === 'N' || arm === 'S' ? 'NS' : 'EW';
}

export function leftVector(h: Pt): Pt {
  return { x: h.z, z: -h.x };
}

export function inboundPos(xc: number, zc: number, arm: Arm): Pt {
  const h = ARRIVE_HEADING[arm];
  const l = leftVector(h);
  return { x: xc - h.x * D + l.x * LANE_OFFSET, z: zc - h.z * D + l.z * LANE_OFFSET };
}

export function outboundPos(xc: number, zc: number, arm: Arm): Pt {
  const h = ARRIVE_HEADING[arm];
  const l = leftVector(h);
  return { x: xc - h.x * D - l.x * LANE_OFFSET, z: zc - h.z * D - l.z * LANE_OFFSET };
}

export function armConnects(i: number, j: number, arm: Arm): boolean {
  switch (arm) {
    case 'N':
      return j > 0;
    case 'S':
      return j < GRID_N;
    case 'E':
      return i < GRID_N;
    case 'W':
      return i > 0;
  }
}

function maneuverFor(inArm: Arm, outArm: Arm): Maneuver {
  if (outArm === oppositeArm(inArm)) return 'straight';
  const inH = ARRIVE_HEADING[inArm];
  const outH = ARRIVE_HEADING[outArm];
  const outDir = { x: -outH.x, z: -outH.z };
  const cross = inH.x * outDir.z - inH.z * outDir.x;
  return cross < 0 ? 'left' : 'right';
}

export function turnPoints(pIn: Pt, pOut: Pt, inArm: Arm, outArm: Arm): Pt[] {
  if (outArm === oppositeArm(inArm)) return [pIn, pOut];
  const inAxisIsNs = inArm === 'N' || inArm === 'S';
  const cx = inAxisIsNs ? pIn.x : pOut.x;
  const cz = inAxisIsNs ? pOut.z : pIn.z;
  const points: Pt[] = [];
  const steps = 8;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const mt = 1 - t;
    points.push({
      x: mt * mt * pIn.x + 2 * mt * t * cx + t * t * pOut.x,
      z: mt * mt * pIn.z + 2 * mt * t * cz + t * t * pOut.z,
    });
  }
  return points;
}

export function buildLaneGraph(): LaneGraph {
  const nodes = new Map<string, LaneNode>();
  const edges = new Map<string, LaneEdge>();
  const intersections: IntersectionInfo[] = [];

  const addNode = (id: string, pos: Pt): void => {
    nodes.set(id, { id, pos, out: [], in: [] });
  };
  const connect = (edge: LaneEdge): void => {
    edges.set(edge.id, edge);
    nodes.get(edge.from)!.out.push(edge.id);
    nodes.get(edge.to)!.in.push(edge.id);
  };

  for (let i = 0; i <= GRID_N; i++) {
    for (let j = 0; j <= GRID_N; j++) {
      const xc = roadCenter(i);
      const zc = roadCenter(j);
      const id = `${i}:${j}`;
      intersections.push({ id, ix: i, iz: j, x: xc, z: zc });
      for (const arm of ARMS) {
        addNode(`in:${i}:${j}:${arm}`, inboundPos(xc, zc, arm));
        addNode(`out:${i}:${j}:${arm}`, outboundPos(xc, zc, arm));
      }
    }
  }

  const segmentLength = roadCenter(1) - roadCenter(0) - 2 * D;

  for (let i = 0; i <= GRID_N; i++) {
    for (let j = 0; j < GRID_N; j++) {
      const south: LaneEdge = {
        id: `r:NS:${i}:${j}:${j + 1}:S`,
        kind: 'road',
        axis: 'NS',
        from: `out:${i}:${j}:S`,
        to: `in:${i}:${j + 1}:N`,
        points: [nodes.get(`out:${i}:${j}:S`)!.pos, nodes.get(`in:${i}:${j + 1}:N`)!.pos],
        length: segmentLength,
      };
      connect(south);
      const north: LaneEdge = {
        id: `r:NS:${i}:${j}:${j + 1}:N`,
        kind: 'road',
        axis: 'NS',
        from: `out:${i}:${j + 1}:N`,
        to: `in:${i}:${j}:S`,
        points: [nodes.get(`out:${i}:${j + 1}:N`)!.pos, nodes.get(`in:${i}:${j}:S`)!.pos],
        length: segmentLength,
      };
      connect(north);
    }
  }

  for (let i = 0; i < GRID_N; i++) {
    for (let j = 0; j <= GRID_N; j++) {
      const east: LaneEdge = {
        id: `r:EW:${j}:${i}:${i + 1}:E`,
        kind: 'road',
        axis: 'EW',
        from: `out:${i}:${j}:E`,
        to: `in:${i + 1}:${j}:W`,
        points: [nodes.get(`out:${i}:${j}:E`)!.pos, nodes.get(`in:${i + 1}:${j}:W`)!.pos],
        length: segmentLength,
      };
      connect(east);
      const west: LaneEdge = {
        id: `r:EW:${j}:${i}:${i + 1}:W`,
        kind: 'road',
        axis: 'EW',
        from: `out:${i + 1}:${j}:W`,
        to: `in:${i}:${j}:E`,
        points: [nodes.get(`out:${i + 1}:${j}:W`)!.pos, nodes.get(`in:${i}:${j}:E`)!.pos],
        length: segmentLength,
      };
      connect(west);
    }
  }

  for (let i = 0; i <= GRID_N; i++) {
    for (let j = 0; j <= GRID_N; j++) {
      const id = `${i}:${j}`;
      for (const inArm of ARMS) {
        if (!armConnects(i, j, inArm)) continue;
        const inNode = nodes.get(`in:${i}:${j}:${inArm}`)!;
        for (const outArm of ARMS) {
          if (outArm === inArm) continue;
          if (!armConnects(i, j, outArm)) continue;
          const outNode = nodes.get(`out:${i}:${j}:${outArm}`)!;
          const maneuver = maneuverFor(inArm, outArm);
          const points = turnPoints(inNode.pos, outNode.pos, inArm, outArm);
          connect({
            id: `t:${i}:${j}:${inArm}:${outArm}`,
            kind: 'turn',
            axis: axisOfArm(inArm),
            from: inNode.id,
            to: outNode.id,
            points,
            length: polylineLength(points),
            maneuver,
            needsYield: maneuver === 'right',
            intersectionId: id,
          });
        }
      }
    }
  }

  return { nodes, edges, intersections };
}

export const BUS_STOP_EDGE = 'r:EW:2:2:3:E';

export function busLoopEdgeIds(): string[] {
  return [
    'r:EW:2:2:3:E',
    't:3:2:W:S',
    'r:NS:3:2:3:S',
    't:3:3:N:W',
    'r:EW:3:2:3:W',
    't:2:3:E:N',
    'r:NS:2:2:3:N',
    't:2:2:S:E',
  ];
}
