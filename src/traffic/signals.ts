import type { Axis } from '../core/geo';

export type LightState = 'green' | 'yellow' | 'red';

export const PHASE = { green: 8, yellow: 2, allRed: 1 } as const;
export const AXIS_PHASE = PHASE.green + PHASE.yellow + PHASE.allRed;
export const CYCLE_LENGTH = AXIS_PHASE * 2;

export function signalState(axis: Axis, t: number): LightState {
  const u = ((t % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH;
  const nsGreenEnd = PHASE.green;
  const nsYellowEnd = nsGreenEnd + PHASE.yellow;
  const ewGreenStart = AXIS_PHASE;
  const ewGreenEnd = ewGreenStart + PHASE.green;
  const ewYellowEnd = ewGreenEnd + PHASE.yellow;
  if (axis === 'NS') {
    if (u < nsGreenEnd) return 'green';
    if (u < nsYellowEnd) return 'yellow';
    return 'red';
  }
  if (u >= ewGreenStart && u < ewGreenEnd) return 'green';
  if (u >= ewGreenEnd && u < ewYellowEnd) return 'yellow';
  return 'red';
}

export function timeUntilGreen(axis: Axis, t: number): number {
  const u = ((t % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH;
  if (axis === 'NS') {
    if (u < PHASE.green) return 0;
    return CYCLE_LENGTH - u;
  }
  if (u >= AXIS_PHASE && u < AXIS_PHASE + PHASE.green) return 0;
  if (u < AXIS_PHASE) return AXIS_PHASE - u;
  return CYCLE_LENGTH + AXIS_PHASE - u;
}

export class SignalController {
  private t: number;

  constructor(offset = 0) {
    this.t = ((offset % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH;
  }

  update(dt: number): void {
    this.t = (this.t + dt) % CYCLE_LENGTH;
  }

  get time(): number {
    return this.t;
  }

  state(axis: Axis): LightState {
    return signalState(axis, this.t);
  }

  timeUntilGreen(axis: Axis): number {
    return timeUntilGreen(axis, this.t);
  }
}
