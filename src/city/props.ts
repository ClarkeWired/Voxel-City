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

const SHELTER_W = 5;
const SHELTER_D = 2;

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

  builder.box(cx, base + 0.05, cz, SHELTER_W + 0.4, 0.1, SHELTER_D + 0.3, palette.shelterDark);
  for (const dx of [-SHELTER_W / 2 + 0.2, SHELTER_W / 2 - 0.2]) {
    for (const dz of [backZ, frontZ]) {
      builder.box(cx + dx, base + 1.25, dz, 0.22, 2.5, 0.22, palette.shelter);
    }
  }
  builder.box(cx, base + 2.62, cz, SHELTER_W + 0.6, 0.28, SHELTER_D + 0.5, palette.shelter);
  builder.box(cx, base + 2.85, cz, SHELTER_W + 0.2, 0.18, SHELTER_D + 0.1, palette.shelterDark);

  builder.box(cx, base + 1.5, backZ, SHELTER_W - 0.5, 1.9, 0.1, palette.shelterGlass);
  for (const dx of [-SHELTER_W / 2 + 0.2, SHELTER_W / 2 - 0.2]) {
    builder.box(cx + dx, base + 1.5, cz, 0.1, 1.9, SHELTER_D - 0.4, palette.shelterGlass);
  }

  builder.box(cx, base + 0.55, backZ - zSign * 0.4, SHELTER_W - 1.2, 0.14, 0.55, palette.bench);
  builder.box(cx, base + 0.28, backZ + zSign * 0.3, SHELTER_W - 1.4, 0.5, 0.12, palette.shelterDark);

  builder.box(cx - SHELTER_W / 2 + 0.7, base + 1.3, backZ, 1.5, 1.0, 0.14, palette.frame);
  builder.box(cx - SHELTER_W / 2 + 0.4, base + 0.35, backZ, 0.16, 0.7, 0.16, palette.poleDark);

  const waitSpots: Pt[] = [
    { x: cx - 1.0, z: cz - zSign * 0.15 },
    { x: cx + 0.2, z: cz - zSign * 0.15 },
    { x: cx + 1.4, z: cz - zSign * 0.15 },
  ];
  const doorPoint: Pt = { x: cx + 2.5, z: cz + zSign * 2.2 };
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
  const poleTop = base + 4.3;
  builder.box(poleX, base + 1.6, poleZ, 0.24, 3.2, 0.24, palette.poleDark);
  builder.box(poleX, base + 0.08, poleZ, 0.5, 0.16, 0.5, palette.poleDark);

  const dx = laneX - poleX;
  const dz = laneZ - poleZ;
  const armLen = Math.abs(dx) + Math.abs(dz);
  builder.box((poleX + laneX) / 2, poleTop - 0.35, (poleZ + laneZ) / 2, Math.abs(dx) === 0 ? 0.2 : armLen, 0.2, Math.abs(dz) === 0 ? 0.2 : armLen, palette.poleDark);

  const headX = laneX;
  const headZ = laneZ;
  builder.box(headX, poleTop - 1.15, headZ, 0.62, 1.7, 0.62, palette.poleDark);

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
    x: headX + fx * 0.42,
    y: poleTop - 1.15,
    z: headZ + fz * 0.42,
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
  builder.box(x, base + 0.1, z, 0.45, 0.2, 0.45, palette.poleDark);
  builder.box(x, base + 1.9, z, 0.2, 3.6, 0.2, palette.poleDark);
  builder.box(x + armX * 0.7, base + 3.7, z + armZ * 0.7, Math.abs(armX) > 0 ? 1.5 : 0.16, 0.16, Math.abs(armZ) > 0 ? 1.5 : 0.16, palette.poleDark);
  builder.box(x + armX * 1.45, base + 3.55, z + armZ * 1.45, 0.75, 0.35, 0.75, palette.lampWhite);
  builder.box(x + armX * 1.45, base + 3.8, z + armZ * 1.45, 0.85, 0.2, 0.85, palette.poleDark);
  if (night) {
    night.box(x + armX * 1.45, base + 3.5, z + armZ * 1.45, 0.62, 0.3, 0.62, palette.lampWhite);
  }
}

export function buildTree(builder: VoxelBuilder, rng: Rng, x: number, z: number): void {
  const base = 1.0;
  builder.box(x, base + 0.04, z, 1.7, 0.12, 1.7, palette.grassDark);
  builder.box(x, base + 0.9, z, 0.45, 1.8, 0.45, palette.trunk);
  const leaf = rng.chance(0.5) ? palette.leaf : palette.leafLight;
  builder.box(x, base + 2.3, z, 2.4, 1.5, 2.4, leaf);
  builder.box(x, base + 3.35, z, 1.7, 0.8, 1.7, palette.leafDark);
  if (rng.chance(0.4)) builder.box(x, base + 3.9, z, 0.9, 0.5, 0.9, leaf);
}

export function buildTrashCan(builder: VoxelBuilder, x: number, z: number): void {
  const base = 1.0;
  builder.box(x, base + 0.55, z, 0.72, 1.0, 0.72, palette.trash);
  builder.box(x, base + 1.12, z, 0.8, 0.16, 0.8, palette.poleDark);
}

export function buildHydrant(builder: VoxelBuilder, x: number, z: number): void {
  const base = 1.0;
  builder.box(x, base + 0.35, z, 0.4, 0.6, 0.4, palette.hydrant);
  builder.box(x, base + 0.72, z, 0.28, 0.2, 0.28, palette.hydrant);
  builder.box(x, base + 0.45, z, 0.56, 0.18, 0.2, palette.hydrant);
}

export function buildBench(builder: VoxelBuilder, x: number, z: number, alongX: boolean): void {
  const base = 1.0;
  if (alongX) {
    builder.box(x, base + 0.45, z, 2.4, 0.14, 0.65, palette.bench);
    for (const dx of [-0.9, 0.9]) builder.box(x + dx, base + 0.2, z, 0.16, 0.4, 0.55, palette.poleDark);
  } else {
    builder.box(x, base + 0.45, z, 0.65, 0.14, 2.4, palette.bench);
    for (const dz of [-0.9, 0.9]) builder.box(x, base + 0.2, z + dz, 0.55, 0.4, 0.16, palette.poleDark);
  }
}

export function buildPlanter(builder: VoxelBuilder, rng: Rng, x: number, z: number): void {
  const base = 1.0;
  builder.box(x, base + 0.35, z, 1.3, 0.7, 1.3, palette.planter);
  builder.box(x, base + 0.72, z, 1.1, 0.12, 1.1, palette.dirt);
  for (let i = 0; i < 3; i++) {
    const fc = [palette.flowerRed, palette.flowerYellow, palette.flowerPink][i % 3]!;
    builder.box(x + rng.range(-0.35, 0.35), base + 0.9, z + rng.range(-0.35, 0.35), 0.3, 0.3, 0.3, fc);
  }
}
