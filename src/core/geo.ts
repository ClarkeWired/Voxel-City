export interface Pt {
  x: number;
  z: number;
}

export type Axis = 'NS' | 'EW';

export interface Pose {
  x: number;
  z: number;
  dx: number;
  dz: number;
}

export function polylineLength(points: readonly Pt[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    total += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return total;
}

export function samplePolyline(points: readonly Pt[], s: number): Pose {
  let remaining = Math.max(0, s);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (remaining <= len || i === points.length - 1) {
      const t = len > 0 ? Math.min(1, remaining / len) : 0;
      const n = len > 0 ? 1 / len : 0;
      return { x: a.x + dx * t, z: a.z + dz * t, dx: dx * n, dz: dz * n };
    }
    remaining -= len;
  }
  const last = points[points.length - 1]!;
  return { x: last.x, z: last.z, dx: 0, dz: 1 };
}

export function polylinePoint(points: readonly Pt[], s: number): Pt {
  const p = samplePolyline(points, s);
  return { x: p.x, z: p.z };
}
