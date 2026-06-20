/**
 * The lifetime battle tally update — pure & deterministic (no clock/RNG).
 *
 * A win is the player's fighter (`playerSide`) taking the battle; it extends the
 * streak (and the best-streak high-water mark). A loss resets the streak; a draw
 * counts as played but leaves the streak intact. Drives the battle-record Feats.
 */

import type {
  BattleRecord,
  BattleResult,
  BattleSide,
  ContentPack,
  GameEffect,
  GameState,
} from '../types';
import { evaluateAchievements } from './achievements';

function tallyBattle(rec: BattleRecord, result: BattleResult, playerSide: BattleSide): void {
  rec.played += 1;
  if (result.winner === playerSide) {
    rec.won += 1;
    rec.streak += 1;
    if (rec.streak > rec.bestStreak) rec.bestStreak = rec.streak;
  } else if (result.winner !== 'draw') {
    rec.streak = 0;
  }
}

/**
 * Record a fought battle into the lifetime tally and award any newly-met battle
 * Feats. The whole {@link Engine.recordBattle} body — a player action, so `now` is
 * only the achievement timestamp (no clock/RNG). Returns the GameEffects for the UI.
 */
export function recordBattleInto(
  state: GameState,
  pack: ContentPack,
  result: BattleResult,
  playerSide: BattleSide,
  now: number,
): GameEffect[] {
  const effects: GameEffect[] = [];
  tallyBattle(state.battleRecord, result, playerSide);
  evaluateAchievements(state, pack, now, effects);
  return effects;
}
