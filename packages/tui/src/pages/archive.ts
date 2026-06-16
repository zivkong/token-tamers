/**
 * Archive page: the best record per species, a hall-of-fame table with species,
 * grade, generation, stats, and a recorded timestamp column. Derived from the
 * unified Dex record store (`bestSpeciesRecords`) so the Archive and Dex are one
 * source of truth.
 */

import { bestSpeciesRecords, type DexSnapshot, type Stats } from '@token-tamers/core';
import type { Rgb } from '../terminal/ansi';
import { GRADE_ACCENT, GRADE_BADGE } from '../render/sprite';
import { drawPageFooter, drawPageHeader, PAGE_HEADER_ROWS } from '../components';
import { findSpecies } from '../helpers/lookup';
import type { RenderContext } from './types';

const TEXT: Rgb = { r: 214, g: 220, b: 234 };
const DIM: Rgb = { r: 96, g: 100, b: 120 };
const SELECT_BG: Rgb = { r: 40, g: 48, b: 78 };

// Fixed column offsets (within the canvas): marker+#, name, grade, gen, stats.
const COL = { num: 1, name: 8, grade: 25, gen: 31, stats: 37 } as const;

/**
 * First record row: the standard header, then one column-header row inside the
 * body. Shared with the shell's click hit-test.
 */
export const ARCHIVE_LIST_OFFSET = PAGE_HEADER_ROWS + 1;

function statsBrief(s: Stats): string {
  return `PWR ${String(s.pwr).padStart(2)}  SPD ${String(s.spd).padStart(2)}  WIS ${String(s.wis).padStart(2)}  GRT ${String(s.grt).padStart(2)}`;
}

/**
 * Clamp a list's scroll offset so the selected row stays visible. Shared list
 * helper (lives here now that the Dex is a constellation, not a scrolling list).
 */
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

export function renderArchivePage(ctx: RenderContext): void {
  const { buf, hits, layout, state, pack, ui } = ctx;
  const { canvasX, canvasCols, canvasRows } = layout;
  const records: readonly DexSnapshot[] = bestSpeciesRecords(state.dexRecords);

  // Standard page header with an Archive-coverage bar: how many of the Dex's
  // species have a best record here (one record per species). Returns the body's
  // first row, where the column header sits (records follow on the next row).
  const archivePct = pack.dexTotal > 0 ? (records.length / pack.dexTotal) * 100 : 0;
  const colY = drawPageHeader(ctx, {
    icon: '◆',
    title: 'Archive',
    completion: { count: `${records.length}/${pack.dexTotal}`, pct: archivePct },
  });
  // Column header as the first body row, under the standard divider.
  buf.text(canvasX + COL.num, colY, '#', DIM, null);
  buf.text(canvasX + COL.name, colY, 'SPECIES', DIM, null);
  buf.text(canvasX + COL.grade, colY, 'GRADE', DIM, null);
  buf.text(canvasX + COL.gen, colY, 'GEN', DIM, null);
  buf.text(canvasX + COL.stats, colY, 'BEST STATS', DIM, null);

  const listTop = colY + 1;
  const visible = canvasRows - ARCHIVE_LIST_OFFSET - 1;

  if (records.length === 0) {
    buf.text(canvasX + 1, listTop, 'No records yet — your first rebirth writes here.', DIM, null);
    drawPageFooter(ctx, '0 records');
    return;
  }

  const scroll = clampScroll(ui.scroll, ui.selected, visible, records.length);
  ui.scroll = scroll;

  for (let i = 0; i < visible; i++) {
    const rowIndex = scroll + i;
    if (rowIndex >= records.length) break;
    const rec = records[rowIndex];
    if (!rec) continue;
    const y = listTop + i;
    const selected = rowIndex === ui.selected;
    const bg = selected ? SELECT_BG : null;
    const species = findSpecies(pack, rec.speciesId);
    const name = species?.name ?? rec.speciesId;
    for (let x = 0; x < canvasCols; x++) {
      buf.set(canvasX + x, y, { ch: ' ', fg: null, bg });
    }
    const marker = selected ? '› ' : '  ';
    const numStr = `#${String(species?.num ?? rowIndex + 1).padStart(3, '0')}`;
    buf.text(canvasX + COL.num, y, `${marker}${numStr}`, DIM, bg);
    buf.text(canvasX + COL.name, y, name, TEXT, bg);
    buf.text(
      canvasX + COL.grade,
      y,
      `[${rec.grade}]${GRADE_BADGE[rec.grade]}`,
      GRADE_ACCENT[rec.grade],
      bg,
    );
    buf.text(canvasX + COL.gen, y, `g${rec.generation}`, DIM, bg);
    buf.text(canvasX + COL.stats, y, statsBrief(rec.stats), TEXT, bg);
    hits.add(`archive:row:${rowIndex}`, canvasX, y, canvasCols, 1);
  }

  drawPageFooter(ctx, `${ui.selected + 1}/${records.length} records  ·  ↑↓ select  ·  b battle`);
}
