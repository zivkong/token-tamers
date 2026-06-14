/**
 * Meter — the ONE standard progress bar, reused everywhere (stats, food,
 * completion). A bar reads clearly as two distinct parts:
 *   - FILLED  → solid `█` in the bar's accent color (current progress);
 *   - REMAINING → a `▒` track in a clearly-visible slate (what's left).
 * The track is intentionally bright/dense enough to read against the background
 * (a dim `░` was nearly invisible). Distinct glyphs also keep filled-vs-remaining
 * legible in `--no-color` mode.
 */

import type { Rgb } from '../terminal/ansi';
import type { FrameBuffer } from '../render/buffer';

/** Filled cell (current progress) and remaining-track cell glyphs. */
export const BAR_FULL = String.fromCodePoint(0x2588); // █
export const BAR_TRACK = String.fromCodePoint(0x2592); // ▒

/** Remaining-track tint — bright enough that the "what's left" reads clearly. */
export const BAR_EMPTY: Rgb = { r: 96, g: 104, b: 134 };

interface BarRect {
  x: number;
  y: number;
  w: number;
}

function clampFrac(frac: number): number {
  return frac < 0 ? 0 : frac > 1 ? 1 : frac;
}

/** Draw a `w`-cell bar at (x,y) filled to `frac` (0..1) with a visible track. */
export function drawMeter(
  buf: FrameBuffer,
  at: BarRect,
  frac: number,
  fill: Rgb,
  empty: Rgb = BAR_EMPTY,
): void {
  const filled = Math.round(clampFrac(frac) * at.w);
  for (let i = 0; i < at.w; i++) {
    const on = i < filled;
    buf.set(at.x + i, at.y, { ch: on ? BAR_FULL : BAR_TRACK, fg: on ? fill : empty, bg: null });
  }
}

/** One slice of a segmented meter's FILLED portion (e.g. a diet gene's share). */
export interface MeterSegment {
  /** Fraction of the FILLED portion this slice occupies (0..1). */
  frac: number;
  color: Rgb;
}

/**
 * Draw a meter whose filled portion (`fillFrac` of the width) is split into
 * colored `segments`, with the remaining width shown as the standard track.
 * Used by the pet's diet-tinted food bar; the track matches `drawMeter` so all
 * bars look identical.
 */
export function drawSegmentedMeter(
  buf: FrameBuffer,
  at: BarRect,
  fillFrac: number,
  segments: readonly MeterSegment[],
  fallback: Rgb,
): void {
  const filled = Math.round(clampFrac(fillFrac) * at.w);
  let i = 0;
  for (const seg of segments) {
    const cells = Math.round(seg.frac * filled);
    for (let k = 0; k < cells && i < filled; k++) {
      buf.set(at.x + i++, at.y, { ch: BAR_FULL, fg: seg.color, bg: null });
    }
  }
  while (i < filled) buf.set(at.x + i++, at.y, { ch: BAR_FULL, fg: fallback, bg: null });
  while (i < at.w) buf.set(at.x + i++, at.y, { ch: BAR_TRACK, fg: BAR_EMPTY, bg: null });
}

/** A right-aligned page-completion header: `[bar] count  NN.N%` on row `y`. */
export interface CompletionHeader {
  x: number;
  y: number;
  width: number;
  count: string;
  pct: number;
  fill: Rgb;
  dim: Rgb;
}

/**
 * Draw a per-page completion readout right-aligned in `[x, x+width)`: the count
 * + percent, and a 10-cell bar to their left when there is room. Used by Dex and
 * Archive to show how complete THAT page's collection is.
 */
export function drawCompletionHeader(buf: FrameBuffer, h: CompletionHeader): void {
  const seg = `${h.count}  ${h.pct.toFixed(1)}%`;
  const right = h.x + h.width - 1;
  const segX = right - seg.length;
  buf.text(segX, h.y, seg, h.dim, null);
  const barW = 10;
  const barX = segX - 1 - barW;
  if (barX > h.x + 8) drawMeter(buf, { x: barX, y: h.y, w: barW }, h.pct / 100, h.fill);
}
