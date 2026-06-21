/**
 * Battle ARENA renderer (design: battle-playback-redesign.md).
 *
 * Pure playback of `ctx.battle` up to its beat clock: two fighters facing off, the
 * attacker lunging + spotlit while the defender flinches, a tweening HP bar, floating
 * impact tags, and ONE held action banner that names who hit whom. All motion is a
 * pure function of the view's `cursor` + `beatFrame` (see battle-beat.ts), so frames
 * stay golden-testable. The sim runs once in the shell — never here.
 */

import type { BattleSide, Combatant } from '@token-tamers/core';
import type { Rgb } from '../terminal/ansi';
import { drawDivider, drawMeter, drawPageFooter, pageBodyBottom } from '../components';
import {
  buildPalette,
  drawSprite,
  subcellRows,
  subcellCols,
  GRADE_ACCENT,
  GRADE_BADGE,
} from '../render/sprite';
import { findSprite, houseColor, houseTint, ownerLabel } from '../helpers/lookup';
import {
  animHp,
  attackerSide,
  bannerFor,
  currentRound,
  flinchMag,
  floatTag,
  lungeMag,
  shakeMag,
  speedLabel,
  titleCase,
  type BattleTone,
} from './battle-beat';
import type { BattleView, RenderContext } from './types';

const TEXT: Rgb = { r: 214, g: 220, b: 234 };
const DIM: Rgb = { r: 96, g: 100, b: 120 };
const HP_GOOD: Rgb = { r: 74, g: 222, b: 128 };
const HP_WARN: Rgb = { r: 240, g: 200, b: 96 };
const HP_LOW: Rgb = { r: 232, g: 96, b: 96 };
const WIN: Rgb = { r: 255, g: 224, b: 130 };

// Effect-tone palette (kept disjoint from the grade/House ladders — these are FX, not value).
const TONE: Record<BattleTone, Rgb> = {
  normal: TEXT,
  crit: { r: 255, g: 210, b: 92 }, // gold jolt
  dodge: { r: 120, g: 214, b: 232 }, // cool slip
  parry: { r: 176, g: 188, b: 210 }, // steel guard
  proc: { r: 198, g: 150, b: 246 }, // trait violet
  faint: { r: 232, g: 120, b: 120 }, // fading red
};

const SPRITE_ROWS = 4;
/** Sprite footprint at the column's left; dropped when the column can't also hold text. */
const COMBATANT_SPRITE_COLS = 16;

function hpColor(frac: number): Rgb {
  return frac > 0.5 ? HP_GOOD : frac > 0.25 ? HP_WARN : HP_LOW;
}

/** Blend `a` toward `b` by `t` (0..1) — used to dim the off-turn fighter's name. */
function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

/** A combatant column's bounds: left edge, top row, usable width in cells. */
export interface ColumnRect {
  x: number;
  topY: number;
  w: number;
}

/** Draw `text` from (x,y) but never past `maxCols` cells (clips, never overflows). */
export function clipText(
  buf: RenderContext['buf'],
  opts: { x: number; y: number; text: string; color: Rgb; maxCols: number; bold?: boolean },
): void {
  if (opts.maxCols <= 0) return;
  const clipped = [...opts.text].slice(0, opts.maxCols).join('');
  if (opts.bold) buf.textBold(opts.x, opts.y, clipped, opts.color, null);
  else buf.text(opts.x, opts.y, clipped, opts.color, null);
}

/** The split-pane arena: two animated combatants + the held action banner + log tail. */
export function drawArena(ctx: RenderContext, view: BattleView, bodyY: number): void {
  const { layout } = ctx;
  const mid = Math.floor(layout.canvasCols / 2);
  const atk = attackerSide(view);
  const left: ColumnRect = { x: layout.canvasX + 2, topY: bodyY, w: mid - 2 - 1 };
  const right: ColumnRect = {
    x: layout.canvasX + mid + 1,
    topY: bodyY,
    w: layout.canvasCols - mid - 1 - 1,
  };
  drawCombatantColumn(ctx, { view, side: 'a', col: left, attacker: atk });
  drawCombatantColumn(ctx, { view, side: 'b', col: right, attacker: atk });

  const bottom = pageBodyBottom(layout);
  const bannerRow = bottom - 1;
  const fxRow = bodyY + SPRITE_ROWS;
  if (fxRow < bannerRow) drawFloatTags(ctx, view, [left, right], fxRow);
  drawLogTail(ctx, view, fxRow + 1, bannerRow - 1);

  const total = view.result.timeline.length;
  const done = view.cursor >= total;
  if (done) drawWinner(ctx, view, bannerRow);
  else drawBanner(ctx, view, bannerRow);

  const ctrl = done ? 'Enter replay' : view.playing ? 'Enter pause' : 'Enter play';
  const head = `${Math.min(view.cursor, total)}/${total} · R${currentRound(view)}`;
  drawPageFooter(
    ctx,
    `${ctrl}  ·  s ${speedLabel(view)}  ·  r rematch  ·  ←→ step  ·  Esc back  ·  [${head}]`,
  );
}

interface ColumnOpts {
  view: BattleView;
  side: BattleSide;
  col: ColumnRect;
  attacker: BattleSide | null;
}

/** Per-fighter sprite x-shift: lunge (attacker) / flinch (defender), plus screen-shake. */
function spriteShift(opts: ColumnOpts): number {
  const { view, side, attacker } = opts;
  const toFoe = side === 'a' ? 1 : -1;
  const shake = shakeMag(view);
  if (attacker === null) return shake;
  if (attacker === side) return Math.round(lungeMag(view)) * toFoe + shake;
  return Math.round(flinchMag(view)) * -toFoe + shake;
}

function drawCombatantColumn(ctx: RenderContext, opts: ColumnOpts): void {
  const { buf, mode, frame } = ctx;
  const { view, side, col, attacker } = opts;
  if (col.w <= 0) return;
  const c = side === 'a' ? view.left : view.right;
  const species =
    ctx.pack.species.find((s) => s.id === c.speciesId) ??
    ctx.pack.species.find((s) => s.num === c.speciesNum);
  const spr = findSprite(ctx.pack, species?.spriteId ?? '');
  const showSprite = !!spr && col.w >= COMBATANT_SPRITE_COLS + 14;
  if (spr && showSprite) {
    const scale = SPRITE_ROWS / Math.max(1, subcellRows(spr.height));
    const dx = spriteShift(opts);
    drawSprite(buf, spr, buildPalette(houseTint(c.house), c.grade, frame, species?.accent), {
      x: col.x + dx,
      y: col.topY,
      destW: Math.max(1, Math.round(subcellCols(spr.width) * scale)),
      destH: SPRITE_ROWS,
      frame,
      mode,
      clip: { x: col.x, y: col.topY, w: col.w, h: SPRITE_ROWS },
    });
  }
  drawCombatantText(ctx, c, col, showSprite, attacker === side || attacker === null);
  drawHpRow(ctx, view, side, col, showSprite);
}

/** Name (spotlit/dim), House and owner mark in the column's text block. */
function drawCombatantText(
  ctx: RenderContext,
  c: Combatant,
  col: ColumnRect,
  showSprite: boolean,
  lit: boolean,
): void {
  const { buf } = ctx;
  const tx = col.x + (showSprite ? COMBATANT_SPRITE_COLS : 0);
  const avail = col.x + col.w - tx;
  const nameColor = lit ? GRADE_ACCENT[c.grade] : mix(GRADE_ACCENT[c.grade], DIM, 0.6);
  clipText(buf, {
    x: tx,
    y: col.topY,
    text: `${c.name} ${GRADE_BADGE[c.grade]}`,
    color: nameColor,
    maxCols: avail,
    bold: true,
  });
  clipText(buf, { x: tx, y: col.topY + 1, text: '●', color: houseColor(c.house), maxCols: avail });
  clipText(buf, {
    x: tx + 2,
    y: col.topY + 1,
    text: `${titleCase(c.house)} House`,
    color: lit ? TEXT : DIM,
    maxCols: avail - 2,
  });
  const mark = ownerLabel(c, ctx.info?.tamer ?? '', ctx.info?.tamerTitle ?? '');
  if (mark) clipText(buf, { x: tx, y: col.topY + 2, text: mark, color: DIM, maxCols: avail });
}

/** The tweening HP meter + readout (shrinks the bar so the readout never spills). */
function drawHpRow(
  ctx: RenderContext,
  view: BattleView,
  side: BattleSide,
  col: ColumnRect,
  showSprite: boolean,
): void {
  const { buf } = ctx;
  const tx = col.x + (showSprite ? COMBATANT_SPRITE_COLS : 0);
  const avail = col.x + col.w - tx;
  const cur = animHp(view, side);
  const max = view.result.startHp[side];
  const frac = max > 0 ? cur / max : 0;
  const hpStr = `HP ${cur}/${max}`;
  const meterW = Math.max(3, Math.min(14, avail - hpStr.length - 1));
  drawMeter(buf, { x: tx, y: col.topY + 3, w: meterW }, frac, hpColor(frac));
  clipText(buf, {
    x: tx + meterW + 1,
    y: col.topY + 3,
    text: hpStr,
    color: DIM,
    maxCols: avail - meterW - 1,
  });
}

/** Floating impact tags (damage / "miss") popping on the impact row under the struck side. */
function drawFloatTags(
  ctx: RenderContext,
  view: BattleView,
  cols: [ColumnRect, ColumnRect],
  fxRow: number,
): void {
  const sides: BattleSide[] = ['a', 'b'];
  for (let i = 0; i < 2; i++) {
    const tag = floatTag(view, sides[i]!);
    if (!tag) continue;
    const col = cols[i]!;
    clipText(ctx.buf, {
      x: col.x + 1,
      y: fxRow,
      text: tag.text,
      color: TONE[tag.tone],
      maxCols: col.w - 1,
      bold: true,
    });
  }
}

/** A short transcript tail under the arena (secondary to the banner; skipped if no room). */
function drawLogTail(ctx: RenderContext, view: BattleView, top: number, bottom: number): void {
  const rows = bottom - top;
  if (rows <= 0) return;
  const tl = view.result.timeline;
  const end = Math.min(view.cursor, tl.length);
  const start = Math.max(0, end - rows);
  for (let i = start; i < end; i++) {
    ctx.buf.text(ctx.layout.canvasX + 2, top + (i - start), logLine(view, tl[i]!), DIM, null);
  }
}

function logLine(
  view: BattleView,
  e: { actor: BattleSide; kind: string; damage: number; proc?: string },
): string {
  const atk = e.actor === 'a' ? view.left.name : view.right.name;
  const def = e.actor === 'a' ? view.right.name : view.left.name;
  if (e.kind === 'faint') return `✖ ${def} faints`;
  if (e.kind === 'dodge') return `↯ ${def} dodges ${atk}'s strike`;
  if (e.kind === 'crit') return `✸ ${atk} CRITS ${def} for ${e.damage}`;
  if (e.kind === 'parry') return `⛊ ${def} parries — ${atk} hits for ${e.damage}`;
  if (e.kind === 'proc')
    return `⚡ ${atk} — ${titleCase(e.proc ?? '')}! hits ${def} for ${e.damage}`;
  return `⚔ ${atk} hits ${def} for ${e.damage}`;
}

/** The held action banner — the primary "who hit whom" readout. */
function drawBanner(ctx: RenderContext, view: BattleView, row: number): void {
  if (row < ctx.layout.canvasY) return;
  const b = bannerFor(view);
  if (!b) return;
  // Separator rule above the banner only when there's a clear gap below the sprites.
  if (row - 1 >= ctx.layout.canvasY + SPRITE_ROWS) {
    drawDivider(ctx.buf, row - 1, { x: ctx.layout.canvasX + 1, width: ctx.layout.canvasCols - 2 });
  }
  ctx.buf.textBold(
    ctx.layout.canvasX + 2,
    row,
    clip(b.text, ctx.layout.canvasCols - 4),
    TONE[b.tone],
    null,
  );
}

function drawWinner(ctx: RenderContext, view: BattleView, row: number): void {
  if (row >= pageBodyBottom(ctx.layout)) return;
  const w = view.result.winner;
  const text = w === 'draw' ? '⚖ Draw' : `★ ${(w === 'a' ? view.left : view.right).name} wins!`;
  ctx.buf.textBold(ctx.layout.canvasX + 2, row, clip(text, ctx.layout.canvasCols - 4), WIN, null);
}

function clip(s: string, max: number): string {
  return [...s].slice(0, Math.max(0, max)).join('');
}
