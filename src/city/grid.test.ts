import { describe, expect, it } from 'vitest';
import { CITY_HALF, GRID_N, INTERSECTION_NODE_DIST, LANE_OFFSET, PITCH, ROAD, ROAD_HALF, blockCenter, blockEdgeMax, blockEdgeMin, isRoadCoord, nearestBlock, roadCenter } from './grid';

describe('city grid', () => {
  it('places roads at a fixed pitch', () => {
    for (let i = 0; i < GRID_N; i++) {
      expect(roadCenter(i + 1) - roadCenter(i)).toBeCloseTo(PITCH);
    }
  });

  it('blocks touch roads exactly', () => {
    for (let j = 0; j < GRID_N; j++) {
      expect(blockEdgeMax(j)).toBeCloseTo(roadCenter(j + 1) - ROAD_HALF);
      expect(blockEdgeMin(j)).toBeCloseTo(roadCenter(j) + ROAD_HALF);
    }
  });

  it('is symmetric around the origin', () => {
    expect(roadCenter(0)).toBeCloseTo(-CITY_HALF + ROAD_HALF);
    expect(roadCenter(GRID_N)).toBeCloseTo(CITY_HALF - ROAD_HALF);
    expect(blockCenter(2)).toBeCloseTo(0);
  });

  it('a bus fits between adjacent stop lines', () => {
    const segment = PITCH - 2 * INTERSECTION_NODE_DIST;
    expect(segment).toBeGreaterThan(8.6 + 1);
  });

  it('lanes fit inside the road', () => {
    expect(LANE_OFFSET * 2 + 1).toBeLessThan(ROAD);
    expect(ROAD).toBe(ROAD_HALF * 2);
  });

  it('isRoadCoord identifies road strips', () => {
    expect(isRoadCoord(roadCenter(1))).toBe(true);
    expect(isRoadCoord(blockCenter(1) + 3)).toBe(false);
    expect(isRoadCoord(blockCenter(1))).toBe(false);
    expect(isRoadCoord(-CITY_HALF + 1)).toBe(true);
  });

  it('nearestBlock reaches every block in the 5x5 grid', () => {
    const seen = new Set<number>();
    for (let bi = 0; bi < GRID_N; bi++) {
      for (let bj = 0; bj < GRID_N; bj++) {
        const block = nearestBlock(blockCenter(bi), blockCenter(bj));
        expect(block).toBeGreaterThanOrEqual(0);
        expect(block).toBeLessThan(GRID_N * GRID_N);
        seen.add(block);
      }
    }
    expect(seen.size).toBe(GRID_N * GRID_N);
  });

  it('nearestBlock returns the closest block for an incident location', () => {
    for (let bi = 0; bi < GRID_N; bi++) {
      for (let bj = 0; bj < GRID_N; bj++) {
        const block = nearestBlock(blockCenter(bi), blockCenter(bj));
        expect(block).toBe(bi * GRID_N + bj);
      }
    }
  });
});
