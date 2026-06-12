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
  type RhythmKind,
  type TraitClass,
  type WindowSignals,
} from './evaluation';

// Engine — re-exported via engine/index barrel.
export {
  createEngine,
  hasFullWeekBaseline,
  matchModelRule,
  SCHEMA_VERSION,
  seedBaselinesFromHistory,
} from './engine';
