/**
 * End-of-fight flourish + the `l` log overlay for the battle arena (design:
 * battle-playback-redesign.md §7–8). Split out of `battle-arena.ts` to keep that
 * file under the line ceiling. Pure presentation — a function of the resolved view
 * — so frames stay golden-testable.
 */

import type { Rgb } from '../terminal/ansi';
import { BLANK_CELL } from '../render/buffer';
import { drawDivider, pageBodyBottom } from '../components';
import { clipStr, logLine, ownerCreatureLine } from './battle-beat';
import type { BattleView, RenderContext } from './types';

const DIM: Rgb = { r: 96, g: 100, b: 120 };
const TEXT: Rgb = { r: 214, g: 220, b: 234 };
const WIN: Rgb = { r: 255, g: 224, b: 130 };
const PANEL_BG: Rgb = { r: 18, g: 20, b: 30 };

/** Draw `text` centered across the canvas at row `y` (bold), clipped to width. */
function centerBold(ctx: RenderContext, y: number, text: string, color: Rgb): void {
  const { canvasX, canvasCols } = ctx.layout;
  const t = clipStr(text, canvasCols - 2);
  const x = canvasX + Math.max(0, Math.floor((canvasCols - [...t].length) / 2));
  ctx.buf.textBold(x, y, t, color, null);
}

/**
 * The winner flourish, shown once the fight is over: a centered "★ NAME WINS ★"
 * with the winner's Tamer creature line above it (room permitting). A draw reads
 * "⚖ Draw". The winner's glow/bob and the loser's dim are drawn by the columns.
 */
export function drawWinnerFlourish(ctx: RenderContext, view: BattleView, row: number): void {
  if (row >= pageBodyBottom(ctx.layout) || row < ctx.layout.canvasY) return;
  const w = view.result.winner;
  if (w === 'draw') {
    centerBold(ctx, row, '⚖  Draw', WIN);
    return;
  }
  const champ = w === 'a' ? view.left : view.right;
  const sub = ownerCreatureLine(champ, ctx.info?.tamer ?? '');
  // Show the Tamer subtitle only when it adds something beyond the name in the WINS line.
  if (sub !== champ.name && row - 1 >= ctx.layout.canvasY) centerBold(ctx, row - 1, sub, DIM);
  centerBold(ctx, row, `★  ${champ.name} WINS  ★`, WIN);
}

/**
 * The `l` transcript overlay: a panel over the arena listing the full play-by-play
 * up to the playback head, auto-scrolled to the latest line. Press `l`/Esc to close.
 */
export function drawLogOverlay(ctx: RenderContext, view: BattleView, bodyY: number): void {
  const { buf, layout } = ctx;
  const x = layout.canvasX + 2;
  const w = layout.canvasCols - 4;
  const top = bodyY;
  const bottom = pageBodyBottom(layout) - 1; // leave the footer row clear
  if (w < 8 || bottom - top < 3) return;
  // Clear the panel region so the arena behind doesn't bleed through.
  buf.fillRect(x, top, w, bottom - top, { ...BLANK_CELL, bg: PANEL_BG });
  drawDivider(buf, top, { x, width: w, label: 'Battle Log' });
  const tl = view.result.timeline;
  const end = Math.min(view.cursor, tl.length);
  const rows = bottom - (top + 2);
  const start = Math.max(0, end - rows);
  for (let i = start; i < end; i++) {
    const live = i === end - 1; // the line that just landed
    buf.text(
      x,
      top + 2 + (i - start),
      clipStr(logLine(view, tl[i]!), w),
      live ? TEXT : DIM,
      PANEL_BG,
    );
  }
  buf.text(x, bottom, clipStr('l / Esc  close', w), DIM, PANEL_BG);
}
