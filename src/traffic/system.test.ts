import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Rng } from '../core/rng';
import { blockCenter, GRID_N } from '../city/grid';
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

const heads: SignalHead[] = [{ id: 'light:2:2:N', intersectionId: '2:2', axis: 'NS', x: -14.25, y: 3.65, z: -18.15, fx: 0, fz: -1 }];

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
    expect(bus!.edgeId).toBe('r:EW:2:2:3:E');
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
    expect(busGroup.position.z).toBeCloseTo(-14.25, 1);
    expect(Math.abs(busGroup.position.x)).toBeLessThanOrEqual(6.6);
    const bus = traffic.agents.find((a) => a.routeLoop)!;
    expect(bus.s).toBeCloseTo(6, 3);
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
      if (traffic.requestTrip(i % (GRID_N * GRID_N), (i + 4) % (GRID_N * GRID_N)) !== null) accepted++;
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

  it('accumulates congestion and city noise around signal queues', () => {
    const { traffic } = makeSystem();
    for (let i = 0; i < 60 * 30; i++) traffic.update(1 / 60);
    expect(traffic.noiseIndex).toBeGreaterThan(0.01);
    let peak = 0;
    for (const level of Object.values(traffic.congestionSnapshot())) {
      peak = Math.max(peak, level);
    }
    expect(peak).toBeGreaterThan(0.05);
  });

  it('restores congestion memory from a snapshot', () => {
    const scene = new THREE.Scene();
    const graph = buildLaneGraph();
    const traffic = new TrafficSystem(scene, graph, new Rng(3), shelter, heads, {
      congestion: { 'r:EW:2:1:2:W': 0.8 },
    });
    expect(traffic.congestionLevel('r:EW:2:1:2:W')).toBeCloseTo(0.8);
    expect(traffic.noiseIndex).toBeGreaterThan(0);
  });

  it('preempts the signal ahead of an approaching emergency vehicle', () => {
    const { traffic } = makeSystem();
    const agentId = traffic.spawnEmergency(0, 'in:1:1:S');
    expect(agentId).not.toBeNull();
    const ambulance = traffic.agents.find((agent) => agent.id === agentId)!;
    const edge = buildLaneGraph().edges.get('r:NS:1:0:1:S')!;
    ambulance.edgeId = edge.id;
    ambulance.s = edge.length - 10;
    traffic.update(1 / 60);
    expect(traffic.preemptedIntersection('1:1')).toBe('NS');
    expect(traffic.signal('NS', '1:1')).toBe('green');
    expect(traffic.signal('EW', '1:1')).toBe('red');
    expect(traffic.signal('NS', '2:2')).toBe(traffic.signal('NS'));
    ambulance.edgeId = 't:1:1:N:E';
    traffic.update(1 / 60);
    expect(traffic.preemptedIntersection('1:1')).toBeUndefined();
  });

  it('applies per-intersection signal offsets when provided', () => {
    const scene = new THREE.Scene();
    const traffic = new TrafficSystem(scene, buildLaneGraph(), new Rng(11), shelter, heads, {
      initialCars: 0,
      signalOffsets: (id) => (id === '2:2' ? 6 : 0),
    });
    traffic.update(1 / 60);
    expect(traffic.signal('NS', '1:1')).toBe('green');
    expect(traffic.signal('NS', '2:2')).toBe('red');
    expect(traffic.signal('NS')).toBe(traffic.signal('NS', '1:1'));
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
