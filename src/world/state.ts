import type { ClockState } from './clock';

export const WORLD_VERSION = 1;

export interface WorldState {
  version: number;
  clock: ClockState;
  rngState: number;
}

export function createWorldState(seedMinutes = 8 * 60): WorldState {
  return {
    version: WORLD_VERSION,
    clock: { minutes: seedMinutes, day: 1, speed: 1 },
    rngState: 0,
  };
}

export function serializeWorld(state: WorldState): string {
  return JSON.stringify(state);
}

export function deserializeWorld(json: string): WorldState {
  const raw: unknown = JSON.parse(json);
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('world state must be an object');
  }
  const record = raw as Record<string, unknown>;
  if (record.version !== WORLD_VERSION) {
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
  const rngState =
    typeof record.rngState === 'number' && Number.isInteger(record.rngState) && record.rngState >= 0
      ? record.rngState >>> 0
      : 0;
  return {
    version: WORLD_VERSION,
    clock: { minutes, day, speed },
    rngState,
  };
}
