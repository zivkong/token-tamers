/**
 * Archive page: a records table of every pet ever archived (rebirth history),
 * with species, grade, generation, stats, and a recorded timestamp column.
 */

import type { ArchiveRecord, Stats } from '@token-tamers/core';
import type { Rgb } from '../terminal/ansi';
import { GRADE_ACCENT, GRADE_BADGE } from '../render/sprite';
import { drawCompletionHeader, drawDivider } from '../components';
import { findSpecies } from '../helpers/lookup';
import { clampScroll } from './dex';
import type { RenderContext } from './types';

const TEXT: Rgb = { r: 214, g: 220, b: 234 };
const DIM: Rgb = { r: 96, g: 100, b: 120 };
const SELECT_BG: Rgb = { r: 40, g: 48, b: 78 };
const HEADER: Rgb = { r: 150, g: 200, b: 255 };

// Fixed column offsets (within the canvas): marker+#, name, grade, gen, stats.
const COL = { num: 1, name: 8, grade: 25, gen: 31, stats: 37 } as const;

/** Rows above the list: title (1) + columns (1) + divider (1) + gap (1). */
export const ARCHIVE_LIST_OFFSET = 4;

function statsBrief(s: Stats): string {
  return `PWR ${String(s.pwr).padStart(2)}  SPD ${String(s.spd).padStart(2)}  WIS ${String(s.wis).padStart(2)}  GRT ${String(s.grt).padStart(2)}`;
}

export function renderArchivePage(ctx: RenderContext): void {
  const { buf, hits, layout, state, pack, ui } = ctx;
  const { canvasX, canvasY, canvasCols, canvasRows } = layout;
  const records: readonly ArchiveRecord[] = state.archive;

  // Hall-of-fame header with an Archive-coverage bar: how many of the Dex's
  // species have a best record here (one record per species).
  buf.text(canvasX + 1, canvasY, '◆ Archive', HEADER, null);
  const archivePct = pack.dexTotal > 0 ? (records.length / pack.dexTotal) * 100 : 0;
  drawCompletionHeader(buf, {
    x: canvasX,
    y: canvasY,
    width: canvasCols,
    count: `${records.length}/${pack.dexTotal}`,
    pct: archivePct,
    fill: HEADER,
    dim: DIM,
  });
  // Column header on its own rule line.
  buf.text(canvasX + COL.num, canvasY + 1, '#', DIM, null);
  buf.text(canvasX + COL.name, canvasY + 1, 'SPECIES', DIM, null);
  buf.text(canvasX + COL.grade, canvasY + 1, 'GRADE', DIM, null);
  buf.text(canvasX + COL.gen, canvasY + 1, 'GEN', DIM, null);
  buf.text(canvasX + COL.stats, canvasY + 1, 'BEST STATS', DIM, null);
  // Standard section divider (rule + a blank gap row after it) under the columns.
  drawDivider(buf, canvasY + 2, { x: canvasX + 1, width: canvasCols - 2 });

  const listTop = canvasY + ARCHIVE_LIST_OFFSET;
  const visible = canvasRows - ARCHIVE_LIST_OFFSET - 1;

  if (records.length === 0) {
    buf.text(canvasX + 1, listTop, 'No records yet — your first rebirth writes here.', DIM, null);
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

  buf.text(
    canvasX + 1,
    canvasY + canvasRows - 1,
    `${ui.selected + 1}/${records.length} records`,
    DIM,
    null,
  );
}
