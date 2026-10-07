import * as THREE from 'three';
import { VoxelBuilder, buildMergedGeometry } from '../core/voxel';
import type { LaneGraph } from './graph';
import type { Incident } from '../world/incidents';

const CONE_OFFSETS: [number, number][] = [
  [-2.6, -1.6],
  [-2.6, 1.6],
  [2.6, -1.6],
  [2.6, 1.6],
];

function wreckGeometry(): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  b.box(0, 0.75, 0, 3.8, 0.9, 1.8, 0x2b2f36);
  b.box(-0.2, 1.35, 0, 2.2, 0.5, 1.7, 0x22252a);
  b.box(1.95, 0.7, 0, 0.3, 0.4, 1.7, 0x3a3f47);
  b.box(0, 1.65, 0, 1.2, 0.4, 1.2, 0x2b2f36);
  return buildMergedGeometry(b);
}

export class IncidentVisuals {
  private group: THREE.Group | null = null;
  private key = '';

  update(scene: THREE.Scene, graph: LaneGraph, incidents: readonly Incident[]): void {
    const key = incidents.map((incident) => `${incident.id}:${incident.phase}`).join(',');
    if (key === this.key) return;
    this.key = key;

    if (this.group) {
      scene.remove(this.group);
      this.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
      this.group = null;
    }
    if (incidents.length === 0) return;

    const group = new THREE.Group();
    group.name = 'incidents';
    const coneGeometry = new THREE.BoxGeometry(0.26, 0.5, 0.26);
    const coneMaterial = new THREE.MeshLambertMaterial({ color: 0xd97a3a });
    for (const incident of incidents) {
      const edge = graph.edges.get(incident.edgeId);
      if (!edge) continue;
      const first = edge.points[0]!;
      const last = edge.points[edge.points.length - 1]!;
      const midX = (first.x + last.x) / 2;
      const midZ = (first.z + last.z) / 2;
      const dx = last.x - first.x;
      const dz = last.z - first.z;
      const len = Math.hypot(dx, dz) || 1;
      const ux = dx / len;
      const uz = dz / len;

      const wreck = new THREE.Mesh(wreckGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
      wreck.position.set(midX, 0, midZ);
      wreck.rotation.y = Math.atan2(-uz, ux) + (incident.phase === 'responding' ? 0.35 : 0.15);
      wreck.rotation.z = 0.22;
      wreck.castShadow = true;
      group.add(wreck);

      for (const [along, across] of CONE_OFFSETS) {
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        cone.position.set(midX + ux * along - uz * across, 0.25, midZ + uz * along + ux * across);
        cone.castShadow = true;
        group.add(cone);
      }
    }
    scene.add(group);
    this.group = group;
  }
}
