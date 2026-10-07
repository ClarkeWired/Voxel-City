const RISE_SECONDS = 25;
const FALL_SECONDS = 45;
const COST_WEIGHT = 1.4;
const STRESS_NORMALISER = 6;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export class CongestionTracker {
  private readonly levels = new Map<string, number>();

  constructor(initial?: Record<string, number>) {
    if (initial) {
      for (const [edgeId, level] of Object.entries(initial)) {
        if (typeof level === 'number' && Number.isFinite(level) && level > 0) {
          this.levels.set(edgeId, clamp01(level));
        }
      }
    }
  }

  static fromJSON(raw: unknown): CongestionTracker {
    return new CongestionTracker(parseCongestion(raw));
  }

  observe(edgeId: string, occupancy: number, speedRatio: number, dt: number): void {
    const pressure =
      occupancy <= 0 ? 0 : Math.min(1, occupancy / 6) * (1 - clamp01(speedRatio));
    const current = this.levels.get(edgeId) ?? 0;
    const relax = pressure > current ? RISE_SECONDS : FALL_SECONDS;
    const next = current + (pressure - current) * Math.min(1, dt / relax);
    if (next < 0.005 && pressure === 0) {
      this.levels.delete(edgeId);
    } else if (next > 0) {
      this.levels.set(edgeId, next);
    }
  }

  level(edgeId: string): number {
    return this.levels.get(edgeId) ?? 0;
  }

  costFactor(edgeId: string): number {
    return 1 + COST_WEIGHT * this.level(edgeId);
  }

  get entries(): [string, number][] {
    return [...this.levels.entries()];
  }

  get stress(): number {
    let sum = 0;
    for (const level of this.levels.values()) sum += level;
    return Math.min(1, sum / STRESS_NORMALISER);
  }

  toJSON(): Record<string, number> {
    return Object.fromEntries(this.levels);
  }
}

export function parseCongestion(raw: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  if (typeof raw !== 'object' || raw === null) return result;
  for (const [edgeId, level] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof level === 'number' && Number.isFinite(level) && level > 0) {
      result[edgeId] = clamp01(level);
    }
  }
  return result;
}
