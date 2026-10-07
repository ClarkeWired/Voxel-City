import { describe, expect, it } from 'vitest';
import { drawText, textWidth } from './font';
import { VoxelBuilder } from './voxel';

describe('pixel font', () => {
  it('textWidth grows by 4 cells per char', () => {
    expect(textWidth('A', 1)).toBe(3);
    expect(textWidth('AB', 1)).toBe(7);
    expect(textWidth('CAFE', 0.5)).toBeCloseTo(0.5 * 15);
  });

  it('drawText emits one box per lit pixel', () => {
    const b = new VoxelBuilder();
    drawText(b, 'A', 0, 0, 0, 1, 0xffffff, 'S');
    expect(b.count()).toBe(10);
    const c = new VoxelBuilder();
    drawText(c, ' ', 0, 0, 0, 1, 0xffffff, 'S');
    expect(c.count()).toBe(0);
  });

  it('mirrors text between S and N facings', () => {
    const south = new VoxelBuilder();
    drawText(south, 'L', 0, 0, 0, 1, 0xffffff, 'S');
    const north = new VoxelBuilder();
    drawText(north, 'L', 0, 0, 0, 1, 0xffffff, 'N');
    const sx = south.boxes.map((box) => box.x).sort((a, b) => a - b);
    const nx = north.boxes.map((box) => box.x).sort((a, b) => a - b);
    const mirror = sx.map((v) => (v === 0 ? 0 : -v)).sort((a, b) => a - b);
    expect(nx).toEqual(mirror);
  });
});
