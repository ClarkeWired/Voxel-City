import { describe, expect, it } from 'vitest';
import { VoxelBuilder, buildMergedGeometry } from './voxel';

describe('VoxelBuilder', () => {
  it('collects boxes', () => {
    const b = new VoxelBuilder();
    b.box(0, 0, 0, 1, 1, 1, 0xffffff);
    b.box(1, 1, 1, 2, 2, 2, 0xff0000);
    expect(b.count()).toBe(2);
  });

  it('merged geometry has 24 vertices and 36 indices per box', () => {
    const b = new VoxelBuilder();
    b.box(0, 0, 0, 1, 1, 1, 0xffffff);
    b.box(1, 1, 1, 2, 2, 2, 0xff0000);
    const geometry = buildMergedGeometry(b);
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const color = geometry.getAttribute('color');
    const index = geometry.getIndex()!;
    expect(position.count).toBe(48);
    expect(normal.count).toBe(48);
    expect(color.count).toBe(48);
    expect(index.count).toBe(72);
  });

  it('applies scale and position to vertices', () => {
    const b = new VoxelBuilder();
    b.box(10, 5, 0, 2, 4, 6, 0x00ff00);
    const geometry = buildMergedGeometry(b);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.min.x).toBeCloseTo(9);
    expect(box.max.x).toBeCloseTo(11);
    expect(box.min.y).toBeCloseTo(3);
    expect(box.max.y).toBeCloseTo(7);
    expect(box.min.z).toBeCloseTo(-3);
    expect(box.max.z).toBeCloseTo(3);
  });
});
