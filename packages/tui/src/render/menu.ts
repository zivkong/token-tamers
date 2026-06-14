/**
 * Menu model + equal-width, evenly-distributed packing.
 *
 * The menu is a row of nav buttons that ALL share one uniform width (the widest
 * button's text) and are distributed space-between across the full width — first
 * flush-left, last flush-right — so they read as a balanced nav bar. When the
 * width can't hold them all, it wraps into a grid whose columns stay aligned
 * across rows (the last, partial row fills the leftmost columns). Shared by
 * `layout` (to size `menuRows`), `frame` (to draw), and `shell` (to hit-test),
 * so all three agree.
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

/** Left/right inset and the MINIMUM gap kept between adjacent buttons. */
const MENU_X = 1;
const MENU_MIN_GAP = 2;

/** Rendered text of a button: `label key` (e.g. '♥ Pet 1'). */
export function buttonText(item: MenuItem): string {
  return `${item.label} ${item.hotkey}`;
}

/** The uniform button width: the widest button's rendered text (in cells). */
export function menuButtonWidth(): number {
  return Math.max(...MENU_ITEMS.map((it) => [...buttonText(it)].length));
}

/**
 * Pack the nav buttons into an equal-width, space-between grid within `cols`.
 * Every button gets the same width; full rows span edge to edge and columns
 * stay aligned across wrapped rows. Returns each button's position (row + x,
 * both menu-relative) and the total row count.
 */
export function packMenu(cols: number): { buttons: MenuButton[]; rows: number } {
  const n = MENU_ITEMS.length;
  const bw = menuButtonWidth();
  const inner = Math.max(1, cols - 2 * MENU_X);
  // How many uniform buttons (each plus the minimum gap) fit on one row.
  const perRow = Math.max(1, Math.min(n, Math.floor((inner + MENU_MIN_GAP) / (bw + MENU_MIN_GAP))));
  const rows = Math.ceil(n / perRow);

  // Column x-positions: space-between across the inner width so a full row spans
  // flush-left to flush-right; partial rows reuse the same columns.
  const slack = Math.max(0, inner - perRow * bw);
  const gaps = perRow - 1;
  const colX = (col: number): number =>
    MENU_X + col * bw + (gaps > 0 ? Math.round((slack * col) / gaps) : 0);

  const buttons = MENU_ITEMS.map((item, i) => ({
    ...item,
    x: colX(i % perRow),
    row: Math.floor(i / perRow),
    w: bw,
  }));
  return { buttons, rows };
}
