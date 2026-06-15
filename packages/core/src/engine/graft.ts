/**
 * DNA graft potency — the forward spec for grafting/fusion (design §9/§11),
 * exposed now so the Dex UI can surface a record's graft strength even though the
 * fusion engine itself is future (M2.3) work.
 *
 * Potency scales with the DONOR's grade only (never model/volume — invariant 3):
 * C contributes nothing, S is a small hard-capped nudge. See GRAFT_POTENCY in
 * constants.ts for the rationale and the equal-stat-budget caveat. Pure.
 */

import type { Grade } from '../types';
import { GRAFT_POTENCY } from './constants';

export interface GraftPotency {
  /** Additive bonus to the recipient's grade-up chance at graft time. */
  gradeUpChance: number;
  /** Additive fraction applied to recipient stats at graft time (battle-only floor). */
  statBoostFrac: number;
}

/** Graft potency conferred by a donor of the given grade. C is always zero. */
export function graftPotency(grade: Grade): GraftPotency {
  return { ...GRAFT_POTENCY[grade] };
}

/** Coarse tier label for UI ("none" | "small" | "moderate" | "capped"). */
export function graftPotencyTier(grade: Grade): 'none' | 'small' | 'moderate' | 'capped' {
  switch (grade) {
    case 'C':
      return 'none';
    case 'B':
      return 'small';
    case 'A':
      return 'moderate';
    case 'S':
      return 'capped';
  }
}
