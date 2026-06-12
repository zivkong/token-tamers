/**
 * Dex page: a scrollable list of species. Owned species show name + dex number;
 * unowned ones show a '???' silhouette. Rows are clickable and keyboard
 * selectable; the selected row is highlighted.
 */

import type { Rgb } from '../ansi';
import type { RenderContext } from './types';

const OWNED: Rgb = { r: 220, g: 226, b: 240 };
const LOCKED: Rgb = { r: 96, g: 100, b: 120 };
const SELECT_BG: Rgb = { r: 40, g: 48, b: 78 };
const HEADER: Rgb = { r: 150, g: 200, b: 255 };

export interface DexRow {
  num: number;
  owned: boolean;
  label: string;
  speciesId: string | null;
}

/** Build the ordered Dex rows: every dex slot up to dexTotal, owned or '???'. */
export function buildDexRows(ctx: RenderContext): DexRow[] {
  const { pack, state } = ctx;
  const owned = new Set(state.dexOwned);
  const byNum = new Map<number, { id: string; name: string }>();
  for (const sp of pack.species) {
    if (!byNum.has(sp.num)) byNum.set(sp.num, { id: sp.id, name: sp.name });
  }
  const total = Math.max(pack.dexTotal, byNum.size);
  const rows: DexRow[] = [];
  for (let num = 1; num <= total; num++) {
    const entry = byNum.get(num);
    const isOwned = entry ? owned.has(entry.id) : false;
    rows.push({
      num,
      owned: isOwned,
      label: isOwned && entry ? entry.name : '???',
      speciesId: isOwned && entry ? entry.id : null,
    });
  }
  return rows;
}

export function renderDexPage(ctx: RenderContext): void {
  const { buf, hits, layout, ui } = ctx;
  const { canvasX, canvasY, canvasCols, canvasRows } = layout;
  const rows = buildDexRows(ctx);

  buf.text(canvasX + 1, canvasY, 'DEX', HEADER, null);
  const listTop = canvasY + 2;
  const visible = canvasRows - 3;

  // Clamp scroll so the selection stays on screen.
  const scroll = clampScroll(ui.scroll, ui.selected, visible, rows.length);
  ui.scroll = scroll;

  for (let i = 0; i < visible; i++) {
    const rowIndex = scroll + i;
    if (rowIndex >= rows.length) break;
    const row = rows[rowIndex];
    if (!row) continue;
    const y = listTop + i;
    const selected = rowIndex === ui.selected;
    const fg = row.owned ? OWNED : LOCKED;
    const bg = selected ? SELECT_BG : null;
    const numStr = String(row.num).padStart(3, '0');
    const marker = selected ? '›' : ' ';
    const line = `${marker} #${numStr} ${row.label}`;
    // Paint full-width selection bar.
    for (let x = 0; x < canvasCols; x++) {
      buf.set(canvasX + x, y, { ch: ' ', fg: null, bg });
    }
    buf.text(canvasX + 1, y, line, fg, bg);
    hits.add(`dex:row:${rowIndex}`, canvasX, y, canvasCols, 1);
  }

  // Footer hint.
  buf.text(
    canvasX + 1,
    canvasY + canvasRows - 1,
    `${ui.selected + 1}/${rows.length}  ↑↓ select`,
    LOCKED,
    null,
  );
}

export function clampScroll(
  scroll: number,
  selected: number,
  visible: number,
  total: number,
): number {
  let s = scroll;
  if (selected < s) s = selected;
  if (selected >= s + visible) s = selected - visible + 1;
  const maxScroll = Math.max(0, total - visible);
  if (s > maxScroll) s = maxScroll;
  if (s < 0) s = 0;
  return s;
}
