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
});
