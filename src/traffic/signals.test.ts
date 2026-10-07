import { describe, expect, it } from 'vitest';
import { AXIS_PHASE, CYCLE_LENGTH, PHASE, signalState, timeUntilGreen } from './signals';

describe('signal cycle', () => {
  it('starts with NS green and EW red', () => {
    expect(signalState('NS', 0)).toBe('green');
    expect(signalState('EW', 0)).toBe('red');
  });

  it('runs NS green -> yellow -> all red -> EW green -> yellow -> all red', () => {
    expect(signalState('NS', PHASE.green - 0.1)).toBe('green');
    expect(signalState('NS', PHASE.green + 0.5)).toBe('yellow');
    expect(signalState('NS', AXIS_PHASE + 0.5)).toBe('red');
    expect(signalState('EW', AXIS_PHASE + 0.5)).toBe('green');
    expect(signalState('EW', AXIS_PHASE + PHASE.green + 0.5)).toBe('yellow');
    expect(signalState('EW', CYCLE_LENGTH - 0.5)).toBe('red');
    expect(signalState('NS', CYCLE_LENGTH + 0.5)).toBe('green');
  });

  it('never shows both axes green or yellow', () => {
    for (let t = 0; t < CYCLE_LENGTH * 2; t += 0.25) {
      const ns = signalState('NS', t);
      const ew = signalState('EW', t);
      expect(ns === 'green' && ew === 'green').toBe(false);
      expect(ns === 'yellow' && ew === 'yellow').toBe(false);
      expect(ns === 'green' && ew === 'yellow').toBe(false);
      expect(ns === 'yellow' && ew === 'green').toBe(false);
    }
  });

  it('has an all-red clearance window between phases', () => {
    expect(signalState('NS', PHASE.green + PHASE.yellow + 0.5)).toBe('red');
    expect(signalState('EW', PHASE.green + PHASE.yellow + 0.5)).toBe('red');
  });

  it('computes time until next green', () => {
    expect(timeUntilGreen('NS', 0)).toBe(0);
    expect(timeUntilGreen('EW', 0)).toBeCloseTo(AXIS_PHASE);
    expect(timeUntilGreen('EW', 12)).toBe(0);
    expect(timeUntilGreen('NS', 9)).toBeCloseTo(CYCLE_LENGTH - 9);
  });

  it('is periodic', () => {
    for (let t = 0; t < CYCLE_LENGTH; t += 0.5) {
      expect(signalState('NS', t)).toBe(signalState('NS', t + CYCLE_LENGTH * 3));
      expect(signalState('EW', t)).toBe(signalState('EW', t + CYCLE_LENGTH * 2));
    }
  });
});
