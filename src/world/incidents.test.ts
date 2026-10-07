import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { IncidentSystem, parseIncidents } from './incidents';

describe('incidents', () => {
  it('blocks the affected edge while present', () => {
    const system = new IncidentSystem(new Rng(5));
    const incident = system.trigger('r:NS:1:0:1:S', 100);
    expect(system.count).toBe(1);
    expect(system.blockingEdges().has('r:NS:1:0:1:S')).toBe(true);
    expect(incident.respondAt).toBeGreaterThan(100);
    expect(incident.clearAt).toBeGreaterThan(incident.respondAt);
  });

  it('moves active -> responding -> cleared', () => {
    const system = new IncidentSystem(new Rng(5));
    const incident = system.trigger('e', 0);
    expect(system.update(incident.respondAt - 1)).toEqual([]);
    const responding = system.update(incident.respondAt);
    expect(responding.length).toBe(1);
    expect(responding[0]!.type).toBe('responding');
    expect(system.respondingCount).toBe(1);
    const cleared = system.update(incident.clearAt);
    expect(cleared.length).toBe(1);
    expect(cleared[0]!.type).toBe('cleared');
    expect(system.count).toBe(0);
    expect(system.blockingEdges().size).toBe(0);
  });

  it('keeps ids increasing after restore', () => {
    const system = new IncidentSystem(new Rng(5));
    system.trigger('e', 0);
    const restored = IncidentSystem.fromJSON(system.toJSON(), new Rng(6));
    const next = restored.trigger('e2', 10);
    expect(next.id).not.toBe('incident-1');
  });

  it('parses valid entries and drops junk', () => {
    const valid = { id: 'incident-3', edgeId: 'e', start: 0, respondAt: 5, clearAt: 9, phase: 'active' as const };
    expect(parseIncidents([valid, { id: 1 }, null, { ...valid, phase: 'gone' }]).length).toBe(1);
    expect(parseIncidents('nope')).toEqual([]);
    expect(parseIncidents(undefined)).toEqual([]);
  });
});
