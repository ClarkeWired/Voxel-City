export interface ClockState {
  minutes: number;
  day: number;
  speed: number;
}

export const DAY_LENGTH = 24 * 60;
export const SUNRISE = 6 * 60;
export const SUNSET = 20 * 60;
export const SPEEDS: readonly number[] = [0, 1, 4, 16];

export class SimulationClock {
  private state: ClockState;

  constructor(state?: Partial<ClockState>) {
    this.state = {
      minutes: state?.minutes ?? 8 * 60,
      day: state?.day ?? 1,
      speed: state?.speed ?? 1,
    };
  }

  step(realSeconds: number): void {
    this.state.minutes += realSeconds * this.state.speed;
    while (this.state.minutes >= DAY_LENGTH) {
      this.state.minutes -= DAY_LENGTH;
      this.state.day += 1;
    }
  }

  get minutes(): number {
    return this.state.minutes;
  }

  get day(): number {
    return this.state.day;
  }

  get speed(): number {
    return this.state.speed;
  }

  setSpeed(speed: number): void {
    if (speed < 0 || !Number.isFinite(speed)) return;
    this.state.speed = speed;
  }

  get hour(): number {
    return this.state.minutes / 60;
  }

  timeString(): string {
    const total = Math.floor(this.state.minutes);
    const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  isNight(): boolean {
    return this.state.minutes < SUNRISE || this.state.minutes >= SUNSET;
  }

  toJSON(): ClockState {
    return { ...this.state };
  }
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function daylightFactor(minutes: number): number {
  const m = ((minutes % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH;
  if (m <= SUNRISE || m >= SUNSET) return 0;
  const dawn = smoothstep(SUNRISE, SUNRISE + 90, m);
  const dusk = 1 - smoothstep(SUNSET - 90, SUNSET, m);
  return Math.min(dawn, dusk);
}

export function horizonWarmth(minutes: number): number {
  const m = ((minutes % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH;
  const dawn = Math.max(0, 1 - Math.abs(m - SUNRISE) / 120);
  const dusk = Math.max(0, 1 - Math.abs(m - SUNSET) / 120);
  return Math.min(1, dawn + dusk);
}

export interface SunArc {
  x: number;
  y: number;
  z: number;
}

export function sunArc(minutes: number): SunArc {
  const span = SUNSET - SUNRISE;
  const phase = ((minutes - SUNRISE) / span) * Math.PI;
  return { x: Math.cos(phase) * 110, y: Math.sin(phase) * 120, z: 55 };
}
