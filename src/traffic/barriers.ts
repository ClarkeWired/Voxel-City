import * as THREE from 'three';
import { palette } from '../core/palette';
import type { LaneGraph } from './graph';
import { isClosureActive, type RoadClosure } from '../world/closures';

const SEGMENTS = [-3.9, -2.6, -1.3, 0, 1.3, 2.6, 3.9];
const BARRIER_COLORS = [palette.awningRed, palette.awningWhite];

export class BarrierVisuals {
  private mesh: THREE.InstancedMesh | null = null;
  private key = '';

  update(scene: THREE.Scene, graph: LaneGraph, closures: readonly RoadClosure[], at: number): void {
    const active: string[] = [];
    for (const closure of closures) {
      if (isClosureActive(closure, at)) active.push(closure.edgeId);
    }
    const key = active.join(',');
    if (key === this.key) return;
    this.key = key;

    if (this.mesh) {
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = null;
    }
    if (active.length === 0) return;

    const placements: { x: number; z: number; rot: number; color: number }[] = [];
    for (const edgeId of active) {
      const edge = graph.edges.get(edgeId);
      if (!edge) continue;
      const tips = [edge.points[0]!, edge.points[edge.points.length - 1]!];
      for (const tip of tips) {
        const ahead = tip === edge.points[0] ? edge.points[1]! : edge.points[edge.points.length - 2]!;
        const dx = tip.x - ahead.x;
        const dz = tip.z - ahead.z;
        const len = Math.hypot(dx, dz) || 1;
        const ux = dx / len;
        const uz = dz / len;
        const px = -uz;
        const pz = ux;
        const rot = Math.atan2(-pz, px);
        SEGMENTS.forEach((offset, index) => {
          placements.push({
            x: tip.x + px * offset,
            z: tip.z + pz * offset,
            rot,
            color: BARRIER_COLORS[index % BARRIER_COLORS.length]!,
          });
        });
      }
    }

    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.5, 0.95, 0.24),
      new THREE.MeshLambertMaterial(),
      placements.length,
    );
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    placements.forEach((placement, index) => {
      dummy.position.set(placement.x, 0.55, placement.z);
      dummy.rotation.set(0, placement.rot, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.setHex(placement.color);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    mesh.name = 'road-closures';
    scene.add(mesh);
    this.mesh = mesh;
  }
}
