import { drawText } from '../core/font';
import type { Rng } from '../core/rng';
import { palette } from '../core/palette';
import type { VoxelBuilder } from '../core/voxel';
import { BLOCK, FURNITURE_INNER, GRID_N, blockCenter } from './grid';
import type { SpatialBlocker } from '../world/obstacles';

interface Side {
  name: 'N' | 'E' | 'S' | 'W';
  facing: 'N' | 'E' | 'S' | 'W';
  nx: number;
  nz: number;
  tx: number;
  tz: number;
}

const SIDES: readonly Side[] = [
  { name: 'N', facing: 'N', nx: 0, nz: -1, tx: 1, tz: 0 },
  { name: 'E', facing: 'E', nx: 1, nz: 0, tx: 0, tz: -1 },
  { name: 'S', facing: 'S', nx: 0, nz: 1, tx: 1, tz: 0 },
  { name: 'W', facing: 'W', nx: -1, nz: 0, tx: 0, tz: 1 },
];

interface WallStyle {
  wall: number;
  wallDark: number;
  roof: number;
}

const WALL_STYLES: readonly WallStyle[] = [
  { wall: palette.wallOrange, wallDark: palette.wallOrangeDark, roof: palette.roofDark },
  { wall: palette.wallMint, wallDark: palette.wallMintDark, roof: palette.roofDark },
  { wall: palette.wallCream, wallDark: palette.wallCreamDark, roof: palette.roofBrown },
  { wall: palette.wallBlue, wallDark: palette.wallBlueDark, roof: palette.roofDark },
  { wall: palette.wallButter, wallDark: palette.wallButterDark, roof: palette.roofBrown },
  { wall: palette.wallRose, wallDark: palette.wallRoseDark, roof: palette.roofDark },
  { wall: palette.wallWhite, wallDark: palette.wallCreamDark, roof: palette.roofDark },
];

const AWNING_COLORS: readonly number[] = [palette.awningRed, palette.awningGreen, palette.awningTeal, palette.awningBlue];

const SHOP_NAMES: readonly string[] = ['BAKERY', 'BOOKS', 'PIZZA', 'TOYS', 'SHOES', 'GROCERY', 'DELI'];

const FLOWER_COLORS: readonly number[] = [
  palette.flowerGreen,
  palette.flowerRed,
  palette.flowerYellow,
  palette.flowerPink,
  palette.flowerWhite,
];

const BASE_Y = 1.06;
const FACADE_DIST = BLOCK / 2 - 1.5;
const SHOP_GROUND_H = 3.8;
const UPPER_H = 2.6;

function boxOn(
  builder: VoxelBuilder,
  fx: number,
  fz: number,
  side: Side,
  u: number,
  v: number,
  y: number,
  su: number,
  sv: number,
  sy: number,
  color: number,
): void {
  const sx = su * Math.abs(side.tx) + sv * Math.abs(side.nx);
  const sz = su * Math.abs(side.tz) + sv * Math.abs(side.nz);
  const x = fx + side.tx * u + side.nx * v;
  const z = fz + side.tz * u + side.nz * v;
  builder.box(x, y, z, sx, sy, sz, color);
}

function buildWindow(
  builder: VoxelBuilder,
  fx: number,
  fz: number,
  side: Side,
  u: number,
  y: number,
  rng: Rng,
  withFlowers: boolean,
  night?: VoxelBuilder,
  nightRng?: Rng,
): void {
  boxOn(builder, fx, fz, side, u, 0.1, y + 0.72, 1.6, 0.16, 0.2, palette.frame);
  boxOn(builder, fx, fz, side, u, 0.1, y - 0.72, 1.6, 0.16, 0.2, palette.frame);
  boxOn(builder, fx, fz, side, u - 0.7, 0.1, y, 0.2, 0.16, 1.65, palette.frame);
  boxOn(builder, fx, fz, side, u + 0.7, 0.1, y, 0.2, 0.16, 1.65, palette.frame);
  boxOn(builder, fx, fz, side, u, 0.0, y, 1.25, 0.16, 1.3, palette.glass);
  boxOn(builder, fx, fz, side, u, 0.18, y - 0.85, 1.85, 0.4, 0.22, palette.frame);
  if (night && nightRng && nightRng.chance(0.45)) {
    boxOn(night, fx, fz, side, u, 0.12, y, 1.15, 0.12, 1.2, 0xffd98c);
  }
  if (withFlowers && rng.chance(0.65)) {
    const count = rng.int(1, 3);
    for (let i = 0; i < count; i++) {
      const fu = u - 0.45 + i * 0.45;
      const fc = FLOWER_COLORS[rng.int(0, FLOWER_COLORS.length - 1)]!;
      boxOn(builder, fx, fz, side, fu, 0.24, y - 0.75, 0.24, 0.24, 0.22, palette.flowerGreen);
      boxOn(builder, fx, fz, side, fu, 0.28, y - 0.55, 0.2, 0.2, 0.18, fc);
    }
  }
}

function windowRow(
  builder: VoxelBuilder,
  fx: number,
  fz: number,
  side: Side,
  u0: number,
  u1: number,
  y: number,
  rng: Rng,
  night?: VoxelBuilder,
  nightRng?: Rng,
): void {
  const width = u1 - u0;
  const count = Math.max(2, Math.floor((width - 0.8) / 2.0));
  const margin = 0.8;
  const span = width - margin * 2;
  for (let i = 0; i < count; i++) {
    const u = u0 + margin + (count === 1 ? span / 2 : (span * i) / (count - 1));
    buildWindow(builder, fx, fz, side, u, y, rng, true, night, nightRng);
  }
}

interface BuildingSpec {
  u0: number;
  u1: number;
  floors: number;
  depth: number;
  style: WallStyle;
  shop: boolean;
  shopName: string | null;
  awning: number;
}

function buildBuilding(
  builder: VoxelBuilder,
  rng: Rng,
  bx: number,
  bz: number,
  side: Side,
  spec: BuildingSpec,
  blockers?: SpatialBlocker,
  night?: VoxelBuilder,
  nightRng?: Rng,
): void {
  const fx = bx + side.nx * FACADE_DIST;
  const fz = bz + side.nz * FACADE_DIST;
  const width = spec.u1 - spec.u0;
  const mid = (spec.u0 + spec.u1) / 2;
  const depth = spec.depth;
  const floors = spec.floors;
  const style = spec.style;
  const groundH = spec.shop ? SHOP_GROUND_H : UPPER_H;
  const totalH = groundH + (floors - 1) * UPPER_H;
  const topY = BASE_Y + totalH;

  if (blockers) {
    const m = 0.1;
    const u0 = Math.max(spec.u0 - m, -FURNITURE_INNER);
    const u1 = Math.min(spec.u1 + m, FURNITURE_INNER);
    if (side.name === 'N') {
      blockers.add(`b${bx}:${bz}:${side.name}`, bx + u0, bx + u1, bz - FACADE_DIST, bz - FACADE_DIST + depth);
    } else if (side.name === 'S') {
      blockers.add(`b${bx}:${bz}:${side.name}`, bx + u0, bx + u1, bz + FACADE_DIST - depth, bz + FACADE_DIST);
    } else if (side.name === 'E') {
      blockers.add(`b${bx}:${bz}:${side.name}`, bx + FACADE_DIST - depth, bx + FACADE_DIST, bz + u0, bz + u1);
    } else {
      blockers.add(`b${bx}:${bz}:${side.name}`, bx - FACADE_DIST, bx - FACADE_DIST + depth, bz + u0, bz + u1);
    }
  }

  boxOn(builder, fx, fz, side, mid, -depth / 2, BASE_Y + totalH / 2, width, depth, totalH, style.wall);
  boxOn(builder, fx, fz, side, mid, 0.1, BASE_Y + 0.55, width, 0.2, 1.1, style.wallDark);
  boxOn(builder, fx, fz, side, mid, -depth / 2, topY + 0.18, width + 0.4, depth + 0.4, 0.35, style.roof);

  if (rng.chance(0.75)) {
    const cu = mid + rng.range(-width / 2 + 1.0, width / 2 - 1.0);
    boxOn(builder, fx, fz, side, cu, -depth * 0.6, topY + 0.8, 0.7, 0.7, 1.3, palette.chimney);
    boxOn(builder, fx, fz, side, cu, -depth * 0.6, topY + 1.55, 1.0, 1.0, 0.2, palette.roofDark);
  }
  if (rng.chance(0.55)) {
    const au = mid + rng.range(-width / 2 + 0.8, width / 2 - 0.8);
    boxOn(builder, fx, fz, side, au, -depth * 0.4, topY + 0.6, 1.1, 0.8, 0.65, palette.carGray);
  }
  if (width > 9 && rng.chance(0.4)) {
    boxOn(builder, fx, fz, side, mid - width / 2 + 1.8, -depth * 0.7, topY + 0.7, 1.6, 1.4, 1.0, style.wallDark);
  }

  if (spec.shop) {
    boxOn(builder, fx, fz, side, mid, 0.05, BASE_Y + 1.25, width - 1.2, 0.16, 2.3, palette.glass);
    boxOn(builder, fx, fz, side, mid, 0.13, BASE_Y + 1.15, width - 1.8, 0.2, 1.9, palette.glassLight);
    if (night && nightRng && nightRng.chance(0.75)) {
      boxOn(night, fx, fz, side, mid, 0.25, BASE_Y + 1.15, width - 2.0, 0.12, 1.8, 0xffe2a8);
    }
    const doorU = mid + (rng.chance(0.5) ? -width / 2 + 1.2 : width / 2 - 1.2);
    boxOn(builder, fx, fz, side, doorU, 0.2, BASE_Y + 0.95, 1.0, 0.24, 1.9, palette.doorWood);

    const awningY = BASE_Y + 2.8;
    const stripes = Math.max(4, Math.round(width / 0.7));
    const stripeW = width / stripes;
    for (let i = 0; i < stripes; i++) {
      const u = spec.u0 + stripeW * (i + 0.5);
      const color = i % 2 === 0 ? spec.awning : palette.awningWhite;
      boxOn(builder, fx, fz, side, u, 0.75, awningY, stripeW * 0.96, 1.4, 0.24, color);
    }
    boxOn(builder, fx, fz, side, mid, 1.4, awningY - 0.28, width, 0.12, 0.45, spec.awning);

    if (spec.shopName) {
      const text = spec.shopName;
      const signW = width - 1.4;
      let size = Math.min(0.36, (signW - 0.5) / (text.length * 4 - 1));
      size = Math.min(size, 0.34);
      const textH = 5 * size;
      const boardH = textH + 0.4;
      const signBottom = awningY + 0.35;
      const signY = signBottom + boardH / 2;
      boxOn(builder, fx, fz, side, mid, 0.25, signY, signW, 0.24, boardH, palette.frame);
      drawText(builder, text, fx + side.nx * 0.45, signY - 0.04, fz + side.nz * 0.45, size, palette.signBoard, side.facing, 0.12);
    }

    const rowStart = BASE_Y + groundH + UPPER_H + 1.5;
    for (let fl = 0; fl < floors - 2; fl++) {
      windowRow(builder, fx, fz, side, spec.u0, spec.u1, rowStart + fl * UPPER_H, rng, night, nightRng);
    }
  } else {
    const doorU = mid;
    boxOn(builder, fx, fz, side, doorU, 0.15, BASE_Y + 0.85, 1.1, 0.24, 1.75, palette.doorWood);
    boxOn(builder, fx, fz, side, doorU, 0.28, BASE_Y + 1.95, 1.5, 0.7, 0.2, style.wallDark);
    for (let i = 0; i < 2; i++) {
      const u = spec.u0 + 1.5 + i * (width - 3);
      buildWindow(builder, fx, fz, side, u, BASE_Y + 1.55, rng, true, night, nightRng);
    }
    for (let fl = 1; fl < floors; fl++) {
      windowRow(builder, fx, fz, side, spec.u0, spec.u1, BASE_Y + 1.55 + fl * UPPER_H, rng, night, nightRng);
    }
  }
}

function pickShopName(rng: Rng): string {
  return SHOP_NAMES[rng.int(0, SHOP_NAMES.length - 1)]!;
}

function pickWall(rng: Rng): WallStyle {
  return WALL_STYLES[Math.floor(rng.next() * WALL_STYLES.length)]!;
}

function showcaseLots(side: Side): BuildingSpec[] | null {
  if (side.name !== 'S') return null;
  return [
    {
      u0: -12.5,
      u1: -0.5,
      floors: 4,
      depth: 6,
      style: { wall: palette.wallOrange, wallDark: palette.wallOrangeDark, roof: palette.roofDark },
      shop: true,
      shopName: 'CAFE',
      awning: palette.awningRed,
    },
    {
      u0: 0.5,
      u1: 12.5,
      floors: 4,
      depth: 6,
      style: { wall: palette.wallMint, wallDark: palette.wallMintDark, roof: palette.roofDark },
      shop: true,
      shopName: 'FLOWERS',
      awning: palette.awningGreen,
    },
  ];
}

function randomLots(rng: Rng): BuildingSpec[] {
  const gap = rng.range(0.5, 1.0);
  const w1 = rng.range(6.5, 8.5);
  const w2 = BLOCK - w1 - gap * 3;
  const u00 = -BLOCK / 2 + gap;
  const u01 = u00 + w1;
  const u10 = u01 + gap;
  const u11 = u10 + w2;
  const shop1 = rng.chance(0.45);
  const shop2 = !shop1 && rng.chance(0.6);
  return [
    {
      u0: u00,
      u1: u01,
      floors: rng.int(2, 4),
      depth: rng.range(4.0, 5.5),
      style: pickWall(rng),
      shop: shop1,
      shopName: shop1 ? pickShopName(rng) : null,
      awning: AWNING_COLORS[rng.int(0, AWNING_COLORS.length - 1)]!,
    },
    {
      u0: u10,
      u1: u11,
      floors: rng.int(2, 4),
      depth: rng.range(4.0, 5.5),
      style: pickWall(rng),
      shop: shop2,
      shopName: shop2 ? pickShopName(rng) : null,
      awning: AWNING_COLORS[rng.int(0, AWNING_COLORS.length - 1)]!,
    },
  ];
}

export function buildBuildings(
  builder: VoxelBuilder,
  rng: Rng,
  night: VoxelBuilder | undefined,
  nightRng: Rng | undefined,
  blockers?: SpatialBlocker,
): void {
  for (let bi = 0; bi < GRID_N; bi++) {
    for (let bj = 0; bj < GRID_N; bj++) {
      const bx = blockCenter(bi);
      const bz = blockCenter(bj);
      for (const side of SIDES) {
        if (bi === 2 && bj === 3 && side.name === 'N') continue;
        const showcase = bi === 2 && bj === 2 ? showcaseLots(side) : null;
        const specs = showcase ?? randomLots(rng);
        for (const spec of specs) {
          buildBuilding(builder, rng, bx, bz, side, spec, blockers, night, nightRng);
        }
      }
    }
  }
}
