import { describe, expect, it } from 'vitest';
import { SpatialBlocker, segmentIntersectsBlocker, pointInBlocker } from './obstacles';

describe('SpatialBlocker', () => {
  it('detects a segment passing through a blocker', () => {
    const blockers = new SpatialBlocker();
    blockers.add('b1', -1, 1, -1, 1);
    expect(blockers.intersects(-3, 0, 3, 0)).toBe(true);
    expect(blockers.intersects(-3, 3, 3, 3)).toBe(false);
  });

  it('detects a segment touching a blocker edge', () => {
    const blockers = new SpatialBlocker();
    blockers.add('b1', 0, 2, 0, 2);
    expect(blockers.intersects(-1, 1, 1, 1)).toBe(true);
    expect(blockers.intersects(-1, 3, 1, 3)).toBe(false);
  });

  it('detects a point inside a blocker with margin', () => {
    const blockers = new SpatialBlocker();
    blockers.add('b1', 0, 2, 0, 2);
    expect(blockers.pointBlocked(1, 1)).toBe(true);
    expect(blockers.pointBlocked(3, 3)).toBe(false);
    expect(blockers.pointBlocked(2.5, 1, 0.6)).toBe(true);
  });

  it('handles multiple blockers', () => {
    const blockers = new SpatialBlocker();
    blockers.add('b1', -5, -3, -1, 1);
    blockers.add('b2', 3, 5, -1, 1);
    expect(blockers.intersects(-6, 0, -2, 0)).toBe(true);
    expect(blockers.intersects(2, 0, 6, 0)).toBe(true);
    expect(blockers.intersects(-2, 0, 2, 0)).toBe(false);
  });

  it('addCircle creates a circular blocker', () => {
    const blockers = new SpatialBlocker();
    blockers.addCircle('c1', 0, 0, 2);
    expect(blockers.intersects(-3, 0, 3, 0)).toBe(true);
    expect(blockers.intersects(-3, 3, 3, 3)).toBe(false);
  });

  it('segmentIntersectsBlocker handles zero-length segments', () => {
    const blocker = { id: 'b', minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
    expect(segmentIntersectsBlocker(blocker, 0, 0, 0, 0)).toBe(true);
    expect(segmentIntersectsBlocker(blocker, 3, 3, 3, 3)).toBe(false);
  });

  it('pointInBlocker respects margin', () => {
    const blocker = { id: 'b', minX: 0, maxX: 2, minZ: 0, maxZ: 2 };
    expect(pointInBlocker(blocker, 1, 1)).toBe(true);
    expect(pointInBlocker(blocker, 3, 3)).toBe(false);
    expect(pointInBlocker(blocker, 2.5, 1, 0.6)).toBe(true);
    expect(pointInBlocker(blocker, 3.5, 1, 0.6)).toBe(false);
  });
});
