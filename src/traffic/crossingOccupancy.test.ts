import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Rng } from '../core/rng';
import type { ShelterBuild, SignalHead } from '../city/props';
import { buildLaneGraph } from './graph';
import { TrafficSystem } from './index';
import { VehicleAgent } from './agent';

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

function makeSystem(): TrafficSystem {
  const scene = new THREE.Scene();
  return new TrafficSystem(scene, buildLaneGraph(), new Rng(1234), shelter, heads, { initialCars: 0 });
}

describe('crossing occupancy', () => {
  it('stops a vehicle when a pedestrian occupies the crossing', () => {
    const traffic = makeSystem();
    const graph = buildLaneGraph();
    const edge = graph.edges.get('r:NS:2:2:3:N')!;
    const car = new VehicleAgent({
      id: 999,
      edgeId: edge.id,
      s: 0,
      maxSpeed: 7,
      length: 4,
      rng: () => 0.5,
    });
    traffic.agents.push(car);

    traffic.setCrossingOccupied('NS', '2:2', true);

    for (let i = 0; i < 60 * 10; i++) traffic.update(1 / 60);

    expect(car.edgeId).toBe(edge.id);
    expect(car.v).toBeLessThan(0.1);
  });

  it('releases the vehicle when the crossing clears', () => {
    const traffic = makeSystem();
    const graph = buildLaneGraph();
    const edge = graph.edges.get('r:NS:2:2:3:N')!;
    const car = new VehicleAgent({
      id: 999,
      edgeId: edge.id,
      s: 0,
      maxSpeed: 7,
      length: 4,
      rng: () => 0.5,
    });
    traffic.agents.push(car);

    traffic.setCrossingOccupied('NS', '2:2', true);
    for (let i = 0; i < 60 * 5; i++) traffic.update(1 / 60);
    expect(car.v).toBeLessThan(0.1);

    traffic.setCrossingOccupied('NS', '2:2', false);
    for (let i = 0; i < 60 * 20; i++) traffic.update(1 / 60);

    expect(car.v).toBeGreaterThan(0.5);
  });

  it('does not stop a vehicle when the crossing is not occupied', () => {
    const traffic = makeSystem();
    const graph = buildLaneGraph();
    const edge = graph.edges.get('r:NS:2:1:2:S')!;
    const car = new VehicleAgent({
      id: 999,
      edgeId: edge.id,
      s: 0,
      maxSpeed: 7,
      length: 4,
      rng: () => 0.5,
    });
    traffic.agents.push(car);

    for (let i = 0; i < 60 * 5; i++) traffic.update(1 / 60);

    expect(car.v).toBeGreaterThan(1);
  });

  it('tracks crossing occupancy per intersection and axis', () => {
    const traffic = makeSystem();
    expect(traffic.crossingOccupied('NS', '2:2')).toBe(false);
    traffic.setCrossingOccupied('NS', '2:2', true);
    expect(traffic.crossingOccupied('NS', '2:2')).toBe(true);
    expect(traffic.crossingOccupied('EW', '2:2')).toBe(false);
    traffic.setCrossingOccupied('NS', '2:2', false);
    expect(traffic.crossingOccupied('NS', '2:2')).toBe(false);
  });
});
