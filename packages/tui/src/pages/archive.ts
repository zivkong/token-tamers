/**
 * Archive page: a records table of every pet ever archived (rebirth history),
 * with species, grade, generation, stats, and a recorded timestamp column.
 */

import type { ArchiveRecord, Stats } from '@token-tamers/core';
import type { Rgb } from '../terminal/ansi';
import { GRADE_BADGE } from '../render/sprite';
import { findSpecies } from '../helpers/lookup';
import { clampScroll } from './dex';
import type { RenderContext } from './types';

const TEXT: Rgb = { r: 214, g: 220, b: 234 };
const DIM: Rgb = { r: 96, g: 100, b: 120 };
const SELECT_BG: Rgb = { r: 40, g: 48, b: 78 };
const HEADER: Rgb = { r: 150, g: 200, b: 255 };

function statsBrief(s: Stats): string {
  return `${s.pwr}/${s.spd}/${s.wis}/${s.grt}`;
}

export function renderArchivePage(ctx: RenderContext): void {
  const { buf, hits, layout, state, pack, ui } = ctx;
  const { canvasX, canvasY, canvasCols, canvasRows } = layout;
  const records: readonly ArchiveRecord[] = state.archive;

  buf.text(canvasX + 1, canvasY, 'ARCHIVE', HEADER, null);
  // Column header.
  const header = padRow('#', 'SPECIES', 'GR', 'GEN', 'PWR/SPD/WIS/GRT');
  buf.text(canvasX + 1, canvasY + 1, header, DIM, null);

  const listTop = canvasY + 2;
  const visible = canvasRows - 3;

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
    const badge = GRADE_BADGE[rec.grade];
    const line = padRow(
      String(rowIndex + 1),
      name,
      `${rec.grade}${badge}`,
      `g${rec.generation}`,
      statsBrief(rec.stats),
    );
    for (let x = 0; x < canvasCols; x++) {
      buf.set(canvasX + x, y, { ch: ' ', fg: null, bg });
    }
    buf.text(canvasX + 1, y, (selected ? '› ' : '  ') + line, TEXT, bg);
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

function padRow(num: string, species: string, grade: string, gen: string, stats: string): string {
  return num.padEnd(4) + species.slice(0, 16).padEnd(18) + grade.padEnd(4) + gen.padEnd(5) + stats;
}
