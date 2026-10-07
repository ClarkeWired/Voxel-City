import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FIXED_STEP } from '../core/loop';
import { Rng } from '../core/rng';
import type { ShelterBuild, SignalHead } from '../city/props';
import { buildLaneGraph } from './graph';
import { TrafficSystem } from './index';

const shelter: ShelterBuild = {
  center: { x: 0, z: -16.9 },
  waitSpots: [
    { x: -0.8, z: -16.9 },
    { x: 0.15, z: -16.9 },
    { x: 1.1, z: -16.9 },
  ],
  doorPoint: { x: 2.0, z: -15.1 },
};

const heads: SignalHead[] = [
  { id: 'light:2:2:N', intersectionId: '2:2', axis: 'NS', x: -14.25, y: 3.65, z: -18.15, fx: 0, fz: -1 },
];

function makeSystem(seed: number): TrafficSystem {
  const scene = new THREE.Scene();
  return new TrafficSystem(scene, buildLaneGraph(), new Rng(seed), shelter, heads);
}

function snapshot(traffic: TrafficSystem): string {
  return JSON.stringify(
    traffic.agents.map((a) => ({
      id: a.id,
      edgeId: a.edgeId,
      s: a.s,
      v: a.v,
      x: traffic.visualPose(a.id, 1)?.x,
      z: traffic.visualPose(a.id, 1)?.z,
    })),
  );
}

describe('fixed-timestep determinism', () => {
  it('produces identical states for the same seed', () => {
    const a = makeSystem(42);
    const b = makeSystem(42);
    for (let i = 0; i < 600; i++) {
      a.update(FIXED_STEP);
      b.update(FIXED_STEP);
    }
    expect(snapshot(a)).toBe(snapshot(b));
  });

  it('produces different states for different seeds', () => {
    const a = makeSystem(42);
    const b = makeSystem(43);
    for (let i = 0; i < 600; i++) {
      a.update(FIXED_STEP);
      b.update(FIXED_STEP);
    }
    expect(snapshot(a)).not.toBe(snapshot(b));
  });

  it('signal time advances deterministically', () => {
    const a = makeSystem(42);
    const b = makeSystem(42);
    for (let i = 0; i < 300; i++) {
      a.update(FIXED_STEP);
      b.update(FIXED_STEP);
    }
    expect(a.signalTime()).toBeCloseTo(b.signalTime(), 12);
  });
});
