/**
 * Menu model + full-width column packing.
 *
 * The menu is a row of nav buttons that TILE the width end-to-end: each row's
 * columns fill the width with no margins or gaps, adjacent buttons sharing one
 * border column (a ┬/┴ junction), every button spanning its whole column — no
 * narrow centered buttons. Buttons are bordered boxes
 * (HEIGHT 3) with the icon+label left and the hotkey right; when the width can't
 * hold them all the row wraps into an aligned grid (the partial last row reuses
 * the columns), and when the terminal is short the height shrinks toward 1 (a
 * borderless filled block). Shared by `layout` (to size `menuRows` + pick the
 * height), `frame` (to draw), and `shell` (to hit-test), so all three agree.
 */

import type { PageId } from '../pages/types';

export interface MenuItem {
  id: PageId | 'quit';
  label: string;
  hotkey: string;
}

export const MENU_ITEMS: MenuItem[] = [
  { id: 'pet', label: '♥ Pet', hotkey: '1' },
  { id: 'dex', label: '☰ Dex', hotkey: '2' },
  { id: 'archive', label: '◆ Archive', hotkey: '3' },
  { id: 'battle', label: '⚔ Battle', hotkey: '4' },
  { id: 'settings', label: '⚙ Settings', hotkey: '5' },
  { id: 'quit', label: '⏻ Quit', hotkey: 'q' },
];

/** A laid-out button: its row (0-based within the menu band) and column. */
export interface MenuButton extends MenuItem {
  /** Column of the button's first cell. */
  x: number;
  /** Row within the menu band (0-based). */
  row: number;
  /** Button width in cells (`label key`). */
  w: number;
}

/** Left/right band inset — 0 so the button row spans the terminal edge to edge. */
export const MENU_X = 0;
/** Interior breathing room inside the border: a blank cell before the icon and
 *  after the hotkey, so neither hugs the frame nor a neighbouring button. */
export const MENU_PAD_X = 1;
/** Cells a button's border frame consumes horizontally (left + right edges). */
const BORDER_COLS = 2;

/**
 * Button HEIGHT in cells. 3 is a full bordered box (top rule / label / bottom
 * rule); `computeLayout` shrinks it toward 1 on short terminals, where the button
 * renders as a borderless filled block instead (the border needs ≥3 rows).
 */
export const MENU_BTN_H = 3;

/** Rendered text of a button: `label key` (e.g. '♥ Pet 1'). */
export function buttonText(item: MenuItem): string {
  return `${item.label} ${item.hotkey}`;
}

/** Minimum button width: the widest `label key` text, its border frame, one pad
 *  before the icon, and TWO cells of clearance after the hotkey. The extra right
 *  cell absorbs a wide (emoji-presentation) icon that some terminals render as two
 *  columns — the buffer is one-cell-per-codepoint, so without slack such an icon
 *  shifts the row right and the hotkey would jam against the border. */
export function menuButtonWidth(): number {
  const widest = Math.max(...MENU_ITEMS.map((it) => [...buttonText(it)].length));
  return widest + BORDER_COLS + 3 * MENU_PAD_X;
}

/** Vertical gap between wrapped button rows — bordered rows abut (their frames
 *  separate them); a 2-row degraded button keeps a 1-row gap. */
export function menuRowGap(btnH: number): number {
  return btnH >= 3 ? 0 : btnH > 1 ? 1 : 0;
}

/** Band height (cells) for `wrapRows` rows of `btnH`-tall buttons. */
export function menuBandRows(wrapRows: number, btnH: number): number {
  return wrapRows * btnH + (wrapRows - 1) * menuRowGap(btnH);
}

/** Cell-row offset within the menu band of a button on wrap-row `row`. */
export function menuButtonY(row: number, btnH: number): number {
  return row * (btnH + menuRowGap(btnH));
}

/**
 * Pack the nav buttons so each row spans the width EDGE TO EDGE: the columns tile
 * `cols` with no margins or gaps, and adjacent buttons SHARE one border column
 * (`w` overlaps its neighbour by 1, drawn as a ┬/┴ junction). Every button fills
 * its whole column — no narrow centered buttons. Wraps into aligned rows when a
 * row can't hold them all; the partial last row reuses the columns. HEIGHT is
 * applied by the caller (`menuButtonY`/`menuBandRows`).
 */
export function packMenu(cols: number): { buttons: MenuButton[]; rows: number } {
  const n = MENU_ITEMS.length;
  const minW = menuButtonWidth();
  const inner = Math.max(1, cols - 2 * MENU_X);
  // Each extra button adds (minW - 1) cells (it shares one border with the last).
  const perRow = Math.max(1, Math.min(n, Math.floor((inner - 1) / Math.max(1, minW - 1))));
  const rows = Math.ceil(n / perRow);

  // Widths sum to inner + (perRow-1) because each shared border is counted by both
  // neighbours; spread the remainder onto the leftmost columns. Column x advances
  // by (w - 1) so borders overlap and the row ends flush at the inner edge.
  const totalW = inner + (perRow - 1);
  const baseW = Math.floor(totalW / perRow);
  const extra = totalW - baseW * perRow;
  const colW = (col: number): number => baseW + (col < extra ? 1 : 0);
  const colX = (col: number): number => {
    let x = MENU_X;
    for (let c = 0; c < col; c++) x += colW(c) - 1;
    return x;
  };

  const buttons = MENU_ITEMS.map((item, i) => {
    const col = i % perRow;
    return { ...item, x: colX(col), row: Math.floor(i / perRow), w: colW(col) };
  });
  return { buttons, rows };
}
