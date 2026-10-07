import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { wrapAngle, samplePolyline } from '../core/geo';
import { FIXED_STEP, FixedStepAccumulator } from '../core/loop';
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

function makeSystem(seed = 1234): TrafficSystem {
  const scene = new THREE.Scene();
  return new TrafficSystem(scene, buildLaneGraph(), new Rng(seed), shelter, heads);
}

interface AgentState {
  id: number;
  edgeId: string;
  s: number;
  v: number;
}

function agentStates(traffic: TrafficSystem): AgentState[] {
  return traffic.agents
    .map((agent) => ({ id: agent.id, edgeId: agent.edgeId, s: agent.s, v: agent.v }))
    .sort((a, b) => a.id - b.id);
}

const FRAME_PATTERN = [0.007, 0.021, 0.033, 0.049, 0.0166, 0.0167, 0.004, 0.05];

function runChunked(traffic: TrafficSystem, steps: number): void {
  const accumulator = new FixedStepAccumulator();
  let applied = 0;
  let index = 0;
  while (applied < steps) {
    const plan = accumulator.advance(FRAME_PATTERN[index++ % FRAME_PATTERN.length]!);
    for (let k = 0; k < plan.steps && applied < steps; k++) {
      traffic.update(FIXED_STEP);
      applied++;
    }
  }
}

describe('fixed timestep traffic', () => {
  it('produces identical states whatever the browser frame times are', () => {
    const direct = makeSystem();
    const chunked = makeSystem();

    for (let step = 0; step < 600; step++) direct.update(FIXED_STEP);
    runChunked(chunked, 600);

    expect(agentStates(chunked)).toEqual(agentStates(direct));
    for (const agent of direct.agents) {
      expect(chunked.visualPose(agent.id, 0.5)).toEqual(direct.visualPose(agent.id, 0.5));
    }
    expect(chunked.signalTime()).toBeCloseTo(direct.signalTime(), 12);
  });

  it('decides from one snapshot regardless of agent iteration order', () => {
    const forward = makeSystem();
    const reversed = makeSystem();
    reversed.agents.reverse();

    for (let step = 0; step < 240; step++) {
      forward.update(FIXED_STEP);
      reversed.update(FIXED_STEP);
    }

    const a = agentStates(forward);
    const b = agentStates(reversed);
    expect(b.length).toBe(a.length);
    for (let i = 0; i < a.length; i++) {
      expect(b[i]!.id).toBe(a[i]!.id);
      expect(b[i]!.edgeId).toBe(a[i]!.edgeId);
      expect(b[i]!.s).toBeCloseTo(a[i]!.s, 9);
      expect(b[i]!.v).toBeCloseTo(a[i]!.v, 9);
    }
  });

  it('renders strictly between the previous and current simulation states', () => {
    const traffic = makeSystem();
    for (let step = 0; step < 300; step++) traffic.update(FIXED_STEP);

    for (const agent of traffic.agents) {
      const prev = traffic.visualPose(agent.id, 0)!;
      const current = traffic.visualPose(agent.id, 1)!;
      const mid = traffic.visualPose(agent.id, 0.5)!;
      const quarter = traffic.visualPose(agent.id, 0.25)!;

      expect(mid.x).toBeCloseTo((prev.x + current.x) / 2, 9);
      expect(mid.z).toBeCloseTo((prev.z + current.z) / 2, 9);
      expect(wrapAngle(mid.yaw - prev.yaw)).toBeCloseTo(wrapAngle(current.yaw - prev.yaw) / 2, 9);
      expect(wrapAngle(quarter.yaw - prev.yaw)).toBeCloseTo(wrapAngle(current.yaw - prev.yaw) / 4, 9);

      const loX = Math.min(prev.x, current.x) - 1e-9;
      const hiX = Math.max(prev.x, current.x) + 1e-9;
      expect(mid.x).toBeGreaterThanOrEqual(loX);
      expect(mid.x).toBeLessThanOrEqual(hiX);
    }
  });

  it('keeps rendered heading locked to the path while turning', () => {
    const traffic = makeSystem();
    const graph = buildLaneGraph();
    let turnSamples = 0;
    for (let step = 0; step < 900; step++) {
      traffic.update(FIXED_STEP);
      for (const agent of traffic.agents) {
        const edge = graph.edges.get(agent.edgeId);
        if (!edge || edge.kind !== 'turn') continue;
        const pose = samplePolyline(edge.points, agent.s);
        const expected = Math.atan2(-pose.dz, pose.dx);
        const shown = traffic.visualPose(agent.id, 1)!;
        expect(Math.abs(wrapAngle(shown.yaw - expected))).toBeLessThan(1e-9);
        turnSamples++;
      }
    }
    expect(turnSamples).toBeGreaterThan(50);
  });

  it('never snaps the rendered heading across an edge transition', () => {
    const traffic = makeSystem();
    const previousYaw = new Map<number, number>();
    const previousEdge = new Map<number, string>();
    let tracked = 0;
    let transitions = 0;

    for (let step = 0; step < 900; step++) {
      traffic.update(FIXED_STEP);
      for (const agent of traffic.agents) {
        const pose = traffic.visualPose(agent.id, 1)!;
        const before = previousYaw.get(agent.id);
        if (before !== undefined) {
          expect(Math.abs(wrapAngle(pose.yaw - before))).toBeLessThan(0.3);
          tracked++;
          if (previousEdge.get(agent.id) !== agent.edgeId) transitions++;
        }
        previousYaw.set(agent.id, pose.yaw);
        previousEdge.set(agent.id, agent.edgeId);
      }
    }

    expect(tracked).toBeGreaterThan(500);
    expect(transitions).toBeGreaterThan(10);
  });

  it('moves vehicles a bounded distance per rendered frame under uneven frame times', () => {
    const traffic = makeSystem();
    for (let step = 0; step < 240; step++) traffic.update(FIXED_STEP);

    const accumulator = new FixedStepAccumulator();
    const previous = new Map<number, { x: number; z: number }>();
    let compared = 0;
    let index = 0;
    for (let frame = 0; frame < 300; frame++) {
      const frameSeconds = FRAME_PATTERN[index++ % FRAME_PATTERN.length]!;
      const plan = accumulator.advance(frameSeconds);
      for (let k = 0; k < plan.steps; k++) traffic.update(FIXED_STEP);
      for (const agent of traffic.agents) {
        const pose = traffic.visualPose(agent.id, plan.alpha)!;
        const before = previous.get(agent.id);
        if (before) {
          const moved = Math.hypot(pose.x - before.x, pose.z - before.z);
          expect(moved).toBeLessThanOrEqual(9.5 * (frameSeconds + FIXED_STEP) + 1e-6);
          compared++;
        }
        previous.set(agent.id, { x: pose.x, z: pose.z });
      }
    }
    expect(compared).toBeGreaterThan(200);
  });
});
