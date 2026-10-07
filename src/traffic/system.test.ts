import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Rng } from '../core/rng';
import { blockCenter } from '../city/grid';
import type { ShelterBuild, SignalHead } from '../city/props';
import { buildLaneGraph } from './graph';
import { TrafficSystem } from './index';

const shelter: ShelterBuild = {
  center: { x: 2, z: 26.6 },
  waitSpots: [
    { x: 1, z: 26.6 },
    { x: 2.2, z: 26.6 },
    { x: 3.4, z: 26.6 },
  ],
  doorPoint: { x: 4.5, z: 24.4 },
};

const heads: SignalHead[] = [{ id: 'light:1:1:N', intersectionId: '1:1', axis: 'NS', x: -22.5, y: 4.15, z: -29.15, fx: 0, fz: -1 }];

function makeSystem(): { traffic: TrafficSystem; scene: THREE.Scene } {
  const scene = new THREE.Scene();
  const traffic = new TrafficSystem(scene, buildLaneGraph(), new Rng(1234), shelter, heads);
  return { traffic, scene };
}

function luminance(color: THREE.Color): number {
  return color.r * 0.2 + color.g * 0.7 + color.b * 0.1;
}

describe('TrafficSystem', () => {
  it('spawns the bus on its loop just west of the shelter stop', () => {
    const { traffic } = makeSystem();
    const bus = traffic.agents.find((a) => a.routeLoop);
    expect(bus).toBeDefined();
    expect(bus!.edgeId).toBe('r:EW:2:1:2:E');
    expect(bus!.s).toBeLessThan(8.5);
    expect(traffic.agents.length).toBe(13);
  });

  it('moves every vehicle onto the road network', () => {
    const { traffic, scene } = makeSystem();
    for (let i = 0; i < 120; i++) traffic.update(1 / 60);
    const groups = scene.children.filter((child): child is THREE.Group => child instanceof THREE.Group);
    expect(groups.length).toBe(13);
    for (const group of groups) {
      const distance = Math.hypot(group.position.x, group.position.z);
      expect(distance).toBeGreaterThan(5);
    }
  });

  it('parks the bus at the shelter stop on the showcase street', () => {
    const { traffic, scene } = makeSystem();
    for (let i = 0; i < 60 * 4; i++) traffic.update(1 / 60);
    const busGroup = scene.children.filter((child): child is THREE.Group => child instanceof THREE.Group)[0]!;
    expect(busGroup.position.z).toBeCloseTo(22.5, 1);
    expect(Math.abs(busGroup.position.x)).toBeLessThanOrEqual(6.6);
    const bus = traffic.agents.find((a) => a.routeLoop)!;
    expect(bus.s).toBeCloseTo(8.5, 3);
    expect(bus.dwelling).toBeGreaterThan(0);
  });

  it('drives the bus away after dwelling', () => {
    const { traffic } = makeSystem();
    const bus = traffic.agents.find((a) => a.routeLoop)!;
    for (let i = 0; i < 60 * 18; i++) traffic.update(1 / 60);
    expect(bus.edgeId).not.toBe('r:EW:2:1:2:E');
    const events = traffic.consumeEvents();
    expect(events.some((e) => e.type === 'bus-arrived')).toBe(true);
    expect(events.some((e) => e.type === 'bus-departed')).toBe(true);
  });

  it('assigns every car a real origin-to-destination route', () => {
    const { traffic } = makeSystem();
    const cars = traffic.agents.filter((agent) => !agent.routeLoop);
    expect(cars.length).toBe(12);
    for (const car of cars) {
      expect(car.route).toBeDefined();
      expect(car.route!.length).toBeGreaterThanOrEqual(2);
      expect(car.route![0]).toBe(car.edgeId);
      expect(traffic.destinationOf(car.id)).toBeDefined();
    }
  });

  it('retires cars at their destination and keeps traffic flowing', () => {
    const { traffic } = makeSystem();
    let arrivals = 0;
    for (let i = 0; i < 60 * 300; i++) {
      traffic.update(1 / 60);
      arrivals += traffic.consumeEvents().filter((event) => event.type === 'vehicle-arrived').length;
    }
    expect(arrivals).toBeGreaterThan(0);
    expect(traffic.carCount).toBeGreaterThan(0);
  });

  it('reroutes a car when its next edge is closed', () => {
    const closed = new Set<string>();
    const scene = new THREE.Scene();
    const traffic = new TrafficSystem(scene, buildLaneGraph(), new Rng(99), shelter, heads, { closedEdges: () => closed });
    for (let i = 0; i < 60 * 20; i++) traffic.update(1 / 60);
    const car = traffic.agents.find(
      (agent) => !agent.routeLoop && !agent.arrived && agent.route !== undefined && agent.route.length - agent.routeIndex > 2,
    );
    expect(car).toBeDefined();
    const blocked = car!.route![car!.routeIndex + 1]!;
    closed.add(blocked);
    const before = traffic.reroutes;
    traffic.update(1 / 60);
    expect(traffic.reroutes).toBeGreaterThan(before);
    expect(car!.route!.slice(car!.routeIndex).includes(blocked)).toBe(false);
  });

  it('services trip requests with a car starting near the origin block', () => {
    const { traffic } = makeSystem();
    const graph = buildLaneGraph();
    const before = traffic.carCount;
    const agentId = traffic.requestTrip(0, 8);
    expect(agentId).not.toBeNull();
    expect(traffic.carCount).toBe(before + 1);
    const car = traffic.agents.find((agent) => agent.id === agentId)!;
    expect(car.route).toBeDefined();
    expect(car.route![0]).toBe(car.edgeId);
    expect(traffic.destinationOf(car.id)).toBeDefined();
    const edge = graph.edges.get(car.edgeId)!;
    const last = edge.points[edge.points.length - 1]!;
    const midX = (edge.points[0]!.x + last.x) / 2;
    const midZ = (edge.points[0]!.z + last.z) / 2;
    const distance = Math.hypot(midX - blockCenter(0), midZ - blockCenter(0));
    expect(distance).toBeLessThan(45);
  });

  it('respects the maximum car capacity for trip requests', () => {
    const scene = new THREE.Scene();
    const traffic = new TrafficSystem(scene, buildLaneGraph(), new Rng(7), shelter, heads, { initialCars: 0, maxCars: 3 });
    let accepted = 0;
    for (let i = 0; i < 12; i++) {
      if (traffic.requestTrip(i % 9, (i + 4) % 9) !== null) accepted++;
    }
    expect(accepted).toBeGreaterThan(0);
    expect(accepted).toBeLessThanOrEqual(3);
    expect(traffic.carCount).toBeLessThanOrEqual(3);
  });

  it('dispatches an emergency vehicle to a requested node', () => {
    const { traffic } = makeSystem();
    const before = traffic.vehicleCount;
    const agentId = traffic.spawnEmergency(0, 'in:1:1:S');
    expect(agentId).not.toBeNull();
    expect(traffic.vehicleCount).toBe(before + 1);
    expect(traffic.destinationOf(agentId!)).toBe('in:1:1:S');
    const car = traffic.agents.find((agent) => agent.id === agentId)!;
    expect(car.route).toBeDefined();
    expect(car.maxSpeed).toBeGreaterThan(9);
  });

  it('renders signal lamps for the current phase', () => {
    const { traffic, scene } = makeSystem();
    for (let i = 0; i < 180; i++) traffic.update(1 / 60);
    const mesh = scene.children.find((child) => child instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
    expect(mesh).toBeDefined();
    expect(mesh.instanceColor).not.toBeNull();
    const red = new THREE.Color();
    const green = new THREE.Color();
    mesh.getColorAt(0, red);
    mesh.getColorAt(2, green);
    expect(luminance(green)).toBeGreaterThan(luminance(red));
  });
});
