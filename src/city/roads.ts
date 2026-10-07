import type { Rng } from '../core/rng';
import { palette } from '../core/palette';
import type { VoxelBuilder } from '../core/voxel';
import { BLOCK, BLOCK_TOP, CITY_HALF, GRID_N, blockCenter, isRoadCoord, roadCenter } from './grid';

const CROSSWALK_INNER = 5;
const CROSSWALK_OUTER = 8;
const CROSSWALK_CENTER = 6.5;
const STOP_LINE_DIST = 9.15;

function centerlineDashes(builder: VoxelBuilder): void {
  const dashLen = 2;
  const pitch = 4.5;
  const lim = CITY_HALF - 7;
  for (let i = 0; i <= GRID_N; i++) {
    const c = roadCenter(i);
    for (let s = -lim; s < lim; s += pitch) {
      const mid = s + dashLen / 2;
      let nearIntersection = false;
      for (let j = 0; j <= GRID_N; j++) {
        if (Math.abs(mid - roadCenter(j)) < 10) {
          nearIntersection = true;
          break;
        }
      }
      if (nearIntersection) continue;
      builder.box(c, 0.05, mid, 0.35, 0.08, dashLen, palette.marking);
      builder.box(mid, 0.05, c, dashLen, 0.08, 0.35, palette.marking);
    }
  }
}

function crosswalkAcrossNsRoad(builder: VoxelBuilder, cx: number, cz: number): void {
  for (let k = -3; k <= 3; k++) {
    if (k === 0) continue;
    const off = k * 1.65 - Math.sign(k) * 0.35;
    builder.box(cx + off, 0.05, cz, 0.95, 0.08, CROSSWALK_OUTER - CROSSWALK_INNER, palette.marking);
  }
}

function crosswalkAcrossEwRoad(builder: VoxelBuilder, cx: number, cz: number): void {
  for (let k = -3; k <= 3; k++) {
    if (k === 0) continue;
    const off = k * 1.65 - Math.sign(k) * 0.35;
    builder.box(cx, 0.05, cz + off, CROSSWALK_OUTER - CROSSWALK_INNER, 0.08, 0.95, palette.marking);
  }
}

function stopLinesAndCrosswalks(builder: VoxelBuilder): void {
  for (let i = 0; i <= GRID_N; i++) {
    for (let j = 0; j <= GRID_N; j++) {
      const xc = roadCenter(i);
      const zc = roadCenter(j);

      if (j > 0) crosswalkAcrossNsRoad(builder, xc, zc - CROSSWALK_CENTER);
      if (j < GRID_N) crosswalkAcrossNsRoad(builder, xc, zc + CROSSWALK_CENTER);
      if (i > 0) crosswalkAcrossEwRoad(builder, xc - CROSSWALK_CENTER, zc);
      if (i < GRID_N) crosswalkAcrossEwRoad(builder, xc + CROSSWALK_CENTER, zc);

      if (j > 0) builder.box(xc - 2.5, 0.05, zc - STOP_LINE_DIST, 4.3, 0.08, 0.7, palette.marking);
      if (j < GRID_N) builder.box(xc + 2.5, 0.05, zc + STOP_LINE_DIST, 4.3, 0.08, 0.7, palette.marking);
      if (i > 0) builder.box(xc - STOP_LINE_DIST, 0.05, zc + 2.5, 0.7, 0.08, 4.3, palette.marking);
      if (i < GRID_N) builder.box(xc + STOP_LINE_DIST, 0.05, zc - 2.5, 0.7, 0.08, 4.3, palette.marking);
    }
  }
}

export function buildRoads(builder: VoxelBuilder, rng: Rng): void {
  const outer = CITY_HALF + 22;
  builder.box(0, -1, -CITY_HALF - 11, outer * 2, 1, (outer - CITY_HALF) * 2, palette.grass);
  builder.box(0, -1, CITY_HALF + 11, outer * 2, 1, (outer - CITY_HALF) * 2, palette.grass);
  builder.box(-CITY_HALF - 11, -1, 0, (outer - CITY_HALF) * 2, 1, CITY_HALF * 2, palette.grass);
  builder.box(CITY_HALF + 11, -1, 0, (outer - CITY_HALF) * 2, 1, CITY_HALF * 2, palette.grass);

  builder.box(0, -1, 0, CITY_HALF * 2, 1, CITY_HALF * 2, palette.asphalt);

  for (let i = 0; i < GRID_N; i++) {
    for (let j = 0; j < GRID_N; j++) {
      const bx = blockCenter(i);
      const bz = blockCenter(j);
      builder.box(bx, BLOCK_TOP / 2, bz, BLOCK, BLOCK_TOP, BLOCK, palette.sidewalk);
      builder.box(bx, BLOCK_TOP + 0.03, bz, BLOCK - 4, 0.06, BLOCK - 4, palette.sidewalkDark);
      const edge = BLOCK / 2 - 0.2;
      builder.box(bx, BLOCK_TOP + 0.05, bz - edge, BLOCK, 0.08, 0.4, palette.curb);
      builder.box(bx, BLOCK_TOP + 0.05, bz + edge, BLOCK, 0.08, 0.4, palette.curb);
      builder.box(bx - edge, BLOCK_TOP + 0.05, bz, 0.4, 0.08, BLOCK, palette.curb);
      builder.box(bx + edge, BLOCK_TOP + 0.05, bz, 0.4, 0.08, BLOCK, palette.curb);
    }
  }

  for (let i = 0; i <= GRID_N; i++) {
    for (let j = 0; j <= GRID_N; j++) {
      const xc = roadCenter(i);
      const zc = roadCenter(j);
      for (let k = 0; k < 3; k++) {
        const px = xc + rng.range(-3.5, 3.5);
        const pz = zc + rng.range(-3.5, 3.5);
        const sx = rng.range(1.2, 3);
        const sz = rng.range(1.2, 3);
        if (!isRoadCoord(px) || !isRoadCoord(pz)) continue;
        builder.box(px, 0.02, pz, sx, 0.04, sz, palette.asphaltWear);
      }
      builder.box(xc + rng.range(-3, 3), 0.06, zc + rng.range(-3, 3), 1.1, 0.1, 1.1, palette.asphaltDark);
      builder.box(xc + rng.range(-3, 3), 0.06, zc + rng.range(-3, 3), 1.1, 0.1, 1.1, palette.asphaltDark);
    }
  }

  centerlineDashes(builder);
  stopLinesAndCrosswalks(builder);
}
