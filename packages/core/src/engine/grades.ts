/**
 * Grade roll math helpers.
 */

import { activityModifier } from '../evaluation/modifier';
import { computeWindowSignals } from '../evaluation/signals';
import { GRADE_ORDER, type GameState, type Grade, type UsageEvent } from '../types';
import { A_TO_S_CAP, GRADE_BASE, VITALITY_FULL_TOKENS, VITALITY_MAX_BONUS } from './constants';

export function gradeAtLeast(current: Grade, target: Grade): boolean {
  return GRADE_ORDER.indexOf(current) >= GRADE_ORDER.indexOf(target);
}

/** The grade one step above `from`, or null when `from` is already the cap (S). */
export function nextGradeOf(from: Grade): Grade | null {
  const idx = GRADE_ORDER.indexOf(from);
  return idx >= 0 && idx < GRADE_ORDER.length - 1 ? GRADE_ORDER[idx + 1]! : null;
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Capped vitality bonus added to a grade roll from the closing window's RAW
 * token volume (hybrid growth). 0 at no usage, ramping linearly to
 * VITALITY_MAX_BONUS at VITALITY_FULL_TOKENS and clamped there — so a bigger
 * session helps the molt, but the bonus can never run away. Pure + deterministic.
 */
export function vitalityBonus(totalTokens: number): number {
  const frac = Math.max(0, Math.min(1, totalTokens / VITALITY_FULL_TOKENS));
  return frac * VITALITY_MAX_BONUS;
}

/**
 * The grade-roll success chance for a single molt: the baseline-normalized base
 * odds scaled by the model-/volume-blind activity modifier, PLUS the separate
 * capped vitality bonus from raw token volume (the ONE volume input). The A→S
 * step is clamped to `A_TO_S_CAP` so a big session can never let the rarest jump
 * run away. The single source of truth shared by the live roll (`rollGrade`) and
 * the UI forecast (`gradeOdds`). Pure + deterministic.
 */
export function gradeRollChance(from: Grade, modifier: number, totalTokens: number): number {
  const base = GRADE_BASE[from] ?? 0;
  let p = base * modifier + vitalityBonus(totalTokens);
  if (from === 'A') p = Math.min(p, A_TO_S_CAP);
  return Math.max(0, Math.min(1, p));
}

/** A forecast of the next grade roll: the transition and its success chance. */
export interface GradeOddsPreview {
  /** Current grade (the roll's source). */
  from: Grade;
  /** The grade one step up (the roll's target). */
  to: Grade;
  /** Success chance in [0,1] if the window closed now. */
  chance: number;
  /** True when the A→S cap clamped the chance below its raw (base×mod + vitality). */
  capped: boolean;
}

/**
 * Forecast the NEXT grade roll for the pet as if its open window closed now.
 *
 * With no `pending` events it reports the PUBLISHED base odds (the neutral
 * reference shown in the wiki); with the open window's events it folds in the
 * live activity modifier and the capped vitality bonus — exactly the math the
 * engine will apply at the molt (`gradeRollChance`), so the readout the player
 * sees matches the roll they will get. Returns null at the S cap (no next roll).
 *
 * Note: this aggregates the whole open buffer against the summed per-adapter
 * baseline (mirroring the live token readout), so it is a single-window
 * FORECAST — the real molt rolls per the adapter whose window actually closes.
 * Deterministic: reads only state + event timestamps, never the wall clock.
 */
export function gradeOdds(
  state: GameState,
  pending: readonly UsageEvent[] = [],
): GradeOddsPreview | null {
  const from = state.pet.grade;
  const to = nextGradeOf(from);
  if (to === null) return null;

  let modifier = 1;
  let totalTokens = 0;
  if (pending.length > 0) {
    let baselineMean = 0;
    for (const b of Object.values(state.baselines)) baselineMean += b.meanWindowTokens;
    // windowStart === windowEnd makes computeWindowSignals fall back to the full
    // 5-h span for cap proximity, scored from the events' own timestamps.
    const start = Math.min(...pending.map((e) => e.ts));
    const signals = computeWindowSignals(pending, start, start, baselineMean);
    modifier = activityModifier(signals, state.pet.traits);
    totalTokens = signals.totalTokens;
  }

  const raw = (GRADE_BASE[from] ?? 0) * modifier + vitalityBonus(totalTokens);
  const chance = gradeRollChance(from, modifier, totalTokens);
  return { from, to, chance, capped: from === 'A' && raw > A_TO_S_CAP };
}
