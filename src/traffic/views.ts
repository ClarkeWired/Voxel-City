import * as THREE from 'three';
import { palette } from '../core/palette';
import { VoxelBuilder, buildMergedGeometry, createVoxelMaterial } from '../core/voxel';

export type VehicleKind = 'bus' | 'sedan' | 'van';

interface WheelSpec {
  radius: number;
  width: number;
  hubWidth: number;
  positionsX: number[];
  track: number;
  y: number;
}

const WHEELS: Record<VehicleKind, WheelSpec> = {
  bus: { radius: 0.47, width: 0.3, hubWidth: 0.34, positionsX: [3.1, -2.6], track: 1.05, y: 0.47 },
  sedan: { radius: 0.34, width: 0.26, hubWidth: 0.3, positionsX: [1.35, -1.3], track: 0.79, y: 0.34 },
  van: { radius: 0.36, width: 0.28, hubWidth: 0.32, positionsX: [1.42, -1.42], track: 0.8, y: 0.36 },
};

const TRIM = palette.busBumper;
const RIM = palette.carGray;

function sedanBuilder(color: number): VoxelBuilder {
  const b = new VoxelBuilder();
  b.box(0, 0.45, 0, 4.12, 0.66, 1.22, palette.carTire);
  b.box(0.025, 0.56, 0, 1.81, 0.44, 1.9, color);
  b.box(1.935, 0.56, 0, 0.33, 0.44, 1.9, color);
  b.box(-1.91, 0.56, 0, 0.38, 0.44, 1.9, color);
  b.box(0, 0.92, 0, 4.2, 0.28, 1.9, color);
  b.box(-0.14, 1.27, 0, 2.2, 0.42, 1.56, color);
  b.box(0.45, 1.28, 0.795, 0.78, 0.28, 0.05, palette.carGlass);
  b.box(0.45, 1.28, -0.795, 0.78, 0.28, 0.05, palette.carGlass);
  b.box(-0.58, 1.28, 0.795, 1.12, 0.28, 0.05, palette.carGlass);
  b.box(-0.58, 1.28, -0.795, 1.12, 0.28, 0.05, palette.carGlass);
  b.box(0.99, 1.28, 0, 0.06, 0.32, 1.48, palette.carGlass);
  b.box(-1.27, 1.27, 0, 0.06, 0.3, 1.48, palette.carGlass);
  b.box(0.92, 1.15, 0.85, 0.16, 0.1, 0.18, TRIM);
  b.box(0.92, 1.15, -0.85, 0.16, 0.1, 0.18, TRIM);
  b.box(2.13, 0.57, 0, 0.14, 0.26, 1.76, TRIM);
  b.box(-2.13, 0.57, 0, 0.14, 0.26, 1.76, TRIM);
  b.box(2.13, 0.9, 0.62, 0.06, 0.16, 0.34, palette.lampWhite);
  b.box(2.13, 0.9, -0.62, 0.06, 0.16, 0.34, palette.lampWhite);
  b.box(-2.13, 0.91, 0.63, 0.06, 0.18, 0.34, palette.awningRed);
  b.box(-2.13, 0.91, -0.63, 0.06, 0.18, 0.34, palette.awningRed);
  b.box(2.125, 0.9, 0, 0.05, 0.16, 0.76, TRIM);
  return b;
}

function vanBuilder(color: number, emergency: boolean): VoxelBuilder {
  const b = new VoxelBuilder();
  b.box(0, 0.47, 0, 4.12, 0.78, 1.2, palette.carTire);
  b.box(0, 0.61, 0, 1.96, 0.5, 1.94, color);
  b.box(1.98, 0.61, 0, 0.24, 0.5, 1.94, color);
  b.box(-1.98, 0.61, 0, 0.24, 0.5, 1.94, color);
  b.box(1.725, 1.08, 0, 0.75, 0.44, 1.94, color);
  b.box(-0.375, 1.41, 0, 3.45, 1.1, 1.94, color);
  b.box(1.385, 1.55, 0, 0.07, 0.5, 1.76, palette.carGlass);
  b.box(0.825, 1.56, 0.99, 0.55, 0.44, 0.06, palette.carGlass);
  b.box(0.825, 1.56, -0.99, 0.55, 0.44, 0.06, palette.carGlass);
  b.box(-2.13, 1.56, 0, 0.06, 0.44, 1.6, palette.carGlass);
  b.box(1.235, 1.46, 0.995, 0.15, 0.12, 0.06, TRIM);
  b.box(1.235, 1.46, -0.995, 0.15, 0.12, 0.06, TRIM);
  b.box(2.13, 0.57, 0, 0.14, 0.3, 1.8, TRIM);
  b.box(-2.13, 0.57, 0, 0.14, 0.3, 1.8, TRIM);
  b.box(2.135, 1.07, 0.67, 0.07, 0.22, 0.36, palette.lampWhite);
  b.box(2.135, 1.07, -0.67, 0.07, 0.22, 0.36, palette.lampWhite);
  b.box(2.13, 1.07, 0, 0.06, 0.22, 0.8, TRIM);
  b.box(-2.13, 1.15, 0.74, 0.06, 0.4, 0.34, palette.awningRed);
  b.box(-2.13, 1.15, -0.74, 0.06, 0.4, 0.34, palette.awningRed);
  if (emergency) {
    b.box(0, 1.02, 1, 4.2, 0.22, 0.06, palette.awningRed);
    b.box(0, 1.02, -1, 4.2, 0.22, 0.06, palette.awningRed);
    b.box(0, 1.24, 1, 4.2, 0.14, 0.06, palette.carBlue);
    b.box(0, 1.24, -1, 4.2, 0.14, 0.06, palette.carBlue);
  }
  return b;
}

function busBuilder(): VoxelBuilder {
  const b = new VoxelBuilder();
  b.box(0, 0.58, 0, 8.48, 0.88, 1.68, palette.carTire);
  b.box(0.25, 0.72, 0, 4.6, 0.6, 2.5, palette.busYellowDark);
  b.box(3.975, 0.72, 0, 0.65, 0.6, 2.5, palette.busYellowDark);
  b.box(-3.725, 0.72, 0, 1.15, 0.6, 2.5, palette.busYellowDark);
  b.box(0, 1.77, 0, 8.6, 1.5, 2.5, palette.busYellow);
  b.box(0, 2.59, 0, 8.52, 0.14, 2.42, palette.busWhite);
  for (let i = 0; i < 6; i++) {
    const pane = 1.0667;
    const x = -4 + i * (pane + 0.26);
    b.box(x + pane / 2, 1.75, 1.275, pane, 0.82, 0.05, palette.carGlass);
    b.box(x + pane / 2, 1.75, -1.275, pane, 0.82, 0.05, palette.carGlass);
  }
  b.box(4.335, 1.8, 0, 0.07, 1, 2.28, palette.carGlass);
  b.box(4.335, 2.42, 0, 0.07, 0.16, 1.6, palette.signBoard);
  b.box(-4.335, 1.85, 0, 0.07, 0.7, 2, palette.carGlass);
  b.box(4.3, 0.71, 0, 0.12, 0.42, 2.6, TRIM);
  b.box(-4.3, 0.71, 0, 0.12, 0.42, 2.6, TRIM);
  b.box(4.335, 1.15, 0.76, 0.07, 0.18, 0.36, palette.lampWhite);
  b.box(4.335, 1.15, -0.76, 0.07, 0.18, 0.36, palette.lampWhite);
  b.box(-4.335, 1.25, 1.04, 0.07, 0.38, 0.3, palette.awningRed);
  b.box(-4.335, 1.25, -1.04, 0.07, 0.38, 0.3, palette.awningRed);
  b.box(4.125, 1.78, 1.28, 0.15, 0.16, 0.1, TRIM);
  b.box(4.125, 1.78, -1.28, 0.15, 0.16, 0.1, TRIM);
  b.box(0, 2.73, 0, 2.6, 0.14, 1.1, RIM);
  return b;
}

function builderFor(kind: VehicleKind, color: number, emergency: boolean): VoxelBuilder {
  switch (kind) {
    case 'bus':
      return busBuilder();
    case 'sedan':
      return sedanBuilder(color);
    case 'van':
      return vanBuilder(color, emergency);
  }
}

export class VehicleView {
  readonly group = new THREE.Group();
  private readonly wheelL: THREE.Mesh;
  private readonly wheelR: THREE.Mesh;
  private readonly radius: number;
  private spin = 0;

  constructor(
    kind: VehicleKind,
    color: number,
    bodyMaterial: THREE.Material,
    wheelMaterial: THREE.Material,
    emergency = false,
  ) {
    const body = new THREE.Mesh(builderGeometry(kind, color, emergency), bodyMaterial);
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

function builderGeometry(kind: VehicleKind, color: number, emergency: boolean): THREE.BufferGeometry {
  const key = `${kind}:${color}:${emergency ? 'e' : 'p'}`;
  let geometry = bodyCache.get(key);
  if (!geometry) {
    geometry = buildMergedGeometry(builderFor(kind, color, emergency));
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
      const tire = new THREE.CylinderGeometry(spec.radius, spec.radius, spec.width, 12);
      tire.rotateX(Math.PI / 2);
      tire.translate(x, 0, 0);
      parts.push(tint(tire, palette.carTire));
      const hub = new THREE.CylinderGeometry(spec.radius * 0.56, spec.radius * 0.56, spec.hubWidth, 10);
      hub.rotateX(Math.PI / 2);
      hub.translate(x, 0, 0);
      parts.push(tint(hub, RIM));
    }
    geometry = mergeCylinders(parts);
    wheelCache.set(kind, geometry);
  }
  return geometry;
}

function tint(geometry: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const count = geometry.getAttribute('position').count;
  const values = new Float32Array(count * 3);
  const c = new THREE.Color().setHex(color);
  for (let v = 0; v < count; v++) {
    values[v * 3] = c.r;
    values[v * 3 + 1] = c.g;
    values[v * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
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
  const colors = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(indexCount);
  let vOff = 0;
  let iOff = 0;
  for (const part of parts) {
    const pos = part.getAttribute('position');
    const norm = part.getAttribute('normal');
    const col = part.getAttribute('color');
    const index = part.getIndex()!;
    for (let i = 0; i < pos.count; i++) {
      positions[(vOff + i) * 3] = pos.getX(i);
      positions[(vOff + i) * 3 + 1] = pos.getY(i);
      positions[(vOff + i) * 3 + 2] = pos.getZ(i);
      normals[(vOff + i) * 3] = norm.getX(i);
      normals[(vOff + i) * 3 + 1] = norm.getY(i);
      normals[(vOff + i) * 3 + 2] = norm.getZ(i);
      colors[(vOff + i) * 3] = col!.getX(i);
      colors[(vOff + i) * 3 + 1] = col!.getY(i);
      colors[(vOff + i) * 3 + 2] = col!.getZ(i);
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
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
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
