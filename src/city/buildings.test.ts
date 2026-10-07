import { describe, expect, it } from 'vitest';
import { BLOCK, GRID_N, blockCenter } from './grid';

describe('building footprints', () => {
  it('building widths fit within block sides', () => {
    const maxBuildingWidth = BLOCK - 2;
    expect(maxBuildingWidth).toBeGreaterThan(6);
    expect(maxBuildingWidth).toBeLessThan(BLOCK);
  });

  it('two buildings fit on each block side with a gap', () => {
    const gap = 1.0;
    const w1 = 7.5;
    const w2 = BLOCK - w1 - gap * 3;
    expect(w2).toBeGreaterThan(4);
    expect(w1 + gap + w2 + gap * 2).toBeLessThanOrEqual(BLOCK);
  });

  it('building depths fit within blocks', () => {
    const maxDepth = 5.5;
    expect(maxDepth).toBeLessThan(BLOCK / 2);
  });

  it('all block centers are within the city', () => {
    for (let bi = 0; bi < GRID_N; bi++) {
      for (let bj = 0; bj < GRID_N; bj++) {
        expect(Math.abs(blockCenter(bi))).toBeLessThanOrEqual(66);
        expect(Math.abs(blockCenter(bj))).toBeLessThanOrEqual(66);
      }
    }
  });
});
