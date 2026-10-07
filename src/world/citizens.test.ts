import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { DAY_LENGTH } from './clock';
import { CitizenSystem, parseCitizenStates } from './citizens';

function dueAt(system: CitizenSystem, at: number): number {
  return system.update(at).length;
}

describe('CitizenSystem', () => {
  it('starts with citizens at home awaiting their morning commute', () => {
    const system = new CitizenSystem(40, new Rng(7), 8 * 60);
    expect(system.count).toBe(40);
    expect(system.travelingCount).toBe(0);
    const morning = system.update(8 * 60 + 11);
    expect(morning.length).toBeGreaterThan(0);
    for (const demand of morning) {
      const state = system.toJSON().find((c) => c.id === demand.citizenId)!;
      expect(state.activity).toBe('home');
      expect(demand.fromBlock).toBe(state.homeBlock);
      expect(demand.toBlock).toBe(state.workBlock);
    }
  });

  it('emits no demands before departure time', () => {
    const system = new CitizenSystem(40, new Rng(7), 0);
    expect(dueAt(system, 8 * 60 - 60)).toBe(0);
  });

  it('caps active trips', () => {
    const system = new CitizenSystem(60, new Rng(3), 0, { maxActiveTrips: 10 });
    const demands = system.update(9 * 60);
    expect(demands.length).toBeLessThanOrEqual(10);
  });

  it('completes the home -> work -> shop -> home cycle', () => {
    const system = new CitizenSystem(1, new Rng(11), 8 * 60);
    const citizen = system.toJSON()[0]!;
    citizen.shopBlock = citizen.shopBlock >= 0 ? citizen.shopBlock : (citizen.homeBlock + 1) % 9;
    const rebuilt = CitizenSystem.fromJSON([citizen], new Rng(11));
    const demos = rebuilt.update(citizen.nextDepart);
    expect(demos.length).toBe(1);
    rebuilt.assignAgent(demos[0]!.citizenId, 99);
    expect(rebuilt.travelingCount).toBe(1);
    rebuilt.handleAgentArrived(99, citizen.nextDepart + 20);
    const afterWork = rebuilt.toJSON()[0]!;
    expect(afterWork.activity).toBe('work');
    expect(afterWork.location).toBe(afterWork.workBlock);
    expect(afterWork.nextDepart).toBeGreaterThan(citizen.nextDepart + 20);
  });

  it('sends workers to a shop when they have one, otherwise home', () => {
    const rng = new Rng(21);
    const system = new CitizenSystem(30, rng, 8 * 60);
    for (const citizen of system.toJSON()) {
      const at = citizen.nextDepart;
      const demands = system.update(at);
      const demand = demands.find((d) => d.citizenId === citizen.id);
      if (!demand) continue;
      system.assignAgent(demand.citizenId, citizen.id);
      system.handleAgentArrived(citizen.id, at + 15);
    }
    const atWork = system.toJSON().filter((c) => c.activity === 'work');
    expect(atWork.length).toBeGreaterThan(0);
    for (const worker of atWork) {
      const eveningAt = worker.nextDepart;
      const demands = system.update(eveningAt);
      const demand = demands.find((d) => d.citizenId === worker.id);
      if (!demand) continue;
      if (worker.shopBlock >= 0) {
        expect(demand.toBlock).toBe(worker.shopBlock);
      } else {
        expect(demand.toBlock).toBe(worker.homeBlock);
      }
    }
  });

  it('produces a morning rush that dwarfs midday demand', () => {
    const system = new CitizenSystem(60, new Rng(99), 0);
    let morning = 0;
    let midday = 0;
    for (let minute = 0; minute < DAY_LENGTH; minute += 5) {
      const demands = system.update(minute);
      if (minute >= 7 * 60 && minute < 10 * 60) morning += demands.length;
      if (minute >= 11 * 60 && minute < 15 * 60) midday += demands.length;
      for (const demand of demands) {
        system.assignAgent(demand.citizenId, demand.citizenId);
        system.handleAgentArrived(demand.citizenId, minute + 10);
      }
    }
    expect(morning).toBeGreaterThanOrEqual(40);
    expect(midday).toBeLessThan(morning / 3);
  });

  it('runs a full simulated day without losing citizens', () => {
    const system = new CitizenSystem(30, new Rng(5), 0);
    let trips = 0;
    for (let minute = 0; minute < DAY_LENGTH; minute += 5) {
      for (const demand of system.update(minute)) {
        system.assignAgent(demand.citizenId, demand.citizenId);
        system.handleAgentArrived(demand.citizenId, minute + 10);
        trips++;
      }
    }
    expect(trips).toBeGreaterThanOrEqual(30);
    expect(system.count).toBe(30);
    for (const citizen of system.toJSON()) {
      expect(citizen.traveling).toBe(false);
      expect(citizen.nextDepart).toBeGreaterThan(DAY_LENGTH - 5);
      expect(citizen.location).toBe(citizen.homeBlock);
    }
  });

  it('defers failed trips to a retry window', () => {
    const system = new CitizenSystem(10, new Rng(4), 0);
    const demands = system.update(9 * 60);
    expect(demands.length).toBeGreaterThan(0);
    const demand = demands[0]!;
    system.deferTrip(demand.citizenId, 9 * 60);
    const retried = system.update(9 * 60 + 7);
    expect(retried.some((d) => d.citizenId === demand.citizenId)).toBe(true);
  });

  it('round-trips through JSON and drops malformed entries', () => {
    const system = new CitizenSystem(12, new Rng(8), 8 * 60);
    const json = system.toJSON();
    const restored = CitizenSystem.fromJSON(json, new Rng(8));
    expect(restored.count).toBe(12);
    expect(restored.toJSON()).toEqual(json);
    const dirty = parseCitizenStates([...json, { id: 'x' }, null, { id: 1 }]);
    expect(dirty.length).toBe(12);
  });

  it('assignAgent ignores unknown or already-traveling citizens', () => {
    const system = new CitizenSystem(2, new Rng(6), 0);
    const demands = system.update(9 * 60);
    const demand = demands[0]!;
    system.assignAgent(demand.citizenId, 1);
    expect(system.travelingCount).toBe(1);
    system.assignAgent(demand.citizenId, 2);
    expect(system.travelingCount).toBe(1);
    system.assignAgent(9999, 3);
    expect(system.travelingCount).toBe(1);
  });
});
