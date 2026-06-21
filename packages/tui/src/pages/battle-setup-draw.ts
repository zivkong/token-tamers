/**
 * Leaf drawing helpers for the Battle SETUP screen — the generic box border, its
 * centered title, the centered-text primitive, and the "VS" stamp. Split out of
 * `battle-setup.ts` to keep that file under the line ceiling; pure presentation, no
 * state, so the setup frames stay golden-testable.
 */

import type { Rgb } from '../terminal/ansi';
import type { RenderContext } from './types';

const DIM: Rgb = { r: 96, g: 100, b: 120 };
const READY: Rgb = { r: 74, g: 222, b: 128 };
const VS_COLOR: Rgb = { r: 255, g: 224, b: 130 };
const BORDER: Rgb = { r: 70, g: 76, b: 96 };

/** Stamp the "VS" divider between the two fighter panels. */
export function drawVS(ctx: RenderContext, midX: number, y: number): void {
  ctx.buf.textBold(midX - 1, y, 'VS', VS_COLOR, null);
}

/** Draw `text` horizontally centered within the box rect (at `box.y`), clipped to width. */
export function centerText(
  buf: RenderContext['buf'],
  box: { x: number; w: number; y: number },
  text: string,
  color: Rgb,
  bold = false,
): void {
  const chars = [...text];
  const t = chars.length > box.w ? chars.slice(0, box.w).join('') : text;
  const cx = box.x + Math.max(0, Math.floor((box.w - [...t].length) / 2));
  if (bold) buf.textBold(cx, box.y, t, color, null);
  else buf.text(cx, box.y, t, color, null);
}

/** Draw a single-line box border (the bottom-band container); `focused` brightens it. */
export function drawBox(
  ctx: RenderContext,
  box: { x: number; y: number; w: number; h: number },
  focused: boolean,
): void {
  const { buf } = ctx;
  const { x, y, w, h } = box;
  if (w < 2 || h < 2) return;
  const color = focused ? READY : BORDER;
  const horiz = '─'.repeat(w - 2);
  buf.text(x, y, `┌${horiz}┐`, color, null);
  buf.text(x, y + h - 1, `└${horiz}┘`, color, null);
  for (let r = 1; r < h - 1; r++) {
    buf.set(x, y + r, { ch: '│', fg: color, bg: null });
    buf.set(x + w - 1, y + r, { ch: '│', fg: color, bg: null });
  }
}

/** Overlay a centered title (padded) onto a box's top border row. */
export function boxTitle(
  ctx: RenderContext,
  box: { x: number; w: number; y: number },
  label: string,
  focused: boolean,
): void {
  centerText(ctx.buf, box, ` ${label} `, focused ? READY : DIM, true);
}
