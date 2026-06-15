// Public API of @token-tamers/core.
// Exported names and types are IDENTICAL to the previous flat layout.

export * from './types';

// RNG — moved to helpers/rng; re-exported here for consumers.
export { chance, createRng, nextFloat, nextInt, pickWeighted, type Rng } from './helpers/rng';

// Cycle — re-exported via cycle/index barrel.
export { deriveCycleEvents, unconsumedEvents, WEEK_MS, weekStartFor, WINDOW_MS } from './cycle';

// Molt evaluation — re-exported via evaluation/index barrel.
export {
  activityModifier,
  classifyRhythm,
  computeWindowSignals,
  dominantTraitClass,
  evaluateTraits,
  eventEssence,
  eventTokens,
  type RhythmKind,
  type TraitClass,
  type WindowSignals,
} from './evaluation';

// Engine — re-exported via engine/index barrel.
export {
  BATTLE_READY_STAGE,
  bestSpeciesRecords,
  createEngine,
  GRAFT_GRADE_BONUS_CAP,
  GRAFT_POTENCY,
  GRAFT_STAT_BOOST_CAP,
  gradeOdds,
  graftPotency,
  graftPotencyTier,
  growthProgress,
  hasFullWeekBaseline,
  isBattleReady,
  isGraftReady,
  matchModelRule,
  MAX_DEX_RECORDS,
  petSnapshot,
  requiredMaturity,
  SCHEMA_VERSION,
  seedBaselinesFromHistory,
  snapshotRank,
  snapshotStrictlyBetter,
  stageMature,
  tryCaptureSnapshot,
  vitalityBonus,
  VITALITY_FULL_TOKENS,
  VITALITY_MAX_BONUS,
  type GradeOddsPreview,
  type GraftPotency,
  type GrowthProgress,
} from './engine';

// DNA hash codec — re-exported via dna/index barrel.
export {
  decodeDna,
  DNA_SCHEMA_VERSION,
  encodeDna,
  GRADE_CODES,
  HOUSE_CODES,
  MUTATION_CODES,
  PATTERN_CODES,
  RHYTHM_CODES,
  STAGE_CODES,
  TRAIT_CODES,
  type DecodedDna,
} from './dna';
