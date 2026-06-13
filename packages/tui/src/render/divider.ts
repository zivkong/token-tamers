/**
 * Section divider rule — a full-width horizontal line used to separate the
 * stacked sections of a page. Optionally carries a left-aligned label
 * (`──┤ VITALS ├────────────`) for a titled section break.
 */

import type { Rgb } from '../terminal/ansi';
import type { FrameBuffer } from './buffer';

/** '─' light horizontal (U+2500), by codepoint to survive encoding. */
const RULE = String.fromCodePoint(0x2500);

const DEFAULT_LINE: Rgb = { r: 54, g: 62, b: 86 };
const DEFAULT_LABEL: Rgb = { r: 150, g: 200, b: 255 };

export interface DividerOptions {
  /** Start column (default 0). */
  x?: number;
  /** Width in cells (default: to the buffer's right edge from `x`). */
  width?: number;
  /** Optional section label rendered into the rule near the left. */
  label?: string;
  /** Rule color. */
  color?: Rgb;
  /** Label color. */
  labelColor?: Rgb;
}

/** Draw a horizontal divider rule across `[x, x+width)` at row `y`. */
export function drawDivider(buf: FrameBuffer, y: number, opts: DividerOptions = {}): void {
  const x = opts.x ?? 0;
  const width = opts.width ?? buf.cols - x;
  const color = opts.color ?? DEFAULT_LINE;
  if (width <= 0) return;

  for (let i = 0; i < width; i++) {
    buf.set(x + i, y, { ch: RULE, fg: color, bg: null });
  }

  if (opts.label) {
    // ──┤ LABEL ├── : a small gap of rule, the label, then the rule continues.
    const label = ` ${opts.label} `;
    const startGap = 2;
    if (startGap + label.length <= width) {
      buf.text(x + startGap, y, label, opts.labelColor ?? DEFAULT_LABEL, null);
    }
  }
}
