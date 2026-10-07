import * as THREE from 'three';
import { palette } from '../core/palette';
import type { Rng } from '../core/rng';
import { VoxelBuilder, buildMergedGeometry, createVoxelMaterial } from '../core/voxel';

export interface PersonRig {
  group: THREE.Group;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
}

const bodyMaterial = createVoxelMaterial();

function bodyGeometry(skin: number, shirt: number, hair: number): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  b.box(0, 1.04, 0, 0.6, 0.64, 0.36, shirt);
  b.box(-0.39, 1.06, 0, 0.18, 0.56, 0.28, shirt);
  b.box(0.39, 1.06, 0, 0.18, 0.56, 0.28, shirt);
  b.box(0, 1.56, 0, 0.42, 0.4, 0.42, skin);
  b.box(0, 1.79, 0, 0.46, 0.16, 0.46, hair);
  b.box(0, 1.6, -0.2, 0.46, 0.34, 0.1, hair);
  b.box(-0.1, 1.58, 0.22, 0.07, 0.08, 0.05, 0x22252a);
  b.box(0.1, 1.58, 0.22, 0.07, 0.08, 0.05, 0x22252a);
  return buildMergedGeometry(b);
}

function legGeometry(pants: number): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  b.box(0, -0.36, 0, 0.26, 0.72, 0.3, pants);
  b.box(0, -0.64, 0.05, 0.3, 0.16, 0.4, palette.carTire);
  return buildMergedGeometry(b);
}

const bodyCache = new Map<string, THREE.BufferGeometry>();
const legCache = new Map<number, THREE.BufferGeometry>();

function cachedBody(skin: number, shirt: number, hair: number): THREE.BufferGeometry {
  const key = `${skin}:${shirt}:${hair}`;
  let geometry = bodyCache.get(key);
  if (!geometry) {
    geometry = bodyGeometry(skin, shirt, hair);
    bodyCache.set(key, geometry);
  }
  return geometry;
}

function cachedLeg(pants: number): THREE.BufferGeometry {
  let geometry = legCache.get(pants);
  if (!geometry) {
    geometry = legGeometry(pants);
    legCache.set(pants, geometry);
  }
  return geometry;
}

export function createPersonRig(rng: Rng): PersonRig {
  const skin = rng.pick(palette.skin);
  const shirt = rng.pick(palette.shirt);
  const pants = rng.pick(palette.pants);
  const hair = rng.pick(palette.hair);
  const group = new THREE.Group();

  const body = new THREE.Mesh(cachedBody(skin, shirt, hair), bodyMaterial);
  body.castShadow = true;
  group.add(body);

  const legGeom = cachedLeg(pants);
  const legL = new THREE.Mesh(legGeom, bodyMaterial);
  legL.castShadow = true;
  legL.position.set(-0.17, 0.72, 0);
  const legR = new THREE.Mesh(legGeom, bodyMaterial);
  legR.castShadow = true;
  legR.position.set(0.17, 0.72, 0);
  group.add(legL, legR);

  return { group, legL, legR };
}

export function animateRig(rig: PersonRig, phase: number, moving: boolean): number {
  if (moving) {
    rig.legL.rotation.x = Math.sin(phase) * 0.55;
    rig.legR.rotation.x = -Math.sin(phase) * 0.55;
    return Math.abs(Math.sin(phase)) * 0.05;
  }
  rig.legL.rotation.x *= 0.85;
  rig.legR.rotation.x *= 0.85;
  return Math.sin(phase * 0.35) * 0.015;
}
