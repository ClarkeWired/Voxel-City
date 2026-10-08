import type { Rng } from '../core/rng';
import { GRID_N } from '../city/grid';
import { DAY_LENGTH } from './clock';

export type Activity = 'home' | 'work' | 'shop';

export interface TravelDemand {
  citizenId: number;
  fromBlock: number;
  toBlock: number;
}

export interface CitizenState {
  id: number;
  homeBlock: number;
  workBlock: number;
  shopBlock: number;
  location: number;
  activity: Activity;
  nextDepart: number;
  traveling: boolean;
  tripAgentId: number;
  targetBlock: number;
  workStart: number;
  workEnd: number;
  shopDwell: number;
}

export interface CitizenConfig {
  maxActiveTrips: number;
  warmStart?: boolean;
}

const DEFAULT_CONFIG: CitizenConfig = { maxActiveTrips: 26, warmStart: true };

const BLOCK_COUNT = GRID_N * GRID_N;

function blockWeight(bi: number, bj: number, kind: 'home' | 'work'): number {
  const ci = bi - (GRID_N - 1) / 2;
  const cj = bj - (GRID_N - 1) / 2;
  const dist = Math.sqrt(ci * ci + cj * cj);
  if (kind === 'work') {
    return 1 + Math.round(4 * Math.max(0, 1 - dist / 3));
  }
  return 1 + Math.round(2 * Math.min(1, dist / 2.5));
}

function homeWeight(block: number): number {
  return blockWeight(Math.floor(block / GRID_N), block % GRID_N, 'home');
}

function workWeight(block: number): number {
  return blockWeight(Math.floor(block / GRID_N), block % GRID_N, 'work');
}

function weightedPick(rng: Rng, weight: (block: number) => number): number {
  let total = 0;
  for (let i = 0; i < BLOCK_COUNT; i++) total += weight(i);
  let roll = rng.next() * total;
  for (let i = 0; i < BLOCK_COUNT; i++) {
    roll -= weight(i);
    if (roll <= 0) return i;
  }
  return BLOCK_COUNT - 1;
}

function dayStart(at: number): number {
  return Math.floor(at / DAY_LENGTH) * DAY_LENGTH;
}

function validBlock(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < BLOCK_COUNT;
}

function parseCitizen(raw: unknown): CitizenState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== 'number' || !Number.isInteger(record.id)) return null;
  if (!validBlock(record.homeBlock) || !validBlock(record.workBlock)) return null;
  const shopBlock = record.shopBlock;
  if (shopBlock !== -1 && !validBlock(shopBlock)) return null;
  if (!validBlock(record.location) || !validBlock(record.targetBlock)) return null;
  const activity = record.activity;
  if (activity !== 'home' && activity !== 'work' && activity !== 'shop') return null;
  if (
    typeof record.nextDepart !== 'number' ||
    !Number.isFinite(record.nextDepart) ||
    typeof record.workStart !== 'number' ||
    typeof record.workEnd !== 'number' ||
    typeof record.shopDwell !== 'number'
  ) {
    return null;
  }
  return {
    id: record.id,
    homeBlock: record.homeBlock,
    workBlock: record.workBlock,
    shopBlock: shopBlock as number,
    location: record.location,
    activity,
    nextDepart: record.nextDepart,
    traveling: record.traveling === true,
    tripAgentId: typeof record.tripAgentId === 'number' ? record.tripAgentId : -1,
    targetBlock: record.targetBlock,
    workStart: record.workStart,
    workEnd: record.workEnd,
    shopDwell: record.shopDwell,
  };
}

export function parseCitizenStates(raw: unknown): CitizenState[] {
  if (!Array.isArray(raw)) return [];
  const states: CitizenState[] = [];
  for (const entry of raw) {
    const state = parseCitizen(entry);
    if (state) states.push(state);
  }
  return states;
}

export class CitizenSystem {
  private readonly citizens: CitizenState[] = [];
  private readonly rng: Rng;
  private readonly config: CitizenConfig;

  constructor(count: number, rng: Rng, nowAt: number, config: Partial<CitizenConfig> = {}) {
    this.rng = rng;
    this.config = { ...DEFAULT_CONFIG, ...config };
    for (let i = 0; i < count; i++) {
      const workStart = 8 * 60 + Math.round(rng.range(-50, 50));
      const workEnd = 17 * 60 + Math.round(rng.range(-50, 50));
      const shopper = rng.chance(0.45);
      const base = dayStart(nowAt) + workStart;
      this.citizens.push({
        id: i + 1,
        homeBlock: weightedPick(rng, homeWeight),
        workBlock: weightedPick(rng, workWeight),
        shopBlock: shopper ? weightedPick(rng, homeWeight) : -1,
        location: 0,
        activity: 'home',
        nextDepart: base >= nowAt ? base : nowAt + rng.range(0, 10),
        traveling: false,
        tripAgentId: -1,
        targetBlock: 0,
        workStart,
        workEnd,
        shopDwell: Math.round(rng.range(35, 80)),
      });
    }
    for (const citizen of this.citizens) {
      citizen.location = citizen.homeBlock;
      citizen.targetBlock = citizen.workBlock;
    }
    if (this.config.warmStart) this.applyWarmStart(nowAt);
  }

  private applyWarmStart(nowAt: number): void {
    const hour = ((nowAt % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH / 60;
    if (hour < 6.5 || hour > 10) return;
    const rushProgress = Math.min(1, Math.max(0, (hour - 6.5) / 2.5));
    const warmCount = Math.floor(this.citizens.length * rushProgress * 0.7);
    for (let i = 0; i < warmCount; i++) {
      const citizen = this.citizens[i];
      if (!citizen || citizen.traveling) continue;
      const departTime = dayStart(nowAt) + citizen.workStart;
      if (departTime >= nowAt) continue;
      citizen.nextDepart = nowAt;
    }
  }

  static fromJSON(raw: unknown, rng: Rng, config: Partial<CitizenConfig> = {}): CitizenSystem {
    const states = parseCitizenStates(raw);
    const system = new CitizenSystem(0, rng, 0, config);
    system.citizens.push(...states);
    return system;
  }

  toJSON(): CitizenState[] {
    return this.citizens.map((citizen) => ({ ...citizen }));
  }

  get count(): number {
    return this.citizens.length;
  }

  get travelingCount(): number {
    let count = 0;
    for (const citizen of this.citizens) if (citizen.traveling) count++;
    return count;
  }

  update(at: number): TravelDemand[] {
    const demands: TravelDemand[] = [];
    let budget = this.config.maxActiveTrips - this.travelingCount;
    if (budget <= 0) return demands;
    for (const citizen of this.citizens) {
      if (budget <= 0) break;
      if (citizen.traveling || at < citizen.nextDepart) continue;
      const toBlock = this.targetFor(citizen);
      if (toBlock === citizen.location) {
        this.advance(citizen, at);
        continue;
      }
      demands.push({ citizenId: citizen.id, fromBlock: citizen.location, toBlock });
      budget--;
    }
    return demands;
  }

  assignAgent(citizenId: number, agentId: number): void {
    const citizen = this.citizens.find((c) => c.id === citizenId);
    if (!citizen || citizen.traveling) return;
    citizen.traveling = true;
    citizen.tripAgentId = agentId;
    citizen.targetBlock = this.targetFor(citizen);
  }

  deferTrip(citizenId: number, at: number): void {
    const citizen = this.citizens.find((c) => c.id === citizenId);
    if (!citizen || citizen.traveling) return;
    citizen.nextDepart = at + this.rng.range(2, 6);
  }

  handleAgentArrived(agentId: number, at: number): void {
    const citizen = this.citizens.find((c) => c.traveling && c.tripAgentId === agentId);
    if (!citizen) return;
    citizen.traveling = false;
    citizen.tripAgentId = -1;
    citizen.location = citizen.targetBlock;
    this.arrive(citizen, at);
  }

  // Vehicle agents are not part of WorldState, so after a reload a saved trip
  // refers to an id that can never emit 'vehicle-arrived'. Releasing those
  // citizens keeps them departing instead of waiting forever; location still
  // holds the origin block, so the interrupted trip restarts towards targetBlock.
  resumeInterruptedTrips(at: number, agentExists: (agentId: number) => boolean): number {
    let released = 0;
    for (const citizen of this.citizens) {
      if (!citizen.traveling || agentExists(citizen.tripAgentId)) continue;
      citizen.traveling = false;
      citizen.tripAgentId = -1;
      citizen.nextDepart = at;
      released++;
    }
    return released;
  }

  private targetFor(citizen: CitizenState): number {
    if (citizen.activity === 'home') return citizen.workBlock;
    if (citizen.activity === 'work') {
      return citizen.shopBlock >= 0 ? citizen.shopBlock : citizen.homeBlock;
    }
    return citizen.homeBlock;
  }

  private advance(citizen: CitizenState, at: number): void {
    citizen.location = citizen.targetBlock;
    this.arrive(citizen, at);
  }

  private arrive(citizen: CitizenState, at: number): void {
    const base = dayStart(at);
    if (citizen.location === citizen.workBlock) {
      citizen.activity = 'work';
      citizen.nextDepart = this.after(at, base + citizen.workEnd);
      citizen.targetBlock = this.targetFor(citizen);
      return;
    }
    if (citizen.shopBlock >= 0 && citizen.location === citizen.shopBlock) {
      citizen.activity = 'shop';
      citizen.nextDepart = at + citizen.shopDwell;
      citizen.targetBlock = citizen.homeBlock;
      return;
    }
    citizen.activity = 'home';
    citizen.nextDepart = this.after(at, base + citizen.workStart + DAY_LENGTH);
    citizen.targetBlock = citizen.workBlock;
  }

  private after(at: number, candidate: number): number {
    let next = candidate;
    while (next <= at) next += DAY_LENGTH;
    return next;
  }
}
