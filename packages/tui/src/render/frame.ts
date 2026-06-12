/**
 * Pure frame rendering: draw the active page + bottom menu into a frame buffer
 * and register hit regions. Shared by the live shell loop and golden tests
 * (which call `renderFrameToString` against a fake stdout).
 */

import { StringSink, Writer, type ColorMode, type Rgb } from '../terminal/ansi';
import { FrameBuffer } from './buffer';
import { HitRegistry } from './hit';
import { computeLayout, tooSmallMessage, type Layout } from './layout';
import { renderPetPage } from '../pages/pet';
import { renderDexPage } from '../pages/dex';
import { renderArchivePage } from '../pages/archive';
import type { PageId, PageUiState, RenderContext } from '../pages/types';
import type { ContentPack, GameState } from '@token-tamers/core';

const MENU_FG: Rgb = { r: 196, g: 203, b: 220 };
const MENU_DIM: Rgb = { r: 110, g: 117, b: 140 };
const MENU_ACTIVE: Rgb = { r: 255, g: 224, b: 130 };
const MENU_ACTIVE_BG: Rgb = { r: 56, g: 50, b: 18 };
const MENU_BG: Rgb = { r: 22, g: 26, b: 38 };
const FLASH_FG: Rgb = { r: 255, g: 226, b: 140 };
const FLASH_BG: Rgb = { r: 56, g: 46, b: 12 };
const BORDER: Rgb = { r: 58, g: 66, b: 92 };
const METER_FILL: Rgb = { r: 240, g: 196, b: 80 };

export interface MenuItem {
  id: PageId | 'quit';
  label: string;
  hotkey: string;
}

export const MENU_ITEMS: MenuItem[] = [
  { id: 'pet', label: '♥ Pet', hotkey: '1' },
  { id: 'dex', label: '☰ Dex', hotkey: '2' },
  { id: 'archive', label: '◆ Archive', hotkey: '3' },
  { id: 'quit', label: '⚙ Quit', hotkey: 'q' },
];

export interface FrameInput {
  page: PageId;
  state: GameState;
  pack: ContentPack;
  mode: ColorMode;
  frame: number;
  ui: PageUiState;
  completionPct: number;
  flash: string | null;
}

/**
 * Render a full frame (page + menu) into `buf`, populating `hits`. Returns the
 * computed layout so callers can map clicks. Pure aside from buffer/hit writes.
 */
export function renderFrame(buf: FrameBuffer, hits: HitRegistry, input: FrameInput): Layout {
  buf.clear();
  hits.reset();
  const layout = computeLayout(buf.cols, buf.rows);

  if (layout.tooSmall) {
    drawTooSmall(buf, layout);
    return layout;
  }

  const ctx: RenderContext = {
    buf,
    hits,
    layout,
    state: input.state,
    pack: input.pack,
    mode: input.mode,
    frame: input.frame,
    ui: input.ui,
    flash: input.flash,
  };

  switch (input.page) {
    case 'pet':
      renderPetPage(ctx);
      break;
    case 'dex':
      renderDexPage(ctx);
      break;
    case 'archive':
      renderArchivePage(ctx);
      break;
  }

  drawCanvasBorder(buf, layout);

  // Transient flash toast, centered just above the menu (e.g. gradeshift).
  if (input.flash) {
    const row = layout.menuRow - 1;
    const text = ` ${input.flash} `;
    const x = Math.max(0, layout.canvasX + Math.floor((layout.canvasCols - text.length) / 2));
    buf.text(x, row, text, FLASH_FG, FLASH_BG);
  }

  drawMenu(buf, hits, layout, input.page, input.completionPct);
  return layout;
}

/** Thin frame around the 4:3 canvas so the play area reads as a stage. */
function drawCanvasBorder(buf: FrameBuffer, layout: Layout): void {
  const x0 = layout.canvasX - 1;
  const y0 = layout.canvasY - 1;
  const x1 = layout.canvasX + layout.canvasCols;
  const y1 = layout.canvasY + layout.canvasRows;
  for (let x = layout.canvasX; x < x1; x++) {
    buf.set(x, y0, { ch: '─', fg: BORDER, bg: null });
    buf.set(x, y1, { ch: '─', fg: BORDER, bg: null });
  }
  for (let y = layout.canvasY; y < y1; y++) {
    buf.set(x0, y, { ch: '│', fg: BORDER, bg: null });
    buf.set(x1, y, { ch: '│', fg: BORDER, bg: null });
  }
  buf.set(x0, y0, { ch: '┌', fg: BORDER, bg: null });
  buf.set(x1, y0, { ch: '┐', fg: BORDER, bg: null });
  buf.set(x0, y1, { ch: '└', fg: BORDER, bg: null });
  buf.set(x1, y1, { ch: '┘', fg: BORDER, bg: null });
}

function drawMenu(
  buf: FrameBuffer,
  hits: HitRegistry,
  layout: Layout,
  page: PageId,
  completionPct: number,
): void {
  const row = layout.menuRow;
  // Paint the whole menu row.
  for (let x = 0; x < buf.cols; x++) {
    buf.set(x, row, { ch: ' ', fg: null, bg: MENU_BG });
  }
  let x = 1;
  for (const item of MENU_ITEMS) {
    const active = item.id === page;
    const label = ` ${item.label} `;
    const hint = `${item.hotkey} `;
    const block = label.length + hint.length;
    const bg = active ? MENU_ACTIVE_BG : MENU_BG;
    buf.text(x, row, label, active ? MENU_ACTIVE : MENU_FG, bg);
    buf.text(x + label.length, row, hint, active ? MENU_ACTIVE : MENU_DIM, bg);
    hits.add(`menu:${item.id}`, x, row, block, 1);
    x += block + 1;
  }
  // Completion meter, right-aligned: mini bar + 'NN.N%'.
  const pct = `${completionPct.toFixed(1)}%`;
  const filled = Math.max(0, Math.min(10, Math.round(completionPct / 10)));
  const barX = buf.cols - pct.length - 13;
  if (barX > x) {
    buf.text(barX, row, '█'.repeat(filled), METER_FILL, MENU_BG);
    buf.text(barX + filled, row, '░'.repeat(10 - filled), MENU_DIM, MENU_BG);
    buf.text(buf.cols - pct.length - 1, row, pct, MENU_FG, MENU_BG);
  }
}

function drawTooSmall(buf: FrameBuffer, layout: Layout): void {
  const lines = tooSmallMessage(layout.termCols, layout.termRows);
  const startY = Math.max(0, Math.floor(layout.termRows / 2) - 1);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const x = Math.max(0, Math.floor((layout.termCols - line.length) / 2));
    buf.text(x, startY + i, line, MENU_FG, null);
  }
}

/**
 * Render one frame to a plain string at a fixed (cols, rows). Used by golden
 * tests and `tt watch` snapshots. Does a full repaint (the buffer starts
 * fully dirty), so the returned string contains the whole frame's ANSI.
 */
export function renderFrameToString(cols: number, rows: number, input: FrameInput): string {
  const sink = new StringSink();
  const writer = new Writer(sink, input.mode);
  const buf = new FrameBuffer(cols, rows);
  const hits = new HitRegistry();
  renderFrame(buf, hits, input);
  buf.flush(writer);
  return sink.toString();
}
