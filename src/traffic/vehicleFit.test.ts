import { describe, expect, it } from 'vitest';
import { buildLaneGraph } from './graph';
import { LANE_OFFSET, ROAD } from '../city/grid';
import { WHEELS } from './views';

describe('vehicle fit', () => {
  const graph = buildLaneGraph();

  it('vehicle widths fit within lane widths', () => {
    const laneWidth = LANE_OFFSET * 2;
    expect(laneWidth).toBeLessThan(ROAD);
    for (const spec of Object.values(WHEELS)) {
      const vehicleWidth = spec.track * 2 + spec.width;
      expect(vehicleWidth).toBeLessThan(laneWidth);
    }
  });

  it('vehicle lengths fit between intersections', () => {
    const segment = graph.edges.get('r:NS:2:1:2:S')!;
    for (const spec of Object.values(WHEELS)) {
      const vehicleLength = spec === WHEELS.bus ? 8.0 : 4.2;
      expect(vehicleLength).toBeLessThan(segment.length);
    }
  });

  it('wheel diameters are proportional to vehicle size', () => {
    const sedanRadius = WHEELS.sedan.radius;
    const vanRadius = WHEELS.van.radius;
    const busRadius = WHEELS.bus.radius;
    expect(sedanRadius).toBeLessThan(vanRadius);
    expect(vanRadius).toBeLessThan(busRadius);
    expect(sedanRadius * 2).toBeGreaterThan(0.6);
    expect(sedanRadius * 2).toBeLessThan(0.7);
  });

  it('sedan wheelbase is believable for a 4.2m car', () => {
    const wb = WHEELS.sedan.positionsX[0]! - WHEELS.sedan.positionsX[1]!;
    expect(wb).toBeGreaterThanOrEqual(2.6);
    expect(wb).toBeLessThanOrEqual(2.9);
  });

  it('van wheelbase is believable for a 4.2m van', () => {
    const wb = WHEELS.van.positionsX[0]! - WHEELS.van.positionsX[1]!;
    expect(wb).toBeGreaterThanOrEqual(2.6);
    expect(wb).toBeLessThanOrEqual(2.9);
  });

  it('bus wheelbase is believable for an 8m bus', () => {
    const wb = WHEELS.bus.positionsX[0]! - WHEELS.bus.positionsX[1]!;
    expect(wb).toBeGreaterThanOrEqual(4.5);
    expect(wb).toBeLessThanOrEqual(6.0);
  });

  it('wheels are not pushed to the bumpers', () => {
    for (const spec of [WHEELS.sedan, WHEELS.van]) {
      const wb = spec.positionsX[0]! - spec.positionsX[1]!;
      expect(wb).toBeLessThan(4.2 - 0.8);
    }
  });
});
