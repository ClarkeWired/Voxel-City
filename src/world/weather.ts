import type { Rng } from '../core/rng';
import { DAY_LENGTH } from './clock';

export type WeatherKind = 'clear' | 'rain' | 'storm' | 'fog';

export interface WeatherState {
  kind: WeatherKind;
  intensity: number;
  until: number;
}

export interface DriveConditions {
  speedFactor: number;
  headwayFactor: number;
  brakeFactor: number;
  visibility: number;
}

export const CLEAR_CONDITIONS: DriveConditions = {
  speedFactor: 1,
  headwayFactor: 1,
  brakeFactor: 1,
  visibility: 1,
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function conditionsFor(weather: WeatherState): DriveConditions {
  const i = clamp01(weather.intensity);
  switch (weather.kind) {
    case 'clear':
      return { ...CLEAR_CONDITIONS };
    case 'rain':
      return {
        speedFactor: 1 - 0.18 * i,
        headwayFactor: 1 + 0.35 * i,
        brakeFactor: 1 - 0.2 * i,
        visibility: 1 - 0.25 * i,
      };
    case 'storm':
      return {
        speedFactor: 1 - 0.35 * i,
        headwayFactor: 1 + 0.6 * i,
        brakeFactor: 1 - 0.4 * i,
        visibility: 1 - 0.5 * i,
      };
    case 'fog':
      return {
        speedFactor: 1 - 0.3 * i,
        headwayFactor: 1 + 0.5 * i,
        brakeFactor: 1 - 0.1 * i,
        visibility: 1 - 0.75 * i,
      };
  }
}

export function isWeatherKind(value: unknown): value is WeatherKind {
  return value === 'clear' || value === 'rain' || value === 'storm' || value === 'fog';
}

export function parseWeather(raw: unknown): WeatherState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  if (!isWeatherKind(record.kind)) return null;
  if (typeof record.intensity !== 'number' || !Number.isFinite(record.intensity)) return null;
  if (typeof record.until !== 'number' || !Number.isFinite(record.until)) return null;
  return {
    kind: record.kind,
    intensity: clamp01(record.intensity),
    until: record.until,
  };
}

const TRANSITIONS: Record<WeatherKind, [WeatherKind, number][]> = {
  clear: [
    ['clear', 0.5],
    ['rain', 0.3],
    ['fog', 0.12],
    ['storm', 0.08],
  ],
  rain: [
    ['clear', 0.4],
    ['rain', 0.3],
    ['storm', 0.2],
    ['fog', 0.1],
  ],
  storm: [
    ['rain', 0.45],
    ['clear', 0.4],
    ['storm', 0.1],
    ['fog', 0.05],
  ],
  fog: [
    ['clear', 0.6],
    ['fog', 0.25],
    ['rain', 0.15],
  ],
};

export class WeatherSystem {
  private readonly rng: Rng;
  private state: WeatherState;

  constructor(rng: Rng, state?: WeatherState, at = 0) {
    this.rng = rng;
    this.state = state ?? { kind: 'clear', intensity: 0, until: at + this.rng.range(20, 50) };
  }

  get current(): WeatherState {
    return this.state;
  }

  update(at: number): WeatherState {
    if (at < this.state.until) return this.state;
    const kind = this.nextKind(at);
    const intensity = kind === 'clear' ? 0 : this.rng.range(0.4, 1);
    this.state = {
      kind,
      intensity,
      until: at + this.rng.range(15, 45),
    };
    return this.state;
  }

  private nextKind(at: number): WeatherKind {
    const hour = ((at % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH / 60;
    const weights = TRANSITIONS[this.state.kind].map(([kind, weight]) => {
      const adjusted = kind === 'fog' && hour >= 4 && hour < 10 ? weight * 2.5 : weight;
      return [kind, adjusted] as [WeatherKind, number];
    });
    let total = 0;
    for (const [, weight] of weights) total += weight;
    let roll = this.rng.next() * total;
    for (const [kind, weight] of weights) {
      roll -= weight;
      if (roll <= 0) return kind;
    }
    return weights[weights.length - 1]![0];
  }

  toJSON(): WeatherState {
    return { ...this.state };
  }

  static fromJSON(raw: unknown, rng: Rng, at: number): WeatherSystem {
    const parsed = parseWeather(raw);
    return new WeatherSystem(rng, parsed ?? undefined, at);
  }
}
