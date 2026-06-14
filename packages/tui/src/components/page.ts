/**
 * Standard full-screen page scaffold — the shared chrome every non-Pet page uses
 * so Dex / Archive / Settings look and behave identically:
 *
 *   row 0       `icon Title` (left)  ………………  optional completion readout (right)
 *   row 1       the one standard divider rule (`drawDivider`)
 *   row 2       the divider's reserved gap row
 *   row 3…N-2   page body (list / table / fields), starting at PAGE_HEADER_ROWS
 *   row N-1     a left-aligned footer status line (`drawPageFooter`)
 *
 * The Pet page is the game canvas and is deliberately exempt. The global
 * `── Menu ──` divider + buttons are frame chrome below every page (see
 * render/frame.ts), so pages never draw nav themselves — no per-page legends.
 */

import type { Rgb } from '../terminal/ansi';
import type { RenderContext } from '../pages/types';
import { drawDivider } from './divider';
import { drawCompletionHeader } from './meter';

/** Shared page-title color (rarity-neutral header blue) and dim/secondary text. */
export const PAGE_TITLE: Rgb = { r: 150, g: 200, b: 255 };
export const PAGE_DIM: Rgb = { r: 96, g: 100, b: 120 };

/**
 * Rows the standard header occupies: the title row, the divider rule, and the
 * divider's reserved gap row. The body starts at `canvasY + PAGE_HEADER_ROWS`.
 */
export const PAGE_HEADER_ROWS = 3;

export interface PageHeaderOptions {
  /** Leading glyph, e.g. '☰' / '◆' / '⚙'. */
  icon: string;
  /** Title-Case page name, e.g. 'Dex'. */
  title: string;
  /**
   * Optional right-aligned completion readout (Dex/Archive show their collection
   * coverage here). Omitted for pages with nothing to track (e.g. Settings).
   */
  completion?: { count: string; pct: number };
}

/**
 * Draw the standard page header (title + optional completion bar + divider) and
 * return the first body row (`canvasY + PAGE_HEADER_ROWS`). Every full-screen
 * page calls this, so headers never drift apart.
 */
export function drawPageHeader(ctx: RenderContext, opts: PageHeaderOptions): number {
  const { buf, layout } = ctx;
  const { canvasX, canvasY, canvasCols } = layout;
  buf.text(canvasX + 1, canvasY, `${opts.icon} ${opts.title}`, PAGE_TITLE, null);
  if (opts.completion) {
    drawCompletionHeader(buf, {
      x: canvasX,
      y: canvasY,
      width: canvasCols,
      count: opts.completion.count,
      pct: opts.completion.pct,
      fill: PAGE_TITLE,
      dim: PAGE_DIM,
    });
  }
  drawDivider(buf, canvasY + 1, { x: canvasX + 1, width: canvasCols - 2 });
  return canvasY + PAGE_HEADER_ROWS;
}

/** Draw the standard left-aligned footer status line on the bottom canvas row. */
export function drawPageFooter(ctx: RenderContext, text: string): void {
  const { buf, layout } = ctx;
  buf.text(layout.canvasX + 1, layout.canvasY + layout.canvasRows - 1, text, PAGE_DIM, null);
}
