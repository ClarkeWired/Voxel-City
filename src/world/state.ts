import type { Rng } from '../core/rng';
import type { ClockState } from './clock';
import { DAY_LENGTH } from './clock';
import type { RoadClosure } from './closures';
import { parseCitizenStates, type CitizenState } from './citizens';
import { parseIncidents, type Incident } from './incidents';
import { parseWeather, type WeatherState } from './weather';
import { parseCongestion } from '../traffic/congestion';

export const WORLD_VERSION = 6;

export interface WorldState {
  version: number;
  clock: ClockState;
  rngState: number;
  closures: RoadClosure[];
  incidents: Incident[];
  citizens: CitizenState[];
  weather: WeatherState | null;
  congestion: Record<string, number>;
}

export function createWorldState(seedMinutes = 8 * 60): WorldState {
  return {
    version: WORLD_VERSION,
    clock: { minutes: seedMinutes, day: 1, speed: 1 },
    rngState: 0,
    closures: [],
    incidents: [],
    citizens: [],
    weather: null,
    congestion: {},
  };
}

export function serializeWorld(state: WorldState): string {
  return JSON.stringify(state);
}

// Only a world that came back from storage carries a meaningful rngState;
// a fresh one would rewind the seed to 0, so it must be left alone.
export function resumeRngFromSave(rng: Rng, saved: WorldState | null): void {
  if (saved) rng.restore(saved.rngState);
}

function parseClosure(raw: unknown): RoadClosure | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.edgeId !== 'string' ||
    typeof record.reason !== 'string' ||
    typeof record.startMinutes !== 'number' ||
    typeof record.endMinutes !== 'number' ||
    !Number.isFinite(record.startMinutes) ||
    !Number.isFinite(record.endMinutes)
  ) {
    return null;
  }
  return {
    id: record.id,
    edgeId: record.edgeId,
    reason: record.reason,
    startMinutes: record.startMinutes,
    endMinutes: record.endMinutes,
  };
}

export function deserializeWorld(json: string): WorldState {
  const raw: unknown = JSON.parse(json);
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('world state must be an object');
  }
  const record = raw as Record<string, unknown>;
  if (
    record.version !== 1 &&
    record.version !== 2 &&
    record.version !== 3 &&
    record.version !== 4 &&
    record.version !== 5 &&
    record.version !== WORLD_VERSION
  ) {
    throw new Error(`unsupported world version: ${String(record.version)}`);
  }
  const clock = record.clock as Record<string, unknown> | undefined;
  if (
    !clock ||
    typeof clock.minutes !== 'number' ||
    typeof clock.day !== 'number' ||
    typeof clock.speed !== 'number'
  ) {
    throw new Error('invalid clock state');
  }
  const { minutes, day, speed } = clock;
  if (!Number.isFinite(minutes) || !Number.isFinite(day) || !Number.isFinite(speed)) {
    throw new Error('clock values must be finite');
  }
  if (speed < 0) throw new Error('clock speed must not be negative');
  if (minutes < 0 || minutes >= DAY_LENGTH * 2) throw new Error('clock minutes out of range');

  const rngState =
    typeof record.rngState === 'number' && Number.isInteger(record.rngState) && record.rngState >= 0
      ? record.rngState >>> 0
      : 0;

  const closures: RoadClosure[] = [];
  if (Array.isArray(record.closures)) {
    for (const entry of record.closures) {
      const closure = parseClosure(entry);
      if (closure) closures.push(closure);
    }
  }

  return {
    version: WORLD_VERSION,
    clock: { minutes, day, speed },
    rngState,
    closures,
    incidents: parseIncidents(record.incidents),
    citizens: parseCitizenStates(record.citizens),
    weather: parseWeather(record.weather),
    congestion: parseCongestion(record.congestion),
  };
}
