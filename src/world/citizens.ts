import type { Rng } from '../core/rng';
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
}

const DEFAULT_CONFIG: CitizenConfig = { maxActiveTrips: 26 };

const BLOCK_COUNT = 9;
const WORK_WEIGHTS = [1, 2, 1, 2, 4, 2, 1, 2, 1];
const HOME_WEIGHTS = [3, 1, 3, 1, 1, 1, 3, 1, 3];

function weightedPick(rng: Rng, weights: readonly number[]): number {
  let total = 0;
  for (const weight of weights) total += weight;
  let roll = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return i;
  }
  return weights.length - 1;
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
        homeBlock: weightedPick(rng, HOME_WEIGHTS),
        workBlock: weightedPick(rng, WORK_WEIGHTS),
        shopBlock: shopper ? weightedPick(rng, HOME_WEIGHTS) : -1,
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
