import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FIXED_STEP } from '../core/loop';
import { Rng } from '../core/rng';
import { buildCity } from '../city/index';
import { buildLaneGraph } from '../traffic/graph';
import { TrafficSystem } from '../traffic/index';
import { PeopleSystem } from './index';
import { buildWalkGraph } from './paths';

function makeWorld() {
  const scene = new THREE.Scene();
  const city = buildCity(scene, new Rng(20261007));
  const traffic = new TrafficSystem(scene, buildLaneGraph(), new Rng(1234), city.shelter, city.signalHeads, { initialCars: 0 });
  const walk = buildWalkGraph();
  const people = new PeopleSystem(scene, walk, traffic, new Rng(5), city.shelter, city.blockers);
  return { city, traffic, walk, people };
}

describe('pedestrian blocker soak', () => {
  it('spawns initial walkers only on unblocked edges', () => {
    const { city, walk, people } = makeWorld();
    for (const ped of people.pedStates()) {
      const edge = walk.edges.get(ped.edgeId);
      if (!edge) continue;
      const a = edge.points[0]!;
      const b = edge.points[edge.points.length - 1]!;
      expect(city.blockers.intersects(a.x, a.z, b.x, b.z)).toBe(false);
    }
  });

  it('never places a pedestrian centre inside a blocker', () => {
    const { city, traffic, people } = makeWorld();
    let violations = 0;
    for (let i = 0; i < 60 * 180; i++) {
      traffic.update(FIXED_STEP);
      people.update(FIXED_STEP);
      for (const ped of people.pedStates()) {
        if (city.blockers.pointBlocked(ped.x, ped.z)) violations++;
      }
    }
    expect(violations).toBe(0);
  });
});
