import type { Axis, Pt } from '../core/geo';
import { polylineLength } from '../core/geo';
import { GRID_N, PITCH, RING_HALF, ROAD_HALF, blockCenter, roadCenter } from '../city/grid';
import type { LightState } from '../traffic/signals';

export interface CrossingInfo {
  axis: Axis;
  intersectionId: string;
  center: Pt;
  duration: number;
}

export interface WalkEdge {
  id: string;
  a: string;
  b: string;
  points: Pt[];
  length: number;
  crossing?: CrossingInfo;
}

export interface WalkNode {
  id: string;
  pos: Pt;
  edges: string[];
}

export interface WalkGraph {
  nodes: Map<string, WalkNode>;
  edges: Map<string, WalkEdge>;
}

export const PED_SPEED = 1.5;
export const CROSS_SPEED = 1.7;
export const JOG_SPEED = 2.8;

const CROSSING_OFFSET = ROAD_HALF + 1.5;

export function canStartCrossing(
  crossing: CrossingInfo,
  state: LightState,
  timeUntilGreen: number,
  vehicleDistance: number,
): boolean {
  if (state !== 'red') return false;
  if (timeUntilGreen < crossing.duration + 2.5) return false;
  if (vehicleDistance < 9) return false;
  return true;
}

function cornerId(bi: number, bj: number, corner: 'nw' | 'ne' | 'sw' | 'se'): string {
  return `b${bi}:${bj}:${corner}`;
}

export function buildWalkGraph(): WalkGraph {
  const nodes = new Map<string, WalkNode>();
  const edges = new Map<string, WalkEdge>();

  const addNode = (id: string, pos: Pt): void => {
    nodes.set(id, { id, pos, edges: [] });
  };
  const addEdge = (id: string, a: string, b: string, points: Pt[], crossing?: CrossingInfo): void => {
    const edge: WalkEdge = { id, a, b, points, length: polylineLength(points), crossing };
    edges.set(id, edge);
    nodes.get(a)!.edges.push(id);
    nodes.get(b)!.edges.push(id);
  };

  for (let bi = 0; bi < GRID_N; bi++) {
    for (let bj = 0; bj < GRID_N; bj++) {
      const bx = blockCenter(bi);
      const bz = blockCenter(bj);
      const r = RING_HALF;
      addNode(cornerId(bi, bj, 'nw'), { x: bx - r, z: bz - r });
      addNode(cornerId(bi, bj, 'ne'), { x: bx + r, z: bz - r });
      addNode(cornerId(bi, bj, 'sw'), { x: bx - r, z: bz + r });
      addNode(cornerId(bi, bj, 'se'), { x: bx + r, z: bz + r });

      const sideNodes = (side: string, count: number): string[] => {
        const ids: string[] = [];
        for (let i = 0; i < count; i++) {
          const u = -r + ((i + 1) * (2 * r)) / (count + 1);
          let x = bx;
          let z = bz;
          if (side === 'N') {
            x = bx + u;
            z = bz - r;
          } else if (side === 'S') {
            x = bx + u;
            z = bz + r;
          } else if (side === 'E') {
            x = bx + r;
            z = bz + u;
          } else {
            x = bx - r;
            z = bz + u;
          }
          const id = `b${bi}:${bj}:${side}${i}`;
          addNode(id, { x, z });
          ids.push(id);
        }
        return ids;
      };

      const nSide = sideNodes('N', 3);
      const eSide = sideNodes('E', 3);
      const sSide = sideNodes('S', 3);
      const wSide = sideNodes('W', 3);

      const chain = (ids: string[]): void => {
        for (let i = 1; i < ids.length; i++) {
          const a = ids[i - 1]!;
          const b = ids[i]!;
          addEdge(`w:${a}->${b}`, a, b, [nodes.get(a)!.pos, nodes.get(b)!.pos]);
        }
      };
      chain([cornerId(bi, bj, 'nw'), ...nSide, cornerId(bi, bj, 'ne')]);
      chain([cornerId(bi, bj, 'ne'), ...eSide, cornerId(bi, bj, 'se')]);
      chain([cornerId(bi, bj, 'se'), ...sSide, cornerId(bi, bj, 'sw')]);
      chain([cornerId(bi, bj, 'sw'), ...wSide, cornerId(bi, bj, 'nw')]);
    }
  }

  const blockExists = (bi: number, bj: number): boolean => bi >= 0 && bi < GRID_N && bj >= 0 && bj < GRID_N;

  for (let i = 0; i <= GRID_N; i++) {
    for (let j = 0; j <= GRID_N; j++) {
      const xc = roadCenter(i);
      const zc = roadCenter(j);
      const intersectionId = `${i}:${j}`;
      const crossingLen = PITCH - 2 * RING_HALF;
      const duration = crossingLen / CROSS_SPEED;

      const tryAdd = (
        arm: 'N' | 'S' | 'E' | 'W',
        aBi: number,
        aBj: number,
        aCorner: 'nw' | 'ne' | 'sw' | 'se',
        bBi: number,
        bBj: number,
        bCorner: 'nw' | 'ne' | 'sw' | 'se',
        center: Pt,
        axis: Axis,
      ): void => {
        if (!blockExists(aBi, aBj) || !blockExists(bBi, bBj)) return;
        const a = cornerId(aBi, aBj, aCorner);
        const b = cornerId(bBi, bBj, bCorner);
        addEdge(`x:${i}:${j}:${arm}`, a, b, [nodes.get(a)!.pos, nodes.get(b)!.pos], {
          axis,
          intersectionId,
          center,
          duration,
        });
      };

      tryAdd('N', i - 1, j - 1, 'se', i, j - 1, 'sw', { x: xc, z: zc - CROSSING_OFFSET }, 'NS');
      tryAdd('S', i - 1, j, 'ne', i, j, 'nw', { x: xc, z: zc + CROSSING_OFFSET }, 'NS');
      tryAdd('W', i - 1, j - 1, 'se', i - 1, j, 'ne', { x: xc - CROSSING_OFFSET, z: zc }, 'EW');
      tryAdd('E', i, j - 1, 'sw', i, j, 'nw', { x: xc + CROSSING_OFFSET, z: zc }, 'EW');
    }
  }

  return { nodes, edges };
}
