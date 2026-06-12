/**
 * One-line status renderers used by `tt watch` / `tt status`. These produce
 * plain strings (no ANSI), e.g.:
 *
 *   🥚 Wisp [C]○ molt 3 ▓▓░░
 */

import type { ContentPack, GameState, Stage } from '@token-tamers/core';
import { GRADE_BADGE } from './sprite';
import { findSpecies } from './lookup';

/** Stage emoji prefix for the status line. */
const STAGE_EMOJI: Record<Stage, string> = {
  egg: '🥚',
  sprite: '✨',
  rookie: '🐣',
  evolved: '🦋',
  prime: '🔥',
  apex: '👑',
};

/** A short progress bar of filled/empty blocks. */
export function progressBar(fraction: number, width = 4): string {
  const f = fraction < 0 ? 0 : fraction > 1 ? 1 : fraction;
  const filled = Math.round(f * width);
  return '▓'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
}

/**
 * Render the compact status one-liner. `progress` is an optional 0..1 cycle
 * progress (e.g. fraction of the current molt window elapsed); when omitted a
 * molt-count-derived bar is shown.
 */
export function renderStatusLine(state: GameState, pack: ContentPack, progress?: number): string {
  const pet = state.pet;
  const species = findSpecies(pack, pet.speciesId);
  const name = species?.name ?? '???';
  const emoji = STAGE_EMOJI[pet.stage];
  const badge = GRADE_BADGE[pet.grade];
  const frac = progress ?? (pet.moltCount % 4) / 4;
  const bar = progressBar(frac);
  const stageWord = pet.calibrating ? 'calibrating' : 'molt';
  return `${emoji} ${name} [${pet.grade}]${badge} ${stageWord} ${pet.moltCount} ${bar}`;
}

/** The grade-roll odds line, e.g. 'next: B→A 35% (rolls at molt)'. */
export function renderGradeOddsLine(state: GameState): string {
  const roll = state.pet.lastGradeRoll;
  if (!roll) return 'next grade roll: pending first molt';
  const pct = Math.round(roll.chance * 100);
  const outcome = roll.succeeded ? 'succeeded' : 'held';
  return `last roll: ${roll.from}→${roll.to} ${pct}% (${outcome})`;
}
