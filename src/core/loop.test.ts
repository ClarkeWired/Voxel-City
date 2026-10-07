import { describe, expect, it } from 'vitest';
import { FIXED_STEP, FixedStepAccumulator, MAX_FRAME_SECONDS, MAX_STEPS_PER_FRAME } from './loop';

describe('FixedStepAccumulator', () => {
  it('turns uneven frame times into whole steps plus an interpolation fraction', () => {
    const accumulator = new FixedStepAccumulator();
    const frames = [0.004, 0.0166, 0.033, 0.05, 0.008, 0.021, 0.0166, 0.049];
    let consumed = 0;
    let steps = 0;
    for (const frame of frames) {
      const plan = accumulator.advance(frame);
      consumed += Math.min(frame, MAX_FRAME_SECONDS);
      steps += plan.steps;
      expect(plan.alpha).toBeGreaterThanOrEqual(0);
      expect(plan.alpha).toBeLessThan(1);
      expect(steps * FIXED_STEP + plan.alpha * FIXED_STEP).toBeCloseTo(consumed, 9);
    }
    expect(steps).toBeGreaterThan(0);
  });

  it('keeps simulated time behind real time by less than one step', () => {
    const accumulator = new FixedStepAccumulator();
    const frames = [1 / 120, 1 / 60, 1 / 30, 1 / 20];
    let steps = 0;
    let realTime = 0;
    for (let i = 0; i < 2000; i++) {
      const frame = frames[i % frames.length]!;
      const plan = accumulator.advance(frame);
      steps += plan.steps;
      realTime += frame;
      expect(plan.alpha).toBeLessThan(1);
    }
    const simulatedTime = steps * FIXED_STEP + accumulator.alpha * FIXED_STEP;
    expect(simulatedTime).toBeLessThanOrEqual(realTime + 1e-9);
    expect(realTime - simulatedTime).toBeLessThan(FIXED_STEP);
  });

  it('caps a single runaway frame at the step budget', () => {
    const accumulator = new FixedStepAccumulator(FIXED_STEP, 10, MAX_STEPS_PER_FRAME);
    const plan = accumulator.advance(10);
    expect(plan.steps).toBe(MAX_STEPS_PER_FRAME);
    expect(accumulator.alpha).toBeLessThan(1e-12);
  });

  it('drops frame time that is not a positive finite duration', () => {
    const accumulator = new FixedStepAccumulator();
    expect(accumulator.advance(-1).steps).toBe(0);
    expect(accumulator.advance(Number.NaN).steps).toBe(0);
    expect(accumulator.advance(0).steps).toBe(0);
    expect(accumulator.alpha).toBe(0);
  });

  it('reaches the same step count for a duration split across frames', () => {
    const whole = new FixedStepAccumulator();
    let steps = 0;
    for (let i = 0; i < 120; i++) steps += whole.advance(FIXED_STEP).steps;

    const split = new FixedStepAccumulator();
    let splitSteps = 0;
    for (let i = 0; i < 240; i++) splitSteps += split.advance(FIXED_STEP / 2).steps;

    expect(splitSteps).toBe(steps);
    expect(split.alpha).toBeCloseTo(whole.alpha, 9);
  });
});
