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
import { findSprite, houseTint } from '../helpers/lookup';
import { QMARK_TILE, LOCKED_PALETTE } from '../render/tiles';
import { flash, type FlashTarget } from '../shell-effects';
import {
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
const SEL_BG: Rgb = { r: 40, g: 46, b: 64 };
const VS_COLOR: Rgb = { r: 255, g: 224, b: 130 };

/** One battle-ready fighter the player can field: a combatant + whether it's the live pet. */
interface Fighter {
  c: Combatant;
  isLive: boolean;
}

/** Setup orchestration operates on the shell runtime + the flash banner. */
type SetupShell = BattleShell & FlashTarget;

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

/**
 * Draw the setup as a VS character-select (Street Fighter style): two big facing
 * portraits — YOU on the left, the OPPONENT on the right (sprite flipped to face
 * you), an unselected side showing the "?" tile — with each fighter's identity
 * below, the opponent paste field beneath its portrait, and the selectable rosters
 * along the bottom.
 */
export function drawSetup(ctx: RenderContext, bodyY: number): void {
  const { buf, layout, ui } = ctx;
  const host = hostOf(ctx);
  const focus = ui.focus ?? 'input';
  const x0 = layout.canvasX;
  const mid = Math.floor(layout.canvasCols / 2);
  const left = { x: x0 + 1, w: mid - 2 };
  const right = { x: x0 + mid + 1, w: layout.canvasCols - mid - 2 };
  const bottom = pageBodyBottom(layout);

  // Resolve both sides up front.
  const fighters = fighterCandidates(host);
  const fsel = clampSel(ui.fighterSel, fighters.length);
  const fighter = fighters[fsel]?.c ?? null;
  const mirror = fighter?.speciesId ?? '';
  const oppRes = resolveSetupOpponent(host, ui, mirror);
  const opp = 'opp' in oppRes ? oppRes.opp : null;
  const oppHint = 'error' in oppRes ? oppRes.error : undefined;

  // Side labels (the focused side glows).
  buf.textBold(left.x, bodyY, 'YOU', focus === 'fighter' ? READY : TEXT, null);
  const oppLbl = 'OPPONENT';
  const oppLblX = right.x + Math.max(0, right.w - oppLbl.length);
  buf.textBold(oppLblX, bodyY, oppLbl, focus === 'fighter' ? TEXT : READY, null);

  // Portrait band — the hero element; height adapts so it fits short docks.
  const portraitY = bodyY + 1;
  const reserved = 1 + 2 + 2 + 1 + 2; // labels + identity + paste + roster divider + min rows
  const portraitRows = Math.max(3, Math.min(9, bottom - bodyY - reserved));
  drawPortrait(ctx, fighter, { x: left.x, y: portraitY, w: left.w, rows: portraitRows }, false);
  drawPortrait(ctx, opp, { x: right.x, y: portraitY, w: right.w, rows: portraitRows }, true);
  drawVS(ctx, x0 + mid, portraitY + Math.floor(portraitRows / 2));

  // Identity (name/grade + house/stats) centered under each portrait.
  const idY = portraitY + portraitRows;
  drawIdentity(
    ctx,
    fighter,
    { x: left.x, y: idY, w: left.w },
    fighters.length ? undefined : 'No ready fighter',
  );
  drawIdentity(ctx, opp, { x: right.x, y: idY, w: right.w }, oppHint);

  // Paste field beneath the opponent portrait.
  const pasteY = idY + 2;
  drawPasteField(ctx, { x: right.x, y: pasteY, w: right.w }, focus === 'input', ui.input ?? '');

  // Rosters along the bottom: your candidates (left), eligible opponents (right).
  const rosterDivY = pasteY + 2;
  if (rosterDivY < bottom) {
    drawDivider(buf, rosterDivY, { x: left.x, width: left.w, label: 'your roster' });
    drawDivider(buf, rosterDivY, { x: right.x, width: right.w, label: 'opponents' });
    const rosterY = rosterDivY + 2;
    drawFighterList(ctx, { x: left.x, y: rosterY, w: left.w }, fighters, fsel, focus === 'fighter');
    drawDexList(ctx, { x: right.x, y: rosterY, w: right.w }, focus === 'list', mirror);
  }

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

/** Resolve a combatant's species def (by id, then content num) for sprite/accent. */
function speciesOf(ctx: RenderContext, c: Combatant) {
  return (
    ctx.pack.species.find((s) => s.id === c.speciesId) ??
    ctx.pack.species.find((s) => s.num === c.speciesNum)
  );
}

/**
 * Draw a big VS portrait centered in `box`. A real fighter renders its sprite
 * (scaled up, `flip` to face the centre); a null side renders the slate "?" tile.
 */
function drawPortrait(
  ctx: RenderContext,
  c: Combatant | null,
  box: { x: number; y: number; w: number; rows: number },
  flip: boolean,
): void {
  const { buf, mode, frame } = ctx;
  const species = c ? speciesOf(ctx, c) : undefined;
  const spr = c ? findSprite(ctx.pack, species?.spriteId ?? '') : undefined;
  const sprite = spr ?? QMARK_TILE;
  const palette =
    c && spr ? buildPalette(houseTint(c.house), c.grade, frame, species?.accent) : LOCKED_PALETTE;
  const destH = box.rows;
  const nativeRows = Math.max(1, subcellRows(sprite.height));
  const nativeCols = Math.max(1, subcellCols(sprite.width));
  const destW = Math.max(1, Math.min(box.w, Math.round((nativeCols * destH) / nativeRows)));
  const sx = box.x + Math.max(0, Math.floor((box.w - destW) / 2));
  drawSprite(buf, sprite, palette, {
    x: sx,
    y: box.y,
    destW,
    destH,
    frame,
    mode,
    flipX: c && spr ? flip : false,
    clip: { x: box.x, y: box.y, w: box.w, h: box.rows },
  });
}

/** Centered identity under a portrait: name + grade, then House + raw stats. */
function drawIdentity(
  ctx: RenderContext,
  c: Combatant | null,
  box: { x: number; y: number; w: number },
  hint: string | undefined,
): void {
  const { buf } = ctx;
  if (!c) {
    if (hint) centerText(buf, box, hint, DIM);
    return;
  }
  centerText(buf, box, `${c.name} ${GRADE_BADGE[c.grade]}`, GRADE_ACCENT[c.grade], true);
  const s = c.stats;
  const sub = `${titleCase(c.house)} · P${s.pwr} S${s.spd} W${s.wis} G${s.grt}`;
  centerText(buf, { x: box.x, w: box.w, y: box.y + 1 }, sub, DIM);
}

/** The gold "VS" splash between the two portraits. */
function drawVS(ctx: RenderContext, midX: number, y: number): void {
  ctx.buf.textBold(midX - 1, y, 'VS', VS_COLOR, null);
}

/** Draw `text` horizontally centered within the box rect (at `box.y`), clipped to width. */
function centerText(
  buf: RenderContext['buf'],
  box: { x: number; w: number; y: number },
  text: string,
  color: Rgb,
  bold = false,
): void {
  const chars = [...text];
  const t = chars.length > box.w ? chars.slice(0, box.w).join('') : text;
  const cx = box.x + Math.max(0, Math.floor((box.w - [...t].length) / 2));
  if (bold) buf.textBold(cx, box.y, t, color, null);
  else buf.text(cx, box.y, t, color, null);
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
