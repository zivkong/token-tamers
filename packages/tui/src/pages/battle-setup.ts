/**
 * Battle SETUP (the pre-fight screen). The Battle page shows this whenever no
 * battle is loaded: the player's live pet on the left, and an OPPONENT chosen on
 * the right either by pasting a friend's DNA code OR by picking one of the
 * player's own Dex records.
 *
 * Two opponent sources, two self-mirror rules (design §11):
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

/** Sprite footprint reserved at a fighter card's left, and the card's height. */
const CARD_SPRITE_COLS = 16;
const CARD_ROWS = 4;

/** Setup orchestration operates on the shell runtime + the flash banner. */
type SetupShell = BattleShell & FlashTarget;

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

/** Draw the setup screen: live pet (left) vs. a chosen opponent (right). */
export function drawSetup(ctx: RenderContext, bodyY: number): void {
  const { buf, layout, state } = ctx;
  const mid = Math.floor(layout.canvasCols / 2);
  const leftX = layout.canvasX + 2;
  const leftW = mid - 2 - 1;
  const rightX = layout.canvasX + mid + 1;
  const rightW = layout.canvasCols - mid - 1 - 1;

  const petReady = isBattleReady(state.pet);
  buf.text(leftX, bodyY, 'Your fighter', petReady ? READY : SEALED, null);
  if (petReady) {
    drawFighter(ctx, playerCombatant(ctx.pack, state.pet), { x: leftX, y: bodyY + 1, w: leftW });
  } else {
    buf.text(leftX, bodyY + 2, 'Sealed — battles unlock', SEALED, null);
    buf.text(leftX, bodyY + 3, 'once your pet is Evolved.', SEALED, null);
  }

  drawOpponentPane(ctx, { x: rightX, y: bodyY, w: rightW });
  drawPageFooter(ctx, 'Tab switch  ·  paste a code / ↑↓ pick  ·  Enter fight  ·  Esc back');
}

/** The opponent half: a paste field + live preview, then the "pick from Dex" list. */
function drawOpponentPane(ctx: RenderContext, col: { x: number; y: number; w: number }): void {
  const { buf, ui } = ctx;
  const onInput = (ui.focus ?? 'input') === 'input';
  buf.text(col.x, col.y, 'Opponent', TEXT, null);

  drawPasteField(ctx, { x: col.x, y: col.y + 1, w: col.w }, onInput, ui.input ?? '');
  drawOpponentPreview(ctx, { x: col.x, y: col.y + 4, w: col.w });

  const listTop = col.y + 8;
  if (listTop < pageBodyBottom(ctx.layout)) {
    drawDivider(buf, listTop, { x: col.x, width: col.w, label: 'or pick from your Dex' });
    drawDexList(ctx, { x: col.x, y: listTop + 2, w: col.w }, !onInput);
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
function drawOpponentPreview(ctx: RenderContext, box: { x: number; y: number; w: number }): void {
  const { buf } = ctx;
  const res = resolveSetupOpponent({ pack: ctx.pack, getState: () => ctx.state }, ctx.ui);
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

/** The player's Dex records as selectable opponent rows (own kind = blocked). */
function drawDexList(
  ctx: RenderContext,
  box: { x: number; y: number; w: number },
  listFocused: boolean,
): void {
  const { buf, layout, state, ui } = ctx;
  const records = bestSpeciesRecords(state.dexRecords);
  if (records.length === 0) {
    buf.text(box.x, box.y, 'No Dex records yet — raise and molt a pet.', DIM, null);
    return;
  }
  const maxRows = Math.max(0, Math.min(records.length, pageBodyBottom(layout) - box.y));
  for (let i = 0; i < maxRows; i++) {
    const ry = box.y + i;
    drawPickerRow(ctx, records[i]!, listFocused && i === (ui.selected ?? 0), ry, {
      x: box.x,
      w: box.w,
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
  const showSprite = spr && col.w >= CARD_SPRITE_COLS + 14;
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

/** Resolve the configured opponent, or an error message explaining why it can't fight. */
export function resolveSetupOpponent(
  host: BattleHost,
  ui: PageUiState,
): { opp: Combatant; warn?: string } | { error: string } {
  const state = host.getState();
  if ((ui.focus ?? 'input') === 'list') {
    const snap = bestSpeciesRecords(state.dexRecords)[ui.selected ?? 0];
    if (!snap) return { error: 'No Dex record to battle yet.' };
    if (sameSpecies(state.pet, snap)) {
      return { error: "Can't battle your own kind — pick a different species or paste a code." };
    }
    if (!isBattleReady(snap))
      return { error: 'That record is sealed — opponents must reach Evolved.' };
    return { opp: opponentCombatant(host.pack, snap) };
  }
  const code = (ui.input ?? '').trim();
  if (!code) return { error: 'Paste a DNA code, or press Tab to pick from your Dex.' };
  const decoded = decodeDna(code);
  if (!isBattleReady(decoded))
    return { error: 'That code is sealed — its pet is not yet Evolved.' };
  const name = host.pack.species.find((s) => s.num === decoded.speciesNum)?.name ?? '???';
  const opp = combatantFromDecoded(decoded, name);
  return decoded.sigValid
    ? { opp }
    : { opp, warn: 'Integrity check failed — using recovered fields.' };
}

/** Confirm the matchup: simulate ONCE and load it for playback, or flash the reason. */
export function confirmBattle(rt: SetupShell, host: BattleHost): void {
  const pet = host.getState().pet;
  if (!isBattleReady(pet)) {
    flash(rt, 'Your pet is sealed — battles unlock once it reaches Evolved.');
    return;
  }
  const res = resolveSetupOpponent(host, rt.ui.battle);
  if ('error' in res) {
    flash(rt, res.error);
    return;
  }
  if (res.warn) flash(rt, res.warn);
  const left = playerCombatant(host.pack, pet);
  const result = simulateBattle(left, res.opp, host.pack.battle);
  rt.battle = { left, right: res.opp, result, cursor: 0, playing: true };
}

/** Handle a key while the setup screen is showing (no battle loaded). */
export function handleSetupKey(rt: SetupShell, host: BattleHost, name: string): boolean {
  const ui = rt.ui.battle;
  switch (name) {
    case 'escape':
      rt.page = 'pet';
      return true;
    case 'tab':
      ui.focus = (ui.focus ?? 'input') === 'input' ? 'list' : 'input';
      return true;
    case 'enter':
      confirmBattle(rt, host);
      return true;
    case 'up':
      if (ui.focus === 'list') moveListSelection(rt, host, -1);
      return true;
    case 'down':
      if (ui.focus === 'list') moveListSelection(rt, host, +1);
      return true;
    case 'backspace':
      if ((ui.focus ?? 'input') === 'input') ui.input = (ui.input ?? '').slice(0, -1);
      return true;
    default:
      // A single printable char extends the paste field (a paste is a run of these).
      if ((ui.focus ?? 'input') === 'input' && isPrintable(name)) {
        ui.input = (ui.input ?? '') + name;
        return true;
      }
      return false;
  }
}

/** Move the Dex-list selection, clamped to the record count. */
export function moveListSelection(rt: SetupShell, host: BattleHost, delta: number): void {
  const max = bestSpeciesRecords(host.getState().dexRecords).length - 1;
  const ui = rt.ui.battle;
  ui.selected = Math.max(0, Math.min(Math.max(0, max), (ui.selected ?? 0) + delta));
}

/** True for a single non-control printable character (the key name IS the char). */
function isPrintable(name: string): boolean {
  return name.length === 1 && name >= ' ' && name !== '\x7f';
}
