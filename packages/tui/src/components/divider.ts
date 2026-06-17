/**
 * Section divider — the one standard rule used to separate stacked sections.
 *
 * STANDARD (keep every divider identical):
 *  - a full-width `─` rule in the shared line color;
 *  - an optional section label, always rendered **ALL CAPS + BOLD** in the shared
 *    label color, inset a couple of cells (`──┤ VITALS ├──` style);
 *  - a **blank gap row immediately AFTER** the rule. The gap is reserved by the
 *    layout (see render/layout.ts) so callers must leave row `y+1` empty — every
 *    section divider breathes the same way.
 */

import type { Rgb } from '../terminal/ansi';
import type { FrameBuffer } from '../render/buffer';

/** '─' light horizontal (U+2500), by codepoint to survive encoding. */
const RULE = String.fromCodePoint(0x2500);
/** '│' light vertical (U+2502), by codepoint to survive encoding. */
const VRULE = String.fromCodePoint(0x2502);

/** Shared rule + label colors so every divider looks identical. */
export const DIVIDER_LINE: Rgb = { r: 54, g: 62, b: 86 };
export const DIVIDER_LABEL: Rgb = { r: 150, g: 200, b: 255 };

export interface DividerOptions {
  /** Start column (default 0). */
  x?: number;
  /** Width in cells (default: to the buffer's right edge from `x`). */
  width?: number;
  /** Optional section label — rendered ALL CAPS + BOLD regardless of casing. */
  label?: string;
  /** Rule color (defaults to the shared line color). */
  color?: Rgb;
  /** Label color (defaults to the shared label color). */
  labelColor?: Rgb;
}

/**
 * Draw the standard divider rule across `[x, x+width)` at row `y`. A blank gap
 * row is expected at `y+1` (reserved by the layout) — do NOT draw content there.
 */
export function drawDivider(buf: FrameBuffer, y: number, opts: DividerOptions = {}): void {
  const x = opts.x ?? 0;
  const width = opts.width ?? buf.cols - x;
  if (width <= 0) return;

  const color = opts.color ?? DIVIDER_LINE;
  for (let i = 0; i < width; i++) {
    buf.set(x + i, y, { ch: RULE, fg: color, bg: null });
  }

  if (opts.label) {
    // ALL CAPS + BOLD, inset from the left so the rule frames it: ── LABEL ──
    const label = ` ${opts.label.toUpperCase()} `;
    const startGap = 2;
    if (startGap + label.length <= width) {
      buf.textBold(x + startGap, y, label, opts.labelColor ?? DIVIDER_LABEL, null);
    }
  }
}

/**
 * Draw a vertical rule down column `x` for `height` rows from `y`. The companion
 * to `drawDivider`, used by the horizontal (side-by-side) layout to separate the
 * game canvas from the chrome column / menu rail. Same shared line color.
 */
export function drawVDivider(
  buf: FrameBuffer,
  x: number,
  y: number,
  height: number,
  color: Rgb = DIVIDER_LINE,
): void {
  if (height <= 0) return;
  for (let i = 0; i < height; i++) {
    buf.set(x, y + i, { ch: VRULE, fg: color, bg: null });
  }
}
