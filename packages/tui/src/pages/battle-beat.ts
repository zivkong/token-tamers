/**
 * Battle playback "beat" clock + animation math (design: battle-playback-redesign.md).
 *
 * The arena no longer snaps one timeline event every few frames. Each event plays
 * as a phased BEAT — wind-up → impact → drain → settle — long enough to read, with
 * a held breath between turns. Everything here is a PURE function of the view's
 * `cursor` + `beatFrame` (no wall clock, no RNG), so frames stay golden-testable and
 * shared-code replays reproduce identically. The renderer (battle-arena.ts) reads
 * these helpers; the shell ticks {@link advanceBattlePlayback} once per frame.
 */

import type { BattleSide, Combatant } from '@token-tamers/core';
import type { BattleView } from './types';

/** Frames for a plain attack beat at 1× (~1s at 30fps) — ~5× slower than the old snap. */
const BEAT_BASE = 30;
/** Extra lead frames when an event opens a new turn — the breath between exchanges. */
const TURN_GAP = 10;
/** Speed cycle for the `s` key: normal → fast → slow → normal. 1× is the new default. */
const SPEEDS = [1, 2, 0.5];

/** Beat phase boundaries as a fraction of the beat (wind-up / impact / drain / settle). */
export const WINDUP_END = 0.25;
export const IMPACT_END = 0.42;
export const DRAIN_END = 0.82;

export function titleCase(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
function easeOut(x: number): number {
  const c = clamp(x, 0, 1);
  return 1 - (1 - c) * (1 - c);
}
function easeIn(x: number): number {
  const c = clamp(x, 0, 1);
  return c * c;
}

/** The event currently being animated (undefined once the fight is fully played). */
export function currentEvent(
  view: BattleView,
): BattleView['result']['timeline'][number] | undefined {
  return view.cursor < view.result.timeline.length ? view.result.timeline[view.cursor] : undefined;
}

/** A per-kind beat-length multiplier — crits/faints linger, dodges snap by. */
function kindMult(kind: string): number {
  if (kind === 'crit') return 1.5;
  if (kind === 'faint') return 1.6;
  if (kind === 'proc') return 1.3;
  if (kind === 'parry') return 1.1;
  if (kind === 'dodge') return 0.8;
  return 1;
}

/** Total frames the event at `i` occupies (kind length + a turn-break lead, ÷ speed). */
export function beatLen(view: BattleView, i: number): number {
  const tl = view.result.timeline;
  const e = tl[i];
  if (!e) return BEAT_BASE;
  const newTurn = i > 0 && tl[i - 1]!.turn !== e.turn;
  const frames = BEAT_BASE * kindMult(e.kind) + (newTurn ? TURN_GAP : 0);
  return Math.max(1, Math.round(frames / (view.speed ?? 1)));
}

/** Progress through the current beat, 0..1 (0 when the fight is over). */
export function beatT(view: BattleView): number {
  if (view.cursor >= view.result.timeline.length) return 0;
  return clamp((view.beatFrame ?? 0) / beatLen(view, view.cursor), 0, 1);
}

/**
 * Advance auto-playback one frame. Ticks `beatFrame`; when the current beat fills,
 * the event "lands" (cursor++) and the next beat starts. Called once per render frame.
 */
export function advanceBattlePlayback(view: BattleView): void {
  if (!view.playing) return;
  const tl = view.result.timeline;
  if (view.cursor >= tl.length) {
    view.playing = false;
    return;
  }
  const next = (view.beatFrame ?? 0) + 1;
  if (next >= beatLen(view, view.cursor)) {
    view.cursor++;
    view.beatFrame = 0;
    if (view.cursor >= tl.length) view.playing = false;
  } else {
    view.beatFrame = next;
  }
}

/** Defender HP for `side` after the events that have fully LANDED (cursor exclusive). */
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

/** Displayed HP for `side` — the settled HP, tweened toward the in-flight hit's result. */
export function animHp(view: BattleView, side: BattleSide): number {
  const settled = hpAt(view, side);
  const e = currentEvent(view);
  if (!e) return settled;
  const foe: BattleSide = side === 'a' ? 'b' : 'a';
  if (e.actor !== foe || e.damage <= 0) return settled;
  const drainT = clamp((beatT(view) - WINDUP_END) / (DRAIN_END - WINDUP_END), 0, 1);
  return Math.round(settled + (e.hpAfter - settled) * easeOut(drainT));
}

/** The attacking side this beat (for the spotlight), or null when the fight is over. */
export function attackerSide(view: BattleView): BattleSide | null {
  return currentEvent(view)?.actor ?? null;
}

/** Lunge magnitude (cells) toward the foe — grows to a peak at impact, then recedes. */
export function lungeMag(view: BattleView): number {
  const e = currentEvent(view);
  if (!e) return 0;
  const t = beatT(view);
  const peak = e.kind === 'crit' ? 3 : 2;
  if (t <= IMPACT_END) return peak * easeOut(t / IMPACT_END);
  return peak * (1 - easeIn((t - IMPACT_END) / (1 - IMPACT_END)));
}

/** Defender recoil magnitude (cells) away from the blow — a flinch, or a dodge side-step. */
export function flinchMag(view: BattleView): number {
  const e = currentEvent(view);
  if (!e) return 0;
  const t = beatT(view);
  if (e.kind === 'dodge') return t >= WINDUP_END && t <= DRAIN_END ? 2 : 0;
  if (e.damage <= 0) return 0;
  return t >= WINDUP_END && t <= DRAIN_END ? 1 : 0;
}

/** Whole-arena screen-shake offset (cells) — only crits and faints jolt the stage. */
export function shakeMag(view: BattleView): number {
  const e = currentEvent(view);
  if (!e || (e.kind !== 'crit' && e.kind !== 'faint')) return 0;
  if (beatT(view) > IMPACT_END) return 0;
  return (view.beatFrame ?? 0) % 2 === 0 ? 1 : -1;
}

/** Visual tone for a banner / floating tag — the renderer maps it to a colour. */
export type BattleTone = 'normal' | 'crit' | 'dodge' | 'parry' | 'proc' | 'faint';

/** The held action banner for the current beat (null once the fight is over). */
export function bannerFor(view: BattleView): { text: string; tone: BattleTone } | null {
  const e = currentEvent(view);
  if (!e) return null;
  const atk = e.actor === 'a' ? view.left.name : view.right.name;
  const def = e.actor === 'a' ? view.right.name : view.left.name;
  // Universal wind-up lead: every incoming strike anticipates before it lands, so
  // the start frame reads cleanly and the effect's tone is a reveal, not a spoiler.
  // (A faint is a consequence, not a strike — it has no wind-up.)
  if (e.kind !== 'faint' && beatT(view) < IMPACT_END) {
    return { text: `▶ ${atk} winds up…`, tone: 'normal' };
  }
  if (e.kind === 'crit')
    return { text: `✸ CRITICAL!  ${atk} crits ${def} for ${e.damage}`, tone: 'crit' };
  if (e.kind === 'dodge') return { text: `↯ ${def} slips ${atk}'s strike`, tone: 'dodge' };
  if (e.kind === 'parry')
    return { text: `⛊ ${def} parries — ${atk} hits for ${e.damage}`, tone: 'parry' };
  if (e.kind === 'proc')
    return {
      text: `⚡ ${titleCase(e.proc ?? '')}!  ${atk} hits ${def} for ${e.damage}`,
      tone: 'proc',
    };
  if (e.kind === 'faint') return { text: `✖ ${def} faints`, tone: 'faint' };
  return { text: `▶ ${atk} strikes ${def} for ${e.damage}`, tone: 'normal' };
}

/**
 * A floating impact tag (damage number / "miss") for the struck `side`, shown on the
 * free impact row below the fighters from impact onward, or null. The combatant block
 * is too tight to rise upward without hitting the HP bar, so the pop holds + fades in
 * place rather than climbing.
 */
export function floatTag(
  view: BattleView,
  side: BattleSide,
): { text: string; tone: BattleTone } | null {
  const e = currentEvent(view);
  if (!e) return null;
  const foe: BattleSide = side === 'a' ? 'b' : 'a';
  if (e.actor !== foe || beatT(view) < IMPACT_END) return null;
  if (e.kind === 'dodge') return { text: '↯ miss', tone: 'dodge' };
  if (e.damage <= 0) return null;
  const tone: BattleTone = e.kind === 'crit' ? 'crit' : e.kind === 'parry' ? 'parry' : 'normal';
  return { text: `-${e.damage}`, tone };
}

/** Cycle the playback speed (the `s` key); persists on the view for the session. */
export function cycleSpeed(view: BattleView): void {
  const i = SPEEDS.indexOf(view.speed ?? 1);
  view.speed = SPEEDS[(i + 1) % SPEEDS.length];
}

export function speedLabel(view: BattleView): string {
  return `${view.speed ?? 1}×`;
}

/** The 1-based round (turn) currently on screen, for the footer readout. */
export function currentRound(view: BattleView): number {
  const e = currentEvent(view);
  const tl = view.result.timeline;
  const last = tl.length ? tl[Math.min(view.cursor, tl.length - 1)!]! : undefined;
  return ((e ?? last)?.turn ?? 0) + 1;
}

/** Clip a string to `max` cells (never overflows the renderer's columns). */
export function clipStr(s: string, max: number): string {
  return [...s].slice(0, Math.max(0, max)).join('');
}

/** One transcript line for a battle event (the log tail + the `l` overlay share this). */
export function logLine(
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

/** "Tamer's Creature" for the win flourish (just the creature when there's no handle). */
export function ownerCreatureLine(c: Combatant, fbName: string): string {
  const handle = c.owner ?? fbName;
  return handle ? `${handle}'s ${c.name}` : c.name;
}

/** Whether the fight has fully played out (the winner flourish should show). */
export function battleDone(view: BattleView): boolean {
  return view.cursor >= view.result.timeline.length;
}

/**
 * This side's outcome for the win flourish: `none` until the fight is over, then
 * `win`/`lose`/`draw` from the result. Drives the winner glow vs. loser dim.
 */
export function battleOutcome(
  view: BattleView,
  side: BattleSide,
): 'none' | 'win' | 'lose' | 'draw' {
  if (!battleDone(view)) return 'none';
  const w = view.result.winner;
  if (w === 'draw') return 'draw';
  return w === side ? 'win' : 'lose';
}
