import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { CitizenSystem } from './citizens';

function dueCount(system: CitizenSystem, at: number): number {
  return system.toJSON().filter((c) => c.nextDepart <= at).length;
}

describe('warm start', () => {
  it('marks rush-hour citizens as due for departure during morning rush', () => {
    const system = new CitizenSystem(60, new Rng(42), 8 * 60);
    const due = dueCount(system, 8 * 60);
    expect(due).toBeGreaterThan(0);
    expect(due).toBeLessThan(60);
  });

  it('produces more due citizens later in the rush than earlier', () => {
    const early = new CitizenSystem(60, new Rng(42), 7 * 60);
    const late = new CitizenSystem(60, new Rng(42), 9 * 60);
    expect(dueCount(late, 9 * 60)).toBeGreaterThan(dueCount(early, 7 * 60));
  });

  it('produces no due citizens outside rush hours', () => {
    const system = new CitizenSystem(60, new Rng(42), 14 * 60);
    expect(dueCount(system, 14 * 60)).toBe(0);
  });

  it('is deterministic for the same seed', () => {
    const a = new CitizenSystem(60, new Rng(42), 8 * 60);
    const b = new CitizenSystem(60, new Rng(42), 8 * 60);
    expect(a.toJSON()).toEqual(b.toJSON());
  });

  it('can be disabled', () => {
    const enabled = new CitizenSystem(60, new Rng(42), 8 * 60, { warmStart: true });
    const disabled = new CitizenSystem(60, new Rng(42), 8 * 60, { warmStart: false });
    expect(dueCount(disabled, 8 * 60)).toBeLessThan(dueCount(enabled, 8 * 60));
  });

  it('warm-start citizens depart and receive real agents on the first update', () => {
    const system = new CitizenSystem(60, new Rng(42), 8 * 60);
    const demands = system.update(8 * 60);
    expect(demands.length).toBeGreaterThan(0);
    for (const demand of demands) {
      system.assignAgent(demand.citizenId, demand.citizenId + 500000);
    }
    expect(system.travelingCount).toBe(demands.length);
    for (const citizen of system.toJSON()) {
      if (!citizen.traveling) continue;
      expect(citizen.tripAgentId).toBeGreaterThan(0);
      expect(citizen.targetBlock).toBe(citizen.workBlock);
      expect(citizen.activity).toBe('home');
    }
  });
});
