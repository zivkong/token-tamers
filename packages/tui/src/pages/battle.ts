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
  bestSpeciesRecords,
  BATTLE_READY_STAGE,
  combatantFromSnapshot,
  isBattleReady,
  sameSpecies,
  simulateBattle,
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

function titleCase(s: string): string {
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
    drawPicker(ctx, bodyY);
  }
}

/** The opponent picker: the player's live pet vs. a chosen Archive record. */
function drawPicker(ctx: RenderContext, bodyY: number): void {
  const { buf, layout, state, ui } = ctx;
  const x = layout.canvasX + 2;
  const records = bestSpeciesRecords(state.dexRecords);
  const petReady = isBattleReady(state.pet);

  buf.text(
    x,
    bodyY,
    petReady
      ? 'Choose an Archive record to battle your pet.'
      : `Your pet is sealed — battles unlock at ${titleCase(BATTLE_READY_STAGE)}.`,
    petReady ? TEXT : SEALED,
    null,
  );

  if (records.length === 0) {
    buf.text(x, bodyY + 2, 'No Archive records yet — raise and molt a pet first.', DIM, null);
    drawPageFooter(ctx, 'Esc back');
    return;
  }

  const top = bodyY + 2;
  const maxRows = Math.max(0, Math.min(records.length, pageBodyBottom(layout) - top));
  for (let i = 0; i < maxRows; i++) {
    drawPickerRow(ctx, records[i]!, i === ui.selected, top + i);
  }
  drawPageFooter(ctx, '↑↓ select  ·  Enter fight  ·  Esc back');
}

function drawPickerRow(ctx: RenderContext, snap: DexSnapshot, selected: boolean, y: number): void {
  const { buf, layout } = ctx;
  const x = layout.canvasX + 2;
  if (selected) {
    for (let i = 0; i < layout.canvasCols - 4; i++)
      buf.set(x + i, y, { ch: ' ', fg: null, bg: SEL_BG });
  }
  const bg = selected ? SEL_BG : null;
  const species = ctx.pack.species.find((s) => s.id === snap.speciesId);
  const name = species?.name ?? snap.speciesId;
  buf.text(x, y, `${GRADE_BADGE[snap.grade]} ${snap.grade}`, GRADE_ACCENT[snap.grade], bg);
  buf.text(x + 5, y, name.padEnd(14), TEXT, bg);
  const s = snap.stats;
  buf.text(x + 20, y, `P${s.pwr} S${s.spd} W${s.wis} G${s.grt}`, DIM, bg);
  // Eligibility: a same-species record is your own kind (mirror match) — not battleable.
  const [tag, color] = sameSpecies(ctx.state.pet, snap)
    ? (['⊘ your kind', SEALED] as const)
    : isBattleReady(snap)
      ? (['✦ ready', READY] as const)
      : (['▢ sealed', SEALED] as const);
  buf.text(x + 40, y, tag, color, bg);
}

/** The split-pane arena: two combatants + HP + a scrolling battle log. */
function drawArena(ctx: RenderContext, view: BattleView, bodyY: number): void {
  const { buf, layout } = ctx;
  const mid = Math.floor(layout.canvasCols / 2);
  const hpA = { cur: hpAt(view, 'a'), max: view.result.startHp.a };
  const hpB = { cur: hpAt(view, 'b'), max: view.result.startHp.b };
  drawCombatantColumn(ctx, view.left, hpA, layout.canvasX + 2, bodyY);
  drawCombatantColumn(ctx, view.right, hpB, layout.canvasX + mid + 1, bodyY);

  const logTop = bodyY + SPRITE_ROWS + 2;
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

function drawCombatantColumn(
  ctx: RenderContext,
  c: Combatant,
  hp: { cur: number; max: number },
  x: number,
  topY: number,
): void {
  const { buf, mode, frame } = ctx;
  const species =
    ctx.pack.species.find((s) => s.id === c.speciesId) ?? speciesByNum(ctx.pack, c.speciesNum);
  const spr = findSprite(ctx.pack, species?.spriteId ?? '');
  if (spr) {
    const scale = SPRITE_ROWS / Math.max(1, subcellRows(spr.height));
    drawSprite(buf, spr, buildPalette(houseTint(c.house), c.grade, frame, species?.accent), {
      x,
      y: topY,
      destW: Math.max(1, Math.round(subcellCols(spr.width) * scale)),
      destH: SPRITE_ROWS,
      frame,
      mode,
    });
  }
  const tx = x + 16;
  buf.textBold(tx, topY, `${c.name} ${GRADE_BADGE[c.grade]}`, GRADE_ACCENT[c.grade], null);
  buf.text(tx, topY + 1, '●', houseColor(c.house), null);
  buf.text(tx + 2, topY + 1, `${titleCase(c.house)} House`, TEXT, null);
  const frac = hp.max > 0 ? hp.cur / hp.max : 0;
  drawMeter(buf, { x: tx, y: topY + 3, w: 14 }, frac, hpColor(frac));
  buf.text(tx + 15, topY + 3, `HP ${hp.cur}/${hp.max}`, DIM, null);
}

function drawLog(ctx: RenderContext, view: BattleView, x: number, y: number): void {
  const { buf, layout } = ctx;
  const tl = view.result.timeline;
  const end = Math.min(view.cursor, tl.length);
  const rows = Math.max(1, pageBodyBottom(layout) - y);
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

/**
 * Build a BattleView for the player's live pet vs. the `index`-th Archive record,
 * or undefined when either side is below the Evolved readiness gate or there is
 * no such opponent. The simulation runs HERE, once. Shared by the Battle picker
 * (Enter) and the Archive page (the `b` shortcut).
 */
export function buildBattleVsRecord(host: BattleHost, index: number): BattleView | undefined {
  const state = host.getState();
  const snap = bestSpeciesRecords(state.dexRecords)[index];
  if (!snap || battleBlockReason(state.pet, snap)) return undefined;
  const left = playerCombatant(host.pack, state.pet);
  const right = opponentCombatant(host.pack, snap);
  const result = simulateBattle(left, right, host.pack.battle);
  return { left, right, result, cursor: 0, playing: true };
}

/**
 * Why battling the live pet against the SELF (Archive) record `snap` is blocked,
 * or null if it's allowed. Both sides must be Evolved, and a SELF mirror match
 * (same species) is forbidden — battle a different species, or a friend's pasted
 * code (a different player), instead.
 */
export function battleBlockReason(pet: PetState, snap: DexSnapshot): string | null {
  if (!isBattleReady(pet)) return 'Your pet is sealed — battles unlock at Evolved.';
  if (!isBattleReady(snap)) return 'That record is sealed — opponents must reach Evolved.';
  if (sameSpecies(pet, snap)) {
    return "Can't battle your own kind — pick a different species (or a friend's code).";
  }
  return null;
}

/** Advance auto-playback one step every {@link BATTLE_STEP_FRAMES} frames. */
export function advanceBattlePlayback(view: BattleView, frame: number): void {
  if (!view.playing || frame % BATTLE_STEP_FRAMES !== 0) return;
  if (view.cursor < view.result.timeline.length) view.cursor++;
  else view.playing = false;
}

/**
 * Handle a key on the Battle page. Returns true when consumed (so the shell skips
 * its generic handling). Picker: ↑↓ select, Enter fight. Arena: Enter play/pause/
 * replay, ←→ scrub, Esc back to the picker (then to the Archive page).
 */
export function handleBattleKey(rt: BattleShell, host: BattleHost, name: string): boolean {
  if (rt.page !== 'battle') return false;
  const view = rt.battle;
  switch (name) {
    case 'escape':
      if (view) rt.battle = undefined;
      else rt.page = 'archive';
      return true;
    case 'up':
      if (!view) moveBattleSelection(rt, host, -1);
      return true;
    case 'down':
      if (!view) moveBattleSelection(rt, host, +1);
      return true;
    case 'left':
      if (view) scrub(view, -1);
      return true;
    case 'right':
      if (view) scrub(view, +1);
      return true;
    case 'enter':
      if (view) togglePlay(view);
      else rt.battle = buildBattleVsRecord(host, rt.ui.battle.selected);
      return true;
    default:
      return false;
  }
}

function moveBattleSelection(rt: BattleShell, host: BattleHost, delta: number): void {
  const max = bestSpeciesRecords(host.getState().dexRecords).length - 1;
  const ui = rt.ui.battle;
  ui.selected = Math.max(0, Math.min(Math.max(0, max), ui.selected + delta));
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
