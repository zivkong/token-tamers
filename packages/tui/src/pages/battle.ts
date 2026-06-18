/**
 * Battle page (design §11): split-pane playback of a deterministic battle, plus
 * an opponent picker over the player's Archive records.
 *
 * The page is PURE: it renders `ctx.battle` (the loaded BattleView) up to its
 * `cursor`, or the picker when none is loaded. The simulation itself runs once,
 * in the shell, when a battle starts (see {@link buildBattleVsRecord}) — never at
 * render time — so frames are golden-testable and replays are reproducible.
 *
 * Battle reads only identity/stat fields (House, grade, stats, traits) of a
 * decoded snapshot; it never mutates the pet and never consults a model id, so
 * no model is ever "stronger" (invariants 1 & 3).
 */

import {
  combatantFromSnapshot,
  isBattleReady,
  sameSpecies,
  type BattleSide,
  type Combatant,
  type ContentPack,
  type DexSnapshot,
  type GameState,
  type PetState,
  type SpeciesDef,
} from '@token-tamers/core';
import type { Rgb } from '../terminal/ansi';
import {
  drawDivider,
  drawMeter,
  drawPageFooter,
  drawPageHeader,
  pageBodyBottom,
} from '../components';
import {
  buildPalette,
  drawSprite,
  subcellRows,
  subcellCols,
  GRADE_ACCENT,
  GRADE_BADGE,
} from '../render/sprite';
import { findSprite, houseColor, houseTint } from '../helpers/lookup';
import type { FlashTarget } from '../shell-effects';
import { drawSetup, handleSetupKey } from './battle-setup';
import type { BattleView, PageId, PageUiState, RenderContext } from './types';

const TEXT: Rgb = { r: 214, g: 220, b: 234 };
const DIM: Rgb = { r: 96, g: 100, b: 120 };
const READY: Rgb = { r: 74, g: 222, b: 128 };
const SEALED: Rgb = { r: 150, g: 152, b: 160 };
const SEL_BG: Rgb = { r: 40, g: 46, b: 64 };
const HP_GOOD: Rgb = { r: 74, g: 222, b: 128 };
const HP_WARN: Rgb = { r: 240, g: 200, b: 96 };
const HP_LOW: Rgb = { r: 232, g: 96, b: 96 };
const WIN: Rgb = { r: 255, g: 224, b: 130 };

/** Frames between playback steps (~5 events/sec at 30fps). */
export const BATTLE_STEP_FRAMES = 6;
const SPRITE_ROWS = 4;

export function titleCase(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function speciesByNum(pack: ContentPack, num: number): SpeciesDef | undefined {
  return pack.species.find((s) => s.num === num);
}

function hpColor(frac: number): Rgb {
  return frac > 0.5 ? HP_GOOD : frac > 0.25 ? HP_WARN : HP_LOW;
}

// ---------------------------------------------------------------------------
// Pure battle-state helpers (shared by the renderer and the shell orchestration)
// ---------------------------------------------------------------------------

/** A combatant for the player's live pet, resolved against the pack for name/num. */
export function playerCombatant(pack: ContentPack, pet: PetState): Combatant {
  const species = pack.species.find((s) => s.id === pet.speciesId);
  return {
    speciesNum: species?.num ?? 0,
    speciesId: pet.speciesId,
    name: species?.name ?? '???',
    house: pet.house,
    grade: pet.grade,
    stage: pet.stage,
    stats: { ...pet.stats },
    traits: [...pet.traits],
  };
}

/** A combatant for an Archive snapshot, resolved against the pack for name/num. */
export function opponentCombatant(pack: ContentPack, snap: DexSnapshot): Combatant {
  const species = pack.species.find((s) => s.id === snap.speciesId);
  return combatantFromSnapshot(snap, species?.num ?? 0, species?.name ?? '???');
}

/** Defender HP for `side` after the events applied so far (the playback head). */
export function hpAt(view: BattleView, side: BattleSide): number {
  const foe: BattleSide = side === 'a' ? 'b' : 'a';
  let hp = view.result.startHp[side];
  const tl = view.result.timeline;
  const end = Math.min(view.cursor, tl.length);
  for (let i = 0; i < end; i++) {
    if (tl[i]!.actor === foe) hp = tl[i]!.hpAfter;
  }
  return hp;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export function renderBattlePage(ctx: RenderContext): void {
  const bodyY = drawPageHeader(ctx, { icon: '⚔', title: 'Battle' });
  if (ctx.battle) {
    drawArena(ctx, ctx.battle, bodyY);
  } else {
    drawSetup(ctx, bodyY);
  }
}

/** One opponent row within the rect (x..x+w): grade, name, stats, eligibility tag. */
export function drawPickerRow(
  ctx: RenderContext,
  snap: DexSnapshot,
  selected: boolean,
  y: number,
  rect: { x: number; w: number },
): void {
  const { buf } = ctx;
  const { x, w } = rect;
  if (selected) {
    for (let i = 0; i < w; i++) buf.set(x + i, y, { ch: ' ', fg: null, bg: SEL_BG });
  }
  const bg = selected ? SEL_BG : null;
  const species = ctx.pack.species.find((s) => s.id === snap.speciesId);
  const name = species?.name ?? snap.speciesId;
  // Eligibility: a same-species record is your own kind (mirror match) — not battleable.
  const [tag, color] = sameSpecies(ctx.state.pet, snap)
    ? (['⊘ your kind', SEALED] as const)
    : isBattleReady(snap)
      ? (['✦ ready', READY] as const)
      : (['▢ sealed', SEALED] as const);
  // Lay the columns out so the eligibility tag is right-aligned and never clips.
  const tagX = x + Math.max(20, w - tag.length);
  buf.text(x, y, `${GRADE_BADGE[snap.grade]} ${snap.grade}`, GRADE_ACCENT[snap.grade], bg);
  if (w > 6) buf.text(x + 5, y, name.slice(0, Math.max(0, tagX - (x + 5) - 1)), TEXT, bg);
  if (tagX + tag.length <= x + w) buf.text(tagX, y, tag, color, bg);
}

/** A combatant column's bounds: left edge, top row, usable width in cells. */
interface ColumnRect {
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

/** The split-pane arena: two combatants + HP + a scrolling battle log. */
function drawArena(ctx: RenderContext, view: BattleView, bodyY: number): void {
  const { buf, layout } = ctx;
  const mid = Math.floor(layout.canvasCols / 2);
  const hpA = { cur: hpAt(view, 'a'), max: view.result.startHp.a };
  const hpB = { cur: hpAt(view, 'b'), max: view.result.startHp.b };
  // Two columns split at `mid`, each leaving a 1-col gutter (before mid, and
  // before the canvas/rail edge) so neither half ever bleeds into the other
  // column or the menu rail at narrow widths.
  const left: ColumnRect = { x: layout.canvasX + 2, topY: bodyY, w: mid - 2 - 1 };
  const right: ColumnRect = {
    x: layout.canvasX + mid + 1,
    topY: bodyY,
    w: layout.canvasCols - mid - 1 - 1,
  };
  drawCombatantColumn(ctx, view.left, hpA, left);
  drawCombatantColumn(ctx, view.right, hpB, right);

  // On a short dock, tighten the gap between the combatants and the Log so the
  // log shows enough lines to FOLLOW the fight (vs only 1-2). Roomy terminals
  // keep the airier spacing.
  const logGap = layout.canvasRows <= 20 ? 0 : 2;
  const logTop = bodyY + SPRITE_ROWS + logGap;
  drawDivider(buf, logTop, { x: layout.canvasX + 1, width: layout.canvasCols - 2, label: 'Log' });
  drawLog(ctx, view, layout.canvasX + 2, logTop + 2);

  const total = view.result.timeline.length;
  const done = view.cursor >= total;
  if (done) drawWinner(ctx, view, logTop + 1);
  const ctrl = done ? 'Enter replay' : view.playing ? 'Enter pause' : 'Enter play';
  drawPageFooter(
    ctx,
    `${ctrl}  ·  ←→ step  ·  Esc back  ·  [${Math.min(view.cursor, total)}/${total}]`,
  );
}

/** Sprite footprint reserved at the column's left (cells) — dropped when the
 *  column is too narrow to fit the sprite AND a legible text block beside it. */
const COMBATANT_SPRITE_COLS = 16;

function drawCombatantColumn(
  ctx: RenderContext,
  c: Combatant,
  hp: { cur: number; max: number },
  col: ColumnRect,
): void {
  const { buf, mode, frame } = ctx;
  if (col.w <= 0) return;
  const species =
    ctx.pack.species.find((s) => s.id === c.speciesId) ?? speciesByNum(ctx.pack, c.speciesNum);
  const spr = findSprite(ctx.pack, species?.spriteId ?? '');
  // Show the sprite only when the column can also hold a readable text block
  // beside it; otherwise drop it and run text full-width (clipped).
  // Show the sprite only when the text column ALSO fits a full HP readout
  // (avail >= 14: a 10-char "HP ddd/ddd" + the min meter + gap); otherwise drop
  // the sprite and run text full-width so the HP denominator never clips.
  const showSprite = spr && col.w >= COMBATANT_SPRITE_COLS + 14;
  if (spr && showSprite) {
    const scale = SPRITE_ROWS / Math.max(1, subcellRows(spr.height));
    drawSprite(buf, spr, buildPalette(houseTint(c.house), c.grade, frame, species?.accent), {
      x: col.x,
      y: col.topY,
      destW: Math.max(1, Math.round(subcellCols(spr.width) * scale)),
      destH: SPRITE_ROWS,
      frame,
      mode,
      clip: { x: col.x, y: col.topY, w: col.w, h: SPRITE_ROWS },
    });
  }
  const tx = col.x + (showSprite ? COMBATANT_SPRITE_COLS : 0);
  const avail = col.x + col.w - tx; // text budget, clipped to the column
  const namePart = `${c.name} ${GRADE_BADGE[c.grade]}`;
  clipText(buf, {
    x: tx,
    y: col.topY,
    text: namePart,
    color: GRADE_ACCENT[c.grade],
    maxCols: avail,
    bold: true,
  });
  clipText(buf, { x: tx, y: col.topY + 1, text: '●', color: houseColor(c.house), maxCols: avail });
  clipText(buf, {
    x: tx + 2,
    y: col.topY + 1,
    text: `${titleCase(c.house)} House`,
    color: TEXT,
    maxCols: avail - 2,
  });
  // Meter + inline HP must fit `avail`; shrink the meter so the HP readout never
  // spills past the column (into the other combatant or the menu rail).
  const frac = hp.max > 0 ? hp.cur / hp.max : 0;
  const hpStr = `HP ${hp.cur}/${hp.max}`;
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

function drawLog(ctx: RenderContext, view: BattleView, x: number, y: number): void {
  const { buf, layout } = ctx;
  const tl = view.result.timeline;
  const end = Math.min(view.cursor, tl.length);
  // No forced minimum: when the log start is already at/below the body bottom
  // (a very short dock) draw nothing rather than spilling a line over the footer.
  const rows = Math.max(0, pageBodyBottom(layout) - y);
  const start = Math.max(0, end - rows);
  for (let i = start; i < end; i++) {
    buf.text(x, y + (i - start), logLine(view, tl[i]!), TEXT, null);
  }
}

function logLine(
  view: BattleView,
  e: { actor: BattleSide; kind: string; damage: number; proc?: string },
): string {
  const atk = e.actor === 'a' ? view.left.name : view.right.name;
  const def = e.actor === 'a' ? view.right.name : view.left.name;
  if (e.kind === 'faint') return `✖ ${def} faints`;
  if (e.kind === 'proc')
    return `⚔ ${atk} — ${titleCase(e.proc ?? '')}! hits ${def} for ${e.damage}`;
  return `⚔ ${atk} hits ${def} for ${e.damage}`;
}

function drawWinner(ctx: RenderContext, view: BattleView, y: number): void {
  // Never draw the banner on/below the footer row (a tiny dock would otherwise
  // collide it with the footer text).
  if (y >= pageBodyBottom(ctx.layout)) return;
  const w = view.result.winner;
  const text = w === 'draw' ? '⚖ Draw' : `★ ${(w === 'a' ? view.left : view.right).name} wins!`;
  ctx.buf.textBold(ctx.layout.canvasX + 2, y, text, WIN, null);
}

// ---------------------------------------------------------------------------
// Shell orchestration (kept here so shell.ts stays lean; operates structurally
// on the shell runtime's battle/page/ui fields)
// ---------------------------------------------------------------------------

/** The slice of the shell runtime the battle controls read/mutate. */
export interface BattleShell {
  page: PageId;
  battle?: BattleView;
  ui: Record<PageId, PageUiState>;
}

/** The slice of the shell host the battle controls read. */
export interface BattleHost {
  pack: ContentPack;
  getState(): GameState;
}

/** Advance auto-playback one step every {@link BATTLE_STEP_FRAMES} frames. */
export function advanceBattlePlayback(view: BattleView, frame: number): void {
  if (!view.playing || frame % BATTLE_STEP_FRAMES !== 0) return;
  if (view.cursor < view.result.timeline.length) view.cursor++;
  else view.playing = false;
}

/**
 * Handle a key on the Battle page. Returns true when consumed (so the shell skips
 * its generic handling). When a battle is loaded this is the ARENA (Enter play/
 * pause/replay, ←→ scrub, Esc back to setup); otherwise the SETUP screen owns the
 * key (paste-field typing, Tab, Dex selection, Enter fight — see `battle-setup.ts`).
 */
export function handleBattleKey(
  rt: BattleShell & FlashTarget,
  host: BattleHost,
  name: string,
): boolean {
  if (rt.page !== 'battle') return false;
  const view = rt.battle;
  if (!view) return handleSetupKey(rt, host, name);
  switch (name) {
    case 'escape':
      rt.battle = undefined;
      return true;
    case 'up':
    case 'down':
      return true; // consumed (no selection in the arena)
    case 'left':
      scrub(view, -1);
      return true;
    case 'right':
      scrub(view, +1);
      return true;
    case 'enter':
      togglePlay(view);
      return true;
    default:
      return false;
  }
}

function scrub(view: BattleView, delta: number): void {
  view.playing = false;
  view.cursor = Math.max(0, Math.min(view.result.timeline.length, view.cursor + delta));
}

function togglePlay(view: BattleView): void {
  if (view.cursor >= view.result.timeline.length) {
    view.cursor = 0;
    view.playing = true;
  } else {
    view.playing = !view.playing;
  }
}
