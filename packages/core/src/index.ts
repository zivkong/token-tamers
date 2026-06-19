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
  earnedTitles,
  GRADE_STAT_FLOOR,
  GRADE_STAT_FLOOR_CAP,
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
  rankBestPerLife,
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
  sanitizeTamerName,
  STAGE_CODES,
  TAMER_NAME_MAX,
  TAMER_TITLE_MAX,
  TRAIT_CODES,
  type DecodedDna,
  type EncodeOptions,
} from './dna';

// Battle engine — re-exported via battle/index barrel.
export {
  battleSeed,
  combatantFromDecoded,
  combatantFromSnapshot,
  effectiveStats,
  mechanicChance,
  resolveProcs,
  sameSpecies,
  simulateBattle,
  typeMultiplier,
  type ProcResult,
} from './battle';
