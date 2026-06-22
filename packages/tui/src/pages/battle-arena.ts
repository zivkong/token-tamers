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
  type Palette,
} from '../render/sprite';
import { findSprite, houseColor, houseTint, ownerLabel } from '../helpers/lookup';
import {
  animHp,
  attackerSide,
  bannerFor,
  battleDone,
  battleOutcome,
  clipStr,
  currentRound,
  flinchMag,
  floatTag,
  logLine,
  lungeMag,
  shakeMag,
  speedLabel,
  titleCase,
  type BattleTone,
} from './battle-beat';
import { drawLogOverlay, drawWinnerFlourish } from './battle-flourish';
import type { BattleView, RenderContext } from './types';

/** This side's end-of-fight state, driving the winner glow vs. loser wash. */
type Outcome = 'none' | 'win' | 'lose' | 'draw';

const TEXT: Rgb = { r: 214, g: 220, b: 234 };
const DIM: Rgb = { r: 96, g: 100, b: 120 };
const NAMEPLATE: Rgb = { r: 198, g: 188, b: 150 }; // soft parchment for the Tamer corner
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

/** The split-pane arena: two facing combatants + the held action banner / flourish. */
export function drawArena(ctx: RenderContext, view: BattleView, bodyY: number): void {
  const { layout } = ctx;
  const mid = Math.floor(layout.canvasCols / 2);
  const atk = attackerSide(view);
  const done = battleDone(view);
  const left: ColumnRect = { x: layout.canvasX + 2, topY: bodyY, w: mid - 2 - 1 };
  const right: ColumnRect = {
    x: layout.canvasX + mid + 1,
    topY: bodyY,
    w: layout.canvasCols - mid - 1 - 1,
  };
  const bannerRow = pageBodyBottom(layout) - 1;
  const fxRow = bodyY + SPRITE_ROWS < bannerRow ? bodyY + SPRITE_ROWS : -1;
  drawCombatantColumn(ctx, { view, side: 'a', col: left, attacker: atk, fxRow });
  drawCombatantColumn(ctx, { view, side: 'b', col: right, attacker: atk, fxRow });

  if (view.showLog) {
    // The transcript overlay takes over the whole arena body + the banner row.
    drawLogOverlay(ctx, view, bodyY);
  } else {
    drawLogTail(ctx, view, bodyY + SPRITE_ROWS + 1, bannerRow - 1);
    if (done) drawWinnerFlourish(ctx, view, bannerRow);
    else drawBanner(ctx, view, bannerRow);
  }

  const total = view.result.timeline.length;
  const ctrl = done ? 'Enter replay' : view.playing ? 'Enter pause' : 'Enter play';
  const head = `${Math.min(view.cursor, total)}/${total} · R${currentRound(view)}`;
  drawPageFooter(
    ctx,
    `${ctrl}  ·  s ${speedLabel(view)}  ·  ←→ step  ·  l ${view.showLog ? 'close' : 'log'}  ·  r rematch  ·  Esc back  ·  [${head}]`,
  );
}

interface ColumnOpts {
  view: BattleView;
  side: BattleSide;
  col: ColumnRect;
  attacker: BattleSide | null;
  /** Row for the floating impact tag, or -1 when there's no room. */
  fxRow: number;
}

/** Sprite/text rects within a column. The fighters FACE OFF: sprites sit on the inner
 *  edge (toward the center divider), name plates on the outer edge (the arena corners). */
interface Geom {
  sx: number;
  tx: number;
  textW: number;
}
function columnGeom(col: ColumnRect, showSprite: boolean, mirror: boolean): Geom {
  if (!showSprite) return { sx: col.x, tx: col.x, textW: col.w };
  const textW = col.w - COMBATANT_SPRITE_COLS;
  // mirror = the RIGHT fighter: sprite inner-left, text outer-right.
  if (mirror) return { sx: col.x, tx: col.x + COMBATANT_SPRITE_COLS, textW };
  // the LEFT fighter: sprite inner-right, text outer-left.
  return { sx: col.x + col.w - COMBATANT_SPRITE_COLS, tx: col.x, textW };
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

/** Vertical sprite offset for the end-of-fight flourish: the winner bobs, the loser slumps. */
function spriteBob(outcome: Outcome, frame: number): number {
  if (outcome === 'win') return (frame >> 3) % 2 === 0 ? 0 : -1;
  if (outcome === 'lose') return 1;
  return 0;
}

/** Blend a palette toward grey + darken — the defeated fighter's washed-out look. */
function desaturate(pal: Palette, amt: number): Palette {
  return pal.map((c) => {
    if (!c) return null;
    const g = Math.round(0.3 * c.r + 0.59 * c.g + 0.11 * c.b);
    return mix(mix(c, { r: g, g, b: g }, amt), { r: 0, g: 0, b: 0 }, 0.35);
  });
}

function drawCombatantColumn(ctx: RenderContext, opts: ColumnOpts): void {
  const { buf, mode, frame } = ctx;
  const { view, side, col, attacker, fxRow } = opts;
  if (col.w <= 0) return;
  const c = side === 'a' ? view.left : view.right;
  const mirror = side === 'b';
  const outcome = battleOutcome(view, side);
  const species =
    ctx.pack.species.find((s) => s.id === c.speciesId) ??
    ctx.pack.species.find((s) => s.num === c.speciesNum);
  const spr = findSprite(ctx.pack, species?.spriteId ?? '');
  const showSprite = !!spr && col.w >= COMBATANT_SPRITE_COLS + 14;
  const geom = columnGeom(col, showSprite, mirror);
  if (spr && showSprite) {
    const scale = SPRITE_ROWS / Math.max(1, subcellRows(spr.height));
    let pal = buildPalette(houseTint(c.house), c.grade, frame, species?.accent);
    if (outcome === 'lose') pal = desaturate(pal, 0.8);
    drawSprite(buf, spr, pal, {
      x: geom.sx + spriteShift(opts),
      y: col.topY + spriteBob(outcome, frame),
      destW: Math.max(1, Math.round(subcellCols(spr.width) * scale)),
      destH: SPRITE_ROWS,
      frame,
      mode,
      flipX: mirror, // mirror the opponent so the fighters face each other
      clip: { x: geom.sx, y: col.topY, w: COMBATANT_SPRITE_COLS, h: SPRITE_ROWS },
    });
  }
  const lit = attacker === side || attacker === null;
  drawCombatantText(ctx, { c, geom, mirror, outcome, lit, topY: col.topY });
  drawHpRow(ctx, view, side, geom, col.topY);
  // Floating impact tag over THIS fighter's sprite when it's the one struck.
  if (fxRow >= 0) drawFloatTag(ctx, view, side, showSprite ? geom.sx + 1 : geom.tx + 1, fxRow);
}

interface TextOpts {
  c: Combatant;
  geom: Geom;
  mirror: boolean;
  outcome: Outcome;
  lit: boolean;
  topY: number;
}

/** Tamer nameplate (top corner) + name/grade (spotlit/outcome-tinted) + House. */
function drawCombatantText(ctx: RenderContext, o: TextOpts): void {
  const { buf } = ctx;
  const { c, geom, mirror, outcome, lit, topY } = o;
  const { tx, textW: avail } = geom;
  // Row 0 — the Tamer nameplate, anchored to the arena corner (diamonds point inward).
  const mark = ownerLabel(c, ctx.info?.tamer ?? '', ctx.info?.tamerTitle ?? '');
  if (mark) {
    const plate = clipStr(mirror ? `◆ ${mark}` : `${mark} ◆`, avail);
    const px = mirror ? tx + avail - [...plate].length : tx;
    buf.text(px, topY, plate, NAMEPLATE, null);
  }
  // Row 1 — name + grade: gold for the winner, washed for the loser, else spotlight.
  const nameColor =
    outcome === 'win'
      ? WIN
      : outcome === 'lose'
        ? mix(GRADE_ACCENT[c.grade], DIM, 0.8)
        : lit
          ? GRADE_ACCENT[c.grade]
          : mix(GRADE_ACCENT[c.grade], DIM, 0.6);
  clipText(buf, {
    x: tx,
    y: topY + 1,
    text: `${c.name} ${GRADE_BADGE[c.grade]}`,
    color: nameColor,
    maxCols: avail,
    bold: true,
  });
  // Row 2 — House.
  const houseLit = outcome === 'win' || outcome === 'draw' || (outcome === 'none' && lit);
  clipText(buf, { x: tx, y: topY + 2, text: '●', color: houseColor(c.house), maxCols: avail });
  clipText(buf, {
    x: tx + 2,
    y: topY + 2,
    text: `${titleCase(c.house)} House`,
    color: houseLit ? TEXT : DIM,
    maxCols: avail - 2,
  });
}

/** The tweening HP meter + readout (row 3; shrinks the bar so the readout never spills). */
function drawHpRow(
  ctx: RenderContext,
  view: BattleView,
  side: BattleSide,
  geom: Geom,
  topY: number,
): void {
  const { buf } = ctx;
  const { tx, textW: avail } = geom;
  const cur = animHp(view, side);
  const max = view.result.startHp[side];
  const frac = max > 0 ? cur / max : 0;
  const hpStr = `HP ${cur}/${max}`;
  const meterW = Math.max(3, Math.min(14, avail - hpStr.length - 1));
  drawMeter(buf, { x: tx, y: topY + 3, w: meterW }, frac, hpColor(frac));
  clipText(buf, {
    x: tx + meterW + 1,
    y: topY + 3,
    text: hpStr,
    color: DIM,
    maxCols: avail - meterW - 1,
  });
}

/** The floating impact tag (damage / "miss") for `side`, popped over its sprite. */
function drawFloatTag(
  ctx: RenderContext,
  view: BattleView,
  side: BattleSide,
  x: number,
  fxRow: number,
): void {
  const tag = floatTag(view, side);
  if (!tag) return;
  clipText(ctx.buf, {
    x,
    y: fxRow,
    text: tag.text,
    color: TONE[tag.tone],
    maxCols: 12,
    bold: true,
  });
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
    clipStr(b.text, ctx.layout.canvasCols - 4),
    TONE[b.tone],
    null,
  );
}
