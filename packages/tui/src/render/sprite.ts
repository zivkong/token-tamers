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

/** Soft cream belly/underside tone (palette index 20). */
const CREAM: Rgb = { r: 246, g: 239, b: 216 };

/**
 * Build the palette LUT for a House tint + Grade + optional per-species accent.
 * Indices 1..15 are the grade body ramp (C flat → S gold-glow). Indices 16/17/18
 * are the species SIGNATURE ACCENT band (a SECONDARY color, dark→light); index 20
 * is the cream belly. The body ramp is normalized to always fill 1..15 (short C/B
 * ramps clamp to their top color) so adding the accent band never punches holes in
 * the body. `accent` omitted ⇒ the accent band falls back to the House hue (the
 * legacy look); golden frames that pass no accent keep indices 1..15 unchanged.
 */
export function buildPalette(tint: string, grade: Grade, frame = 0, accent?: string): Palette {
  const base = hexToRgb(tint);
  const dark = mix(base, BLACK, 0.45);
  const darker = mix(base, BLACK, 0.7);
  const light = mix(base, WHITE, 0.35);
  const lighter = mix(base, WHITE, 0.6);

  let body: Array<Rgb | null>;
  switch (grade) {
    case 'C':
      // Flat 4-color: transparent + 3 shades.
      body = [null, darker, base, light];
      break;
    case 'B':
      // 8-color: add midtones + a white accent.
      body = [null, darker, dark, base, light, lighter, WHITE, mix(base, WHITE, 0.85)];
      break;
    case 'A': {
      // 16-color: full ramp + a sparkle glint slot (index 15).
      const ramp: Array<Rgb | null> = [null];
      for (let i = 1; i <= 13; i++) ramp.push(mix(darker, lighter, i / 13));
      ramp.push(WHITE);
      ramp.push(glint(base, frame));
      body = ramp;
      break;
    }
    case 'S': {
      // Aurum: a gold→amber→white highlight travels across the ramp (design §13
      // beauty ladder) — the shimmer SWEEPS, the body stays saturated/gold-infused.
      const ramp: Array<Rgb | null> = [null];
      for (let i = 1; i <= 14; i++) {
        const t = i / 14;
        const b = mix(mix(dark, lighter, t), AURUM, t * t * 0.35);
        const sweep = (Math.sin(frame * 0.5 - i * 0.55) + 1) / 2;
        const peak = sweep > 0.72 ? (sweep - 0.72) / 0.28 : 0;
        ramp.push(peak > 0 ? mix(b, mix(AMBER, WHITE, peak), 0.65) : b);
      }
      ramp.push(glint(mix(base, AURUM, 0.6), frame));
      body = ramp;
      break;
    }
  }

  // Normalize the body ramp to fill 1..15 (clamp short C/B ramps to their top),
  // then append the per-species accent band (16..18) + cream belly (19/20).
  const out: Array<Rgb | null> = [null];
  const top = body[body.length - 1] ?? WHITE;
  for (let i = 1; i <= 15; i++) out[i] = i < body.length ? (body[i] ?? top) : top;
  const acc = accent ? hexToRgb(accent) : base;
  out[16] = mix(acc, BLACK, 0.32);
  out[17] = acc;
  out[18] = mix(acc, WHITE, 0.45);
  out[19] = CREAM;
  out[20] = CREAM;
  return out;
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

/**
 * Build a palette directly from an ordered list of hex colors, with NO grade
 * ladder and no dimming. Index 0 is transparent; index 1 maps to hexes[0],
 * index 2 to hexes[1], and so on (so `grid` index N reads `hexes[N - 1]`).
 * Used by habitats that own their colors (HabitatDef.palette).
 */
export function paletteFromHexes(hexes: string[]): Palette {
  return [null, ...hexes.map((h) => hexToRgb(h))];
}

/** Named animation banks selectable via DrawOptions.anim. */
export type AnimBank = 'idle' | 'walk' | 'jump' | 'play';

export interface DrawOptions {
  /** Cell column to draw at (0-based). */
  x: number;
  /** Cell row to draw at (0-based). */
  y: number;
  /** Animation frame counter; selects sprite frame and animates palette. */
  frame?: number;
  /** Color mode; in 'none' the index ramp is used instead of color. */
  mode?: ColorMode;
  /** Optional clip rect (cells); pixels outside it are not drawn. */
  clip?: { x: number; y: number; w: number; h: number };
  /** Mirror columns left<->right when set (face the other way). */
  flipX?: boolean;
  /**
   * Animation bank to draw from. Falls back to `frames` (idle) when the named
   * bank is absent on the sprite. 'idle' always uses `frames`.
   */
  anim?: AnimBank;
  /**
   * Destination width in cells. When set, the sprite is nearest-neighbor scaled
   * horizontally to exactly this many columns; omit for native width. Used to
   * fill a full-width backdrop with no side padding.
   */
  destW?: number;
  /**
   * Destination height in cells. When set, the sprite is nearest-neighbor scaled
   * vertically to exactly this many cell-rows (2 px each); omit for native
   * height. Setting `destW`/`destH` together to the scene's cell aspect scales
   * the backdrop uniformly (no distortion).
   */
  destH?: number;
}

/**
 * Nominal shell render cadence (frames/sec) the `frame` counter ticks at — kept
 * in sync with the shell loop (`FRAME_MS = 1000 / 30`). Animation banks advance
 * at the sprite's own `fps`, NOT once per render frame: dividing the render
 * counter down to `sprite.fps` is what stops a 2-frame breathe/bob from flipping
 * ~15×/sec (which reads as the pet jittering "in place").
 */
const NOMINAL_FPS = 30;

/** Select the frame grid for the requested bank/frame, honoring fallback. */
function selectGrid(sprite: SpriteDef, anim: AnimBank, frame: number): number[][] | undefined {
  const bank = anim === 'idle' ? sprite.frames : (sprite[anim] ?? sprite.frames);
  if (bank.length === 0) return sprite.frames[0];
  // Advance the bank at the sprite's declared fps, not the render cadence. Pure
  // function of (frame, sprite.fps) so golden frames stay deterministic.
  const tick = Math.floor((frame * sprite.fps) / NOMINAL_FPS);
  return bank[tick % bank.length] ?? bank[0];
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
  const frame = opts.frame ?? 0;
  const grid = selectGrid(sprite, opts.anim ?? 'idle', frame);
  if (!grid) return;

  // Source grid dimensions (rectangular palette grids; max guards ragged rows).
  let srcCols = 0;
  for (const row of grid) srcCols = Math.max(srcCols, row.length);
  const srcPixelH = grid.length;

  // Destination size in cells; defaults reproduce the native 1:1 draw exactly
  // (floor sampling is the identity when src and dest sizes match).
  const destW = opts.destW ?? srcCols;
  const destH = opts.destH ?? Math.ceil(srcPixelH / 2);
  const rd: RowDraw = {
    grid,
    pal,
    opts,
    srcCols,
    srcPixelH,
    destW,
    destPixelH: destH * 2,
  };

  for (let cy = 0; cy < destH; cy++) {
    drawSpriteRow(buf, rd, cy);
  }
}

/** Everything a single scaled row-draw needs, grouped to honor max-params. */
interface RowDraw {
  grid: number[][];
  pal: Palette;
  opts: DrawOptions;
  srcCols: number;
  srcPixelH: number;
  destW: number;
  destPixelH: number;
}

/** Composite one destination cell-row (two scaled pixel rows) of a sprite. */
function drawSpriteRow(buf: FrameBuffer, rd: RowDraw, cy: number): void {
  const { grid, pal, opts } = rd;
  const mode = opts.mode ?? 'truecolor';
  const topRow = grid[Math.floor((cy * 2 * rd.srcPixelH) / rd.destPixelH)];
  const botRow = grid[Math.floor(((cy * 2 + 1) * rd.srcPixelH) / rd.destPixelH)];
  for (let cx = 0; cx < rd.destW; cx++) {
    const sampled = rd.destW === rd.srcCols ? cx : Math.floor((cx * rd.srcCols) / rd.destW);
    const src = opts.flipX ? rd.srcCols - 1 - sampled : sampled;
    const topIdx = topRow?.[src] ?? 0;
    const botIdx = botRow?.[src] ?? 0;
    const top = resolveIndex(pal, topIdx);
    const bot = resolveIndex(pal, botIdx);
    if (top === null && bot === null) continue;
    const tx = opts.x + cx;
    const ty = opts.y + cy;
    if (!insideClip(opts.clip, tx, ty)) continue;
    buf.set(tx, ty, composeHalfBlock(top, bot, topIdx, botIdx, mode));
  }
}

function insideClip(clip: DrawOptions['clip'], x: number, y: number): boolean {
  if (!clip) return true;
  return x >= clip.x && y >= clip.y && x < clip.x + clip.w && y < clip.y + clip.h;
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

/** Beauty-ladder accent per grade (design §13) — UI badge/highlight colors. */
export const GRADE_ACCENT: Record<Grade, Rgb> = {
  C: { r: 150, g: 152, b: 160 },
  B: { r: 74, g: 222, b: 128 },
  A: { r: 167, g: 139, b: 250 },
  S: { r: 251, g: 191, b: 36 },
};

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
