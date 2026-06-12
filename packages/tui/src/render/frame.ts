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

const MENU_FG: Rgb = { r: 210, g: 216, b: 230 };
const MENU_ACTIVE: Rgb = { r: 255, g: 234, b: 140 };
const MENU_BG: Rgb = { r: 24, g: 28, b: 40 };
const FLASH_FG: Rgb = { r: 255, g: 220, b: 120 };

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

  // Transient flash banner just above the menu (e.g. gradeshift).
  if (input.flash) {
    const row = layout.menuRow - 1;
    buf.text(layout.canvasX + 1, row, input.flash, FLASH_FG, null);
  }

  drawMenu(buf, hits, layout, input.page, input.completionPct);
  return layout;
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
    const text = `[${item.label}]`;
    const active = item.id === page;
    buf.text(x, row, text, active ? MENU_ACTIVE : MENU_FG, MENU_BG);
    hits.add(`menu:${item.id}`, x, row, text.length, 1);
    x += text.length + 1;
  }
  // Completion meter, right-aligned: 'NN.N%'.
  const pct = `${completionPct.toFixed(1)}%`;
  const px = buf.cols - pct.length - 1;
  if (px > x) {
    buf.text(px, row, pct, MENU_FG, MENU_BG);
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
