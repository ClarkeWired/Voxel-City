import { describe, expect, it } from 'vitest';
import { CongestionTracker, parseCongestion } from './congestion';
import { buildLaneGraph } from './graph';
import { findRoute } from './routing';

describe('CongestionTracker', () => {
  it('rises under stationary queues and falls when cleared', () => {
    const tracker = new CongestionTracker();
    for (let i = 0; i < 120; i++) tracker.observe('e1', 6, 0.05, 1);
    const risen = tracker.level('e1');
    expect(risen).toBeGreaterThan(0.4);
    for (let i = 0; i < 300; i++) tracker.observe('e1', 0, 0, 1);
    expect(tracker.level('e1')).toBeLessThan(risen * 0.5);
  });

  it('tracks pressure rather than vehicle count alone', () => {
    const moving = new CongestionTracker();
    for (let i = 0; i < 120; i++) moving.observe('e', 6, 0.95, 1);
    const stopped = new CongestionTracker();
    for (let i = 0; i < 120; i++) stopped.observe('e', 6, 0.0, 1);
    expect(stopped.level('e')).toBeGreaterThan(moving.level('e') + 0.3);
  });

  it('raises routing cost factors and normalises city stress', () => {
    const tracker = new CongestionTracker();
    expect(tracker.costFactor('e')).toBe(1);
    for (let i = 0; i < 600; i++) tracker.observe('e', 6, 0, 1);
    expect(tracker.costFactor('e')).toBeGreaterThan(2);
    expect(tracker.stress).toBeGreaterThan(0);
    expect(tracker.stress).toBeLessThanOrEqual(1);
  });

  it('round-trips through JSON and drops junk', () => {
    const tracker = new CongestionTracker({ a: 0.5, b: 2 });
    expect(tracker.toJSON()).toEqual({ a: 0.5, b: 1 });
    const parsed = parseCongestion({ a: 0.5, c: 'x', d: -1 });
    expect(parsed).toEqual({ a: 0.5 });
    expect(CongestionTracker.fromJSON({ a: 0.3 }).level('a')).toBeCloseTo(0.3);
  });

  it('prefers a detour when the direct continuation is congested', () => {
    const graph = buildLaneGraph();
    const start = 'r:EW:1:1:2:W';
    const dest = 'out:1:1:N';
    const baseline = findRoute(graph, start, dest);
    expect(baseline).not.toBeNull();
    const firstHop = baseline![1]!;
    const weighted = findRoute(graph, start, dest, undefined, (edgeId) =>
      edgeId === firstHop ? 30 : 1,
    );
    expect(weighted).not.toBeNull();
    expect(weighted!.includes(firstHop)).toBe(false);
  });
});
