/**
 * Dex page: a scrollable list of species. Owned species show name + dex number;
 * unowned ones show a '???' silhouette. Rows are clickable and keyboard
 * selectable; the selected row is highlighted.
 */

import { type Rgb } from '../terminal/ansi';
import { drawCompletionHeader, drawDivider } from '../components';
import { houseColor } from '../helpers/lookup';
import type { House } from '@token-tamers/core';
import type { RenderContext } from './types';

const OWNED: Rgb = { r: 220, g: 226, b: 240 };
const LOCKED: Rgb = { r: 88, g: 92, b: 112 };
const SELECT_BG: Rgb = { r: 40, g: 48, b: 78 };
const HEADER: Rgb = { r: 150, g: 200, b: 255 };
const RULE: Rgb = { r: 52, g: 58, b: 80 };

/** Rows above the list: title (1) + divider (1) + gap (1). Shared with the shell. */
export const DEX_LIST_OFFSET = 3;

export interface DexRow {
  num: number;
  owned: boolean;
  label: string;
  speciesId: string | null;
  house: House | 'hybrid' | null;
}

/** Build the ordered Dex rows: every dex slot up to dexTotal, owned or '???'. */
export function buildDexRows(ctx: RenderContext): DexRow[] {
  const { pack, state } = ctx;
  const owned = new Set(state.dexOwned);
  const byNum = new Map<number, { id: string; name: string; house: House | 'hybrid' }>();
  for (const sp of pack.species) {
    if (!byNum.has(sp.num)) byNum.set(sp.num, { id: sp.id, name: sp.name, house: sp.house });
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
      house: isOwned && entry ? entry.house : null,
    });
  }
  return rows;
}

export function renderDexPage(ctx: RenderContext): void {
  const { buf, hits, layout, ui } = ctx;
  const { canvasX, canvasY, canvasCols, canvasRows } = layout;
  const rows = buildDexRows(ctx);

  const ownedCount = rows.filter((r) => r.owned).length;
  buf.text(canvasX + 1, canvasY, '☰ Dex', HEADER, null);
  // Top-right: a Dex-collection completion bar (this page's slice of 100%).
  drawCompletionHeader(buf, {
    x: canvasX,
    y: canvasY,
    width: canvasCols,
    count: `${ownedCount}/${rows.length}`,
    pct: ctx.completion.dex,
    fill: HEADER,
    dim: LOCKED,
  });
  // Standard section divider (rule + a blank gap row after it) under the header.
  drawDivider(buf, canvasY + 1, { x: canvasX + 1, width: canvasCols - 2 });
  const listTop = canvasY + DEX_LIST_OFFSET;
  const visible = canvasRows - DEX_LIST_OFFSET - 1;

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
    // Paint full-width selection bar.
    for (let x = 0; x < canvasCols; x++) {
      buf.set(canvasX + x, y, { ch: ' ', fg: null, bg });
    }
    buf.text(canvasX + 1, y, `${marker} #${numStr}`, selected ? OWNED : LOCKED, bg);
    // House-tinted identity dot for discovered species.
    const dot = row.owned ? '●' : '·';
    const dotFg =
      row.owned && row.house && row.house !== 'hybrid' && row.house !== 'wild'
        ? houseColor(row.house)
        : LOCKED;
    buf.text(canvasX + 9, y, dot, dotFg, bg);
    buf.text(canvasX + 11, y, row.label, fg, bg);
    hits.add(`dex:row:${rowIndex}`, canvasX, y, canvasCols, 1);
  }

  // Scrollbar track on the canvas's right edge when the list overflows.
  if (rows.length > visible) {
    const trackX = canvasX + canvasCols - 1;
    const thumbLen = Math.max(1, Math.round((visible / rows.length) * visible));
    const thumbTop =
      listTop + Math.round((scroll / Math.max(1, rows.length - visible)) * (visible - thumbLen));
    for (let i = 0; i < visible; i++) {
      const yy = listTop + i;
      const isThumb = yy >= thumbTop && yy < thumbTop + thumbLen;
      buf.set(trackX, yy, { ch: isThumb ? '█' : '│', fg: isThumb ? LOCKED : RULE, bg: null });
    }
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
