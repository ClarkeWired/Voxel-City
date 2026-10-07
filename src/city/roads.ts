import type { Rng } from '../core/rng';
import { palette } from '../core/palette';
import type { VoxelBuilder } from '../core/voxel';
import { BLOCK, BLOCK_TOP, CITY_HALF, GRID_N, LANE_OFFSET, blockCenter, isRoadCoord, roadCenter } from './grid';

const CROSSWALK_INNER = 2.5;
const CROSSWALK_OUTER = 4.5;
const CROSSWALK_CENTER = 3.5;
const STOP_LINE_DIST = 5.65;
const MARK_Y = 0.03;
const MARK_H = 0.05;
const LINE_W = 0.15;
const STRIPE_W = 0.5;
const STRIPE_PITCH = 1.0;
const STOP_LINE_DEPTH = 0.3;

function centerlineDashes(builder: VoxelBuilder): void {
  const dashLen = 1.5;
  const pitch = 3.5;
  const lim = CITY_HALF - 5;
  for (let i = 0; i <= GRID_N; i++) {
    const c = roadCenter(i);
    for (let s = -lim; s < lim; s += pitch) {
      const mid = s + dashLen / 2;
      let nearIntersection = false;
      for (let j = 0; j <= GRID_N; j++) {
        if (Math.abs(mid - roadCenter(j)) < 7) {
          nearIntersection = true;
          break;
        }
      }
      if (nearIntersection) continue;
      builder.box(c, MARK_Y, mid, LINE_W, MARK_H, dashLen, palette.marking);
      builder.box(mid, MARK_Y, c, dashLen, MARK_H, LINE_W, palette.marking);
    }
  }
}

function crosswalkAcrossNsRoad(builder: VoxelBuilder, cx: number, cz: number): void {
  for (let k = -2; k <= 2; k++) {
    builder.box(
      cx + k * STRIPE_PITCH,
      MARK_Y,
      cz,
      STRIPE_W,
      MARK_H,
      CROSSWALK_OUTER - CROSSWALK_INNER,
      palette.marking,
    );
  }
}

function crosswalkAcrossEwRoad(builder: VoxelBuilder, cx: number, cz: number): void {
  for (let k = -2; k <= 2; k++) {
    builder.box(
      cx,
      MARK_Y,
      cz + k * STRIPE_PITCH,
      CROSSWALK_OUTER - CROSSWALK_INNER,
      MARK_H,
      STRIPE_W,
      palette.marking,
    );
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

      if (j > 0) builder.box(xc - LANE_OFFSET, MARK_Y, zc - STOP_LINE_DIST, 3.3, MARK_H, STOP_LINE_DEPTH, palette.marking);
      if (j < GRID_N) builder.box(xc + LANE_OFFSET, MARK_Y, zc + STOP_LINE_DIST, 3.3, MARK_H, STOP_LINE_DEPTH, palette.marking);
      if (i > 0) builder.box(xc - STOP_LINE_DIST, MARK_Y, zc + LANE_OFFSET, STOP_LINE_DEPTH, MARK_H, 3.3, palette.marking);
      if (i < GRID_N) builder.box(xc + STOP_LINE_DIST, MARK_Y, zc - LANE_OFFSET, STOP_LINE_DEPTH, MARK_H, 3.3, palette.marking);
    }
  }
}

export function buildRoads(builder: VoxelBuilder, rng: Rng): void {
  const outer = CITY_HALF + 22;
  const band = outer - CITY_HALF;
  builder.box(0, -1, -CITY_HALF - band / 2, outer * 2, 1, band, palette.grass);
  builder.box(0, -1, CITY_HALF + band / 2, outer * 2, 1, band, palette.grass);
  builder.box(-CITY_HALF - band / 2, -1, 0, band, 1, CITY_HALF * 2, palette.grass);
  builder.box(CITY_HALF + band / 2, -1, 0, band, 1, CITY_HALF * 2, palette.grass);

  builder.box(0, -1, 0, CITY_HALF * 2, 1, CITY_HALF * 2, palette.asphalt);

  for (let i = 0; i < GRID_N; i++) {
    for (let j = 0; j < GRID_N; j++) {
      const bx = blockCenter(i);
      const bz = blockCenter(j);
      builder.box(bx, BLOCK_TOP / 2, bz, BLOCK, BLOCK_TOP, BLOCK, palette.sidewalk);
      builder.box(bx, BLOCK_TOP + 0.03, bz, BLOCK - 3, 0.06, BLOCK - 3, palette.sidewalkDark);
      const edge = BLOCK / 2 - 0.15;
      builder.box(bx, BLOCK_TOP + 0.05, bz - edge, BLOCK, 0.08, 0.3, palette.curb);
      builder.box(bx, BLOCK_TOP + 0.05, bz + edge, BLOCK, 0.08, 0.3, palette.curb);
      builder.box(bx - edge, BLOCK_TOP + 0.05, bz, 0.3, 0.08, BLOCK, palette.curb);
      builder.box(bx + edge, BLOCK_TOP + 0.05, bz, 0.3, 0.08, BLOCK, palette.curb);
    }
  }

  for (let i = 0; i <= GRID_N; i++) {
    for (let j = 0; j <= GRID_N; j++) {
      const xc = roadCenter(i);
      const zc = roadCenter(j);
      for (let k = 0; k < 3; k++) {
        const px = xc + rng.range(-2.5, 2.5);
        const pz = zc + rng.range(-2.5, 2.5);
        const sx = rng.range(0.8, 2);
        const sz = rng.range(0.8, 2);
        if (!isRoadCoord(px) || !isRoadCoord(pz)) continue;
        builder.box(px, 0.02, pz, sx, 0.04, sz, palette.asphaltWear);
      }
      builder.box(xc + rng.range(-2, 2), 0.06, zc + rng.range(-2, 2), 0.8, 0.1, 0.8, palette.asphaltDark);
      builder.box(xc + rng.range(-2, 2), 0.06, zc + rng.range(-2, 2), 0.8, 0.1, 0.8, palette.asphaltDark);
    }
  }

  centerlineDashes(builder);
  stopLinesAndCrosswalks(builder);
}
