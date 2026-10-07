import { describe, expect, it } from 'vitest';
import { barrierPlacements } from './barriers';
import { buildLaneGraph } from './graph';

describe('barrier placements', () => {
  it('places two rows of alternating segments across a closed edge', () => {
    const graph = buildLaneGraph();
    const edge = graph.edges.get('r:EW:2:1:2:W')!;
    const placements = barrierPlacements(edge);
    expect(placements.length).toBe(14);
    expect(new Set(placements.map((p) => p.color)).size).toBe(2);

    const xs = [...new Set(placements.map((p) => p.x))].sort((a, b) => a - b);
    expect(xs.length).toBe(2);
    expect(xs[0]).toBeCloseTo(-31, 5);
    expect(xs[1]).toBeCloseTo(-19, 5);

    const zs = placements.map((p) => p.z);
    expect(Math.min(...zs)).toBeCloseTo(-10.75 - 3.9, 5);
    expect(Math.max(...zs)).toBeCloseTo(-10.75 + 3.9, 5);
  });

  it('spans the road on both ends of a north-south edge', () => {
    const graph = buildLaneGraph();
    const edge = graph.edges.get('r:NS:1:0:1:S')!;
    const placements = barrierPlacements(edge);
    const zs = [...new Set(placements.map((p) => p.z))].sort((a, b) => a - b);
    expect(zs.length).toBe(2);
    const xs = placements.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(-39.25 - 3.9, 5);
    expect(Math.max(...xs)).toBeCloseTo(-39.25 + 3.9, 5);
  });
});
