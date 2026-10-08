import * as THREE from 'three';
import { Rng } from '../core/rng';
import { VoxelBuilder, buildInstancedMesh, createInstancedMaterial } from '../core/voxel';
import { GRID_N, LANE_OFFSET, ROAD_HALF, blockCenter, roadCenter } from './grid';
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
import { SpatialBlocker } from '../world/obstacles';

export const SHELTER_X = 0;
export const SHELTER_Z = -16.9;

const STOP_DIST = 5.65;

interface ArmPlacement {
  laneX: number;
  laneZ: number;
  poleX: number;
  poleZ: number;
}

function armPlacement(xc: number, zc: number, arm: Arm, _i: number, _j: number): ArmPlacement {
  switch (arm) {
    case 'N':
      return {
        laneX: xc - LANE_OFFSET,
        laneZ: zc - STOP_DIST,
        poleX: xc - ROAD_HALF - 0.5,
        poleZ: zc - STOP_DIST,
      };
    case 'S':
      return {
        laneX: xc + LANE_OFFSET,
        laneZ: zc + STOP_DIST,
        poleX: xc + ROAD_HALF + 0.5,
        poleZ: zc + STOP_DIST,
      };
    case 'E':
      return {
        laneX: xc + STOP_DIST,
        laneZ: zc + LANE_OFFSET,
        poleX: xc + STOP_DIST,
        poleZ: zc + ROAD_HALF + 0.5,
      };
    case 'W':
      return {
        laneX: xc - STOP_DIST,
        laneZ: zc - LANE_OFFSET,
        poleX: xc - STOP_DIST,
        poleZ: zc - ROAD_HALF - 0.5,
      };
  }
}

export interface CityBuild {
  shelter: ShelterBuild;
  signalHeads: SignalHead[];
  nightMesh: THREE.InstancedMesh | null;
  blockers: SpatialBlocker;
}

export function buildCity(scene: THREE.Scene, rng: Rng): CityBuild {
  const builder = new VoxelBuilder();
  const nightBuilder = new VoxelBuilder();
  const nightRng = new Rng(0x9e3779b9);
  const blockers = new SpatialBlocker();

  buildRoads(builder, rng);
  buildBuildings(builder, rng, nightBuilder, nightRng);

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
      const edge = 12;

      for (const side of [
        { nx: 0, nz: -1, tx: 1, tz: 0 },
        { nx: 1, nz: 0, tx: 0, tz: -1 },
        { nx: 0, nz: 1, tx: 1, tz: 0 },
        { nx: -1, nz: 0, tx: 0, tz: 1 },
      ]) {
        const cx = bx + side.nx * edge;
        const cz = bz + side.nz * edge;
        const shelterSide = bi === 2 && bj === 3 && side.nx === 0 && side.nz === -1;
        const uAt = (u: number): number =>
          shelterSide && Math.abs(u - SHELTER_X) < 4 ? SHELTER_X + (u >= SHELTER_X ? 4 : -4) : u;
        const lampU = uAt(rng.range(-5.5, 5.5));
        buildStreetLamp(
          builder,
          cx + side.tx * lampU - side.nx * 0.7,
          cz + side.tz * lampU - side.nz * 0.7,
          side.nx,
          side.nz,
          nightBuilder,
        );
        const treeCount = shelterSide ? 0 : rng.int(2, 3);
        for (let t = 0; t < treeCount; t++) {
          const u = uAt(rng.range(-9, 9));
          const tx = cx + side.tx * u - side.nx * 2.1;
          const tz = cz + side.tz * u - side.nz * 2.1;
          buildTree(builder, rng, tx, tz);
          blockers.addCircle(`tree:${bi}:${bj}:${t}`, tx, tz, 0.8);
        }
        if (rng.chance(0.7)) {
          const u = uAt(rng.range(-8, 8));
          const bx2 = cx + side.tx * u - side.nx * 1.6;
          const bz2 = cz + side.tz * u - side.nz * 1.6;
          buildBench(builder, bx2, bz2, Math.abs(side.tx) > 0);
          blockers.add(`bench:${bi}:${bj}`, bx2 - 1.0, bx2 + 1.0, bz2 - 0.3, bz2 + 0.3);
        }
        if (rng.chance(0.6)) {
          const u = uAt(rng.range(-8, 8));
          const tx = cx + side.tx * u - side.nx * 1.4;
          const tz = cz + side.tz * u - side.nz * 1.4;
          buildTrashCan(builder, tx, tz);
          blockers.addCircle(`bin:${bi}:${bj}`, tx, tz, 0.4);
        }
        if (rng.chance(0.4)) {
          const u = uAt(rng.range(-8, 8));
          const px = cx + side.tx * u - side.nx * 1.8;
          const pz = cz + side.tz * u - side.nz * 1.8;
          buildPlanter(builder, rng, px, pz);
          blockers.add(`planter:${bi}:${bj}`, px - 0.6, px + 0.6, pz - 0.6, pz + 0.6);
        }
        if (rng.chance(0.3)) {
          const u = uAt(rng.range(-8, 8));
          const hx = cx + side.tx * u - side.nx * 1.2;
          const hz = cz + side.tz * u - side.nz * 1.2;
          buildHydrant(builder, hx, hz);
          blockers.addCircle(`hydrant:${bi}:${bj}`, hx, hz, 0.3);
        }
      }
    }
  }

  const shelter = buildShelter(builder, SHELTER_X, SHELTER_Z, true);
  blockers.add('shelter', SHELTER_X - 2.2, SHELTER_X + 2.2, SHELTER_Z - 1.0, SHELTER_Z + 1.0);

  for (let r = 0; r < 14; r++) {
    const angle = (r / 14) * Math.PI * 2;
    const radius = 72 + rng.range(0, 8);
    buildTree(builder, rng, Math.cos(angle) * radius, Math.sin(angle) * radius);
    blockers.addCircle(`outer-tree:${r}`, Math.cos(angle) * radius, Math.sin(angle) * radius, 0.8);
  }

  const material = createInstancedMaterial();
  const mesh = buildInstancedMesh(builder, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.name = 'static-city';
  scene.add(mesh);

  let nightMesh: THREE.InstancedMesh | null = null;
  if (nightBuilder.count() > 0) {
    nightMesh = buildInstancedMesh(nightBuilder, new THREE.MeshBasicMaterial());
    nightMesh.frustumCulled = false;
    nightMesh.visible = false;
    nightMesh.name = 'night-city';
    scene.add(nightMesh);
  }

  return { shelter, signalHeads, nightMesh, blockers };
}
