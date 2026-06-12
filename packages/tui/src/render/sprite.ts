/**
 * Half-block sprite compositor.
 *
 * A `SpriteDef` (from the content pack) is a palette-indexed grid. We pair
 * vertical pixel rows two-at-a-time into '▀' (upper half block) cells where
 * fg = top pixel color and bg = bottom pixel color, doubling vertical
 * resolution per terminal cell.
 *
 * Palette indirection: a sprite never stores RGB. A palette index is resolved
 * to RGB via a LUT built from the House tint plus the Grade "beauty ladder":
 *   C — flat 4-color (tint shades only)
 *   B — 8-color (tint + accents)
 *   A — 16-color (richer ramp) + sparkle glint
 *   S — animated shimmer + a simple particle aura ('✦ · ˚')
 *
 * Color degradation (truecolor -> 256 -> 8 -> ASCII) is handled at write time
 * by the buffer/ansi layer; for `--no-color` we expose an index->char ramp.
 */

import type { Grade, SpriteDef } from '@token-tamers/core';
import { hexToRgb, mix, type ColorMode, type Rgb } from '../terminal/ansi';
import type { Cell, FrameBuffer } from './buffer';

/** '▀' UPPER HALF BLOCK (U+2580). Defined by codepoint to survive encoding. */
const UPPER_HALF = String.fromCodePoint(0x2580);

/** A resolved palette: index -> RGB (index 0 is reserved for transparent). */
export type Palette = ReadonlyArray<Rgb | null>;

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };
// Aurum accents (design §13: S = gold→amber→white traveling highlight).
const AURUM: Rgb = { r: 251, g: 191, b: 36 };
const AMBER: Rgb = { r: 255, g: 214, b: 110 };

/**
 * Build the palette LUT for a House tint + Grade. The grade determines how many
 * distinct colors the ladder offers; higher grades get a longer, richer ramp.
 * `frame` lets animated grades (S shimmer) shift the ramp over time.
 */
export function buildPalette(tint: string, grade: Grade, frame = 0): Palette {
  const base = hexToRgb(tint);
  const dark = mix(base, BLACK, 0.45);
  const darker = mix(base, BLACK, 0.7);
  const light = mix(base, WHITE, 0.35);
  const lighter = mix(base, WHITE, 0.6);

  switch (grade) {
    case 'C': {
      // Flat 4-color: transparent + 3 shades.
      return [null, darker, base, light];
    }
    case 'B': {
      // 8-color: add midtones + a white accent.
      return [null, darker, dark, base, light, lighter, WHITE, mix(base, WHITE, 0.85)];
    }
    case 'A': {
      // 16-color: full ramp + a sparkle glint slot (index 15).
      const ramp: Array<Rgb | null> = [null];
      for (let i = 1; i <= 13; i++) {
        ramp.push(mix(darker, lighter, i / 13));
      }
      ramp.push(WHITE);
      ramp.push(glint(base, frame)); // index 15: sparkle glint
      return ramp;
    }
    case 'S': {
      // Aurum: a gold→amber→white highlight travels across the ramp (design
      // §13 beauty ladder) — each index peaks at a different phase, so the
      // shimmer visibly SWEEPS over the sprite instead of breathing uniformly,
      // and the body stays saturated (gold-infused, never washed out).
      const ramp: Array<Rgb | null> = [null];
      for (let i = 1; i <= 14; i++) {
        const t = i / 14;
        // Body keeps the House hue, saturated; gold lives in the highlights.
        const body = mix(mix(dark, lighter, t), AURUM, t * t * 0.35);
        const sweep = (Math.sin(frame * 0.5 - i * 0.55) + 1) / 2; // traveling phase
        const peak = sweep > 0.72 ? (sweep - 0.72) / 0.28 : 0;
        ramp.push(peak > 0 ? mix(body, mix(AMBER, WHITE, peak), 0.65) : body);
      }
      ramp.push(glint(mix(base, AURUM, 0.6), frame));
      return ramp;
    }
  }
}

function glint(base: Rgb, frame: number): Rgb {
  const t = (Math.sin(frame * 0.9) + 1) / 2;
  return mix(base, WHITE, 0.5 + t * 0.5);
}

/** Resolve a palette index to RGB, clamping out-of-range to the top color. */
export function resolveIndex(pal: Palette, index: number): Rgb | null {
  if (index <= 0) return null;
  if (index < pal.length) return pal[index] ?? null;
  return pal[pal.length - 1] ?? null;
}

export interface DrawOptions {
  /** Cell column to draw at (0-based). */
  x: number;
  /** Cell row to draw at (0-based). */
  y: number;
  /** Animation frame counter; selects sprite frame and animates palette. */
  frame?: number;
  /** Color mode; in 'none' the index ramp is used instead of color. */
  mode?: ColorMode;
}

/**
 * Composite a sprite into the frame buffer. Position is given by `opts.x` and
 * `opts.y` (0-based cell coords). Each cell consumes two pixel rows (top -> fg,
 * bottom -> bg) rendered with the upper-half block. Transparent pixels (palette
 * null) leave whatever is underneath; if both top and bottom are transparent the
 * cell is skipped entirely.
 */
export function drawSprite(
  buf: FrameBuffer,
  sprite: SpriteDef,
  pal: Palette,
  opts: DrawOptions,
): void {
  const x = opts.x;
  const y = opts.y;
  const frame = opts.frame ?? 0;
  const mode = opts.mode ?? 'truecolor';
  const grid = sprite.frames[frame % sprite.frames.length] ?? sprite.frames[0];
  if (!grid) return;

  const height = grid.length;
  const cellRows = Math.ceil(height / 2);
  for (let cy = 0; cy < cellRows; cy++) {
    const topRow = grid[cy * 2];
    const botRow = grid[cy * 2 + 1];
    const width = Math.max(topRow?.length ?? 0, botRow?.length ?? 0);
    for (let cx = 0; cx < width; cx++) {
      const topIdx = topRow?.[cx] ?? 0;
      const botIdx = botRow?.[cx] ?? 0;
      const top = resolveIndex(pal, topIdx);
      const bot = resolveIndex(pal, botIdx);
      if (top === null && bot === null) continue;
      const cell = composeHalfBlock(top, bot, topIdx, botIdx, mode);
      buf.set(x + cx, y + cy, cell);
    }
  }
}

/** ASCII ramp for --no-color: brighter palette index -> denser glyph. */
const ASCII_RAMP = ' .:-=+*#%@';

export function indexToChar(index: number, paletteSize: number): string {
  if (index <= 0) return ' ';
  const t = Math.min(1, index / Math.max(1, paletteSize - 1));
  const i = Math.min(ASCII_RAMP.length - 1, Math.round(t * (ASCII_RAMP.length - 1)));
  return ASCII_RAMP[i] ?? '#';
}

function composeHalfBlock(
  top: Rgb | null,
  bot: Rgb | null,
  topIdx: number,
  botIdx: number,
  mode: ColorMode,
): Cell {
  if (mode === 'none') {
    // Pick the denser of the two pixels for the glyph; no color.
    const idx = Math.max(topIdx, botIdx);
    return { ch: indexToChar(idx, 16), fg: null, bg: null };
  }
  // fg = top pixel, bg = bottom pixel, glyph = upper-half block.
  return { ch: UPPER_HALF, fg: top, bg: bot };
}

/** Grade badge glyphs used across pages: [S]★ [A]◆ [B]● [C]○. */
export const GRADE_BADGE: Record<Grade, string> = {
  S: '★',
  A: '◆',
  B: '●',
  C: '○',
};

/** Particle aura glyphs for S-grade pets. */
export const AURA_GLYPHS = ['✦', '·', '˚'] as const;

/**
 * Sparkle/aura overlay positions for a given frame, relative to a sprite's
 * top-left, sized to (cols, rows). Returns cells to scatter around the pet for
 * S grade. Deterministic given the frame so golden snapshots are stable.
 */
export function auraOverlay(
  cols: number,
  rows: number,
  frame: number,
): Array<{ x: number; y: number; ch: string }> {
  const out: Array<{ x: number; y: number; ch: string }> = [];
  const positions = [
    { x: -1, y: 0 },
    { x: cols, y: 1 },
    { x: Math.floor(cols / 2), y: -1 },
    { x: -1, y: rows - 1 },
    { x: cols, y: rows - 2 },
  ];
  for (let i = 0; i < positions.length; i++) {
    // Twinkle: only show a subset per frame.
    if ((frame + i) % 3 !== 0) continue;
    const p = positions[i];
    if (!p) continue;
    const ch = AURA_GLYPHS[(frame + i) % AURA_GLYPHS.length] ?? '·';
    out.push({ x: p.x, y: p.y, ch });
  }
  return out;
}
