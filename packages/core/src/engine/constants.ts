/**
 * Engine-wide numeric constants and lookup tables.
 */

import type { Grade } from '../types';

// v2: added `pet.stageMolts` (the per-stage maturity clock).
// v3: added `state.dexRecords` (per-species top-3 snapshot store). Old saves
// migrate forward by back-filling it from `archive` (see the cli state store).
export const SCHEMA_VERSION = 3;

/** Max historical snapshots kept per species in the Dex record store. */
export const MAX_DEX_RECORDS = 3;

// Grade-up base rates (design §12), content-tunable but fixed here for MVP.
export const GRADE_BASE: Partial<Record<Grade, number>> = { C: 0.25, B: 0.1, A: 0.03 };
export const A_TO_S_CAP = 0.06;

/**
 * Capped "vitality bonus" (hybrid growth design). Grade odds stay baseline-
 * normalized (volume-blind), but a SEPARATE bonus rewards a heavy session: the
 * closing window's raw token total ramps a flat additive bonus to the grade
 * roll, full at 200M tokens. This is the only place absolute volume touches
 * power, and it is hard-capped so it can never dominate the self-normalized
 * base odds (and the A→S ceiling still applies after it).
 */
export const VITALITY_FULL_TOKENS = 200_000_000;
export const VITALITY_MAX_BONUS = 0.15;

export const MUTATION_CHANCE = 0.05;
export const MAX_TRAIT_SLOTS = 5;
export const INHERIT_BASE = 0.3;
export const INHERIT_PER_TIER = 0.1;
export const INHERIT_CAP = 0.7;
/** Equal total stat budget per stage, scaled by species weights. */
export const STAGE_STAT_BUDGET = 240;

export const MUTATION_IDS = ['palette-shift', 'offline-trait', 'stat-swap'] as const;

/**
 * Graft potency by DONOR grade (forward spec for DNA grafting / fusion, §9/§11).
 * When a DNA code is grafted into a recipient, the donor's recorded grade scales
 * how much the graft can move the recipient — and the lowest grade does nothing:
 *
 *   C → ZERO impact      B → small      A → moderate      S → small, HARD CAP
 *
 * Both levers are intentionally gentle nudges, never a power spike: every value
 * sits below the C→B base grade odds (0.25) and the `VITALITY_MAX_BONUS` (0.15),
 * the project's other capped bonus. Grade-based ONLY — never model/volume-derived
 * (invariant 3). `statBoostFrac` is applied at graft time as a battle-only floor
 * (or budget-preserving redistribution), NOT a permanent flat add to all four
 * stats, so horizontal evolution's equal-stat-budgets hold. Tunable defaults.
 */
export const GRAFT_POTENCY: Record<Grade, { gradeUpChance: number; statBoostFrac: number }> = {
  C: { gradeUpChance: 0, statBoostFrac: 0 },
  B: { gradeUpChance: 0.02, statBoostFrac: 0.02 },
  A: { gradeUpChance: 0.05, statBoostFrac: 0.05 },
  S: { gradeUpChance: 0.08, statBoostFrac: 0.08 },
};

/** Absolute ceilings guarding future tuning of {@link GRAFT_POTENCY}. */
export const GRAFT_GRADE_BONUS_CAP = 0.08;
export const GRAFT_STAT_BOOST_CAP = 0.08;
