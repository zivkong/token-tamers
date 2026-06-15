/**
 * Initial game state construction and state persistence helpers.
 */

import type { EngineConfig, GameState, PetState } from '../types';
import { SCHEMA_VERSION } from './constants';

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
  const firstAnchor = config.adapters[0]?.weekAnchor ?? 0;
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
  };
}

/** Deep, JSON-safe clone that does not depend on structuredClone availability. */
export function cloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s)) as GameState;
}
