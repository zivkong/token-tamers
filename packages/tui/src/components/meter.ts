/**
 * Meter — the one standard horizontal bar (`filled` cells then an empty track)
 * plus the page-completion header that wraps it. Shared by the vitals panel and
 * the per-page completion bars (Dex/Archive) so every bar looks identical.
 */

import type { Rgb } from '../terminal/ansi';
import type { FrameBuffer } from '../render/buffer';

const FULL = String.fromCodePoint(0x2588); // █
const LIGHT = String.fromCodePoint(0x2591); // ░

/** Default empty-track tint (a dim slate). */
export const BAR_EMPTY: Rgb = { r: 44, g: 50, b: 70 };

/** Draw a `w`-cell bar at (x,y) filled to `frac` (0..1); empty cells show a track. */
export function drawMeter(
  buf: FrameBuffer,
  at: { x: number; y: number; w: number },
  frac: number,
  fill: Rgb,
  empty: Rgb = BAR_EMPTY,
): void {
  const f = frac < 0 ? 0 : frac > 1 ? 1 : frac;
  const filled = Math.round(f * at.w);
  for (let i = 0; i < at.w; i++) {
    const on = i < filled;
    buf.set(at.x + i, at.y, { ch: on ? FULL : LIGHT, fg: on ? fill : empty, bg: null });
  }
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
