/**
 * Battle page (design §11 + battle-playback-redesign.md): the opponent picker and
 * the animated arena playback of a deterministic battle.
 *
 * The page is PURE: it renders `ctx.battle` (the loaded BattleView) up to its beat
 * clock, or the picker when none is loaded. The simulation itself runs once, in the
 * shell, when a battle starts — never at render time — so frames are golden-testable
 * and replays are reproducible. The arena renderer + beat clock live in
 * `battle-arena.ts` / `battle-beat.ts`; this file is dispatch, the fighter builders,
 * the picker row, and the arena key controls.
 *
 * Battle reads only identity/stat fields (House, grade, stats, traits) of a decoded
 * snapshot; it never mutates the pet and never consults a model id (invariants 1 & 3).
 */

import {
  combatantFromSnapshot,
  isBattleReady,
  sameSpecies,
  simulateBattle,
  type BattleResult,
  type BattleSide,
  type Combatant,
  type ContentPack,
  type DexSnapshot,
  type GameState,
  type PetState,
} from '@token-tamers/core';
import type { Rgb } from '../terminal/ansi';
import { drawPageHeader } from '../components';
import { GRADE_ACCENT, GRADE_BADGE } from '../render/sprite';
import { beatLen, cycleSpeed } from './battle-beat';
import { drawArena } from './battle-arena';
import { drawSetup, handleSetupKey } from './battle-setup';
import type { FlashTarget } from '../shell-effects';
import type { BattleView, PageId, PageUiState, RenderContext } from './types';

const TEXT: Rgb = { r: 214, g: 220, b: 234 };
const READY: Rgb = { r: 74, g: 222, b: 128 };
const SEALED: Rgb = { r: 150, g: 152, b: 160 };
const SEL_BG: Rgb = { r: 40, g: 46, b: 64 };

// Re-exported so the package surface (cli + setup page) is unchanged after the split.
export { advanceBattlePlayback, hpAt, titleCase } from './battle-beat';

export function renderBattlePage(ctx: RenderContext): void {
  const bodyY = drawPageHeader(ctx, { icon: '⚔', title: 'Battle' });
  if (ctx.battle) drawArena(ctx, ctx.battle, bodyY);
  else drawSetup(ctx, bodyY);
}

// ---------------------------------------------------------------------------
// Fighter builders (shared by the cli `tt battle` command and the setup page)
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

/** One opponent row within the rect (x..x+w): grade, name, stats, eligibility tag. */
export function drawPickerRow(
  ctx: RenderContext,
  snap: DexSnapshot,
  selected: boolean,
  y: number,
  rect: { x: number; w: number; mirrorSpeciesId: string },
): void {
  const { buf } = ctx;
  const { x, w } = rect;
  if (selected) {
    for (let i = 0; i < w; i++) buf.set(x + i, y, { ch: ' ', fg: null, bg: SEL_BG });
  }
  const bg = selected ? SEL_BG : null;
  const species = ctx.pack.species.find((s) => s.id === snap.speciesId);
  const name = species?.name ?? snap.speciesId;
  // Eligibility relative to YOUR chosen fighter: a same-species own record is a
  // self-mirror (not battleable); a foreign code never matches (its id is empty).
  const [tag, color] = sameSpecies({ speciesId: rect.mirrorSpeciesId }, snap)
    ? (['⊘ your kind', SEALED] as const)
    : isBattleReady(snap)
      ? (['✦ ready', READY] as const)
      : (['▢ sealed', SEALED] as const);
  const tagX = x + Math.max(20, w - tag.length);
  buf.text(x, y, `${GRADE_BADGE[snap.grade]} ${snap.grade}`, GRADE_ACCENT[snap.grade], bg);
  if (w > 6) buf.text(x + 5, y, name.slice(0, Math.max(0, tagX - (x + 5) - 1)), TEXT, bg);
  if (tagX + tag.length <= x + w) buf.text(tagX, y, tag, color, bg);
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
  /** Record a fought battle into the lifetime tally (drives battle Feats). Optional
   * so golden tests can use a read-only stub host. */
  recordBattle?(result: BattleResult, playerSide: BattleSide): void;
}

/**
 * Handle a key on the Battle page. Returns true when consumed. When a battle is
 * loaded this is the ARENA (Enter play/pause/replay, s speed, ←→ step a beat, r
 * rematch, Esc back to setup); otherwise the SETUP screen owns the key.
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
    case 's':
      cycleSpeed(view);
      return true;
    case 'enter':
      togglePlay(view);
      return true;
    case 'r':
      rt.battle = rematch(view, host);
      return true;
    default:
      return false;
  }
}

/**
 * Re-simulate the SAME two fighters with a bumped seed nonce — a fresh, still
 * deterministic fight, so the player can battle the same matchup over with variety.
 * The canonical (nonce 0) battle is unaffected, so shared-code replays stay valid.
 */
export function rematch(view: BattleView, host: BattleHost): BattleView {
  const nonce = (view.nonce ?? 0) + 1;
  const result = simulateBattle(view.left, view.right, host.pack.battle, nonce);
  host.recordBattle?.(result, 'a');
  return {
    left: view.left,
    right: view.right,
    result,
    cursor: 0,
    beatFrame: 0,
    playing: true,
    nonce,
    speed: view.speed,
  };
}

/** Step one whole event (a beat), landing on its resolved frame so the hit reads. */
function scrub(view: BattleView, delta: number): void {
  view.playing = false;
  const total = view.result.timeline.length;
  view.cursor = Math.max(0, Math.min(total, view.cursor + delta));
  view.beatFrame = view.cursor < total ? Math.max(0, beatLen(view, view.cursor) - 1) : 0;
}

function togglePlay(view: BattleView): void {
  if (view.cursor >= view.result.timeline.length) {
    view.cursor = 0;
    view.beatFrame = 0;
    view.playing = true;
  } else {
    view.playing = !view.playing;
  }
}
