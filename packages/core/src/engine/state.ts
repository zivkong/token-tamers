/**
 * Initial game state construction and state persistence helpers.
 */

import type { BattleRecord, EngineConfig, GameState, PetState } from '../types';
import { SCHEMA_VERSION } from './constants';

/** A zeroed battle tally (fresh save / migrated old save). */
export function freshBattleRecord(): BattleRecord {
  return { played: 0, won: 0, streak: 0, bestStreak: 0 };
}

/**
 * Defensively back-fill SCHEMA_VERSION-added fields on a resumed snapshot that
 * bypassed the cli store migration (so the engine never dereferences undefined).
 * Pure and deterministic — no back-fill from history, just safe defaults.
 */
export function ensureStateFields(s: GameState): void {
  if (!Array.isArray(s.dexRecords)) s.dexRecords = [];
  if (typeof s.lifetimeTokens !== 'number') s.lifetimeTokens = 0;
  if (!s.battleRecord) s.battleRecord = freshBattleRecord();
}

export function freshPet(generation: number, hatchedAt: number, calibrating: boolean): PetState {
  return {
    speciesId: 'mote',
    stage: 'egg',
    house: 'wild',
    grade: 'C',
    traits: [],
    pattern: null,
    rhythmVariant: null,
    stats: { pwr: 0, spd: 0, wis: 0, grt: 0 },
    moltCount: 0,
    stageMolts: 0,
    generation,
    hatchedAt,
    dormant: false,
    calibrating,
    dietGenes: {},
    mutations: [],
    lastGradeRoll: null,
  };
}

export function initialState(config: EngineConfig): GameState {
  const firstAnchor = config.cycle?.weekAnchor ?? 0;
  // When `startAt` is given (the fresh-init path), the pet hatches and starts
  // living from `startAt` so the Calibration Egg plays normally from day one.
  // Otherwise keep the legacy anchor-derived behavior so existing savefiles and
  // tests that build engines without `startAt` are byte-for-byte unaffected.
  const hasStart = config.startAt !== undefined;
  const startAt = config.startAt ?? 0;
  const hatchedAt = hasStart ? startAt : firstAnchor;
  const simulatedTo = hasStart ? startAt : firstAnchor === 0 ? 0 : firstAnchor - 1;
  const rngSeed = hasStart ? startAt : firstAnchor;
  return {
    schemaVersion: SCHEMA_VERSION,
    pet: freshPet(1, hatchedAt, true),
    dexOwned: [],
    archive: [],
    dexRecords: [],
    achievementsEarned: {},
    habitatsUnlocked: [],
    trinketsUnlocked: [],
    selectedHabitat: '',
    selectedTrinkets: [],
    baselines: {},
    rngState: (rngSeed ^ 0x9e3779b9) >>> 0,
    simulatedTo,
    lineage: [],
    lifetimeTokens: 0,
    battleRecord: freshBattleRecord(),
  };
}

/** Deep, JSON-safe clone that does not depend on structuredClone availability. */
export function cloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s)) as GameState;
}
