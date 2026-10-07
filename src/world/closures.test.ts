import { describe, expect, it } from 'vitest';
import { activeClosureEdges, createClosure, isClosureActive, worldMinutes } from './closures';

describe('road closures', () => {
  it('maps day/minute to absolute world minutes', () => {
    expect(worldMinutes(1, 0)).toBe(0);
    expect(worldMinutes(1, 480)).toBe(480);
    expect(worldMinutes(2, 0)).toBe(1440);
    expect(worldMinutes(3, 90)).toBe(2 * 1440 + 90);
  });

  it('is active within its window only', () => {
    const closure = createClosure('c1', 'edge', 'roadworks', 100, 10);
    expect(isClosureActive(closure, 99)).toBe(false);
    expect(isClosureActive(closure, 100)).toBe(true);
    expect(isClosureActive(closure, 109)).toBe(true);
    expect(isClosureActive(closure, 110)).toBe(false);
  });

  it('collects only active edges', () => {
    const a = createClosure('a', 'e1', 'roadworks', 0, 100);
    const b = createClosure('b', 'e2', 'flood', 150, 100);
    expect([...activeClosureEdges([a, b], 50)]).toEqual(['e1']);
    expect([...activeClosureEdges([a, b], 200)]).toEqual(['e2']);
    expect([...activeClosureEdges([a, b], 300)]).toEqual([]);
  });

  it('spans days for long closures', () => {
    const closure = createClosure('long', 'edge', 'roadworks', worldMinutes(1, 20 * 60), 8 * 60);
    expect(isClosureActive(closure, worldMinutes(1, 22 * 60))).toBe(true);
    expect(isClosureActive(closure, worldMinutes(2, 3 * 60))).toBe(true);
    expect(isClosureActive(closure, worldMinutes(2, 5 * 60))).toBe(false);
  });
});
