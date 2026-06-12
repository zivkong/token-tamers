/**
 * Legacy placeholder sprite generators.
 *
 * These reproduce the v1 MVP placeholder output BYTE-FOR-BYTE so that
 * gen-sprites.ts keeps emitting an identical sprites.json while the per-line
 * design modules (aether.ts, cipher.ts, scenes.ts) are stubs. Artists replace
 * the stub bodies next phase with hand-authored sprites built on sprite-lib.ts;
 * this file then goes away.
 *
 * Deterministic: seeded LCG keyed on the sprite id, no Math.random/Date.now.
 */

import type { SpriteDef } from '@token-tamers/core';
import { hashStr, lcg } from '../sprite-lib';

export type ShapeKind = 'wispy' | 'angular';

function emptyGrid(w: number, h: number): number[][] {
  return Array.from({ length: h }, () => Array(w).fill(0) as number[]);
}

function cloneGrid(g: number[][]): number[][] {
  return g.map((row) => [...row]);
}

function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = x - cx;
  const dy = y - cy;
  return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
}

function inDiamond(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  return Math.abs(x - cx) / rx + Math.abs(y - cy) / ry <= 1;
}

function inHex(x: number, y: number, cx: number, cy: number, r: number): boolean {
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  return dx <= r * 0.866 && dy <= r && 0.5 * dx + dy <= r;
}

function legacyOutline(grid: number[][], w: number, h: number): void {
  const filled = (x: number, y: number): boolean =>
    x >= 0 && x < w && y >= 0 && y < h && (grid[y]?.[x] ?? 0) > 0;
  const isBorder = (x: number, y: number): boolean => {
    if (!filled(x, y)) return false;
    return !filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isBorder(x, y)) grid[y]![x] = 1;
    }
  }
}

/** Pet placeholder: 24x24, 2-frame idle, wispy (Aether) or angular (Cipher). */
export function placeholderPet(id: string, shape: ShapeKind, stage: string): SpriteDef {
  const W = 24;
  const H = 24;
  const rng = lcg(hashStr(id));
  const cx = 12;
  const cy = 12;

  const stageScale: Record<string, number> = {
    egg: 0.5,
    sprite: 0.6,
    rookie: 0.65,
    evolved: 0.75,
    prime: 0.85,
    apex: 0.95,
  };
  const scale = stageScale[stage] ?? 0.7;

  const base = emptyGrid(W, H);

  if (shape === 'wispy') {
    const rx = Math.round(8 * scale);
    const ry = Math.round(9 * scale);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (inEllipse(x, y, cx, cy - 1, rx, ry)) {
          const dist = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy + 1) / ry) ** 2);
          base[y]![x] = dist < 0.4 ? 5 : dist < 0.65 ? 4 : dist < 0.85 ? 3 : 2;
        }
      }
    }
    const wingRx = Math.round(4 * scale);
    const wingRy = Math.round(3 * scale);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (base[y]![x] === 0) {
          if (
            inEllipse(x, y, cx - Math.round(7 * scale), cy + 1, wingRx, wingRy) ||
            inEllipse(x, y, cx + Math.round(7 * scale), cy + 1, wingRx, wingRy)
          ) {
            base[y]![x] = 6;
          }
        }
      }
    }
    const eyeY = cy - Math.round(3 * scale);
    const eyeOff = Math.round(3 * scale);
    if (eyeY >= 0 && eyeY < H) {
      if (cx - eyeOff >= 0) base[eyeY]![cx - eyeOff] = 7;
      if (cx + eyeOff < W) base[eyeY]![cx + eyeOff] = 7;
    }
  } else {
    const r = Math.round(8 * scale);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (inHex(x, y, cx, cy, r)) {
          const dist = Math.max(Math.abs(x - cx) / r, Math.abs(y - cy) / r);
          base[y]![x] = dist < 0.3 ? 5 : dist < 0.55 ? 4 : dist < 0.75 ? 3 : 2;
        }
      }
    }
    const dr = Math.round(4 * scale);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (base[y]![x] === 0 && inDiamond(x, y, cx, cy - Math.round(6 * scale), dr, dr)) {
          base[y]![x] = 6;
        }
      }
    }
    const eyeY = cy - Math.round(2 * scale);
    const eyeOff = Math.round(2 * scale);
    if (eyeY >= 0 && eyeY < H) {
      if (cx - eyeOff >= 0) base[eyeY]![cx - eyeOff] = 7;
      if (cx + eyeOff < W) base[eyeY]![cx + eyeOff] = 7;
    }
  }

  legacyOutline(base, W, H);

  const frame2 = cloneGrid(base);
  const shiftCnt = Math.round(rng.next() * 4) + 2;
  for (let i = 0; i < shiftCnt; i++) {
    const x = Math.floor(rng.next() * W);
    const y = Math.floor(rng.next() * H);
    if ((frame2[y]?.[x] ?? 0) > 1) {
      const orig = frame2[y]![x]!;
      frame2[y]![x] = orig === 5 ? 6 : orig === 6 ? 5 : orig;
    }
  }

  return { id, width: W, height: H, frames: [base, frame2], fps: 2 };
}

/** Habitat placeholder: 96x36 background grid. */
export function placeholderHabitat(id: string, style: string): SpriteDef {
  const W = 96;
  const H = 36;
  const rng = lcg(hashStr(id));
  const grid = emptyGrid(W, H);

  if (style === 'terminal') {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) grid[y]![x] = 2;
    const dotCount = 40;
    for (let i = 0; i < dotCount; i++) {
      const x = Math.floor(rng.next() * W);
      const y = Math.floor(rng.next() * H);
      grid[y]![x] = 5;
    }
    for (let y = 2; y < H; y += 4) {
      for (let x = 0; x < W; x++) {
        if (grid[y]![x] === 2) grid[y]![x] = 3;
      }
    }
  } else if (style === 'meadow') {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) grid[y]![x] = y < H / 2 ? 4 : 3;
    const horizY = Math.floor(H / 2);
    for (let x = 0; x < W; x++) grid[horizY]![x] = 2;
    const tuftCount = 15;
    for (let i = 0; i < tuftCount; i++) {
      const tx = Math.floor(rng.next() * (W - 4)) + 2;
      const ty = horizY + 1;
      grid[ty]![tx] = 5;
      if (tx + 1 < W) grid[ty]![tx + 1] = 5;
      if (ty - 1 >= 0) grid[ty - 1]![tx] = 6;
    }
    for (let ci = 0; ci < 3; ci++) {
      const ccx = Math.floor(rng.next() * (W - 12)) + 6;
      const ccy = Math.floor(rng.next() * (horizY - 4)) + 2;
      for (let y = 0; y < horizY; y++) {
        for (let x = 0; x < W; x++) {
          if (inEllipse(x, y, ccx, ccy, 6, 3)) grid[y]![x] = 7;
        }
      }
    }
  } else {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) grid[y]![x] = 1;
    for (let bx = 0; bx < W; bx += Math.floor(rng.next() * 6) + 4) {
      const bh = Math.floor(rng.next() * 8) + 4;
      for (let by = H - bh; by < H; by++) {
        for (let bw = 0; bw < Math.floor(rng.next() * 6) + 3 && bx + bw < W; bw++) {
          grid[by]![bx + bw] = 2;
        }
      }
    }
    for (let i = 0; i < 30; i++) {
      const sx = Math.floor(rng.next() * W);
      const sy = Math.floor(rng.next() * (H - 10));
      grid[sy]![sx] = 7;
    }
    const mx = Math.floor(rng.next() * 20) + 10;
    const my = Math.floor(rng.next() * 6) + 3;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (inEllipse(x, y, mx, my, 5, 5)) grid[y]![x] = 6;
      }
    }
  }

  return { id, width: W, height: H, frames: [grid], fps: 1 };
}

/** Trinket placeholder: 8x8 icon. */
export function placeholderTrinket(id: string): SpriteDef {
  const W = 8;
  const H = 8;
  const rng = lcg(hashStr(id));
  const grid = emptyGrid(W, H);

  const variant = hashStr(id) % 6;
  const cx = 4;
  const cy = 4;

  if (variant === 0) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) if (inEllipse(x, y, cx, cy, 3, 3)) grid[y]![x] = variant + 2;
    grid[2]![5] = 7;
  } else if (variant === 1) {
    for (let y = 2; y < 6; y++) for (let x = 1; x < 7; x++) grid[y]![x] = 3;
    for (let x = 1; x < 7; x++) {
      grid[2]![x] = 4;
      grid[5]![x] = 2;
    }
    grid[3]![3] = 6;
    grid[3]![4] = 6;
  } else if (variant === 2) {
    for (let y = 1; y < 7; y++)
      for (let x = 2; x < 6; x++) if (inEllipse(x, y, 4, 4, 2, 3)) grid[y]![x] = 4;
    grid[2]![3] = 6;
    grid[2]![4] = 6;
    grid[1]![4] = 7;
    grid[5]![3] = 3;
    grid[6]![4] = 3;
  } else if (variant === 3) {
    for (let y = 1; y < 5; y++)
      for (let x = 1; x < 7; x++) if (Math.abs(x - 4) <= 3 - y) grid[y]![x] = 5;
    grid[5]![3] = 2;
    grid[5]![4] = 2;
    grid[6]![3] = 2;
    grid[6]![4] = 2;
    grid[7]![2] = 3;
    grid[7]![3] = 3;
    grid[7]![4] = 3;
    grid[7]![5] = 3;
  } else if (variant === 4) {
    for (let y = 2; y < 7; y++) for (let x = 1; x < 7; x++) grid[y]![x] = 4;
    for (let x = 1; x < 7; x++) grid[2]![x] = 2;
    for (let y = 2; y < 7; y++) grid[y]![3] = 2;
    grid[2]![3] = 7;
    grid[2]![4] = 7;
  } else {
    for (let x = 2; x < 6; x++) {
      grid[1]![x] = 6;
      grid[2]![x] = 6;
      grid[3]![x] = 6;
    }
    grid[1]![1] = 5;
    grid[1]![6] = 5;
    grid[2]![1] = 5;
    grid[2]![6] = 5;
    grid[3]![2] = 5;
    grid[3]![5] = 5;
    grid[4]![3] = 4;
    grid[4]![4] = 4;
    grid[5]![2] = 3;
    grid[5]![3] = 3;
    grid[5]![4] = 3;
    grid[5]![5] = 3;
    for (let x = 1; x < 7; x++) grid[6]![x] = 2;
    grid[3]![3] = 7;
    grid[3]![4] = 7;
  }

  const tweakX = Math.floor(rng.next() * W);
  const tweakY = Math.floor(rng.next() * H);
  if ((grid[tweakY]?.[tweakX] ?? 0) > 1) grid[tweakY]![tweakX] = 7;

  legacyOutline(grid, W, H);

  return { id, width: W, height: H, frames: [grid], fps: 1 };
}
