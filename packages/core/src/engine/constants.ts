/**
 * Engine-wide numeric constants and lookup tables.
 */

import type { Grade } from '../types';

// v2: added `pet.stageMolts` (the per-stage maturity clock). Old saves migrate
// forward by defaulting it to 0 (see the cli state store).
export const SCHEMA_VERSION = 2;

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
