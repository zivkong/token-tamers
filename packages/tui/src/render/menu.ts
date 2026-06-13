/**
 * Menu model + left-aligned flow packing.
 *
 * The menu is a LEFT-ALIGNED row of nav buttons that flows from the left edge
 * and wraps to the next row when the next button would overflow the width — no
 * fixed grid, no per-button centering. Shared by `layout` (to size `menuRows`),
 * `frame` (to draw), and `shell` (to hit-test), so all three agree.
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

/** Left inset and inter-button gap for the flow. */
const MENU_X = 1;
const MENU_GAP = 2;

/** Rendered text of a button: `label key` (e.g. '♥ Pet 1'). */
export function buttonText(item: MenuItem): string {
  return `${item.label} ${item.hotkey}`;
}

/**
 * Pack the nav buttons into a left-aligned flow within `cols`. Returns each
 * button's position (row + x, both menu-relative) and the total row count.
 */
export function packMenu(cols: number): { buttons: MenuButton[]; rows: number } {
  const buttons: MenuButton[] = [];
  let x = MENU_X;
  let row = 0;
  for (const item of MENU_ITEMS) {
    const w = [...buttonText(item)].length;
    // Wrap to the next row when this button would overflow (but never wrap a
    // button that is alone at the left — it just clips on a too-narrow term).
    if (x > MENU_X && x + w > cols) {
      row += 1;
      x = MENU_X;
    }
    buttons.push({ ...item, x, row, w });
    x += w + MENU_GAP;
  }
  return { buttons, rows: row + 1 };
}
