import { describe, expect, it } from 'vitest';
import type { Pt } from '../core/geo';
import { conditionsFor } from '../world/weather';
import { VehicleAgent, type AgentWorld } from './agent';
import type { LaneEdge, LaneNode } from './graph';
import type { LightState } from './signals';

class StubWorld implements AgentWorld {
  readonly edges = new Map<string, LaneEdge>();
  readonly nodes = new Map<string, LaneNode>();
  agents: VehicleAgent[] = [];
  signalState: LightState = 'green';

  addRoad(id: string, from: string, to: string, length: number): void {
    const points: Pt[] = [
      { x: 0, z: 0 },
      { x: 0, z: length },
    ];
    this.edges.set(id, { id, kind: 'road', axis: 'NS', from, to, points, length });
    this.ensureNode(from);
    this.ensureNode(to);
  }

  addTurn(id: string, from: string, to: string, length: number): void {
    const points: Pt[] = [
      { x: 0, z: 0 },
      { x: length, z: length },
    ];
    this.edges.set(id, { id, kind: 'turn', axis: 'NS', from, to, points, length, maneuver: 'straight', intersectionId: '0:0' });
    this.ensureNode(from);
    this.ensureNode(to);
    this.nodes.get(from)!.out.push(id);
  }

  private ensureNode(id: string): void {
    if (!this.nodes.has(id)) this.nodes.set(id, { id, pos: { x: 0, z: 0 }, out: [], in: [] });
  }

  edge(id: string): LaneEdge {
    return this.edges.get(id)!;
  }

  outEdges(nodeId: string): readonly LaneEdge[] {
    return this.nodes.get(nodeId)!.out.map((id) => this.edges.get(id)!);
  }

  signal(): LightState {
    return this.signalState;
  }

  canEnter(): boolean {
    return true;
  }

  crossingOccupied(): boolean {
    return false;
  }

  roadObstacleDistance(): number | null {
    return null;
  }

  leaderInfo(agent: VehicleAgent): { gap: number; deltaV: number } {
    let gap = Infinity;
    let deltaV = 0;
    for (const other of this.agents) {
      if (other === agent || other.edgeId !== agent.edgeId) continue;
      if (other.s <= agent.s) continue;
      const g = other.s - agent.s - (agent.length + other.length) / 2;
      if (g < gap) {
        gap = g;
        deltaV = agent.v - other.v;
      }
    }
    return { gap, deltaV };
  }
}

function makeWorld(): StubWorld {
  const world = new StubWorld();
  world.addRoad('e1', 'n0', 'n1', 30);
  world.addTurn('e2', 'n1', 'n2', 10);
  return world;
}

function step(world: StubWorld, agents: VehicleAgent[], seconds: number): void {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    for (const agent of agents) agent.update(dt, world);
  }
}

describe('VehicleAgent', () => {
  it('drives and crosses the stop line on green', () => {
    const world = makeWorld();
    world.signalState = 'green';
    const car = new VehicleAgent({ id: 1, edgeId: 'e1', s: 0, maxSpeed: 7, length: 4, rng: () => 0.5 });
    step(world, [car], 6.5);
    expect(car.edgeId).toBe('e2');
    expect(car.v).toBeGreaterThan(0);
  });

  it('stops before the stop line on red', () => {
    const world = makeWorld();
    world.signalState = 'red';
    const car = new VehicleAgent({ id: 1, edgeId: 'e1', s: 0, maxSpeed: 7, length: 4, rng: () => 0.5 });
    step(world, [car], 20);
    expect(car.edgeId).toBe('e1');
    expect(car.v).toBeLessThan(0.05);
    expect(car.s).toBeLessThanOrEqual(30);
    expect(car.s).toBeGreaterThan(25);
  });

  it('stops on yellow when it can brake comfortably', () => {
    const world = makeWorld();
    world.signalState = 'yellow';
    const car = new VehicleAgent({ id: 1, edgeId: 'e1', s: 5, maxSpeed: 7, length: 4, rng: () => 0.5 });
    step(world, [car], 20);
    expect(car.edgeId).toBe('e1');
    expect(car.v).toBeLessThan(0.05);
  });

  it('follows a stopped leader without overlapping', () => {
    const world = makeWorld();
    world.signalState = 'green';
    const leader = new VehicleAgent({ id: 1, edgeId: 'e1', s: 20, maxSpeed: 0.001, length: 4, rng: () => 0.5 });
    const follower = new VehicleAgent({ id: 2, edgeId: 'e1', s: 0, maxSpeed: 7, length: 4, rng: () => 0.5 });
    world.agents = [leader, follower];
    step(world, [follower], 25);
    const gap = leader.s - follower.s - (leader.length + follower.length) / 2;
    expect(gap).toBeGreaterThan(0.8);
    expect(follower.v).toBeLessThan(0.2);
    expect(follower.s).toBeGreaterThan(8);
  });

  it('keeps at least a car length when queued behind a stopper', () => {
    const world = makeWorld();
    world.signalState = 'red';
    const cars = [
      new VehicleAgent({ id: 1, edgeId: 'e1', s: 8, maxSpeed: 7, length: 4, rng: () => 0.5 }),
      new VehicleAgent({ id: 2, edgeId: 'e1', s: 2, maxSpeed: 7, length: 4, rng: () => 0.5 }),
      new VehicleAgent({ id: 3, edgeId: 'e1', s: 0, maxSpeed: 7, length: 4, rng: () => 0.5 }),
    ];
    world.agents = cars;
    step(world, cars, 20);
    const sorted = [...cars].sort((a, b) => a.s - b.s);
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i]!.s - sorted[i - 1]!.s - sorted[i]!.length;
      expect(gap).toBeGreaterThan(0.8);
    }
    expect(sorted[sorted.length - 1]!.s).toBeLessThanOrEqual(30);
  });

  it('drives slower in storm conditions than in clear weather', () => {
    const world = makeWorld();
    world.signalState = 'green';
    const clearCar = new VehicleAgent({ id: 1, edgeId: 'e1', s: 0, maxSpeed: 7, length: 4, rng: () => 0.5 });
    const stormCar = new VehicleAgent({ id: 2, edgeId: 'e1', s: 0, maxSpeed: 7, length: 4, rng: () => 0.5 });
    clearCar.setConditions(null);
    stormCar.setConditions(conditionsFor({ kind: 'storm', intensity: 1, until: 0 }));
    world.agents = [clearCar, stormCar];
    step(world, [clearCar, stormCar], 4);
    expect(clearCar.s).toBeGreaterThan(stormCar.s + 2);
    expect(stormCar.v).toBeLessThan(clearCar.v);
  });

  it('arrives at a bus stop and dwells', () => {
    const world = makeWorld();
    world.signalState = 'green';
    const stop = { edgeId: 'e1', s: 12, dwell: 3, done: false };
    const bus = new VehicleAgent({
      id: 1,
      edgeId: 'e1',
      s: 0,
      maxSpeed: 6,
      length: 8,
      rng: () => 0.5,
      stops: [stop],
    });
    step(world, [bus], 3);
    expect(bus.dwelling).toBeGreaterThan(0);
    expect(bus.consumeStopEvent()).toBe(stop);
    expect(bus.s).toBeCloseTo(12);
    step(world, [bus], 2);
    expect(bus.dwelling).toBeGreaterThan(0);
    step(world, [bus], 6);
    expect(bus.edgeId).toBe('e2');
  });
});
