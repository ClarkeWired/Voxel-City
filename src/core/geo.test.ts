import { describe, expect, it } from 'vitest';
import { lerpAngle, lerpScalar, samplePolyline, wrapAngle } from './geo';

describe('wrapAngle', () => {
  it('maps any angle onto [-pi, pi)', () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(Math.PI)).toBeCloseTo(-Math.PI, 12);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(-Math.PI, 12);
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(-Math.PI, 9);
    expect(wrapAngle(Math.PI * 2 + 0.25)).toBeCloseTo(0.25, 9);
    for (const value of [0.1, -0.1, 7.3, -7.3, 100.5]) {
      const wrapped = wrapAngle(value);
      expect(wrapped).toBeGreaterThanOrEqual(-Math.PI - 1e-9);
      expect(wrapped).toBeLessThan(Math.PI + 1e-9);
      expect(wrapAngle(wrapped)).toBeCloseTo(wrapped, 9);
    }
  });
});

describe('lerpAngle', () => {
  it('returns the endpoints exactly', () => {
    expect(lerpAngle(0.4, -1.2, 0)).toBeCloseTo(0.4, 12);
    expect(lerpAngle(0.4, -1.2, 1)).toBeCloseTo(-1.2, 12);
  });

  it('interpolates linearly inside a turn', () => {
    expect(lerpAngle(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4, 12);
    expect(lerpAngle(1, 2, 0.25)).toBeCloseTo(1.25, 12);
  });

  it('takes the short way around the circle', () => {
    const from = Math.PI - 0.1;
    const to = -Math.PI + 0.1;
    const mid = lerpAngle(from, to, 0.5);
    expect(Math.abs(wrapAngle(mid - from))).toBeCloseTo(0.1, 9);
    expect(Math.abs(wrapAngle(to - mid))).toBeCloseTo(0.1, 9);
  });

  it('never moves further than the shortest arc between the states', () => {
    const from = 3.0;
    const to = -3.0;
    const arc = Math.abs(wrapAngle(to - from));
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const value = lerpAngle(from, to, t);
      expect(Math.abs(wrapAngle(value - from))).toBeLessThanOrEqual(arc + 1e-9);
      expect(Math.abs(wrapAngle(value - to))).toBeLessThanOrEqual(arc + 1e-9);
    }
  });
});

describe('lerpScalar', () => {
  it('mixes linearly with clamped-friendly endpoints', () => {
    expect(lerpScalar(2, 10, 0)).toBe(2);
    expect(lerpScalar(2, 10, 1)).toBe(10);
    expect(lerpScalar(2, 10, 0.5)).toBe(6);
  });
});

describe('samplePolyline', () => {
  it('reports the tangent used for heading at any distance along the path', () => {
    const points = [
      { x: 0, z: 0 },
      { x: 0, z: 10 },
    ];
    const pose = samplePolyline(points, 4);
    expect(pose.x).toBeCloseTo(0, 12);
    expect(pose.z).toBeCloseTo(4, 12);
    expect(pose.dx).toBeCloseTo(0, 12);
    expect(pose.dz).toBeCloseTo(1, 12);
  });
});
