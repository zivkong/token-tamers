/**
 * Menu model + equal-width, evenly-distributed packing.
 *
 * The menu is a row of nav buttons that ALL share one uniform width (the widest
 * button's text + interior padding) and a uniform HEIGHT (top pad / label /
 * bottom pad), distributed space-between across the full width — first
 * flush-left, last flush-right — so they read as a balanced nav bar of real
 * buttons. When the width can't hold them all, it wraps into a grid whose
 * columns stay aligned across rows (the last, partial row fills the leftmost
 * columns); when the terminal is short the button height shrinks to fit. Shared
 * by `layout` (to size `menuRows` + pick the height), `frame` (to draw), and
 * `shell` (to hit-test), so all three agree.
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
  { id: 'settings', label: '⚙ Settings', hotkey: '4' },
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

/** Left/right inset, the MINIMUM gap between buttons, and interior H padding. */
const MENU_X = 1;
const MENU_MIN_GAP = 2;
const MENU_PAD_X = 2;

/** Preferred button HEIGHT in cells (label row + vertical padding); shrinks to fit. */
export const MENU_BTN_H = 2;

/** Rendered text of a button: `label key` (e.g. '♥ Pet 1'). */
export function buttonText(item: MenuItem): string {
  return `${item.label} ${item.hotkey}`;
}

/** The uniform button width: the widest button's text plus interior padding. */
export function menuButtonWidth(): number {
  const widest = Math.max(...MENU_ITEMS.map((it) => [...buttonText(it)].length));
  return widest + 2 * MENU_PAD_X;
}

/** Vertical gap between wrapped button rows — only when buttons are tall. */
export function menuRowGap(btnH: number): number {
  return btnH > 1 ? 1 : 0;
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
 * Pack the nav buttons into an equal-width, space-between grid within `cols`.
 * Every button gets the same (padded) width; full rows span edge to edge and
 * columns stay aligned across wrapped rows; a lone column is centered. Returns
 * each button's x + wrap-row and the total wrap-row count (HEIGHT is applied by
 * the caller via `menuButtonY`/`menuBandRows`, since it depends on the terminal
 * height — see `computeLayout`).
 */
export function packMenu(cols: number): { buttons: MenuButton[]; rows: number } {
  const n = MENU_ITEMS.length;
  const bw = menuButtonWidth();
  const inner = Math.max(1, cols - 2 * MENU_X);
  // How many uniform buttons (each plus the minimum gap) fit on one row.
  const perRow = Math.max(1, Math.min(n, Math.floor((inner + MENU_MIN_GAP) / (bw + MENU_MIN_GAP))));
  const rows = Math.ceil(n / perRow);

  // Column x-positions: space-between across the inner width so a full row spans
  // flush-left to flush-right; a single column is centered; partial rows reuse
  // the same columns.
  const slack = Math.max(0, inner - perRow * bw);
  const gaps = perRow - 1;
  const colX = (col: number): number =>
    gaps > 0
      ? MENU_X + col * bw + Math.round((slack * col) / gaps)
      : MENU_X + Math.floor(slack / 2);

  const buttons = MENU_ITEMS.map((item, i) => ({
    ...item,
    x: colX(i % perRow),
    row: Math.floor(i / perRow),
    w: bw,
  }));
  return { buttons, rows };
}
