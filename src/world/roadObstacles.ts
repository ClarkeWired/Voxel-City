import type { Pt } from '../core/geo';

export interface RoadObstacle {
  id: string;
  edgeId: string;
  s: number;
  lateralOffset: number;
  radius: number;
}

export function obstacleBlocksPoint(obstacle: RoadObstacle, edgePoints: Pt[], x: number, z: number): boolean {
  const total = edgePoints.length;
  if (total < 2) return false;
  let bestDist = Infinity;
  for (let i = 0; i < total; i++) {
    const p = edgePoints[i]!;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestDist) bestDist = d;
  }
  return bestDist < obstacle.radius;
}

export function distanceToObstacle(obstacle: RoadObstacle, edgePoints: Pt[], x: number, z: number): number {
  let bestDist = Infinity;
  for (const p of edgePoints) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestDist) bestDist = d;
  }
  return bestDist - obstacle.radius;
}
