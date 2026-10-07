import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FIXED_STEP, FixedStepAccumulator } from '../core/loop';
import { Rng } from '../core/rng';
import type { ShelterBuild, SignalHead } from '../city/props';
import { buildLaneGraph } from '../traffic/graph';
import { TrafficSystem } from '../traffic/index';
import { PeopleSystem } from './index';
import { buildWalkGraph, JOG_SPEED } from './paths';

const shelter: ShelterBuild = {
  center: { x: 2, z: 26.6 },
  waitSpots: [
    { x: 1, z: 26.6 },
    { x: 2.2, z: 26.6 },
    { x: 3.4, z: 26.6 },
  ],
  doorPoint: { x: 4.5, z: 24.4 },
};

const heads: SignalHead[] = [
  { id: 'light:1:1:N', intersectionId: '1:1', axis: 'NS', x: -22.5, y: 4.15, z: -29.15, fx: 0, fz: -1 },
];

function makeWorld(seed = 20261007) {
  const scene = new THREE.Scene();
  const traffic = new TrafficSystem(scene, buildLaneGraph(), new Rng(seed), shelter, heads, {
    initialCars: 8,
  });
  const peopleScene = new THREE.Scene();
  const walk = buildWalkGraph();
  const people = new PeopleSystem(peopleScene, walk, traffic, new Rng(seed + 1), shelter);
  return { traffic, people, peopleScene, walk };
}

describe('pedestrian motion', () => {
  it('stays inside its edge and carries the remainder across crossings', () => {
    const { traffic, people, walk } = makeWorld();
    const previous = new Map<number, { edgeId: string; s: number; state: string }>();
    let crossings = 0;
    let lostRemainder = 0;
    let outOfBounds = 0;

    for (let step = 0; step < 1800; step++) {
      traffic.update(FIXED_STEP);
      people.update(FIXED_STEP);
      for (const ped of people.pedStates()) {
        const before = previous.get(ped.id);
        const moving = ped.state === 'walk' || ped.state === 'cross';
        const wasMoving = before?.state === 'walk' || before?.state === 'cross';
        if (before && wasMoving && moving && before.edgeId !== ped.edgeId) {
          crossings++;
          if (ped.s <= 0) lostRemainder++;
        }
        if (moving) {
          const edge = walk.edges.get(ped.edgeId);
          if (edge && (ped.s < 0 || ped.s > edge.length + 1e-9)) outOfBounds++;
        }
        previous.set(ped.id, { edgeId: ped.edgeId, s: ped.s, state: ped.state });
      }
    }

    expect(outOfBounds).toBe(0);
    expect(crossings).toBeGreaterThan(10);
    expect(lostRemainder).toBe(0);
  });

  it('moves a bounded distance per simulation step so turns never teleport', () => {
    const { traffic, people } = makeWorld();
    const previous = new Map<number, { x: number; z: number }>();
    let compared = 0;

    for (let step = 0; step < 1200; step++) {
      traffic.update(FIXED_STEP);
      people.update(FIXED_STEP);
      for (const ped of people.pedStates()) {
        if (ped.state !== 'walk' && ped.state !== 'cross') continue;
        const before = previous.get(ped.id);
        if (before) {
          const moved = Math.hypot(ped.x - before.x, ped.z - before.z);
          expect(moved).toBeLessThanOrEqual(JOG_SPEED * FIXED_STEP + 0.11);
          compared++;
        }
        previous.set(ped.id, { x: ped.x, z: ped.z });
      }
    }

    expect(compared).toBeGreaterThan(200);
  });

  it('renders between the previous and current simulation states', () => {
    const { traffic, people, peopleScene } = makeWorld();
    for (let step = 0; step < 240; step++) {
      traffic.update(FIXED_STEP);
      people.update(FIXED_STEP);
    }

    people.render(0);
    const before = peopleScene.children.map((child) => ({
      x: child.position.x,
      y: child.position.y,
      z: child.position.z,
      yaw: child.rotation.y,
    }));
    people.render(1);
    const after = peopleScene.children.map((child) => ({
      x: child.position.x,
      y: child.position.y,
      z: child.position.z,
      yaw: child.rotation.y,
    }));
    people.render(0.5);
    const mid = peopleScene.children.map((child) => ({
      x: child.position.x,
      y: child.position.y,
      z: child.position.z,
      yaw: child.rotation.y,
    }));

    expect(before.length).toBe(after.length);
    expect(before.length).toBeGreaterThan(10);
    for (let i = 0; i < before.length; i++) {
      expect(mid[i]!.x).toBeCloseTo((before[i]!.x + after[i]!.x) / 2, 9);
      expect(mid[i]!.y).toBeCloseTo((before[i]!.y + after[i]!.y) / 2, 9);
      expect(mid[i]!.z).toBeCloseTo((before[i]!.z + after[i]!.z) / 2, 9);
      const arc = after[i]!.yaw - before[i]!.yaw;
      const wrapped = arc > Math.PI ? arc - Math.PI * 2 : arc < -Math.PI ? arc + Math.PI * 2 : arc;
      expect(mid[i]!.yaw - before[i]!.yaw).toBeCloseTo(wrapped / 2, 9);
    }
  });

  it('keeps rendered pedestrian motion bounded under uneven frame times', () => {
    const { traffic, people, peopleScene } = makeWorld();
    const frames = [0.007, 0.021, 0.033, 0.049, 0.0166, 0.05];
    const accumulator = new FixedStepAccumulator();
    const previous = new Map<number, { x: number; z: number }>();
    let compared = 0;
    let index = 0;

    for (let frame = 0; frame < 240; frame++) {
      const frameSeconds = frames[index++ % frames.length]!;
      const plan = accumulator.advance(frameSeconds);
      for (let k = 0; k < plan.steps; k++) {
        traffic.update(FIXED_STEP);
        people.update(FIXED_STEP);
      }
      people.render(plan.alpha);

      for (let i = 0; i < peopleScene.children.length; i++) {
        const rig = peopleScene.children[i]!;
        const before = previous.get(i);
        if (before) {
          const moved = Math.hypot(rig.position.x - before.x, rig.position.z - before.z);
          expect(moved).toBeLessThanOrEqual(JOG_SPEED * (frameSeconds + FIXED_STEP) + 0.15);
          compared++;
        }
        previous.set(i, { x: rig.position.x, z: rig.position.z });
      }
      expect(people.pedStates().length).toBe(peopleScene.children.length);
    }

    expect(compared).toBeGreaterThan(100);
  });
});
