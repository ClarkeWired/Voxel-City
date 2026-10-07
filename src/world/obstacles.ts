export interface Blocker {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CircleBlocker {
  id: string;
  cx: number;
  cz: number;
  radius: number;
}

export function aabbFromCircle(cx: number, cz: number, radius: number): { minX: number; maxX: number; minZ: number; maxZ: number } {
  return { minX: cx - radius, maxX: cx + radius, minZ: cz - radius, maxZ: cz + radius };
}

export function pointInBlocker(blocker: Blocker, x: number, z: number, margin = 0): boolean {
  return x >= blocker.minX - margin && x <= blocker.maxX + margin && z >= blocker.minZ - margin && z <= blocker.maxZ + margin;
}

export function segmentIntersectsBlocker(
  blocker: Blocker,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) return pointInBlocker(blocker, ax, az);
  let t = 0;
  if (blocker.maxX > blocker.minX || blocker.maxZ > blocker.minZ) {
    const tMinX = (blocker.minX - ax) / (dx || 1e-12);
    const tMaxX = (blocker.maxX - ax) / (dx || 1e-12);
    const tMinZ = (blocker.minZ - az) / (dz || 1e-12);
    const tMaxZ = (blocker.maxZ - az) / (dz || 1e-12);
    const tMin = Math.max(0, Math.min(tMinX, tMaxX), Math.min(tMinZ, tMaxZ));
    const tMax = Math.min(1, Math.max(tMinX, tMaxX), Math.max(tMinZ, tMaxZ));
    if (tMin > tMax) return false;
    t = tMin;
  }
  const px = ax + dx * t;
  const pz = az + dz * t;
  return pointInBlocker(blocker, px, pz);
}

export class SpatialBlocker {
  private readonly blockers: Blocker[] = [];
  private readonly grid = new Map<string, number[]>();
  private readonly cellSize = 8;

  add(id: string, minX: number, maxX: number, minZ: number, maxZ: number): void {
    const blocker: Blocker = { id, minX, maxX, minZ, maxZ };
    const index = this.blockers.length;
    this.blockers.push(blocker);
    const minCellX = Math.floor(minX / this.cellSize);
    const maxCellX = Math.floor(maxX / this.cellSize);
    const minCellZ = Math.floor(minZ / this.cellSize);
    const maxCellZ = Math.floor(maxZ / this.cellSize);
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const key = `${cx}:${cz}`;
        let list = this.grid.get(key);
        if (!list) {
          list = [];
          this.grid.set(key, list);
        }
        list.push(index);
      }
    }
  }

  addCircle(id: string, cx: number, cz: number, radius: number): void {
    const bb = aabbFromCircle(cx, cz, radius);
    this.add(id, bb.minX, bb.maxX, bb.minZ, bb.maxZ);
  }

  intersects(ax: number, az: number, bx: number, bz: number): boolean {
    const minCellX = Math.floor(Math.min(ax, bx) / this.cellSize);
    const maxCellX = Math.floor(Math.max(ax, bx) / this.cellSize);
    const minCellZ = Math.floor(Math.min(az, bz) / this.cellSize);
    const maxCellZ = Math.floor(Math.max(az, bz) / this.cellSize);
    const checked = new Set<number>();
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const list = this.grid.get(`${cx}:${cz}`);
        if (!list) continue;
        for (const index of list) {
          if (checked.has(index)) continue;
          checked.add(index);
          if (segmentIntersectsBlocker(this.blockers[index]!, ax, az, bx, bz)) return true;
        }
      }
    }
    return false;
  }

  pointBlocked(x: number, z: number, margin = 0): boolean {
    const cellX = Math.floor(x / this.cellSize);
    const cellZ = Math.floor(z / this.cellSize);
    for (let cx = cellX - 1; cx <= cellX + 1; cx++) {
      for (let cz = cellZ - 1; cz <= cellZ + 1; cz++) {
        const list = this.grid.get(`${cx}:${cz}`);
        if (!list) continue;
        for (const index of list) {
          if (pointInBlocker(this.blockers[index]!, x, z, margin)) return true;
        }
      }
    }
    return false;
  }

  get all(): readonly Blocker[] {
    return this.blockers;
  }
}
