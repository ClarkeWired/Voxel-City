import { describe, expect, it } from 'vitest';
import {
  DAY_LENGTH,
  SimulationClock,
  SUNRISE,
  SUNSET,
  daylightFactor,
  horizonWarmth,
  sunArc,
} from './clock';

describe('SimulationClock', () => {
  it('starts at 08:00 day 1 by default', () => {
    const clock = new SimulationClock();
    expect(clock.minutes).toBe(8 * 60);
    expect(clock.day).toBe(1);
    expect(clock.timeString()).toBe('08:00');
  });

  it('advances at the configured speed', () => {
    const clock = new SimulationClock({ speed: 4 });
    clock.step(15);
    expect(clock.minutes).toBeCloseTo(8 * 60 + 60);
    expect(clock.timeString()).toBe('09:00');
  });

  it('pauses at speed 0', () => {
    const clock = new SimulationClock({ speed: 0 });
    clock.step(120);
    expect(clock.minutes).toBe(8 * 60);
  });

  it('rolls into the next day at midnight', () => {
    const clock = new SimulationClock({ minutes: DAY_LENGTH - 30, day: 3, speed: 1 });
    clock.step(45);
    expect(clock.day).toBe(4);
    expect(clock.minutes).toBeCloseTo(15);
    expect(clock.timeString()).toBe('00:15');
  });

  it('formats times and reports night', () => {
    const clock = new SimulationClock({ minutes: 23 * 60 + 5 });
    expect(clock.timeString()).toBe('23:05');
    expect(clock.isNight()).toBe(true);
    clock.setSpeed(2);
    expect(clock.speed).toBe(2);
    clock.setSpeed(-1);
    expect(clock.speed).toBe(2);
  });

  it('serializes and restores', () => {
    const clock = new SimulationClock({ minutes: 1000, day: 7, speed: 16 });
    const restored = new SimulationClock(clock.toJSON());
    expect(restored.toJSON()).toEqual(clock.toJSON());
    restored.step(60);
    expect(restored.day).toBe(8);
    expect(restored.minutes).toBe(1000 + 16 * 60 - DAY_LENGTH);
  });
});

describe('daylight', () => {
  it('is zero at night and one at noon', () => {
    expect(daylightFactor(0)).toBe(0);
    expect(daylightFactor(SUNRISE)).toBe(0);
    expect(daylightFactor(SUNSET)).toBe(0);
    expect(daylightFactor(13 * 60)).toBe(1);
    expect(daylightFactor(12 * 60)).toBe(1);
  });

  it('ramps up in the morning and down in the evening', () => {
    const dawn = daylightFactor(SUNRISE + 45);
    expect(dawn).toBeGreaterThan(0.2);
    expect(dawn).toBeLessThan(0.8);
    const dusk = daylightFactor(SUNSET - 45);
    expect(dusk).toBeGreaterThan(0.2);
    expect(dusk).toBeLessThan(0.8);
    expect(daylightFactor(SUNRISE + 120)).toBe(1);
    expect(daylightFactor(SUNSET - 120)).toBe(1);
  });

  it('holds full daylight through late morning and early afternoon', () => {
    expect(daylightFactor(11 * 60)).toBe(1);
    expect(daylightFactor(13 * 60)).toBe(1);
    expect(daylightFactor(15 * 60)).toBe(1);
  });

  it('reports horizon warmth at dawn and dusk only', () => {
    expect(horizonWarmth(SUNRISE)).toBe(1);
    expect(horizonWarmth(SUNSET)).toBe(1);
    expect(horizonWarmth(13 * 60)).toBe(0);
    expect(horizonWarmth(2 * 60)).toBe(0);
  });

  it('puts the sun above the horizon during the day', () => {
    expect(sunArc(13 * 60).y).toBeGreaterThan(80);
    expect(sunArc(SUNRISE).y).toBeCloseTo(0);
    expect(sunArc(SUNSET).y).toBeCloseTo(0, 5);
    expect(sunArc(11 * 60).y).toBeGreaterThan(0);
  });
});
