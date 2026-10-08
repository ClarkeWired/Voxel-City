import { describe, expect, it } from 'vitest';
import { buildLaneGraph } from './graph';
import { LANE_OFFSET, ROAD } from '../city/grid';
import { VehicleView, WHEELS } from './views';
import * as THREE from 'three';

describe('vehicle fit', () => {
  it.each(['sedan', 'van', 'bus'] as const)('%s wheels spin about their own axle centres', (kind) => {
    const view = new VehicleView(kind, 0xffffff, new THREE.MeshLambertMaterial(), new THREE.MeshLambertMaterial());
    const wheels = view.group.children.slice(1) as THREE.Mesh[];
    expect(wheels).toHaveLength(4);
    const before = wheels.map((wheel) => wheel.position.clone());
    const expectedXs = WHEELS[kind].positionsX;
    expect(wheels.map((wheel) => wheel.position.x)).toEqual([expectedXs[0], expectedXs[0], expectedXs[1], expectedXs[1]]);
    view.advance(0.1, 5);
    for (let i = 0; i < wheels.length; i++) {
      expect(wheels[i]!.position.distanceTo(before[i]!)).toBe(0);
      expect(wheels[i]!.rotation.z).not.toBe(0);
    }
  });

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

  it('keeps wheels under the body so they do not float', () => {
    const bodyHalfWidth: Record<string, number> = { sedan: 0.9, van: 0.925, bus: 1.15 };
    for (const [kind, spec] of Object.entries(WHEELS)) {
      const half = bodyHalfWidth[kind]!;
      expect(spec.track + spec.width / 2).toBeLessThanOrEqual(half + 1e-6);
    }
  });
});
