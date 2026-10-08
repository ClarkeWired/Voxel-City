import * as THREE from 'three';
import { Rng } from '../core/rng';
import { VoxelBuilder, buildInstancedMesh, createInstancedMaterial } from '../core/voxel';
import {
  BLOCK,
  CITY_HALF,
  GRID_N,
  LANE_OFFSET,
  PITCH,
  ROAD,
  ROAD_HALF,
  blockCenter,
  roadCenter,
} from './grid';
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
import { ARRIVE_HEADING, armConnects, leftVector, type Arm, ARMS } from '../traffic/graph';
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

function armPlacement(xc: number, zc: number, arm: Arm): ArmPlacement {
  const h = ARRIVE_HEADING[arm];
  const l = leftVector(h);
  return {
    laneX: xc + l.x * LANE_OFFSET - h.x * STOP_DIST,
    laneZ: zc + l.z * LANE_OFFSET - h.z * STOP_DIST,
    poleX: xc + l.x * (ROAD_HALF + 0.5) - h.x * STOP_DIST,
    poleZ: zc + l.z * (ROAD_HALF + 0.5) - h.z * STOP_DIST,
  };
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
  buildBuildings(builder, rng, nightBuilder, nightRng, blockers);

  const signalHeads: SignalHead[] = [];
  for (let i = 0; i <= GRID_N; i++) {
    for (let j = 0; j <= GRID_N; j++) {
      const xc = roadCenter(i);
      const zc = roadCenter(j);
      const intersectionId = `${i}:${j}`;
      for (const arm of ARMS) {
        if (!armConnects(i, j, arm)) continue;
        const p = armPlacement(xc, zc, arm);
        signalHeads.push(buildTrafficLight(builder, intersectionId, i, j, arm, p.laneX, p.laneZ, p.poleX, p.poleZ));
        blockers.addCircle(`light-pole:${intersectionId}:${arm}`, p.poleX, p.poleZ, 0.25);
      }
    }
  }

  const shelterKey = ((): string | null => {
    const bi = Math.round((SHELTER_X + CITY_HALF - ROAD - BLOCK / 2) / PITCH);
    const bj = Math.round((SHELTER_Z + CITY_HALF - ROAD - BLOCK / 2) / PITCH);
    if (bi < 0 || bi >= GRID_N || bj < 0 || bj >= GRID_N) return null;
    const dx = SHELTER_X - blockCenter(bi);
    const dz = SHELTER_Z - blockCenter(bj);
    if (Math.abs(dx) > Math.abs(dz)) return `${bi}:${bj}:${dx > 0 ? 'E' : 'W'}`;
    return `${bi}:${bj}:${dz > 0 ? 'S' : 'N'}`;
  })();

  const sides = [
    { name: 'N', nx: 0, nz: -1, tx: 1, tz: 0 },
    { name: 'E', nx: 1, nz: 0, tx: 0, tz: -1 },
    { name: 'S', nx: 0, nz: 1, tx: 1, tz: 0 },
    { name: 'W', nx: -1, nz: 0, tx: 0, tz: 1 },
  ];

  for (let bi = 0; bi < GRID_N; bi++) {
    for (let bj = 0; bj < GRID_N; bj++) {
      const bx = blockCenter(bi);
      const bz = blockCenter(bj);

      for (const side of sides) {
        const shelterSide = `${bi}:${bj}:${side.name}` === shelterKey;
        const at = (depth: number, u: number): { x: number; z: number } => ({
          x: bx + side.nx * depth + side.tx * u,
          z: bz + side.nz * depth + side.tz * u,
        });

        const lampU = rng.range(-5.5, 5.5);
        const lamp = at(8.75, lampU);
        buildStreetLamp(builder, lamp.x, lamp.z, side.nx, side.nz, nightBuilder);
        blockers.addCircle(`lamp:${bi}:${bj}`, lamp.x, lamp.z, 0.2);

        if (!shelterSide) {
          const treeCount = rng.int(2, 3);
          for (let t = 0; t < treeCount; t++) {
            const u = rng.range(-6.5, 6.5);
            const p = at(8.6, u);
            buildTree(builder, rng, p.x, p.z);
            blockers.addCircle(`tree:${bi}:${bj}:${t}`, p.x, p.z, 0.35);
          }
        }
        if (rng.chance(0.7)) {
          const u = rng.range(-6.5, 6.5);
          const p = at(8.6, u);
          buildBench(builder, p.x, p.z, Math.abs(side.tx) > 0);
          if (Math.abs(side.tx) > 0) {
            blockers.add(`bench:${bi}:${bj}`, p.x - 1.0, p.x + 1.0, p.z - 0.3, p.z + 0.3);
          } else {
            blockers.add(`bench:${bi}:${bj}`, p.x - 0.3, p.x + 0.3, p.z - 1.0, p.z + 1.0);
          }
        }
        if (rng.chance(0.6)) {
          const u = rng.range(-6.5, 6.5);
          const p = at(8.65, u);
          buildTrashCan(builder, p.x, p.z);
          blockers.addCircle(`bin:${bi}:${bj}`, p.x, p.z, 0.35);
        }
        if (rng.chance(0.4)) {
          const u = rng.range(-6.5, 6.5);
          const p = at(8.6, u);
          buildPlanter(builder, rng, p.x, p.z);
          blockers.add(`planter:${bi}:${bj}`, p.x - 0.35, p.x + 0.35, p.z - 0.35, p.z + 0.35);
        }
        if (rng.chance(0.3)) {
          const u = rng.range(-6.5, 6.5);
          const p = at(8.7, u);
          buildHydrant(builder, p.x, p.z);
          blockers.addCircle(`hydrant:${bi}:${bj}`, p.x, p.z, 0.3);
        }
      }
    }
  }

  const shelter = buildShelter(builder, SHELTER_X, SHELTER_Z, false);
  blockers.add('shelter', SHELTER_X - 2.2, SHELTER_X + 2.2, SHELTER_Z - 1.0, SHELTER_Z + 0.4);

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

