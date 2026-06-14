/**
 * Pure frame rendering: draw the active page + the menu into a frame buffer and
 * register hit regions. Shared by the live shell loop and golden tests (which
 * call `renderFrameToString` against a fake stdout).
 *
 * Layout is a top-oriented, full-width stack (see render/layout.ts): pages fill
 * the content region edge-to-edge, and the menu is a LEFT-ALIGNED row of buttons
 * (wrapping as needed) docked immediately AFTER the canvas. The completion meter
 * lives in the pet VITALS panel, not the menu.
 */

import { StringSink, Writer, type ColorMode, type Rgb } from '../terminal/ansi';
import { FrameBuffer } from './buffer';
import { HitRegistry } from './hit';
import { computeLayout, tooSmallMessage, type Layout } from './layout';
import { buttonText, packMenu, type MenuButton } from './menu';
import { drawDivider } from './divider';
import { renderPetPage } from '../pages/pet';
import { renderDexPage } from '../pages/dex';
import { renderArchivePage } from '../pages/archive';
import { renderSettingsPage } from '../pages/settings';
import type {
  CompletionBreakdown,
  LiveStats,
  PageId,
  PageUiState,
  RenderContext,
  ShellInfo,
  SettingsState,
} from '../pages/types';
import type { ContentPack, GameState } from '@token-tamers/core';

const MENU_FG: Rgb = { r: 196, g: 203, b: 220 };
const MENU_DIM: Rgb = { r: 110, g: 117, b: 140 };
const MENU_ACTIVE: Rgb = { r: 255, g: 224, b: 130 };
const MENU_ACTIVE_BG: Rgb = { r: 56, g: 50, b: 18 };
const MENU_BG: Rgb = { r: 22, g: 26, b: 38 };
const FLASH_FG: Rgb = { r: 255, g: 226, b: 140 };
const FLASH_BG: Rgb = { r: 56, g: 46, b: 12 };

export interface FrameInput {
  page: PageId;
  state: GameState;
  pack: ContentPack;
  mode: ColorMode;
  frame: number;
  ui: PageUiState;
  completion: CompletionBreakdown;
  flash: string | null;
  /** Static build/config facts for the Settings page (optional). */
  info?: ShellInfo;
  /** Live, editable adapter state for the Settings page (optional). */
  settings?: SettingsState;
  /** Real-time token-consumption readout for the pet page (optional). */
  live?: LiveStats;
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
    live: input.live,
    completion: input.completion,
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

  // Transient flash toast, centered just above the menu divider (e.g. gradeshift).
  if (input.flash) {
    const row = Math.max(0, layout.menuDividerY - 1);
    const text = ` ${input.flash} `;
    const x = Math.max(0, Math.floor((layout.termCols - text.length) / 2));
    buf.text(x, row, text, FLASH_FG, FLASH_BG);
  }

  drawMenu(buf, hits, layout, input.page);
  return layout;
}

function drawMenu(buf: FrameBuffer, hits: HitRegistry, layout: Layout, page: PageId): void {
  // The menu is its own labeled section ("── Menu ──") on every page.
  drawDivider(buf, layout.menuDividerY, { label: 'Menu' });
  // Paint the whole menu-button band.
  for (let ry = 0; ry < layout.menuRows; ry++) {
    for (let x = 0; x < buf.cols; x++) {
      buf.set(x, layout.menuY + ry, { ch: ' ', fg: null, bg: MENU_BG });
    }
  }
  for (const btn of packMenu(layout.termCols).buttons) {
    const y = layout.menuY + btn.row;
    drawMenuButton(buf, btn, y, btn.id === page);
    hits.add(`menu:${btn.id}`, btn.x, y, btn.w, 1);
  }
}

/** Draw one LEFT-ALIGNED nav button ('label key'), highlighting the active page. */
function drawMenuButton(buf: FrameBuffer, btn: MenuButton, y: number, active: boolean): void {
  const bg = active ? MENU_ACTIVE_BG : MENU_BG;
  for (let x = 0; x < btn.w; x++) {
    buf.set(btn.x + x, y, { ch: ' ', fg: null, bg });
  }
  buf.text(btn.x, y, btn.label, active ? MENU_ACTIVE : MENU_FG, bg);
  const text = buttonText(btn);
  buf.text(
    btn.x + text.length - btn.hotkey.length,
    y,
    btn.hotkey,
    active ? MENU_ACTIVE : MENU_DIM,
    bg,
  );
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
