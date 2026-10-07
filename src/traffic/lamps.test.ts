import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Rng } from '../core/rng';
import { palette } from '../core/palette';
import type { ShelterBuild, SignalHead } from '../city/props';
import { buildLaneGraph } from './graph';
import { TrafficSystem } from './index';
import type { LightState } from './signals';

const shelter: ShelterBuild = {
  center: { x: 0, z: -16.9 },
  waitSpots: [
    { x: -0.8, z: -16.9 },
    { x: 0.15, z: -16.9 },
    { x: 1.1, z: -16.9 },
  ],
  doorPoint: { x: 2.0, z: -15.1 },
};

function head(intersectionId: string, axis: 'NS' | 'EW', x: number, z: number): SignalHead {
  const [i, j] = intersectionId.split(':');
  return {
    id: `light:${i}:${j}:${axis === 'NS' ? 'N' : 'E'}`,
    intersectionId,
    axis,
    x,
    y: 3.65,
    z,
    fx: 0,
    fz: -1,
  };
}

const heads: SignalHead[] = [
  head('2:2', 'NS', -14.25, -18.15),
  head('2:2', 'EW', -18.15, -10.75),
  head('3:3', 'NS', 10.75, 6.85),
  head('4:4', 'NS', 35.75, 31.85),
  head('1:1', 'NS', -39.25, -43.15),
  head('1:1', 'EW', -31.85, -35.75),
];

function makeSystem(options: { signalOffsets?: (id: string) => number; initialCars?: number } = {}) {
  const scene = new THREE.Scene();
  const traffic = new TrafficSystem(scene, buildLaneGraph(), new Rng(4242), shelter, heads, options);
  const mesh = scene.children.find((child) => child instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
  expect(mesh).toBeDefined();
  return { traffic, mesh };
}

function colorClose(actual: THREE.Color, hex: number): boolean {
  const expected = new THREE.Color().setHex(hex);
  return (
    Math.abs(actual.r - expected.r) < 1e-4 &&
    Math.abs(actual.g - expected.g) < 1e-4 &&
    Math.abs(actual.b - expected.b) < 1e-4
  );
}

function lampMatches(mesh: THREE.InstancedMesh, headIndex: number, state: LightState): boolean {
  const actual = new THREE.Color();
  const specs: [number, number][] = [
    [0, state === 'red' ? palette.lightRedOn : palette.lightRedOff],
    [1, state === 'yellow' ? palette.lightYellowOn : palette.lightYellowOff],
    [2, state === 'green' ? palette.lightGreenOn : palette.lightGreenOff],
  ];
  for (const [slot, hex] of specs) {
    mesh.getColorAt(headIndex * 3 + slot, actual);
    if (!colorClose(actual, hex)) return false;
  }
  return true;
}

describe('signal lamp rendering', () => {
  it('renders every head the exact state vehicles and pedestrians consume', () => {
    const { traffic, mesh } = makeSystem({ signalOffsets: (id) => (id === '2:2' ? 6 : 0) });
    let mismatches = 0;
    let offsetDisagreements = 0;
    let phaseChanges = 0;
    let previousKey = '';
    for (let step = 0; step < 420; step++) {
      traffic.update(1 / 60);
      const key = heads.map((entry) => traffic.signal(entry.axis, entry.intersectionId)).join('|');
      if (step > 0 && key !== previousKey) phaseChanges++;
      previousKey = key;
      for (let h = 0; h < heads.length; h++) {
        const expected = traffic.signal(heads[h]!.axis, heads[h]!.intersectionId);
        if (!lampMatches(mesh, h, expected)) mismatches++;
      }
      if (traffic.signal('NS', '1:1') !== traffic.signal('NS', '2:2')) offsetDisagreements++;
    }
    expect(mismatches).toBe(0);
    expect(phaseChanges).toBeGreaterThan(0);
    expect(offsetDisagreements).toBeGreaterThan(0);
  });

  it('renders the overridden phase during emergency preemption on the affected head only', () => {
    const { traffic, mesh } = makeSystem();
    for (let step = 0; step < 700 && traffic.signal('NS') !== 'red'; step++) traffic.update(1 / 60);
    expect(traffic.signal('NS')).toBe('red');

    const agentId = traffic.spawnEmergency(0, 'in:1:1:S');
    expect(agentId).not.toBeNull();
    const ambulance = traffic.agents.find((agent) => agent.id === agentId)!;
    const edge = buildLaneGraph().edges.get('r:NS:1:0:1:S')!;
    ambulance.edgeId = edge.id;
    ambulance.s = edge.length - 10;
    traffic.update(1 / 60);

    expect(traffic.preemptedIntersection('1:1')).toBe('NS');
    expect(traffic.signal('NS', '1:1')).toBe('green');
    expect(lampMatches(mesh, 4, 'green')).toBe(true);
    expect(lampMatches(mesh, 5, traffic.signal('EW', '1:1'))).toBe(true);

    expect(traffic.signal('NS', '3:3')).toBe('red');
    expect(lampMatches(mesh, 2, 'red')).toBe(true);
  });

  it('reverts the lamp when the preemption clears', () => {
    const { traffic, mesh } = makeSystem();
    for (let step = 0; step < 700 && traffic.signal('NS') !== 'red'; step++) traffic.update(1 / 60);
    const agentId = traffic.spawnEmergency(0, 'in:1:1:S')!;
    const ambulance = traffic.agents.find((agent) => agent.id === agentId)!;
    const edge = buildLaneGraph().edges.get('r:NS:1:0:1:S')!;
    ambulance.edgeId = edge.id;
    ambulance.s = edge.length - 10;
    traffic.update(1 / 60);
    expect(lampMatches(mesh, 4, 'green')).toBe(true);

    ambulance.edgeId = 't:1:1:N:E';
    traffic.update(1 / 60);
    expect(traffic.preemptedIntersection('1:1')).toBeUndefined();
    expect(lampMatches(mesh, 4, traffic.signal('NS', '1:1'))).toBe(true);
    expect(traffic.signal('NS', '1:1')).toBe('red');
  });
});
