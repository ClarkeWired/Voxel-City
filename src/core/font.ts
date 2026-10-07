import type { VoxelBuilder } from './voxel';

export type Facing = 'N' | 'S' | 'E' | 'W';

const GLYPHS: Record<string, string[]> = {
  A: ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'],
  B: ['XX.', 'X.X', 'XX.', 'X.X', 'XX.'],
  C: ['.XX', 'X..', 'X..', 'X..', '.XX'],
  D: ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'],
  E: ['XXX', 'X..', 'XX.', 'X..', 'XXX'],
  F: ['XXX', 'X..', 'XX.', 'X..', 'X..'],
  G: ['.XX', 'X..', 'X.X', 'X.X', '.XX'],
  H: ['X.X', 'X.X', 'XXX', 'X.X', 'X.X'],
  I: ['XXX', '.X.', '.X.', '.X.', 'XXX'],
  J: ['..X', '..X', '..X', 'X.X', '.X.'],
  K: ['X.X', 'X.X', 'XX.', 'X.X', 'X.X'],
  L: ['X..', 'X..', 'X..', 'X..', 'XXX'],
  M: ['X.X', 'XXX', 'XXX', 'X.X', 'X.X'],
  N: ['X.X', 'XXX', 'XXX', 'XXX', 'X.X'],
  O: ['.X.', 'X.X', 'X.X', 'X.X', '.X.'],
  P: ['XX.', 'X.X', 'XX.', 'X..', 'X..'],
  Q: ['.X.', 'X.X', 'X.X', '.X.', '..X'],
  R: ['XX.', 'X.X', 'XX.', 'X.X', 'X.X'],
  S: ['.XX', 'X..', '.X.', '..X', 'XX.'],
  T: ['XXX', '.X.', '.X.', '.X.', '.X.'],
  U: ['X.X', 'X.X', 'X.X', 'X.X', '.X.'],
  V: ['X.X', 'X.X', 'X.X', 'X.X', '.X.'],
  W: ['X.X', 'X.X', 'XXX', 'XXX', 'X.X'],
  X: ['X.X', 'X.X', '.X.', 'X.X', 'X.X'],
  Y: ['X.X', 'X.X', '.X.', '.X.', '.X.'],
  Z: ['XXX', '..X', '.X.', 'X..', 'XXX'],
  '0': ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'],
  '1': ['.X.', 'XX.', '.X.', '.X.', 'XXX'],
  '2': ['XX.', '..X', '.X.', 'X..', 'XXX'],
  '3': ['XXX', '..X', '.X.', '..X', 'XXX'],
  '4': ['X.X', 'X.X', 'XXX', '..X', '..X'],
  '5': ['XXX', 'X..', 'XX.', '..X', 'XX.'],
  '6': ['.XX', 'X..', 'XXX', 'X.X', 'XXX'],
  '7': ['XXX', '..X', '..X', '.X.', '.X.'],
  '8': ['XXX', 'X.X', 'XXX', 'X.X', 'XXX'],
  '9': ['XXX', 'X.X', 'XXX', '..X', 'XX.'],
  ' ': ['...', '...', '...', '...', '...'],
  '-': ['...', '...', 'XXX', '...', '...'],
};

export function textWidth(text: string, size: number): number {
  return (text.length * 4 - 1) * size;
}

export function drawText(
  builder: VoxelBuilder,
  text: string,
  cx: number,
  cy: number,
  cz: number,
  size: number,
  color: number,
  facing: Facing,
  depth = 0.18,
): void {
  const total = textWidth(text, size);
  const step = size;
  for (let i = 0; i < text.length; i++) {
    const glyph = GLYPHS[text[i]!.toUpperCase()] ?? GLYPHS[' ']!;
    const charCenter = -total / 2 + i * 4 * step + 1.5 * step;
    for (let row = 0; row < 5; row++) {
      const line = glyph[row]!;
      for (let col = 0; col < 3; col++) {
        if (line[col] !== 'X') continue;
        const u = charCenter + (col - 1) * step;
        const y = cy + (2 - row) * step;
        switch (facing) {
          case 'S':
            builder.box(cx + u, y, cz, step * 0.96, step * 0.96, depth, color);
            break;
          case 'N':
            builder.box(cx - u, y, cz, step * 0.96, step * 0.96, depth, color);
            break;
          case 'E':
            builder.box(cx, y, cz - u, depth, step * 0.96, step * 0.96, color);
            break;
          case 'W':
            builder.box(cx, y, cz + u, depth, step * 0.96, step * 0.96, color);
            break;
        }
      }
    }
  }
}
