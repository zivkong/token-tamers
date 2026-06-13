/**
 * Pure frame rendering: draw the active page + the menu grid into a frame buffer
 * and register hit regions. Shared by the live shell loop and golden tests
 * (which call `renderFrameToString` against a fake stdout).
 *
 * Layout is a top-oriented, full-width stack (see render/layout.ts): pages fill
 * the content region edge-to-edge, and the menu is a 6-column grid (3 on narrow
 * terminals) docked immediately AFTER the canvas rather than at the very bottom.
 */

import { StringSink, Writer, type ColorMode, type Rgb } from '../terminal/ansi';
import { FrameBuffer } from './buffer';
import { HitRegistry } from './hit';
import { computeLayout, tooSmallMessage, type Layout } from './layout';
import { renderPetPage } from '../pages/pet';
import { renderDexPage } from '../pages/dex';
import { renderArchivePage } from '../pages/archive';
import { renderSettingsPage } from '../pages/settings';
import type { PageId, PageUiState, RenderContext, ShellInfo, SettingsState } from '../pages/types';
import type { ContentPack, GameState } from '@token-tamers/core';

const MENU_FG: Rgb = { r: 196, g: 203, b: 220 };
const MENU_DIM: Rgb = { r: 110, g: 117, b: 140 };
const MENU_ACTIVE: Rgb = { r: 255, g: 224, b: 130 };
const MENU_ACTIVE_BG: Rgb = { r: 56, g: 50, b: 18 };
const MENU_BG: Rgb = { r: 22, g: 26, b: 38 };
const FLASH_FG: Rgb = { r: 255, g: 226, b: 140 };
const FLASH_BG: Rgb = { r: 56, g: 46, b: 12 };
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
  { id: 'settings', label: '⚙ Settings', hotkey: '4' },
  { id: 'quit', label: '⏻ Quit', hotkey: 'q' },
];

/** One laid-out menu grid cell: a nav button or the completion meter. */
export interface MenuCell {
  id: PageId | 'quit' | 'meter';
  label: string;
  hotkey: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Lay out the menu as a grid placed right after the canvas: the 5 nav buttons
 * plus the completion meter flow across `layout.menuCols` columns (6 on wide
 * terminals, 3 on narrow → 2 rows). Shared by the renderer and the shell's
 * mouse hit-testing so clicks always match what's drawn.
 */
export function menuCells(layout: Layout): MenuCell[] {
  const entries: Array<Pick<MenuCell, 'id' | 'label' | 'hotkey'>> = [
    ...MENU_ITEMS,
    { id: 'meter', label: '', hotkey: '' },
  ];
  const cols = Math.max(1, layout.menuCols);
  const cellW = Math.floor(layout.termCols / cols);
  return entries.map((e, i) => {
    const col = i % cols;
    const x = col * cellW;
    const w = col === cols - 1 ? layout.termCols - x : cellW;
    return { ...e, x, y: layout.menuY + Math.floor(i / cols), w, h: 1 };
  });
}

export interface FrameInput {
  page: PageId;
  state: GameState;
  pack: ContentPack;
  mode: ColorMode;
  frame: number;
  ui: PageUiState;
  completionPct: number;
  flash: string | null;
  /** Static build/config facts for the Settings page (optional). */
  info?: ShellInfo;
  /** Live, editable adapter state for the Settings page (optional). */
  settings?: SettingsState;
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
    info: input.info,
    settings: input.settings,
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
    case 'settings':
      renderSettingsPage(ctx);
      break;
  }

  // Transient flash toast, centered just above the menu (e.g. gradeshift).
  if (input.flash) {
    const row = Math.max(0, layout.menuY - 1);
    const text = ` ${input.flash} `;
    const x = Math.max(0, Math.floor((layout.termCols - text.length) / 2));
    buf.text(x, row, text, FLASH_FG, FLASH_BG);
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
  // Paint the whole menu band.
  for (let ry = 0; ry < layout.menuRows; ry++) {
    for (let x = 0; x < buf.cols; x++) {
      buf.set(x, layout.menuY + ry, { ch: ' ', fg: null, bg: MENU_BG });
    }
  }
  for (const cell of menuCells(layout)) {
    if (cell.id === 'meter') {
      drawMeterCell(buf, cell, completionPct);
      continue;
    }
    drawMenuButton(buf, cell, cell.id === page);
    hits.add(`menu:${cell.id}`, cell.x, cell.y, cell.w, cell.h);
  }
}

/** Draw one centered nav button, highlighting the active page. */
function drawMenuButton(buf: FrameBuffer, cell: MenuCell, active: boolean): void {
  const bg = active ? MENU_ACTIVE_BG : MENU_BG;
  for (let x = 0; x < cell.w; x++) {
    buf.set(cell.x + x, cell.y, { ch: ' ', fg: null, bg });
  }
  const text = `${cell.label} ${cell.hotkey}`;
  const tx = cell.x + Math.max(1, Math.floor((cell.w - text.length) / 2));
  buf.text(tx, cell.y, cell.label, active ? MENU_ACTIVE : MENU_FG, bg);
  buf.text(tx + cell.label.length + 1, cell.y, cell.hotkey, active ? MENU_ACTIVE : MENU_DIM, bg);
}

/** Draw the completion meter cell: a mini bar (when it fits) + 'NN.N%'. */
function drawMeterCell(buf: FrameBuffer, cell: MenuCell, completionPct: number): void {
  for (let x = 0; x < cell.w; x++) {
    buf.set(cell.x + x, cell.y, { ch: ' ', fg: null, bg: MENU_BG });
  }
  const pct = `${completionPct.toFixed(1)}%`;
  const barMax = Math.max(0, Math.min(10, cell.w - pct.length - 3));
  if (barMax > 0) {
    const filled = Math.max(0, Math.min(barMax, Math.round((completionPct / 100) * barMax)));
    buf.text(cell.x + 1, cell.y, '█'.repeat(filled), METER_FILL, MENU_BG);
    buf.text(cell.x + 1 + filled, cell.y, '░'.repeat(barMax - filled), MENU_DIM, MENU_BG);
  }
  buf.text(cell.x + cell.w - pct.length - 1, cell.y, pct, MENU_FG, MENU_BG);
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
