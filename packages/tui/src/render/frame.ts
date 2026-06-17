/**
 * Pure frame rendering: draw the active page + the menu into a frame buffer and
 * register hit regions. Shared by the live shell loop and golden tests (which
 * call `renderFrameToString` against a fake stdout).
 *
 * Layout is a top-oriented, full-width stack (see render/layout.ts): pages fill
 * the content region edge-to-edge, and the menu is an EQUAL-WIDTH row of buttons
 * distributed across the width (wrapping as needed) docked immediately AFTER the
 * canvas. The completion meter lives in the pet VITALS panel, not the menu.
 */

import { StringSink, Writer, type ColorMode, type Rgb } from '../terminal/ansi';
import { FrameBuffer } from './buffer';
import { HitRegistry } from './hit';
import { computeLayout, tooSmallMessage, type Layout } from './layout';
import { MENU_PAD_X, menuButtonY, packMenu, type MenuButton } from './menu';
import { drawDivider, drawVDivider } from '../components';
import { renderPetPage } from '../pages/pet';
import { renderDexPage } from '../pages/dex';
import { renderDexDetailPage } from '../pages/dex-detail';
import { renderArchivePage } from '../pages/archive';
import { renderSettingsPage } from '../pages/settings';
import { renderBattlePage } from '../pages/battle';
import type {
  BattleView,
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
/** Inactive button fill — a touch lighter than the band so buttons read as raised. */
const MENU_BTN_BG: Rgb = { r: 36, g: 42, b: 58 };
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
  /** The loaded battle to play back on the Battle page (optional). */
  battle?: BattleView;
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
    battle: input.battle,
    completion: input.completion,
  };

  switch (input.page) {
    case 'pet':
      renderPetPage(ctx);
      break;
    case 'dex':
      renderDexPage(ctx);
      break;
    case 'dex-detail':
      renderDexDetailPage(ctx);
      break;
    case 'archive':
      renderArchivePage(ctx);
      break;
    case 'settings':
      renderSettingsPage(ctx);
      break;
    case 'battle':
      renderBattlePage(ctx);
      break;
  }

  // Transient flash toast (e.g. gradeshift). Vertical: centered just above the
  // menu divider. Horizontal: centered along the bottom of the content column
  // (there is no menu divider row to sit above).
  if (input.flash) {
    const text = ` ${input.flash} `;
    const row = layout.menuRail
      ? Math.max(0, layout.canvasY + layout.canvasRows - 1)
      : Math.max(0, layout.menuDividerY - 1);
    const width = layout.menuRail ? layout.canvasCols : layout.termCols;
    const x = layout.canvasX + Math.max(0, Math.floor((width - text.length) / 2));
    buf.text(x, row, text, FLASH_FG, FLASH_BG);
  }

  drawMenu(buf, hits, layout, input.page);
  return layout;
}

function drawMenu(buf: FrameBuffer, hits: HitRegistry, layout: Layout, page: PageId): void {
  const { menuRect, menuBtnH } = layout;
  // The menu is its own labeled section on every page: a "── Menu ──" rule above
  // a full-width band (vertical) or a vertical rule + "Menu" label beside a rail
  // (horizontal).
  if (layout.menuRail) {
    drawVDivider(buf, layout.menuDividerX, 0, layout.termRows);
    buf.textBold(menuRect.x, layout.menuDividerY, ' MENU ', MENU_ACTIVE, null);
  } else {
    drawDivider(buf, layout.menuDividerY, { label: 'Menu' });
  }
  // Paint the menu-button band/rail.
  for (let ry = 0; ry < menuRect.rows; ry++) {
    for (let x = 0; x < menuRect.cols; x++) {
      buf.set(menuRect.x + x, menuRect.y + ry, { ch: ' ', fg: null, bg: MENU_BG });
    }
  }
  for (const btn of packMenu(menuRect.cols).buttons) {
    const x = menuRect.x + btn.x;
    const y = menuRect.y + menuButtonY(btn.row, menuBtnH);
    drawMenuButton(buf, { ...btn, x }, y, menuBtnH, btn.id === page);
    hits.add(`menu:${btn.id}`, x, y, btn.w, menuBtnH);
  }
}

/** Draw one equal-width, `h`-tall nav button: a filled block (with interior
 * padding), the LABEL centered and the hotkey RIGHT-aligned to the padding edge,
 * highlighting the active page. */
function drawMenuButton(
  buf: FrameBuffer,
  btn: MenuButton,
  y: number,
  h: number,
  active: boolean,
): void {
  const bg = active ? MENU_ACTIVE_BG : MENU_BTN_BG;
  for (let ry = 0; ry < h; ry++) {
    for (let x = 0; x < btn.w; x++) {
      buf.set(btn.x + x, y + ry, { ch: ' ', fg: null, bg });
    }
  }
  const ty = y + Math.floor(h / 2);
  // Hotkey: right-aligned inside the interior padding.
  const keyLen = [...btn.hotkey].length;
  const kx = btn.x + btn.w - MENU_PAD_X - keyLen;
  // Label: centered in the button, but never overrunning the hotkey.
  const labelLen = [...btn.label].length;
  const lx = Math.min(btn.x + Math.max(0, Math.floor((btn.w - labelLen) / 2)), kx - 1 - labelLen);
  buf.text(Math.max(btn.x, lx), ty, btn.label, active ? MENU_ACTIVE : MENU_FG, bg);
  buf.text(kx, ty, btn.hotkey, active ? MENU_ACTIVE : MENU_DIM, bg);
}

function drawTooSmall(buf: FrameBuffer, layout: Layout): void {
  const lines = tooSmallMessage(layout.termCols, layout.termRows, layout.orientation);
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
