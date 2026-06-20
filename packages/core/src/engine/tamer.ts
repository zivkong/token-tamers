/**
 * Tamer identity helpers — the player's earned, wearable titles. Pure & deterministic.
 *
 * Titles are NOT a separate content system: a title is the `reward.kind === 'title'`
 * of an achievement the player has already earned (`state.achievementsEarned`). This
 * derives the wearable list so the UI can let the player pick one to display and the
 * DNA codec can stamp it as part of the maker's-mark. Cosmetic/identity only — never
 * touches stats, grades, or speed (invariant 3).
 */

import type { ContentPack, GameState } from '../types';
import { achievementRewards } from './achievements';

// Re-exported here so the engine barrel exposes it alongside earnedTitles (both
// are achievement-reward helpers and ship together).
export { achievementRewards } from './achievements';

/** The title names the player has earned, in pack (stable) order, de-duplicated. */
export function earnedTitles(state: GameState, pack: ContentPack): string[] {
  const out: string[] = [];
  for (const ach of pack.achievements) {
    if (state.achievementsEarned[ach.id] === undefined) continue;
    for (const reward of achievementRewards(ach)) {
      if (reward.kind === 'title' && !out.includes(reward.name)) out.push(reward.name);
    }
  }
  return out;
}
