/**
 * Dex detail page: drill-in for one species. Shows a large sprite preview tinted
 * to the species' best grade, a battle/graft-readiness banner, and up to three
 * historical record cards — each with stats, generation, a captured date, the
 * shareable DNA code, and the record's graft potency.
 *
 * Reached by pressing Enter / clicking a discovered row on the Dex; Esc (or a
 * click) returns. The species id rides on the page's UI state (`ui.speciesId`).
 */

import {
  BATTLE_READY_STAGE,
  encodeDna,
  graftPotencyTier,
  isBattleReady,
  type DexSnapshot,
  type House,
} from '@token-tamers/core';
import type { Rgb } from '../terminal/ansi';
import { drawDivider, drawPageFooter, drawPageHeader } from '../components';
import { buildPalette, drawSprite, GRADE_ACCENT, GRADE_BADGE } from '../render/sprite';
import { findSpecies, findSprite, houseColor, houseTint } from '../helpers/lookup';
import type { RenderContext } from './types';

const TEXT: Rgb = { r: 214, g: 220, b: 234 };
const DIM: Rgb = { r: 96, g: 100, b: 120 };
const READY: Rgb = { r: 74, g: 222, b: 128 };
const SEALED: Rgb = { r: 150, g: 152, b: 160 };
const DNA: Rgb = { r: 150, g: 200, b: 255 };

const RANKS = ['Best', '2nd', '3rd'] as const;
const SPRITE_ROWS = 6;

function titleCase(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/** Captured timestamp → UTC YYYY-MM-DD (UTC keeps golden frames deterministic). */
function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Fixed-width stat readout (3-digit columns) so the gen/date columns never overlap. */
function statLine(s: DexSnapshot['stats']): string {
  const p = (n: number) => String(n).padStart(3);
  return `PWR ${p(s.pwr)}  SPD ${p(s.spd)}  WIS ${p(s.wis)}  GRT ${p(s.grt)}`;
}

export function renderDexDetailPage(ctx: RenderContext): void {
  const { buf, layout, pack, ui } = ctx;
  const { canvasX, canvasCols, canvasRows } = layout;
  const speciesId = ui.speciesId ?? null;
  const species = speciesId ? findSpecies(pack, speciesId) : undefined;
  const record = speciesId
    ? ctx.state.dexRecords.find((r) => r.speciesId === speciesId)
    : undefined;
  const best = record?.top[0];

  const name = species?.name ?? '???';
  const bodyY = drawPageHeader(ctx, { icon: '☰', title: `Dex ▸ ${name}` });

  if (!species || !best) {
    buf.text(
      canvasX + 1,
      bodyY,
      'No record yet — raise this species through a molt to log its DNA.',
      DIM,
      null,
    );
    drawPageFooter(ctx, 'Esc back');
    return;
  }

  drawSpriteAndMeta(ctx, species.house, best, species.num, bodyY);

  // Records section.
  const recTop = bodyY + SPRITE_ROWS + 1;
  drawDivider(buf, recTop, { x: canvasX + 1, width: canvasCols - 2, label: 'Records' });
  const cardsTop = recTop + 2;
  const footerY = canvasRows - 1;
  const maxCards = Math.max(0, Math.min(record.top.length, Math.floor((footerY - cardsTop) / 2)));
  for (let i = 0; i < maxCards; i++) {
    drawRecordCard(ctx, record.top[i]!, i, cardsTop + i * 2);
  }

  const shown =
    maxCards < record.top.length ? `${maxCards}/${record.top.length}` : `${record.top.length}`;
  drawPageFooter(
    ctx,
    `${shown} record${record.top.length === 1 ? '' : 's'}  ·  click a DNA code to copy  ·  Esc back`,
  );
}

/**
 * The clipboard form of a DNA code: keep the structural `TTX<v>-` prefix but drop
 * the cosmetic in-body grouping dashes, so a shared/pasted code is shorter. Decode
 * is dash-insensitive, so this is equivalent to the on-screen grouped form.
 */
function compactDna(code: string): string {
  const dash = code.indexOf('-');
  return dash < 0 ? code : code.slice(0, dash + 1) + code.slice(dash + 1).replace(/-/g, '');
}

/** Left: scaled sprite. Right: name + house/dex + the readiness banner. */
function drawSpriteAndMeta(
  ctx: RenderContext,
  house: House | 'hybrid',
  best: DexSnapshot,
  num: number,
  bodyY: number,
): void {
  const { buf, layout, pack, mode, frame } = ctx;
  const canvasX = layout.canvasX;
  const species = findSpecies(pack, best.speciesId);
  const spr = findSprite(pack, species?.spriteId ?? '');
  if (spr) {
    const nativeRows = Math.max(1, Math.ceil(spr.height / 2));
    const scale = SPRITE_ROWS / nativeRows;
    const destW = Math.max(1, Math.round(spr.width * scale));
    drawSprite(buf, spr, buildPalette(houseTint(best.house), best.grade, frame), {
      x: canvasX + 2,
      y: bodyY,
      destW,
      destH: SPRITE_ROWS,
      frame,
      mode,
    });
  }

  const mx = canvasX + 20;
  const houseName = house === 'hybrid' ? 'Hybrid' : titleCase(house);
  const title = `${species?.name ?? best.speciesId} ${GRADE_BADGE[best.grade]}`;
  buf.textBold(mx, bodyY, title, GRADE_ACCENT[best.grade], null);
  buf.text(mx, bodyY + 1, '●', house === 'hybrid' ? DIM : houseColor(house), null);
  buf.text(
    mx + 2,
    bodyY + 1,
    `${houseName} House  ·  Dex #${String(num).padStart(3, '0')}`,
    TEXT,
    null,
  );

  // Readiness banner — driven purely by the best record's stage.
  if (isBattleReady(best)) {
    buf.text(mx, bodyY + 3, '✦ Battle-ready  ·  Graft-ready', READY, null);
  } else {
    buf.text(mx, bodyY + 3, `▢ Sealed — unlocks at ${titleCase(BATTLE_READY_STAGE)}`, SEALED, null);
  }
}

/** One record card: rank + grade + stats on line A, DNA + graft on line B. */
function drawRecordCard(ctx: RenderContext, snap: DexSnapshot, idx: number, y: number): void {
  const { buf, layout, pack } = ctx;
  const x = layout.canvasX + 2;
  const rank = RANKS[idx] ?? `#${idx + 1}`;
  const badge = `${GRADE_BADGE[snap.grade]} ${snap.grade}`;
  buf.text(x, y, rank.padEnd(5), DIM, null);
  buf.text(x + 5, y, badge, GRADE_ACCENT[snap.grade], null);
  buf.text(x + 9, y, statLine(snap.stats), TEXT, null);
  buf.text(x + 45, y, `g${snap.generation}`, DIM, null);
  buf.text(x + 51, y, isoDate(snap.recordedAt), DIM, null);

  const speciesNum = findSpecies(pack, snap.speciesId)?.num ?? 0;
  const code = encodeDna(snap, { speciesNum });
  const label = `DNA ${code}`;
  buf.text(x + 5, y + 1, label, DNA, null);
  // Click-to-copy: a ⧉ affordance + a hit region over the code copy the (compact) code.
  buf.text(x + 5 + label.length + 1, y + 1, '⧉', READY, null);
  ctx.hits.add(`copy:${compactDna(code)}`, x + 5, y + 1, label.length + 2, 1);
  buf.text(x + 5 + label.length + 4, y + 1, `Graft ${graftPotencyTier(snap.grade)}`, DIM, null);
}
