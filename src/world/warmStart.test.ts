import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { CitizenSystem } from './citizens';

describe('warm start', () => {
  it('initializes citizens as traveling during morning rush', () => {
    const system = new CitizenSystem(60, new Rng(42), 8 * 60);
    expect(system.travelingCount).toBeGreaterThan(0);
    expect(system.travelingCount).toBeLessThan(60);
  });

  it('produces more traveling citizens later in the rush than earlier', () => {
    const early = new CitizenSystem(60, new Rng(42), 7 * 60);
    const late = new CitizenSystem(60, new Rng(42), 9 * 60);
    expect(late.travelingCount).toBeGreaterThan(early.travelingCount);
  });

  it('produces no traveling citizens outside rush hours', () => {
    const system = new CitizenSystem(60, new Rng(42), 14 * 60);
    expect(system.travelingCount).toBe(0);
  });

  it('is deterministic for the same seed', () => {
    const a = new CitizenSystem(60, new Rng(42), 8 * 60);
    const b = new CitizenSystem(60, new Rng(42), 8 * 60);
    expect(a.travelingCount).toBe(b.travelingCount);
    expect(a.toJSON()).toEqual(b.toJSON());
  });

  it('can be disabled', () => {
    const system = new CitizenSystem(60, new Rng(42), 8 * 60, { warmStart: false });
    expect(system.travelingCount).toBe(0);
  });

  it('traveling citizens have valid trip state', () => {
    const system = new CitizenSystem(60, new Rng(42), 8 * 60);
    for (const citizen of system.toJSON()) {
      if (!citizen.traveling) continue;
      expect(citizen.tripAgentId).toBeGreaterThan(0);
      expect(citizen.targetBlock).toBe(citizen.workBlock);
      expect(citizen.activity).toBe('home');
    }
  });
});
