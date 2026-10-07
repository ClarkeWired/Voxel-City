import { describe, expect, it } from 'vitest';
import { BLOCK, GRID_N, RING_HALF, SIDEWALK, blockCenter } from './grid';
import { buildWalkGraph } from '../people/paths';

describe('pedestrian and prop layout', () => {
  const graph = buildWalkGraph();

  it('pedestrian ring paths fit within pavements', () => {
    for (const edge of graph.edges.values()) {
      if (edge.crossing) continue;
      for (const point of edge.points) {
        let bestDist = Infinity;
        for (let bi = 0; bi < GRID_N; bi++) {
          for (let bj = 0; bj < GRID_N; bj++) {
            const dx = Math.abs(point.x - blockCenter(bi));
            const dz = Math.abs(point.z - blockCenter(bj));
            const dist = Math.max(dx, dz);
            if (dist < bestDist) bestDist = dist;
          }
        }
        const maxDist = BLOCK / 2 + SIDEWALK / 2;
        expect(bestDist).toBeLessThanOrEqual(maxDist + 0.1);
      }
    }
  });

  it('pedestrian paths avoid block interiors', () => {
    for (const edge of graph.edges.values()) {
      if (edge.crossing) continue;
      for (const point of edge.points) {
        let insideAnyBlock = false;
        for (let bi = 0; bi < GRID_N; bi++) {
          for (let bj = 0; bj < GRID_N; bj++) {
            const dx = Math.abs(point.x - blockCenter(bi));
            const dz = Math.abs(point.z - blockCenter(bj));
            if (dx < RING_HALF - 0.5 && dz < RING_HALF - 0.5) {
              insideAnyBlock = true;
            }
          }
        }
        expect(insideAnyBlock).toBe(false);
      }
    }
  });

  it('ring half is less than half block', () => {
    expect(RING_HALF).toBeLessThan(BLOCK / 2);
  });
});
