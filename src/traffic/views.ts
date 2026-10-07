import * as THREE from 'three';
import { palette } from '../core/palette';
import { VoxelBuilder, buildMergedGeometry, createVoxelMaterial } from '../core/voxel';

export type VehicleKind = 'bus' | 'sedan' | 'van';

interface WheelSpec {
  radius: number;
  width: number;
  positionsX: number[];
  track: number;
  y: number;
}

const WHEELS: Record<VehicleKind, WheelSpec> = {
  bus: { radius: 0.5, width: 0.36, positionsX: [-2.9, 2.9], track: 1.22, y: 0.5 },
  sedan: { radius: 0.4, width: 0.3, positionsX: [-1.45, 1.45], track: 0.95, y: 0.4 },
  van: { radius: 0.44, width: 0.32, positionsX: [-1.5, 1.5], track: 1.0, y: 0.44 },
};

function busBuilder(): VoxelBuilder {
  const b = new VoxelBuilder();
  b.box(0, 0.95, 0, 8.6, 1.0, 2.5, palette.busYellow);
  b.box(0, 0.55, 0, 8.6, 0.3, 2.5, palette.busYellowDark);
  b.box(0, 2.22, 0, 8.3, 0.85, 2.42, palette.carGlass);
  for (const x of [-3.8, -1.9, 0, 1.9, 3.6]) {
    b.box(x, 2.22, 0, 0.3, 0.9, 2.56, palette.busYellow);
  }
  b.box(4.22, 2.2, 0, 0.18, 0.95, 2.3, palette.carGlass);
  b.box(0, 2.84, 0, 8.62, 0.4, 2.52, palette.busWhite);
  b.box(-1.6, 3.08, 0, 1.8, 0.12, 1.1, palette.carGray);
  b.box(1.6, 3.08, 0, 1.8, 0.12, 1.1, palette.carGray);
  b.box(4.32, 0.82, 0, 0.4, 0.5, 2.4, palette.busBumper);
  b.box(-4.32, 0.82, 0, 0.4, 0.5, 2.4, palette.busBumper);
  b.box(4.36, 1.25, 0.85, 0.14, 0.34, 0.55, palette.lampWhite);
  b.box(4.36, 1.25, -0.85, 0.14, 0.34, 0.55, palette.lampWhite);
  b.box(-4.36, 1.25, 0.85, 0.14, 0.34, 0.55, palette.awningRed);
  b.box(-4.36, 1.25, -0.85, 0.14, 0.34, 0.55, palette.awningRed);
  b.box(2.5, 1.62, 1.27, 1.15, 1.9, 0.1, palette.busBumper);
  b.box(2.5, 2.2, 1.3, 1.0, 0.7, 0.08, palette.carGlass);
  b.box(-3.1, 1.62, 1.27, 1.15, 1.9, 0.1, palette.busBumper);
  b.box(4.45, 2.75, 0, 0.12, 0.25, 2.2, palette.busYellowDark);
  return b;
}

function sedanBuilder(color: number): VoxelBuilder {
  const b = new VoxelBuilder();
  b.box(0, 0.85, 0, 4.3, 0.7, 1.85, color);
  b.box(-0.15, 1.42, 0, 2.3, 0.5, 1.68, palette.carGlass);
  b.box(-0.15, 1.72, 0, 1.85, 0.14, 1.58, color);
  b.box(2.2, 0.8, 0, 0.22, 0.4, 1.7, palette.carTire);
  b.box(-2.2, 0.8, 0, 0.22, 0.4, 1.7, palette.carTire);
  b.box(2.18, 1.0, 0.6, 0.12, 0.2, 0.42, palette.lampWhite);
  b.box(2.18, 1.0, -0.6, 0.12, 0.2, 0.42, palette.lampWhite);
  b.box(-2.18, 1.0, 0.6, 0.12, 0.2, 0.42, palette.awningRed);
  b.box(-2.18, 1.0, -0.6, 0.12, 0.2, 0.42, palette.awningRed);
  return b;
}

function vanBuilder(color: number): VoxelBuilder {
  const b = new VoxelBuilder();
  b.box(-0.2, 1.15, 0, 4.2, 1.3, 1.9, color);
  b.box(2.05, 1.3, 0, 0.25, 0.9, 1.75, palette.carGlass);
  b.box(-0.4, 1.55, 0.96, 1.6, 0.6, 0.08, palette.carGlass);
  b.box(-0.4, 1.55, -0.96, 1.6, 0.6, 0.08, palette.carGlass);
  b.box(-0.2, 1.85, 0, 4.24, 0.2, 1.94, color);
  b.box(2.35, 0.75, 0, 0.25, 0.42, 1.75, palette.carTire);
  b.box(-2.35, 0.75, 0, 0.25, 0.42, 1.75, palette.carTire);
  b.box(2.32, 0.95, 0.62, 0.12, 0.2, 0.4, palette.lampWhite);
  b.box(2.32, 0.95, -0.62, 0.12, 0.2, 0.4, palette.lampWhite);
  b.box(-2.32, 0.95, 0.62, 0.12, 0.2, 0.4, palette.awningRed);
  b.box(-2.32, 0.95, -0.62, 0.12, 0.2, 0.4, palette.awningRed);
  return b;
}

function builderFor(kind: VehicleKind, color: number): VoxelBuilder {
  switch (kind) {
    case 'bus':
      return busBuilder();
    case 'sedan':
      return sedanBuilder(color);
    case 'van':
      return vanBuilder(color);
  }
}

export class VehicleView {
  readonly group = new THREE.Group();
  private readonly wheelL: THREE.Mesh;
  private readonly wheelR: THREE.Mesh;
  private readonly radius: number;
  private spin = 0;

  constructor(kind: VehicleKind, color: number, bodyMaterial: THREE.Material, wheelMaterial: THREE.Material) {
    const body = new THREE.Mesh(builderGeometry(kind, color), bodyMaterial);
    body.castShadow = true;
    this.group.add(body);

    const spec = WHEELS[kind];
    const wheelGeom = wheelSetGeometry(kind);
    this.wheelL = new THREE.Mesh(wheelGeom, wheelMaterial);
    this.wheelL.position.set(0, spec.y, spec.track);
    this.wheelL.castShadow = true;
    this.wheelR = new THREE.Mesh(wheelGeom, wheelMaterial);
    this.wheelR.position.set(0, spec.y, -spec.track);
    this.wheelR.castShadow = true;
    this.group.add(this.wheelL, this.wheelR);
    this.radius = spec.radius;
  }

  static material(): THREE.MeshLambertMaterial {
    return createVoxelMaterial();
  }

  update(x: number, z: number, yaw: number, speed: number, dt: number): void {
    this.group.position.set(x, 0, z);
    this.group.rotation.y = yaw;
    this.spin -= (speed * dt) / this.radius;
    this.wheelL.rotation.z = this.spin;
    this.wheelR.rotation.z = this.spin;
  }
}

const bodyCache = new Map<string, THREE.BufferGeometry>();
const wheelCache = new Map<VehicleKind, THREE.BufferGeometry>();

function builderGeometry(kind: VehicleKind, color: number): THREE.BufferGeometry {
  const key = `${kind}:${color}`;
  let geometry = bodyCache.get(key);
  if (!geometry) {
    geometry = buildMergedGeometry(builderFor(kind, color));
    bodyCache.set(key, geometry);
  }
  return geometry;
}

function wheelSetGeometry(kind: VehicleKind): THREE.BufferGeometry {
  let geometry = wheelCache.get(kind);
  if (!geometry) {
    const spec = WHEELS[kind];
    const parts: THREE.BufferGeometry[] = [];
    for (const x of spec.positionsX) {
      const cylinder = new THREE.CylinderGeometry(spec.radius, spec.radius, spec.width, 10);
      cylinder.rotateX(Math.PI / 2);
      cylinder.translate(x, 0, 0);
      parts.push(cylinder);
    }
    geometry = mergeCylinders(parts);
    wheelCache.set(kind, geometry);
  }
  return geometry;
}

function mergeCylinders(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let vertexCount = 0;
  let indexCount = 0;
  for (const part of parts) {
    vertexCount += part.getAttribute('position').count;
    indexCount += part.getIndex()!.count;
  }
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(indexCount);
  let vOff = 0;
  let iOff = 0;
  for (const part of parts) {
    const pos = part.getAttribute('position');
    const norm = part.getAttribute('normal');
    const index = part.getIndex()!;
    for (let i = 0; i < pos.count; i++) {
      positions[(vOff + i) * 3] = pos.getX(i);
      positions[(vOff + i) * 3 + 1] = pos.getY(i);
      positions[(vOff + i) * 3 + 2] = pos.getZ(i);
      normals[(vOff + i) * 3] = norm.getX(i);
      normals[(vOff + i) * 3 + 1] = norm.getY(i);
      normals[(vOff + i) * 3 + 2] = norm.getZ(i);
    }
    for (let i = 0; i < index.count; i++) {
      indices[iOff + i] = vOff + index.getX(i);
    }
    vOff += pos.count;
    iOff += index.count;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

export const CAR_COLORS: readonly number[] = [
  palette.carRed,
  palette.carBlue,
  palette.carYellow,
  palette.carGray,
  palette.carGreen,
  palette.carWhite,
];
