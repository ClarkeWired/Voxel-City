export const BLOCK = 18;
export const ROAD = 7;
export const SIDEWALK = 1.8;
export const PITCH = BLOCK + ROAD;
export const GRID_N = 5;
export const CITY_HALF = (GRID_N * BLOCK + (GRID_N + 1) * ROAD) / 2;
export const ROAD_HALF = ROAD / 2;
export const LANE_OFFSET = 1.75;
export const INTERSECTION_NODE_DIST = 6.5;
export const BLOCK_TOP = 1;
export const RING_INSET = 1.6;
export const RING_HALF = BLOCK / 2 - RING_INSET;
export const CROSSING_OFFSET = ROAD_HALF + 1.5;

export function roadCenter(i: number): number {
  return -CITY_HALF + i * PITCH + ROAD_HALF;
}

export function blockStart(j: number): number {
  return -CITY_HALF + j * PITCH + ROAD;
}

export function blockCenter(j: number): number {
  return blockStart(j) + BLOCK / 2;
}

export function blockEdgeMin(j: number): number {
  return blockStart(j);
}

export function blockEdgeMax(j: number): number {
  return blockStart(j) + BLOCK;
}

export function isRoadCoord(v: number): boolean {
  const local = v + CITY_HALF;
  const m = ((local % PITCH) + PITCH) % PITCH;
  return m < ROAD;
}

export function isInsideCity(x: number, z: number): boolean {
  return Math.abs(x) <= CITY_HALF && Math.abs(z) <= CITY_HALF;
}
