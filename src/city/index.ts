import * as THREE from 'three';
import type { Rng } from '../core/rng';
import { VoxelBuilder, buildInstancedMesh, createInstancedMaterial } from '../core/voxel';
import { GRID_N, blockCenter, roadCenter } from './grid';
import { buildRoads } from './roads';
import { buildBuildings } from './buildings';
import {
  buildBench,
  buildHydrant,
  buildPlanter,
  buildShelter,
  buildStreetLamp,
  buildTrafficLight,
  buildTrashCan,
  buildTree,
  type ShelterBuild,
  type SignalHead,
} from './props';
import { armConnects, type Arm, ARMS } from '../traffic/graph';

export const SHELTER_X = 2;
export const SHELTER_Z = 26.6;

const STOP_DIST = 9.15;

interface ArmPlacement {
  laneX: number;
  laneZ: number;
  poleX: number;
  poleZ: number;
}

function armPlacement(xc: number, zc: number, arm: Arm, i: number, j: number): ArmPlacement {
  switch (arm) {
    case 'N':
      return {
        laneX: xc - 2.5,
        laneZ: zc - STOP_DIST,
        poleX: i > 0 ? xc - 5.6 : xc + 5.6,
        poleZ: zc - STOP_DIST,
      };
    case 'S':
      return {
        laneX: xc + 2.5,
        laneZ: zc + STOP_DIST,
        poleX: i < GRID_N ? xc + 5.6 : xc - 5.6,
        poleZ: zc + STOP_DIST,
      };
    case 'E':
      return {
        laneX: xc + STOP_DIST,
        laneZ: zc - 2.5,
        poleX: xc + STOP_DIST,
        poleZ: j > 0 ? zc - 5.6 : zc + 5.6,
      };
    case 'W':
      return {
        laneX: xc - STOP_DIST,
        laneZ: zc + 2.5,
        poleX: xc - STOP_DIST,
        poleZ: j < GRID_N ? zc + 5.6 : zc - 5.6,
      };
  }
}

export interface CityBuild {
  shelter: ShelterBuild;
  signalHeads: SignalHead[];
}

export function buildCity(scene: THREE.Scene, rng: Rng): CityBuild {
  const builder = new VoxelBuilder();

  buildRoads(builder, rng);
  buildBuildings(builder, rng);

  const signalHeads: SignalHead[] = [];
  for (let i = 0; i <= GRID_N; i++) {
    for (let j = 0; j <= GRID_N; j++) {
      const xc = roadCenter(i);
      const zc = roadCenter(j);
      const intersectionId = `${i}:${j}`;
      for (const arm of ARMS) {
        if (!armConnects(i, j, arm)) continue;
        const p = armPlacement(xc, zc, arm, i, j);
        signalHeads.push(buildTrafficLight(builder, intersectionId, i, j, arm, p.laneX, p.laneZ, p.poleX, p.poleZ));
      }
    }
  }

  for (let bi = 0; bi < GRID_N; bi++) {
    for (let bj = 0; bj < GRID_N; bj++) {
      const bx = blockCenter(bi);
      const bz = blockCenter(bj);
      const edge = 15;

      for (const side of [
        { nx: 0, nz: -1, tx: 1, tz: 0 },
        { nx: 1, nz: 0, tx: 0, tz: -1 },
        { nx: 0, nz: 1, tx: 1, tz: 0 },
        { nx: -1, nz: 0, tx: 0, tz: 1 },
      ]) {
        const cx = bx + side.nx * edge;
        const cz = bz + side.nz * edge;
        const lampU = rng.range(-7, 7);
        buildStreetLamp(
          builder,
          cx + side.tx * lampU - side.nx * 0.9,
          cz + side.tz * lampU - side.nz * 0.9,
          side.nx,
          side.nz,
        );
        const treeCount = rng.int(2, 4);
        for (let t = 0; t < treeCount; t++) {
          const u = rng.range(-12, 12);
          buildTree(builder, rng, cx + side.tx * u - side.nx * 1.1, cz + side.tz * u - side.nz * 1.1);
        }
        if (rng.chance(0.7)) {
          const u = rng.range(-10, 10);
          buildBench(builder, cx + side.tx * u - side.nx * 1.4, cz + side.tz * u - side.nz * 1.4, Math.abs(side.tx) > 0);
        }
        if (rng.chance(0.6)) {
          const u = rng.range(-10, 10);
          buildTrashCan(builder, cx + side.tx * u - side.nx * 0.9, cz + side.tz * u - side.nz * 0.9);
        }
        if (rng.chance(0.4)) {
          const u = rng.range(-10, 10);
          buildPlanter(builder, rng, cx + side.tx * u - side.nx * 1.5, cz + side.tz * u - side.nz * 1.5);
        }
        if (rng.chance(0.3)) {
          const u = rng.range(-10, 10);
          buildHydrant(builder, cx + side.tx * u - side.nx * 0.8, cz + side.tz * u - side.nz * 0.8);
        }
      }
    }
  }

  const shelter = buildShelter(builder, SHELTER_X, SHELTER_Z, true);

  for (let r = 0; r < 14; r++) {
    const angle = (r / 14) * Math.PI * 2;
    const radius = 78 + rng.range(0, 10);
    buildTree(builder, rng, Math.cos(angle) * radius, Math.sin(angle) * radius);
  }

  const material = createInstancedMaterial();
  const mesh = buildInstancedMesh(builder, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.name = 'static-city';
  scene.add(mesh);

  return { shelter, signalHeads };
}
