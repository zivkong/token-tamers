/**
 * Sub-cell sprite compositor (the design degradation ladder).
 *
 * A `SpriteDef` (from the content pack) is a palette-indexed grid. We pack its
 * pixels into terminal cells at the active sub-cell density — sextant (2x3) by
 * default, octant (2x4) once its glyph table ships, half-block (1x2) as the
 * legacy fallback — quantizing each cell to 2 SGR colors (fg/bg) plus the block
 * glyph whose filled-sub-pixel mask matches. Partly-transparent cells composite
 * their silhouette over the existing backdrop cell.
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
import type { FrameBuffer } from './buffer';

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

// ---------------------------------------------------------------------------
// Sub-cell compositor (the design degradation ladder). A terminal cell holds
// `cols x rows` sub-pixels but only 2 SGR colors (fg/bg), so per cell we pack
// the sprite's pixels, quantize to 2 inks, and pick the block glyph whose
// filled-sub-pixel mask matches. Modes:
//   octant 2x4 — square sub-pixels (pending the Unicode 16 BLOCK OCTANT table)
//   sextant 2x3 — CURRENT DEFAULT (Unicode 13 "Block Sextants", broad support)
//   half 1x2 — legacy fallback (the original half-block look)
// ---------------------------------------------------------------------------

interface SubcellMode {
  /** Sub-pixels per cell, left→right. */
  cols: number;
  /** Sub-pixels per cell, top→bottom. */
  rows: number;
  /** Glyph for a fg-mask (bit i set ⇒ sub-pixel i is fg), row-major top→bottom. */
  glyph: (mask: number) => string;
}

/**
 * Build the 2×3 sextant glyph table. Bit order is row-major (0,1 / 2,3 / 4,5).
 * Unicode 13 added 60 "Block Sextants" at U+1FB00.. in increasing pattern value,
 * SKIPPING the 4 patterns that already had Block-Element chars: empty→space,
 * full→█, the left column→▌, the right column→▐.
 */
function buildSextantTable(): string[] {
  const reuse: Record<number, string> = {
    0: ' ',
    0o77: String.fromCodePoint(0x2588), // 63 — full
    21: String.fromCodePoint(0x258c), // bits 0,2,4 — left column → LEFT HALF BLOCK
    42: String.fromCodePoint(0x2590), // bits 1,3,5 — right column → RIGHT HALF BLOCK
  };
  const table = new Array<string>(64);
  let next = 0x1fb00;
  for (let v = 0; v < 64; v++) table[v] = reuse[v] ?? String.fromCodePoint(next++);
  return table;
}
const SEXTANT_TABLE = buildSextantTable();

/** 1×2 half-block table: bit0 = top, bit1 = bottom. */
const HALF_TABLE = [' ', UPPER_HALF, String.fromCodePoint(0x2584), String.fromCodePoint(0x2588)];

const SEXTANT: SubcellMode = { cols: 2, rows: 3, glyph: (m) => SEXTANT_TABLE[m] ?? ' ' };
const HALF: SubcellMode = { cols: 1, rows: 2, glyph: (m) => HALF_TABLE[m] ?? ' ' };

/**
 * Active sub-cell density. Sextant (2×3) is the verified default — 3× the
 * half-block density at broad terminal support. Octant (2×4, square sub-pixels)
 * is the target ceiling; it drops in here as a one-line swap once its 256-entry
 * glyph table ships. `HALF` is retained as the legacy fallback.
 */
const SUBCELL: SubcellMode = SEXTANT;
void HALF; // retained fallback mode (see the degradation ladder)

/** Cell-rows a sprite of `pixelHeight` occupies natively at the active density. */
export function subcellRows(pixelHeight: number): number {
  return Math.ceil(pixelHeight / SUBCELL.rows);
}
/** Cell-cols a sprite of `pixelWidth` occupies natively at the active density. */
export function subcellCols(pixelWidth: number): number {
  return Math.ceil(pixelWidth / SUBCELL.cols);
}

/**
 * Composite a sprite into the frame buffer at `opts.x`/`opts.y` (0-based cells).
 * Each cell packs `SUBCELL.cols × rows` sub-pixels, quantized to 2 colors. Fully
 * transparent cells leave the backdrop; partly-transparent cells composite their
 * silhouette OVER the backdrop (bg read from the buffer). `destW`/`destH` scale
 * the cell footprint (nearest-neighbor); omit for the native footprint.
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
  let srcCols = 0;
  for (const row of grid) srcCols = Math.max(srcCols, row.length);
  const cd: CellDraw = {
    grid,
    pal,
    srcCols,
    srcRows: grid.length,
    m: SUBCELL,
    destCols: opts.destW ?? subcellCols(srcCols),
    destRows: opts.destH ?? subcellRows(grid.length),
    flipX: !!opts.flipX,
    mode: opts.mode ?? 'truecolor',
  };
  cd.subW = cd.destCols * cd.m.cols;
  cd.subH = cd.destRows * cd.m.rows;
  cd.x0 = opts.x;
  cd.y0 = opts.y;
  for (let cy = 0; cy < cd.destRows; cy++) {
    for (let cx = 0; cx < cd.destCols; cx++) {
      if (!insideClip(opts.clip, opts.x + cx, opts.y + cy)) continue;
      composeCell(buf, cd, cx, cy);
    }
  }
}

/** Everything the per-cell compositor needs, grouped to honor max-params. */
interface CellDraw {
  grid: number[][];
  pal: Palette;
  srcCols: number;
  srcRows: number;
  m: SubcellMode;
  destCols: number;
  destRows: number;
  flipX: boolean;
  mode: ColorMode;
  /** Total sub-pixel grid the cells cover (= destCols*cols / destRows*rows). */
  subW?: number;
  subH?: number;
  /** Destination origin in cells (set by drawSprite). */
  x0?: number;
  y0?: number;
}

/** Gather one cell's sub-pixels (mask-bit order) + the opaque inks among them. */
function gatherCell(
  cd: CellDraw,
  cx: number,
  cy: number,
): { cells: Array<Rgb | null>; inks: Rgb[]; maxIdx: number } {
  const cells: Array<Rgb | null> = [];
  const inks: Rgb[] = [];
  let maxIdx = 0;
  const subW = cd.subW ?? cd.destCols * cd.m.cols;
  const subH = cd.subH ?? cd.destRows * cd.m.rows;
  for (let sy = 0; sy < cd.m.rows; sy++) {
    for (let sx = 0; sx < cd.m.cols; sx++) {
      const srcX0 = Math.floor(((cx * cd.m.cols + sx) * cd.srcCols) / subW);
      const srcY = Math.floor(((cy * cd.m.rows + sy) * cd.srcRows) / subH);
      const srcX = cd.flipX ? cd.srcCols - 1 - srcX0 : srcX0;
      const idx = cd.grid[srcY]?.[srcX] ?? 0;
      const rgb = resolveIndex(cd.pal, idx);
      cells.push(rgb);
      if (rgb) {
        inks.push(rgb);
        if (idx > maxIdx) maxIdx = idx;
      }
    }
  }
  return { cells, inks, maxIdx };
}

/** Quantize a cell to 2 colors + a fg mask, and write it to the buffer. */
function composeCell(buf: FrameBuffer, cd: CellDraw, cx: number, cy: number): void {
  const tx = (cd.x0 ?? 0) + cx;
  const ty = (cd.y0 ?? 0) + cy;
  const { cells, inks, maxIdx } = gatherCell(cd, cx, cy);
  if (inks.length === 0) return; // fully transparent: keep the backdrop
  if (cd.mode === 'none') {
    buf.set(tx, ty, { ch: indexToChar(maxIdx, 16), fg: null, bg: null });
    return;
  }
  let fg: Rgb;
  let bg: Rgb | null;
  const hasTransparent = inks.length < cells.length;
  if (hasTransparent) {
    // Silhouette over the backdrop: dominant ink on top of the existing cell.
    fg = dominantColor(inks);
    const under = buf.get(tx, ty);
    bg = under.bg ?? under.fg ?? null;
  } else {
    // Fully opaque: 2-tone quantize so in-cell shading (outline vs body) survives.
    const [dark, light] = lumExtremes(inks);
    fg = light;
    bg = dark;
  }
  let mask = 0;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c) continue; // transparent ⇒ bg bit (0)
    if (hasTransparent || dist2(c, fg) <= dist2(c, bg as Rgb)) mask |= 1 << i;
  }
  buf.set(tx, ty, { ch: cd.m.glyph(mask), fg, bg });
}

function lum(c: Rgb): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}
function dist2(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}
/** The luminance-darkest and luminance-lightest of a non-empty ink list. */
function lumExtremes(inks: Rgb[]): [Rgb, Rgb] {
  let dark = inks[0]!;
  let light = inks[0]!;
  for (const c of inks) {
    if (lum(c) < lum(dark)) dark = c;
    if (lum(c) > lum(light)) light = c;
  }
  return [dark, light];
}
/** The most frequent ink (ties broken toward the brightest) — the cell's main tone. */
function dominantColor(inks: Rgb[]): Rgb {
  const counts = new Map<string, { c: Rgb; n: number }>();
  for (const c of inks) {
    const k = `${c.r},${c.g},${c.b}`;
    const e = counts.get(k);
    if (e) e.n++;
    else counts.set(k, { c, n: 1 });
  }
  let best = inks[0]!;
  let bestN = -1;
  for (const { c, n } of counts.values()) {
    if (n > bestN || (n === bestN && lum(c) > lum(best))) {
      best = c;
      bestN = n;
    }
  }
  return best;
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
