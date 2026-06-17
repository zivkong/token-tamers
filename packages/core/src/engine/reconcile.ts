/**
 * Catch-up reconciliation: decide whether a loaded save owes a rebirth.
 *
 * Pure decision half of {@link Engine.reconcile} — kept out of the engine module
 * so the deterministic replay path stays small and this rule is independently
 * testable. See the engine method for the full rationale.
 */

import { effectiveWeekAnchor, WEEK_MS, weekStartFor } from '../cycle';
import type { CycleConfig, GameState, RebirthEvent, UsageEvent } from '../types';

/**
 * The rebirth a stuck save owes, or null when nothing is due. A pet owes a
 * rebirth when its current life began before the most recent weekly boundary AND
 * the sim clock already slipped past that boundary without rebirthing (a future
 * `weekAnchor` had frozen `weekRebirths`). Requiring `simulatedTo >= boundary`
 * means `advanceTo` — which only emits boundaries strictly after `simulatedTo` —
 * can never double-fire the same rebirth. Idempotent: a fresh egg from this
 * rebirth has `hatchedAt == boundary`, so a repeat call returns null.
 *
 * `all` must be sorted ascending by ts (effectiveWeekAnchor reads the first event).
 */
export function overdueRebirthEvent(
  state: GameState,
  all: readonly UsageEvent[],
  cycle: CycleConfig,
  now: number,
): RebirthEvent | null {
  const anchor = effectiveWeekAnchor(all, cycle.weekAnchor);
  const lastBoundary = weekStartFor(now, anchor);
  if (state.pet.hatchedAt >= lastBoundary || state.simulatedTo < lastBoundary) return null;
  return {
    type: 'rebirth',
    at: lastBoundary,
    weekStart: lastBoundary - WEEK_MS,
    weekEnd: lastBoundary,
  };
}
