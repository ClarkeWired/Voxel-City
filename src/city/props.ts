import type { Pt } from '../core/geo';
import type { Rng } from '../core/rng';
import { palette } from '../core/palette';
import type { VoxelBuilder } from '../core/voxel';
import type { Arm } from '../traffic/graph';

export interface SignalHead {
  id: string;
  intersectionId: string;
  axis: 'NS' | 'EW';
  x: number;
  y: number;
  z: number;
  fx: number;
  fz: number;
}

const SHELTER_W = 4.0;
const SHELTER_D = 1.6;

export interface ShelterBuild {
  center: Pt;
  waitSpots: Pt[];
  doorPoint: Pt;
}

export function buildShelter(builder: VoxelBuilder, cx: number, cz: number, faceNorth: boolean): ShelterBuild {
  const zSign = faceNorth ? -1 : 1;
  const backZ = cz - zSign * (SHELTER_D / 2);
  const frontZ = cz + zSign * (SHELTER_D / 2);
  const base = 1.02;

  builder.box(cx, base + 0.04, cz, SHELTER_W + 0.3, 0.08, SHELTER_D + 0.2, palette.shelterDark);
  for (const dx of [-SHELTER_W / 2 + 0.15, SHELTER_W / 2 - 0.15]) {
    for (const dz of [backZ, frontZ]) {
      builder.box(cx + dx, base + 1.0, dz, 0.18, 2.0, 0.18, palette.shelter);
    }
  }
  builder.box(cx, base + 2.15, cz, SHELTER_W + 0.45, 0.22, SHELTER_D + 0.4, palette.shelter);
  builder.box(cx, base + 2.35, cz, SHELTER_W + 0.15, 0.14, SHELTER_D + 0.08, palette.shelterDark);

  builder.box(cx, base + 1.25, backZ, SHELTER_W - 0.4, 1.55, 0.08, palette.shelterGlass);
  for (const dx of [-SHELTER_W / 2 + 0.15, SHELTER_W / 2 - 0.15]) {
    builder.box(cx + dx, base + 1.25, cz, 0.08, 1.55, SHELTER_D - 0.3, palette.shelterGlass);
  }

  builder.box(cx, base + 0.45, backZ - zSign * 0.3, SHELTER_W - 1.0, 0.1, 0.45, palette.bench);
  builder.box(cx, base + 0.22, backZ + zSign * 0.25, SHELTER_W - 1.15, 0.4, 0.1, palette.shelterDark);

  builder.box(cx - SHELTER_W / 2 + 0.55, base + 1.05, backZ, 1.2, 0.8, 0.1, palette.frame);
  builder.box(cx - SHELTER_W / 2 + 0.3, base + 0.28, backZ, 0.12, 0.55, 0.12, palette.poleDark);

  const waitSpots: Pt[] = [
    { x: cx - 0.8, z: cz - zSign * 0.12 },
    { x: cx + 0.15, z: cz - zSign * 0.12 },
    { x: cx + 1.1, z: cz - zSign * 0.12 },
  ];
  const doorPoint: Pt = { x: cx + 2.0, z: cz + zSign * 1.8 };
  return { center: { x: cx, z: cz }, waitSpots, doorPoint };
}

export function buildTrafficLight(
  builder: VoxelBuilder,
  intersectionId: string,
  ix: number,
  iz: number,
  arm: Arm,
  laneX: number,
  laneZ: number,
  poleX: number,
  poleZ: number,
): SignalHead {
  const base = 1.0;
  const poleTop = base + 3.6;
  builder.box(poleX, base + 1.3, poleZ, 0.2, 2.6, 0.2, palette.poleDark);
  builder.box(poleX, base + 0.06, poleZ, 0.4, 0.12, 0.4, palette.poleDark);

  const dx = laneX - poleX;
  const dz = laneZ - poleZ;
  const armLen = Math.abs(dx) + Math.abs(dz);
  builder.box((poleX + laneX) / 2, poleTop - 0.3, (poleZ + laneZ) / 2, Math.abs(dx) === 0 ? 0.16 : armLen, 0.16, Math.abs(dz) === 0 ? 0.16 : armLen, palette.poleDark);

  const headX = laneX;
  const headZ = laneZ;
  builder.box(headX, poleTop - 0.95, headZ, 0.5, 1.4, 0.5, palette.poleDark);

  let fx = 0;
  let fz = 0;
  switch (arm) {
    case 'N':
      fz = -1;
      break;
    case 'S':
      fz = 1;
      break;
    case 'E':
      fx = 1;
      break;
    case 'W':
      fx = -1;
      break;
  }

  return {
    id: `light:${ix}:${iz}:${arm}`,
    intersectionId,
    axis: arm === 'N' || arm === 'S' ? 'NS' : 'EW',
    x: headX + fx * 0.35,
    y: poleTop - 0.95,
    z: headZ + fz * 0.35,
    fx,
    fz,
  };
}

export function buildStreetLamp(
  builder: VoxelBuilder,
  x: number,
  z: number,
  armX: number,
  armZ: number,
  night?: VoxelBuilder,
): void {
  const base = 1.0;
  builder.box(x, base + 0.08, z, 0.35, 0.16, 0.35, palette.poleDark);
  builder.box(x, base + 1.55, z, 0.16, 2.9, 0.16, palette.poleDark);
  builder.box(x + armX * 0.55, base + 3.0, z + armZ * 0.55, Math.abs(armX) > 0 ? 1.2 : 0.12, 0.12, Math.abs(armZ) > 0 ? 1.2 : 0.12, palette.poleDark);
  builder.box(x + armX * 1.15, base + 2.85, z + armZ * 1.15, 0.6, 0.28, 0.6, palette.lampWhite);
  builder.box(x + armX * 1.15, base + 3.05, z + armZ * 1.15, 0.68, 0.16, 0.68, palette.poleDark);
  if (night) {
    night.box(x + armX * 1.15, base + 2.8, z + armZ * 1.15, 0.5, 0.24, 0.5, palette.lampWhite);
  }
}

export function buildTree(builder: VoxelBuilder, rng: Rng, x: number, z: number): void {
  const base = 1.0;
  builder.box(x, base + 0.03, z, 1.3, 0.1, 1.3, palette.grassDark);
  builder.box(x, base + 0.7, z, 0.35, 1.4, 0.35, palette.trunk);
  const leaf = rng.chance(0.5) ? palette.leaf : palette.leafLight;
  builder.box(x, base + 1.85, z, 1.9, 1.2, 1.9, leaf);
  builder.box(x, base + 2.7, z, 1.35, 0.65, 1.35, palette.leafDark);
  if (rng.chance(0.4)) builder.box(x, base + 3.15, z, 0.7, 0.4, 0.7, leaf);
}

export function buildTrashCan(builder: VoxelBuilder, x: number, z: number): void {
  const base = 1.0;
  builder.box(x, base + 0.45, z, 0.58, 0.8, 0.58, palette.trash);
  builder.box(x, base + 0.92, z, 0.65, 0.12, 0.65, palette.poleDark);
}

export function buildHydrant(builder: VoxelBuilder, x: number, z: number): void {
  const base = 1.0;
  builder.box(x, base + 0.28, z, 0.32, 0.48, 0.32, palette.hydrant);
  builder.box(x, base + 0.58, z, 0.22, 0.16, 0.22, palette.hydrant);
  builder.box(x, base + 0.36, z, 0.45, 0.14, 0.16, palette.hydrant);
}

export function buildBench(builder: VoxelBuilder, x: number, z: number, alongX: boolean): void {
  const base = 1.0;
  if (alongX) {
    builder.box(x, base + 0.36, z, 1.9, 0.1, 0.5, palette.bench);
    for (const dx of [-0.7, 0.7]) builder.box(x + dx, base + 0.16, z, 0.12, 0.32, 0.45, palette.poleDark);
  } else {
    builder.box(x, base + 0.36, z, 0.5, 0.1, 1.9, palette.bench);
    for (const dz of [-0.7, 0.7]) builder.box(x, base + 0.16, z + dz, 0.45, 0.32, 0.12, palette.poleDark);
  }
}

export function buildPlanter(builder: VoxelBuilder, rng: Rng, x: number, z: number): void {
  const base = 1.0;
  builder.box(x, base + 0.28, z, 1.05, 0.55, 1.05, palette.planter);
  builder.box(x, base + 0.58, z, 0.88, 0.1, 0.88, palette.dirt);
  for (let i = 0; i < 3; i++) {
    const fc = [palette.flowerRed, palette.flowerYellow, palette.flowerPink][i % 3]!;
    builder.box(x + rng.range(-0.28, 0.28), base + 0.72, z + rng.range(-0.28, 0.28), 0.24, 0.24, 0.24, fc);
  }
}
