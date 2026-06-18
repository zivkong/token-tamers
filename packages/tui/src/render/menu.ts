/**
 * Menu model + full-width column packing.
 *
 * The menu is a row of nav buttons that TILE the width end-to-end: each row's
 * columns fill the inner width (a 1-col gap between them), every button spanning
 * its whole column — no narrow centered buttons. Buttons are bordered boxes
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

/** Left/right band inset, the gap between columns, and the interior key inset. */
export const MENU_X = 1;
const MENU_COL_GAP = 1;
/** Extra interior inset beyond the border (0 = label/key sit just inside the frame,
 *  which lets the longest label — "⚙ Settings" — fit the narrowest tiled column). */
export const MENU_PAD_X = 0;
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

/** Minimum button width: the widest `label key` text plus its border frame. */
export function menuButtonWidth(): number {
  const widest = Math.max(...MENU_ITEMS.map((it) => [...buttonText(it)].length));
  return widest + BORDER_COLS;
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
 * Pack the nav buttons into a FULL-WIDTH grid within `cols`: each row's columns
 * tile the inner width end-to-end (a 1-col gap between them), every button filling
 * its whole column — so there are no narrow centered buttons. Wraps into aligned
 * rows when a row can't hold them all; the partial last row reuses the columns.
 * HEIGHT is applied by the caller (`menuButtonY`/`menuBandRows`).
 */
export function packMenu(cols: number): { buttons: MenuButton[]; rows: number } {
  const n = MENU_ITEMS.length;
  const minW = menuButtonWidth();
  const inner = Math.max(1, cols - 2 * MENU_X);
  const perRow = Math.max(
    1,
    Math.min(n, Math.floor((inner + MENU_COL_GAP) / (minW + MENU_COL_GAP))),
  );
  const rows = Math.ceil(n / perRow);

  // Tile `perRow` columns across the inner width with 1-col gaps; spread any
  // leftover cells onto the leftmost columns so the row spans exactly edge to edge.
  const avail = inner - (perRow - 1) * MENU_COL_GAP;
  const baseW = Math.floor(avail / perRow);
  const extra = avail - baseW * perRow;
  const colW = (col: number): number => baseW + (col < extra ? 1 : 0);
  const colX = (col: number): number => {
    let x = MENU_X;
    for (let c = 0; c < col; c++) x += colW(c) + MENU_COL_GAP;
    return x;
  };

  const buttons = MENU_ITEMS.map((item, i) => {
    const col = i % perRow;
    return { ...item, x: colX(col), row: Math.floor(i / perRow), w: colW(col) };
  });
  return { buttons, rows };
}
