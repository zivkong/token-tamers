/**
 * Battle SETUP (the pre-fight screen). The Battle page shows this whenever no
 * battle is loaded. The player picks a FIGHTER on the left — the live pet (if
 * Evolved) or any battle-ready Dex record — and an OPPONENT on the right, either
 * by pasting a friend's DNA code OR by picking one of their own Dex records. So a
 * sealed live pet never blocks battling when a retired pet is battle-ready.
 *
 * Two opponent sources, two self-mirror rules (design §11), judged against the
 * CHOSEN fighter's species:
 *  - A pasted code is ANOTHER player: it decodes to a foreign combatant
 *    (`speciesId: ''`), so a same-species match is allowed.
 *  - A Dex record is the player's OWN: a same-species pick is a self-mirror and
 *    is blocked; pick a different species instead.
 *
 * The simulation runs ONCE here (on confirm) and is then played back by the
 * arena renderer in `battle.ts` — never re-simulated at render time. Decoding a
 * pasted code for the live PREVIEW is pure/deterministic, so frames stay
 * golden-testable.
 */

import {
  bestSpeciesRecords,
  combatantFromDecoded,
  decodeDna,
  isBattleReady,
  sameSpecies,
  simulateBattle,
  type Combatant,
  type DexSnapshot,
} from '@token-tamers/core';
import type { Rgb } from '../terminal/ansi';
import { drawDivider, drawPageFooter, pageBodyBottom } from '../components';
import {
  buildPalette,
  drawSprite,
  subcellRows,
  subcellCols,
  GRADE_ACCENT,
  GRADE_BADGE,
} from '../render/sprite';
import { findSprite, houseColor, houseTint } from '../helpers/lookup';
import { flash, type FlashTarget } from '../shell-effects';
import {
  clipText,
  drawPickerRow,
  opponentCombatant,
  playerCombatant,
  titleCase,
  type BattleHost,
  type BattleShell,
} from './battle';
import type { PageUiState, RenderContext } from './types';

const TEXT: Rgb = { r: 214, g: 220, b: 234 };
const DIM: Rgb = { r: 96, g: 100, b: 120 };
const READY: Rgb = { r: 74, g: 222, b: 128 };
const SEALED: Rgb = { r: 150, g: 152, b: 160 };
const WARN: Rgb = { r: 240, g: 200, b: 96 };
const SEL_BG: Rgb = { r: 40, g: 46, b: 64 };

/** One battle-ready fighter the player can field: a combatant + whether it's the live pet. */
interface Fighter {
  c: Combatant;
  isLive: boolean;
}

/** Sprite footprint reserved at a fighter card's left, and the card's height. The
 *  reserve is small (and the show-threshold low) so the highlighted fighter and the
 *  opponent still show a sprite in the narrow half-width columns of a small terminal. */
const CARD_SPRITE_COLS = 11;
const CARD_ROWS = 4;
/** Show the card sprite once the column can also hold a few cells of identity text. */
const CARD_SPRITE_MIN_W = CARD_SPRITE_COLS + 6;

/** Setup orchestration operates on the shell runtime + the flash banner. */
type SetupShell = BattleShell & FlashTarget;

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

/** Draw the setup screen: your chosen fighter (left) vs. a chosen opponent (right). */
export function drawSetup(ctx: RenderContext, bodyY: number): void {
  const { layout } = ctx;
  const mid = Math.floor(layout.canvasCols / 2);
  const leftX = layout.canvasX + 2;
  const leftW = mid - 2 - 1;
  const rightX = layout.canvasX + mid + 1;
  const rightW = layout.canvasCols - mid - 1 - 1;

  const fighters = fighterCandidates(hostOf(ctx));
  drawFighterPane(ctx, { x: leftX, y: bodyY, w: leftW }, fighters);

  const fighter = fighters[clampSel(ctx.ui.fighterSel, fighters.length)];
  drawOpponentPane(ctx, { x: rightX, y: bodyY, w: rightW }, fighter?.c.speciesId ?? '');
  drawPageFooter(ctx, 'Tab zone  ·  ↑↓ pick / paste a code  ·  Enter fight  ·  Esc back');
}

/** A BattleHost view over the render context (pack + a snapshot of state). */
function hostOf(ctx: RenderContext): BattleHost {
  return { pack: ctx.pack, getState: () => ctx.state };
}

/** Your battle-ready fighters: the live pet (if Evolved) then each battle-ready Dex record. */
export function fighterCandidates(host: BattleHost): Fighter[] {
  const state = host.getState();
  const out: Fighter[] = [];
  if (isBattleReady(state.pet)) {
    out.push({ c: playerCombatant(host.pack, state.pet), isLive: true });
  }
  for (const snap of bestSpeciesRecords(state.dexRecords)) {
    if (isBattleReady(snap)) out.push({ c: opponentCombatant(host.pack, snap), isLive: false });
  }
  return out;
}

/** Clamp a (possibly undefined) selection index into `[0, len)`. */
function clampSel(sel: number | undefined, len: number): number {
  return Math.max(0, Math.min(Math.max(0, len - 1), sel ?? 0));
}

/**
 * The Dex records you can field as an OPPONENT against a fighter of `mirrorSpeciesId`:
 * battle-ready only (sealed records hidden), and never the fighter's own species (a
 * same-species own-vs-own match is a self-mirror — forbidden — so it's deduped out).
 */
export function opponentRecords(host: BattleHost, mirrorSpeciesId: string): DexSnapshot[] {
  return bestSpeciesRecords(host.getState().dexRecords).filter(
    (s) => isBattleReady(s) && !sameSpecies({ speciesId: mirrorSpeciesId }, s),
  );
}

/** The species id of the currently-selected fighter (or '' when there is none). */
function currentFighterSpecies(host: BattleHost, ui: PageUiState): string {
  const fighters = fighterCandidates(host);
  return fighters[clampSel(ui.fighterSel, fighters.length)]?.c.speciesId ?? '';
}

/** The left half: a preview of the chosen fighter + a selectable candidate list. */
function drawFighterPane(
  ctx: RenderContext,
  col: { x: number; y: number; w: number },
  fighters: Fighter[],
): void {
  const { buf, ui } = ctx;
  const focused = (ui.focus ?? 'input') === 'fighter';
  buf.text(col.x, col.y, 'Your fighter', focused ? READY : TEXT, null);
  if (fighters.length === 0) {
    buf.text(col.x, col.y + 2, 'No battle-ready fighter yet —', SEALED, null);
    buf.text(col.x, col.y + 3, 'raise a pet to Evolved.', SEALED, null);
    return;
  }
  const sel = clampSel(ui.fighterSel, fighters.length);
  drawFighter(ctx, fighters[sel]!.c, { x: col.x, y: col.y + 1, w: col.w });

  const listTop = col.y + 8;
  if (fighters.length > 1 && listTop < pageBodyBottom(ctx.layout)) {
    drawDivider(buf, listTop, { x: col.x, width: col.w, label: 'choose your fighter' });
    drawFighterList(ctx, { x: col.x, y: listTop + 2, w: col.w }, fighters, sel, focused);
  }
}

/** The fighter candidate rows: grade, name, and a "you" tag for the live pet. */
function drawFighterList(
  ctx: RenderContext,
  box: { x: number; y: number; w: number },
  fighters: Fighter[],
  sel: number,
  focused: boolean,
): void {
  const { buf, layout } = ctx;
  const maxRows = Math.max(0, Math.min(fighters.length, pageBodyBottom(layout) - box.y));
  for (let i = 0; i < maxRows; i++) {
    const ry = box.y + i;
    const { c, isLive } = fighters[i]!;
    const on = focused && i === sel;
    if (on)
      for (let k = 0; k < box.w; k++) buf.set(box.x + k, ry, { ch: ' ', fg: null, bg: SEL_BG });
    const bg = on ? SEL_BG : null;
    const tag = isLive ? '· you' : '';
    const tagX = box.x + Math.max(18, box.w - tag.length);
    buf.text(box.x, ry, `${GRADE_BADGE[c.grade]} ${c.grade}`, GRADE_ACCENT[c.grade], bg);
    if (box.w > 6) {
      buf.text(box.x + 5, ry, c.name.slice(0, Math.max(0, tagX - (box.x + 5) - 1)), TEXT, bg);
    }
    if (tag && tagX + tag.length <= box.x + box.w) buf.text(tagX, ry, tag, DIM, bg);
    ctx.hits.add(`battle:fighter:${i}`, box.x, ry, Math.max(1, box.w), 1);
  }
}

/** The opponent half: a paste field + live preview, then the "pick from Dex" list. */
function drawOpponentPane(
  ctx: RenderContext,
  col: { x: number; y: number; w: number },
  mirrorSpeciesId: string,
): void {
  const { buf, ui } = ctx;
  const onInput = (ui.focus ?? 'input') === 'input';
  buf.text(col.x, col.y, 'Opponent', TEXT, null);

  drawPasteField(ctx, { x: col.x, y: col.y + 1, w: col.w }, onInput, ui.input ?? '');
  drawOpponentPreview(ctx, { x: col.x, y: col.y + 4, w: col.w }, mirrorSpeciesId);

  const listTop = col.y + 8;
  if (listTop < pageBodyBottom(ctx.layout)) {
    drawDivider(buf, listTop, { x: col.x, width: col.w, label: 'or pick from your Dex' });
    drawDexList(ctx, { x: col.x, y: listTop + 2, w: col.w }, ui.focus === 'list', mirrorSpeciesId);
  }
}

/** The bracketed text field showing the pasted code (tail-clipped) + a caret. */
function drawPasteField(
  ctx: RenderContext,
  box: { x: number; y: number; w: number },
  focused: boolean,
  value: string,
): void {
  const { buf } = ctx;
  buf.text(box.x, box.y, "Paste a friend's DNA code:", focused ? TEXT : DIM, null);
  const innerW = Math.max(4, box.w - 2);
  const border = focused ? READY : DIM;
  const caret = focused ? '_' : '';
  const raw = value ? value + caret : focused ? caret : 'TTX…';
  const vis = raw.length > innerW ? raw.slice(raw.length - innerW) : raw;
  buf.text(box.x, box.y + 1, '[', border, null);
  buf.text(box.x + 1, box.y + 1, vis.padEnd(innerW).slice(0, innerW), value ? TEXT : DIM, null);
  buf.text(box.x + 1 + innerW, box.y + 1, ']', border, null);
  // Click the field to focus it (mouse parity with Tab).
  ctx.hits.add('battle:input', box.x, box.y, Math.max(1, box.w), 2);
}

/** Preview whichever opponent is active (pasted code or selected Dex record). */
function drawOpponentPreview(
  ctx: RenderContext,
  box: { x: number; y: number; w: number },
  mirrorSpeciesId: string,
): void {
  const { buf } = ctx;
  const res = resolveSetupOpponent(hostOf(ctx), ctx.ui, mirrorSpeciesId);
  if ('error' in res) {
    clipText(buf, { x: box.x, y: box.y, text: res.error, color: DIM, maxCols: box.w });
    return;
  }
  drawFighter(ctx, res.opp, box);
  if (res.warn) {
    clipText(buf, {
      x: box.x,
      y: box.y + CARD_ROWS - 1,
      text: `! ${res.warn}`,
      color: WARN,
      maxCols: box.w,
    });
  }
}

/**
 * Your eligible Dex opponents as selectable rows. Only battle-ready records of a
 * DIFFERENT species than your fighter appear (sealed records and your own kind are
 * filtered out — see {@link opponentRecords}), so every row is a valid match.
 */
function drawDexList(
  ctx: RenderContext,
  box: { x: number; y: number; w: number },
  listFocused: boolean,
  mirrorSpeciesId: string,
): void {
  const { buf, layout, ui } = ctx;
  const records = opponentRecords(hostOf(ctx), mirrorSpeciesId);
  if (records.length === 0) {
    buf.text(box.x, box.y, 'No eligible Dex opponent — paste a code.', DIM, null);
    return;
  }
  const sel = clampSel(ui.selected, records.length);
  const maxRows = Math.max(0, Math.min(records.length, pageBodyBottom(layout) - box.y));
  for (let i = 0; i < maxRows; i++) {
    const ry = box.y + i;
    drawPickerRow(ctx, records[i]!, listFocused && i === sel, ry, {
      x: box.x,
      w: box.w,
      mirrorSpeciesId,
    });
    ctx.hits.add(`battle:pick:${i}`, box.x, ry, Math.max(1, box.w), 1);
  }
}

/** A compact fighter card: optional sprite + name/grade, House, and raw stats. */
function drawFighter(
  ctx: RenderContext,
  c: Combatant,
  col: { x: number; y: number; w: number },
): void {
  const { buf, mode, frame, pack } = ctx;
  if (col.w <= 0) return;
  const species =
    pack.species.find((s) => s.id === c.speciesId) ??
    pack.species.find((s) => s.num === c.speciesNum);
  const spr = findSprite(pack, species?.spriteId ?? '');
  const showSprite = spr && col.w >= CARD_SPRITE_MIN_W;
  if (spr && showSprite) {
    const scale = CARD_ROWS / Math.max(1, subcellRows(spr.height));
    drawSprite(buf, spr, buildPalette(houseTint(c.house), c.grade, frame, species?.accent), {
      x: col.x,
      y: col.y,
      destW: Math.max(1, Math.round(subcellCols(spr.width) * scale)),
      destH: CARD_ROWS,
      frame,
      mode,
      clip: { x: col.x, y: col.y, w: col.w, h: CARD_ROWS },
    });
  }
  const tx = col.x + (showSprite ? CARD_SPRITE_COLS : 0);
  const avail = col.x + col.w - tx;
  clipText(buf, {
    x: tx,
    y: col.y,
    text: `${c.name} ${GRADE_BADGE[c.grade]}`,
    color: GRADE_ACCENT[c.grade],
    maxCols: avail,
    bold: true,
  });
  clipText(buf, { x: tx, y: col.y + 1, text: '●', color: houseColor(c.house), maxCols: avail });
  clipText(buf, {
    x: tx + 2,
    y: col.y + 1,
    text: `${titleCase(c.house)} House`,
    color: TEXT,
    maxCols: avail - 2,
  });
  const s = c.stats;
  clipText(buf, {
    x: tx,
    y: col.y + 2,
    text: `P${s.pwr} S${s.spd} W${s.wis} G${s.grt}`,
    color: DIM,
    maxCols: avail,
  });
}

// ---------------------------------------------------------------------------
// Orchestration (shared by the keyboard handler and mouse clicks)
// ---------------------------------------------------------------------------

/**
 * Resolve the configured opponent against the chosen fighter's species, or an error
 * explaining why it can't fight. The opponent is the PASTED code when the field holds
 * one (a foreign player — a same-species mirror is allowed), otherwise the selected
 * Dex record. The Dex options are already filtered to battle-ready, different-species
 * records (see {@link opponentRecords}), so a self-mirror can't be selected at all.
 */
export function resolveSetupOpponent(
  host: BattleHost,
  ui: PageUiState,
  mirrorSpeciesId: string,
): { opp: Combatant; warn?: string } | { error: string } {
  const code = (ui.input ?? '').trim();
  if (code) {
    const decoded = decodeDna(code);
    if (!isBattleReady(decoded))
      return { error: 'That code is sealed — its pet is not yet Evolved.' };
    const name = host.pack.species.find((s) => s.num === decoded.speciesNum)?.name ?? '???';
    const opp = combatantFromDecoded(decoded, name);
    return decoded.sigValid
      ? { opp }
      : { opp, warn: 'Integrity check failed — using recovered fields.' };
  }
  const records = opponentRecords(host, mirrorSpeciesId);
  const snap = records[clampSel(ui.selected, records.length)];
  if (!snap) {
    return { error: "No eligible Dex opponent — paste a friend's code, or raise another species." };
  }
  return { opp: opponentCombatant(host.pack, snap) };
}

/** Confirm the matchup: simulate ONCE and load it for playback, or flash the reason. */
export function confirmBattle(rt: SetupShell, host: BattleHost): void {
  const fighters = fighterCandidates(host);
  const fighter = fighters[clampSel(rt.ui.battle.fighterSel, fighters.length)]?.c;
  if (!fighter) {
    flash(rt, 'No battle-ready fighter — raise your pet (or a Dex pet) to Evolved.');
    return;
  }
  const res = resolveSetupOpponent(host, rt.ui.battle, fighter.speciesId);
  if ('error' in res) {
    flash(rt, res.error);
    return;
  }
  if (res.warn) flash(rt, res.warn);
  const result = simulateBattle(fighter, res.opp, host.pack.battle);
  rt.battle = { left: fighter, right: res.opp, result, cursor: 0, playing: true };
}

/** Tab order across the three setup zones. */
const FOCUS_ORDER = ['fighter', 'input', 'list'] as const;
type Focus = (typeof FOCUS_ORDER)[number];

/** Handle a key while the setup screen is showing (no battle loaded). */
export function handleSetupKey(rt: SetupShell, host: BattleHost, name: string): boolean {
  const ui = rt.ui.battle;
  const focus = (ui.focus ?? 'input') as Focus;
  switch (name) {
    case 'escape':
      rt.page = 'pet';
      return true;
    case 'tab':
      ui.focus = FOCUS_ORDER[(FOCUS_ORDER.indexOf(focus) + 1) % FOCUS_ORDER.length];
      return true;
    case 'enter':
      confirmBattle(rt, host);
      return true;
    case 'up':
      moveSetupSelection(rt, host, focus, -1);
      return true;
    case 'down':
      moveSetupSelection(rt, host, focus, +1);
      return true;
    case 'backspace':
      if (focus === 'input') ui.input = (ui.input ?? '').slice(0, -1);
      return true;
    default:
      // A single printable char extends the paste field (a paste is a run of these).
      if (focus === 'input' && isPrintable(name)) {
        ui.input = (ui.input ?? '') + name;
        return true;
      }
      return false;
  }
}

/** ↑↓ within the focused list (fighter candidates or Dex opponents); no-op on the field. */
function moveSetupSelection(rt: SetupShell, host: BattleHost, focus: Focus, delta: number): void {
  const ui = rt.ui.battle;
  if (focus === 'fighter') {
    const max = fighterCandidates(host).length - 1;
    ui.fighterSel = Math.max(0, Math.min(Math.max(0, max), (ui.fighterSel ?? 0) + delta));
  } else if (focus === 'list') {
    // Bound to the FILTERED opponent list (battle-ready, different-species records).
    const max = opponentRecords(host, currentFighterSpecies(host, ui)).length - 1;
    ui.selected = Math.max(0, Math.min(Math.max(0, max), (ui.selected ?? 0) + delta));
  }
}

/** True for a single non-control printable character (the key name IS the char). */
function isPrintable(name: string): boolean {
  return name.length === 1 && name >= ' ' && name !== '\x7f';
}
