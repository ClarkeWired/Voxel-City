import type { Axis } from '../core/geo';
import type { LaneEdge } from './graph';
import type { LightState } from './signals';

export interface AgentWorld {
  edge(id: string): LaneEdge;
  outEdges(nodeId: string): readonly LaneEdge[];
  leaderInfo(agent: VehicleAgent): { gap: number; deltaV: number };
  signal(axis: Axis): LightState;
  canEnter(agent: VehicleAgent, next: LaneEdge): boolean;
}

export interface AgentStop {
  edgeId: string;
  s: number;
  dwell: number;
  done: boolean;
}

export interface AgentOptions {
  id: number;
  edgeId: string;
  s: number;
  maxSpeed: number;
  length: number;
  rng: () => number;
  route?: string[];
  routeIndex?: number;
  routeLoop?: boolean;
  stops?: AgentStop[];
}

const IDM_A = 3.6;
const IDM_B = 4.2;
const IDM_S0 = 1.8;
const IDM_T = 0.85;
const BRAKE = 6.5;

function idm(v: number, v0: number, gap: number, deltaV: number): number {
  const free = 1 - Math.pow(v / Math.max(v0, 0.5), 4);
  let interaction = 0;
  if (gap < 100) {
    const sStar = IDM_S0 + Math.max(0, v * IDM_T + (v * deltaV) / (2 * Math.sqrt(IDM_A * IDM_B)));
    const safe = Math.max(gap, 0.1);
    interaction = (sStar / safe) ** 2;
  }
  return IDM_A * (free - interaction);
}

export class VehicleAgent {
  id: number;
  edgeId: string;
  s: number;
  v = 0;
  maxSpeed: number;
  length: number;
  next: string | undefined;
  route: string[] | undefined;
  routeIndex: number;
  routeLoop: boolean;
  stops: AgentStop[];
  dwelling = 0;
  arrived = false;
  arrivedStop: AgentStop | null = null;
  private rng: () => number;

  constructor(opts: AgentOptions) {
    this.id = opts.id;
    this.edgeId = opts.edgeId;
    this.s = opts.s;
    this.maxSpeed = opts.maxSpeed;
    this.length = opts.length;
    this.rng = opts.rng;
    this.route = opts.route;
    this.routeIndex = opts.routeIndex ?? 0;
    this.routeLoop = opts.routeLoop ?? false;
    this.stops = opts.stops ?? [];
  }

  consumeStopEvent(): AgentStop | null {
    const event = this.arrivedStop;
    this.arrivedStop = null;
    return event;
  }

  private chooseNext(edge: LaneEdge, world: AgentWorld): string | undefined {
    if (this.route && this.route.length > 0) {
      const nextIndex = this.routeIndex + 1;
      if (this.routeLoop) return this.route[nextIndex % this.route.length];
      return nextIndex < this.route.length ? this.route[nextIndex] : undefined;
    }
    const candidates = world.outEdges(edge.to);
    if (candidates.length === 0) return undefined;
    const weights: number[] = [];
    let total = 0;
    for (const candidate of candidates) {
      const w = candidate.maneuver === 'straight' ? 3 : 1.1;
      total += w;
      weights.push(total);
    }
    const roll = this.rng() * total;
    for (let i = 0; i < candidates.length; i++) {
      if (roll <= weights[i]!) return candidates[i]!.id;
    }
    return candidates[candidates.length - 1]!.id;
  }

  update(dt: number, world: AgentWorld): void {
    if (this.dwelling > 0) {
      this.dwelling -= dt;
      this.v = 0;
      return;
    }
    const edge = world.edge(this.edgeId);
    if (this.next === undefined && this.s > edge.length - 10) {
      this.next = this.chooseNext(edge, world);
    }

    let stopGap = Infinity;
    if (this.next !== undefined) {
      const nextEdge = world.edge(this.next);
      if (edge.kind === 'road' && nextEdge.kind === 'turn') {
        const distance = edge.length - this.s;
        const state = world.signal(edge.axis);
        const canStop = distance > (this.v * this.v) / (2 * BRAKE) + 0.8;
        const blocked = !world.canEnter(this, nextEdge);
        if (blocked || state === 'red' || (state === 'yellow' && canStop)) {
          stopGap = distance;
        }
      }
    }

    const leader = world.leaderInfo(this);
    let gap = leader.gap;
    let deltaV = leader.deltaV;
    if (stopGap < gap) {
      gap = stopGap;
      deltaV = this.v;
    }

    const a = idm(this.v, this.maxSpeed, gap, deltaV);
    this.v = Math.max(0, this.v + a * dt);
    const prevS = this.s;
    this.s += this.v * dt;

    for (const stop of this.stops) {
      if (stop.done || stop.edgeId !== this.edgeId) continue;
      if (prevS <= stop.s && this.s >= stop.s) {
        this.s = stop.s;
        this.v = 0;
        this.dwelling = stop.dwell;
        stop.done = true;
        this.arrivedStop = stop;
        break;
      }
    }

    if (this.s >= edge.length) {
      if (this.next !== undefined) {
        const nextEdge = world.edge(this.next);
        this.s -= edge.length;
        this.edgeId = nextEdge.id;
        if (this.route && this.route.length > 0) {
          this.routeIndex = this.routeLoop
            ? (this.routeIndex + 1) % this.route.length
            : this.routeIndex + 1;
        }
        for (const stop of this.stops) {
          if (stop.edgeId === this.edgeId) stop.done = false;
        }
        this.next = undefined;
      } else {
        this.s = edge.length;
        this.v = 0;
        this.arrived = true;
      }
    }
  }
}
