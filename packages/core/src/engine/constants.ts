/**
 * Engine-wide numeric constants and lookup tables.
 */

import type { Grade } from '../types';

export const SCHEMA_VERSION = 1;

// Grade-up base rates (design §12), content-tunable but fixed here for MVP.
export const GRADE_BASE: Partial<Record<Grade, number>> = { C: 0.25, B: 0.1, A: 0.03 };
export const A_TO_S_CAP = 0.06;
export const MUTATION_CHANCE = 0.05;
export const MAX_TRAIT_SLOTS = 5;
export const INHERIT_BASE = 0.3;
export const INHERIT_PER_TIER = 0.1;
export const INHERIT_CAP = 0.7;
/** Equal total stat budget per stage, scaled by species weights. */
export const STAGE_STAT_BUDGET = 240;

export const MUTATION_IDS = ['palette-shift', 'offline-trait', 'stat-swap'] as const;
