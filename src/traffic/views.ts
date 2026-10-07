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

export const WHEELS: Record<VehicleKind, WheelSpec> = {
  bus: { radius: 0.42, width: 0.26, hubWidth: 0.3, positionsX: [2.6, -2.2], track: 0.95, y: 0.42 },
  sedan: { radius: 0.325, width: 0.22, hubWidth: 0.26, positionsX: [1.3, -1.25], track: 0.78, y: 0.325 },
  van: { radius: 0.34, width: 0.24, hubWidth: 0.28, positionsX: [1.35, -1.35], track: 0.79, y: 0.34 },
};

const TRIM = palette.busBumper;
const RIM = palette.carGray;

function sedanBuilder(color: number): VoxelBuilder {
  const b = new VoxelBuilder();
  b.box(0, 0.38, 0, 4.2, 0.55, 1.1, palette.carTire);
  b.box(0.02, 0.48, 0, 1.6, 0.38, 1.8, color);
  b.box(1.85, 0.48, 0, 0.28, 0.38, 1.8, color);
  b.box(-1.83, 0.48, 0, 0.32, 0.38, 1.8, color);
  b.box(0, 0.78, 0, 4.25, 0.22, 1.8, color);
  b.box(-0.12, 1.08, 0, 2.0, 0.36, 1.5, color);
  b.box(0.38, 1.09, 0.72, 0.68, 0.24, 0.04, palette.carGlass);
  b.box(0.38, 1.09, -0.72, 0.68, 0.24, 0.04, palette.carGlass);
  b.box(-0.52, 1.09, 0.72, 1.0, 0.24, 0.04, palette.carGlass);
  b.box(-0.52, 1.09, -0.72, 1.0, 0.24, 0.04, palette.carGlass);
  b.box(0.88, 1.09, 0, 0.05, 0.28, 1.35, palette.carGlass);
  b.box(-1.15, 1.08, 0, 0.05, 0.26, 1.35, palette.carGlass);
  b.box(0.82, 0.98, 0.78, 0.14, 0.08, 0.16, TRIM);
  b.box(0.82, 0.98, -0.78, 0.14, 0.08, 0.16, TRIM);
  b.box(2.0, 0.48, 0, 0.12, 0.22, 1.65, TRIM);
  b.box(-2.0, 0.48, 0, 0.12, 0.22, 1.65, TRIM);
  b.box(2.0, 0.78, 0.55, 0.05, 0.14, 0.3, palette.lampWhite);
  b.box(2.0, 0.78, -0.55, 0.05, 0.14, 0.3, palette.lampWhite);
  b.box(-2.0, 0.79, 0.56, 0.05, 0.16, 0.3, palette.awningRed);
  b.box(-2.0, 0.79, -0.56, 0.05, 0.16, 0.3, palette.awningRed);
  b.box(1.995, 0.78, 0, 0.04, 0.14, 0.68, TRIM);
  b.box(0.55, 1.32, 0, 0.9, 0.06, 1.45, palette.carGlass);
  b.box(-0.75, 1.32, 0, 0.7, 0.06, 1.45, palette.carGlass);
  b.box(1.15, 0.65, 0.82, 0.35, 0.12, 0.04, color);
  b.box(1.15, 0.65, -0.82, 0.35, 0.12, 0.04, color);
  b.box(-1.15, 0.65, 0.82, 0.35, 0.12, 0.04, color);
  b.box(-1.15, 0.65, -0.82, 0.35, 0.12, 0.04, color);
  b.box(2.01, 0.62, 0.45, 0.02, 0.1, 0.22, 0xf5f0e6);
  b.box(2.01, 0.62, -0.45, 0.02, 0.1, 0.22, 0xf5f0e6);
  b.box(-2.01, 0.62, 0.45, 0.02, 0.1, 0.22, 0xf5f0e6);
  b.box(-2.01, 0.62, -0.45, 0.02, 0.1, 0.22, 0xf5f0e6);
  return b;
}

function vanBuilder(color: number, emergency: boolean): VoxelBuilder {
  const b = new VoxelBuilder();
  b.box(0, 0.4, 0, 4.2, 0.65, 1.1, palette.carTire);
  b.box(0, 0.52, 0, 1.8, 0.42, 1.85, color);
  b.box(1.82, 0.52, 0, 0.2, 0.42, 1.85, color);
  b.box(-1.82, 0.52, 0, 0.2, 0.42, 1.85, color);
  b.box(1.55, 0.92, 0, 0.65, 0.38, 1.85, color);
  b.box(-0.35, 1.2, 0, 3.2, 0.95, 1.85, color);
  b.box(1.22, 1.32, 0, 0.06, 0.42, 1.6, palette.carGlass);
  b.box(0.72, 1.33, 0.88, 0.48, 0.38, 0.05, palette.carGlass);
  b.box(0.72, 1.33, -0.88, 0.48, 0.38, 0.05, palette.carGlass);
  b.box(-1.95, 1.33, 0, 0.05, 0.38, 1.45, palette.carGlass);
  b.box(1.08, 1.18, 0.89, 0.12, 0.1, 0.05, TRIM);
  b.box(1.08, 1.18, -0.89, 0.12, 0.1, 0.05, TRIM);
  b.box(2.0, 0.48, 0, 0.12, 0.26, 1.7, TRIM);
  b.box(-2.0, 0.48, 0, 0.12, 0.26, 1.7, TRIM);
  b.box(2.005, 0.92, 0.6, 0.06, 0.18, 0.32, palette.lampWhite);
  b.box(2.005, 0.92, -0.6, 0.06, 0.18, 0.32, palette.lampWhite);
  b.box(2.0, 0.92, 0, 0.05, 0.18, 0.72, TRIM);
  b.box(-2.0, 1.0, 0.68, 0.05, 0.34, 0.3, palette.awningRed);
  b.box(-2.0, 1.0, -0.68, 0.05, 0.34, 0.3, palette.awningRed);
  if (emergency) {
    b.box(0, 0.88, 0.92, 4.2, 0.18, 0.05, palette.awningRed);
    b.box(0, 0.88, -0.92, 4.2, 0.18, 0.05, palette.awningRed);
    b.box(0, 1.08, 0.92, 4.2, 0.12, 0.05, palette.carBlue);
    b.box(0, 1.08, -0.92, 4.2, 0.12, 0.05, palette.carBlue);
  }
  return b;
}

function busBuilder(): VoxelBuilder {
  const b = new VoxelBuilder();
  b.box(0, 0.5, 0, 8.0, 0.75, 1.55, palette.carTire);
  b.box(0.2, 0.62, 0, 4.3, 0.5, 2.3, palette.busYellowDark);
  b.box(3.7, 0.62, 0, 0.55, 0.5, 2.3, palette.busYellowDark);
  b.box(-3.5, 0.62, 0, 1.0, 0.5, 2.3, palette.busYellowDark);
  b.box(0, 1.55, 0, 8.1, 1.3, 2.3, palette.busYellow);
  b.box(0, 2.25, 0, 8.05, 0.12, 2.25, palette.busWhite);
  for (let i = 0; i < 6; i++) {
    const pane = 0.95;
    const x = -3.7 + i * (pane + 0.22);
    b.box(x + pane / 2, 1.55, 1.16, pane, 0.7, 0.04, palette.carGlass);
    b.box(x + pane / 2, 1.55, -1.16, pane, 0.7, 0.04, palette.carGlass);
  }
  b.box(4.0, 1.6, 0, 0.06, 0.85, 2.1, palette.carGlass);
  b.box(4.0, 2.15, 0, 0.06, 0.14, 1.45, palette.signBoard);
  b.box(-4.0, 1.65, 0, 0.06, 0.6, 1.85, palette.carGlass);
  b.box(3.95, 0.6, 0, 0.1, 0.36, 2.4, TRIM);
  b.box(-3.95, 0.6, 0, 0.1, 0.36, 2.4, TRIM);
  b.box(4.0, 1.0, 0.68, 0.06, 0.16, 0.32, palette.lampWhite);
  b.box(4.0, 1.0, -0.68, 0.06, 0.16, 0.32, palette.lampWhite);
  b.box(-4.0, 1.1, 0.92, 0.06, 0.34, 0.28, palette.awningRed);
  b.box(-4.0, 1.1, -0.92, 0.06, 0.34, 0.28, palette.awningRed);
  b.box(3.8, 1.55, 1.17, 0.12, 0.14, 0.08, TRIM);
  b.box(3.8, 1.55, -1.17, 0.12, 0.14, 0.08, TRIM);
  b.box(0, 2.4, 0, 2.4, 0.12, 1.0, RIM);
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

  pose(x: number, z: number, yaw: number): void {
    this.group.position.set(x, 0, z);
    this.group.rotation.y = yaw;
  }

  advance(dt: number, speed: number): void {
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
