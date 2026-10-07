import * as THREE from 'three';

export interface VoxelBox {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color: number;
}

export class VoxelBuilder {
  readonly boxes: VoxelBox[] = [];

  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: number): void {
    this.boxes.push({ x, y, z, sx, sy, sz, color });
  }

  count(): number {
    return this.boxes.length;
  }
}

const cube = new THREE.BoxGeometry(1, 1, 1);
const cubePos = cube.getAttribute('position') as THREE.BufferAttribute;
const cubeNorm = cube.getAttribute('normal') as THREE.BufferAttribute;
const cubeIndex = cube.getIndex()!;
const VERTS = cubePos.count;
const INDICES = cubeIndex.count;

function writeColor(target: Float32Array, offset: number, color: THREE.Color): void {
  for (let v = 0; v < VERTS; v++) {
    target[offset + v * 3] = color.r;
    target[offset + v * 3 + 1] = color.g;
    target[offset + v * 3 + 2] = color.b;
  }
}

export function buildMergedGeometry(builder: VoxelBuilder): THREE.BufferGeometry {
  const boxes = builder.boxes;
  const n = boxes.length;
  const positions = new Float32Array(n * VERTS * 3);
  const normals = new Float32Array(n * VERTS * 3);
  const colors = new Float32Array(n * VERTS * 3);
  const indices = new Uint32Array(n * INDICES);
  const color = new THREE.Color();

  for (let b = 0; b < n; b++) {
    const box = boxes[b]!;
    const vOff = b * VERTS;
    const pOff = vOff * 3;
    for (let v = 0; v < VERTS; v++) {
      positions[pOff + v * 3] = cubePos.getX(v) * box.sx + box.x;
      positions[pOff + v * 3 + 1] = cubePos.getY(v) * box.sy + box.y;
      positions[pOff + v * 3 + 2] = cubePos.getZ(v) * box.sz + box.z;
      normals[pOff + v * 3] = cubeNorm.getX(v);
      normals[pOff + v * 3 + 1] = cubeNorm.getY(v);
      normals[pOff + v * 3 + 2] = cubeNorm.getZ(v);
    }
    color.setHex(box.color);
    writeColor(colors, pOff, color);
    const iOff = b * INDICES;
    for (let i = 0; i < INDICES; i++) {
      indices[iOff + i] = vOff + cubeIndex.getX(i);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

export function buildInstancedMesh(builder: VoxelBuilder, material: THREE.Material): THREE.InstancedMesh {
  const boxes = builder.boxes;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, boxes.length);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i]!;
    dummy.position.set(box.x, box.y, box.z);
    dummy.scale.set(box.sx, box.sy, box.sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color.setHex(box.color);
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

export function createVoxelMaterial(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ vertexColors: true });
}

export function createInstancedMaterial(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial();
}
