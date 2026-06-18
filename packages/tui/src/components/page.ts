/**
 * Standard full-screen page scaffold — the shared chrome every non-Pet page uses
 * so Dex / Archive / Settings look and behave identically:
 *
 *   row 0       `icon Title` (left)  ………………  optional completion readout (right)
 *   row 1       the one standard divider rule (`drawDivider`)
 *   row 2       the divider's reserved gap row
 *   row 3…N-4   page body (list / table / fields), starting at PAGE_HEADER_ROWS
 *   row N-3     a clearance gap row above the legend (so the body never crowds it)
 *   row N-2     a left-aligned footer status line (`drawPageFooter`)
 *   row N-1     a bottom-padding gap before the global `── Menu ──` divider
 *
 * The legend gets breathing room on BOTH sides: a clearance gap above (so the
 * body never butts against it) and a bottom-padding gap below (mirroring the Pet
 * page's bottom-padding gap — see `petSections` in render/layout.ts) so every
 * page's content stops the same distance above the menu divider. Body content is
 * bounded by `pageBodyBottom`; the legend is drawn on `pageFooterY`.
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

/**
 * Rows the standard footer occupies at the bottom of the canvas region: the
 * status/legend line plus a bottom-padding gap row beneath it. The gap keeps the
 * legend one row clear of the global `── Menu ──` divider, matching the Pet page's
 * bottom-padding gap so all pages share the same content height above the menu.
 */
export const PAGE_FOOTER_ROWS = 2;

/**
 * Row the footer/legend line is drawn on:
 * `canvasY + canvasRows - PAGE_FOOTER_ROWS`. The row below it is the
 * bottom-padding gap. Centralized here so pages never hand-roll `canvasRows - 1`.
 */
export function pageFooterY(layout: RenderContext['layout']): number {
  return layout.canvasY + layout.canvasRows - PAGE_FOOTER_ROWS;
}

/**
 * Exclusive lower bound for any page body — one row above the legend, leaving a
 * clearance gap between the body and the legend. Body content must stay strictly
 * above this row (`row < pageBodyBottom`); the row AT `pageBodyBottom` is that
 * clearance gap, and the legend sits on the next row (`pageFooterY`). Pages that
 * size their body to the bottom use this so the legend breathes on both sides.
 */
export function pageBodyBottom(layout: RenderContext['layout']): number {
  return pageFooterY(layout) - 1;
}

/**
 * Clamp a scrollable list's top offset so the selected row stays visible.
 * Shared by the full-screen list pages (Achievements, Unlockables).
 */
export function clampScroll(
  scroll: number,
  selected: number,
  visible: number,
  total: number,
): number {
  let s = scroll;
  if (selected < s) s = selected;
  if (selected >= s + visible) s = selected - visible + 1;
  const maxScroll = Math.max(0, total - visible);
  if (s > maxScroll) s = maxScroll;
  if (s < 0) s = 0;
  return s;
}

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

/**
 * Draw the standard left-aligned footer/legend status line. It sits on
 * `pageFooterY` — one row above the bottom of the canvas region — leaving a
 * bottom-padding gap before the global `── Menu ──` divider.
 */
export function drawPageFooter(ctx: RenderContext, text: string): void {
  const { buf, layout } = ctx;
  // Clip to the content width so the legend never bleeds into the vertical rule
  // / menu rail on a narrow horizontal dock.
  const right = layout.menuRail ? layout.menuDividerX : layout.canvasX + layout.canvasCols;
  const maxCols = Math.max(0, right - (layout.canvasX + 1));
  buf.text(
    layout.canvasX + 1,
    pageFooterY(layout),
    [...text].slice(0, maxCols).join(''),
    PAGE_DIM,
    null,
  );
}
