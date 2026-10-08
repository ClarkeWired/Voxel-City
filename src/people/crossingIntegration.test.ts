import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FIXED_STEP } from '../core/loop';
import { Rng } from '../core/rng';
import type { ShelterBuild, SignalHead } from '../city/props';
import { buildLaneGraph } from '../traffic/graph';
import { TrafficSystem } from '../traffic/index';
import { VehicleAgent } from '../traffic/agent';
import { SpatialBlocker } from '../world/obstacles';
import { PeopleSystem } from './index';
import { buildWalkGraph } from './paths';

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
  { id: 'light:1:1:N', intersectionId: '1:1', axis: 'NS', x: -35.75, y: 3.65, z: -43.15, fx: 0, fz: -1 },
];

function makeWorld() {
  const scene = new THREE.Scene();
  const traffic = new TrafficSystem(scene, buildLaneGraph(), new Rng(1234), shelter, heads, { initialCars: 0 });
  const walk = buildWalkGraph();
  const blockers = new SpatialBlocker();
  const people = new PeopleSystem(scene, walk, traffic, new Rng(5), shelter, blockers);
  return { traffic, people, walk };
}

describe('pedestrian crossing occupancy', () => {
  it('stops an approaching car while a pedestrian occupies the crossing, then proceeds', () => {
    const { traffic, people, walk } = makeWorld();
    (people as unknown as { peds: unknown[] }).peds.length = 0;

    while (!(traffic.signal('NS') === 'red' && traffic.signal('EW') === 'green')) traffic.update(FIXED_STEP);

    const car = new VehicleAgent({
      id: 999,
      edgeId: 'r:NS:1:0:1:S',
      s: 0,
      maxSpeed: 7,
      length: 4,
      rng: () => 0.5,
      route: ['r:NS:1:0:1:S', 't:1:1:N:S', 'r:NS:1:1:2:S'],
      routeIndex: 0,
    });
    traffic.agents.push(car);

    const crossingEdge = walk.edges.get('x:1:1:N')!;
    const endNode = crossingEdge.b;
    const ringEdgeId = walk.nodes.get(endNode)!.edges.find((id) => id !== crossingEdge.id && !walk.edges.get(id)!.crossing)!;
    expect(ringEdgeId).toBeDefined();
    const ringEdge = walk.edges.get(ringEdgeId!)!;
    const dir: 1 | -1 = ringEdge.b === endNode ? 1 : -1;

    people.spawnPedOnEdge(ringEdge.id, ringEdge.length - 0.5, dir);

    let occupied = false;
    for (let i = 0; i < 600 && !occupied; i++) {
      traffic.update(FIXED_STEP);
      people.update(FIXED_STEP);
      occupied = traffic.crossingOccupied('NS', '1:1');
    }
    expect(occupied).toBe(true);

    let stopped = false;
    for (let i = 0; i < 600; i++) {
      traffic.update(FIXED_STEP);
      people.update(FIXED_STEP);
      if (car.v < 0.2 && car.s <= 11.5) {
        stopped = true;
        break;
      }
      if (!traffic.crossingOccupied('NS', '1:1')) break;
    }
    expect(stopped).toBe(true);
    expect(car.s).toBeLessThanOrEqual(11.5);

    let cleared = false;
    for (let i = 0; i < 600 && !cleared; i++) {
      traffic.update(FIXED_STEP);
      people.update(FIXED_STEP);
      cleared = !traffic.crossingOccupied('NS', '1:1');
    }
    expect(cleared).toBe(true);

    let proceeded = false;
    for (let i = 0; i < 60 * 40 && !proceeded; i++) {
      traffic.update(FIXED_STEP);
      people.update(FIXED_STEP);
      proceeded = car.edgeId !== 'r:NS:1:0:1:S';
    }
    expect(proceeded).toBe(true);
  });
});
