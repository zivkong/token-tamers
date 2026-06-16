/**
 * A horizontal scrolling marquee (ticker) — one full-width row that loops a
 * message leftward. The scroll offset is a pure function of the frame counter
 * (no clock, no RNG), so golden frames stay reproducible. The entire row is
 * painted with `bg` so it always reads as a solid ribbon. The loop period is
 * `text.length + gap + cols`, which guarantees at most one copy of the message
 * is on screen at any time: a copy scrolls fully off the left edge — and then
 * clears a further `gap` cells — before the next copy enters from the right.
 */

import type { Rgb } from '../terminal/ansi';
import type { FrameBuffer } from '../render/buffer';

export interface MarqueeOptions {
  /** Left/top cell of the ticker row. */
  x: number;
  y: number;
  /** Row width in cells. */
  cols: number;
  /** The message to scroll. */
  text: string;
  /** Animation frame counter (advances at render fps). */
  frame: number;
  fg: Rgb;
  bg: Rgb;
  /** Frames between each 1-cell advance (higher = slower). Default 3. */
  framesPerStep?: number;
  /** Blank cells inserted between repeats of the message. Default 8. */
  gap?: number;
}

const DEFAULT_FRAMES_PER_STEP = 3;
const DEFAULT_GAP = 8;

/** Draw one frame of a scrolling marquee at (x, y) spanning `cols` cells. */
export function drawMarquee(buf: FrameBuffer, opts: MarqueeOptions): void {
  const { x, y, cols, text, frame, fg, bg } = opts;
  if (cols <= 0) return;

  const step = Math.max(1, opts.framesPerStep ?? DEFAULT_FRAMES_PER_STEP);
  const gap = Math.max(1, opts.gap ?? DEFAULT_GAP);

  // Pad the loop so a full screenful (`cols`) of slack follows the message+gap
  // before it repeats. Period = text.length + gap + cols, so a copy is always
  // fully gone (plus a `gap` margin) before the next one enters — never two at
  // once, at any width.
  const base = [...`${text}${' '.repeat(gap)}`];
  const minPeriod = base.length + cols;
  const loop =
    base.length < minPeriod ? base.concat(Array(minPeriod - base.length).fill(' ')) : base;
  const period = loop.length;

  const offset = Math.floor(frame / step) % period;
  for (let c = 0; c < cols; c++) {
    const ch = loop[(c + offset) % period] ?? ' ';
    buf.set(x + c, y, { ch, fg, bg });
  }
}
