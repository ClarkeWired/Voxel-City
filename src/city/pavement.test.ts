import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Rng } from '../core/rng';
import {
  BLOCK,
  FACADE_LINE,
  FURNITURE_INNER,
  FURNITURE_OUTER,
  GRID_N,
  RING_HALF,
  blockCenter,
} from './grid';
import { buildCity } from './index';
import type { Blocker } from '../world/obstacles';

function isPavementProp(b: Blocker): boolean {
  return /^(tree|bench|bin|planter|hydrant|lamp):/.test(b.id);
}

function isBuilding(b: Blocker): boolean {
  return /^b-?\d/.test(b.id);
}

function aabbOverlap(a: Blocker, b: Blocker): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

describe('pavement furniture', () => {
  const scene = new THREE.Scene();
  const city = buildCity(scene, new Rng(20261007));
  const blockers = city.blockers.all;

  function nearestBlockCenter(b: Blocker): { bx: number; bz: number } {
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    let bestBx = 0;
    let bestBz = 0;
    let best = Infinity;
    for (let bi = 0; bi < GRID_N; bi++) {
      for (let bj = 0; bj < GRID_N; bj++) {
        const d = Math.abs(blockCenter(bi) - cx) + Math.abs(blockCenter(bj) - cz);
        if (d < best) {
          best = d;
          bestBx = blockCenter(bi);
          bestBz = blockCenter(bj);
        }
      }
    }
    return { bx: bestBx, bz: bestBz };
  }

  it('places every pavement prop within the block boundary', () => {
    for (const b of blockers) {
      if (!isPavementProp(b)) continue;
      const { bx, bz } = nearestBlockCenter(b);
      expect(Math.abs((b.minX + b.maxX) / 2 - bx)).toBeLessThanOrEqual(BLOCK / 2);
      expect(Math.abs((b.minZ + b.maxZ) / 2 - bz)).toBeLessThanOrEqual(BLOCK / 2);
    }
  });

  it('keeps every pavement prop in the street-furniture band', () => {
    for (const b of blockers) {
      if (!isPavementProp(b)) continue;
      const { bx, bz } = nearestBlockCenter(b);
      const cx = (b.minX + b.maxX) / 2;
      const cz = (b.minZ + b.maxZ) / 2;
      const across = Math.max(Math.abs(cx - bx), Math.abs(cz - bz));
      expect(across).toBeGreaterThanOrEqual(FURNITURE_INNER - 1e-6);
      expect(across).toBeLessThanOrEqual(FURNITURE_OUTER + 1e-6);
    }
  });

  it('keeps every pavement prop outside building footprints', () => {
    const buildings = blockers.filter(isBuilding);
    for (const b of blockers) {
      if (!isPavementProp(b)) continue;
      for (const bb of buildings) {
        expect(aabbOverlap(b, bb)).toBe(false);
      }
    }
  });

  it('keeps every pavement prop outside the pedestrian clear corridor', () => {
    for (const b of blockers) {
      if (!isPavementProp(b)) continue;
      const { bx, bz } = nearestBlockCenter(b);
      const cx = (b.minX + b.maxX) / 2;
      const cz = (b.minZ + b.maxZ) / 2;
      const across = Math.max(Math.abs(cx - bx), Math.abs(cz - bz));
      expect(across).toBeGreaterThanOrEqual(RING_HALF + 0.35 - 1e-6);
    }
  });

  it('keeps building blockers outside the pedestrian ring', () => {
    for (const b of blockers) {
      if (!isBuilding(b)) continue;
      const { bx, bz } = nearestBlockCenter(b);
      const cx = (b.minX + b.maxX) / 2;
      const cz = (b.minZ + b.maxZ) / 2;
      const across = Math.max(Math.abs(cx - bx), Math.abs(cz - bz));
      expect(across).toBeLessThanOrEqual(FACADE_LINE + 1e-6);
    }
  });
});
