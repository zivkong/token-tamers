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
  return {
    schemaVersion: SCHEMA_VERSION,
    pet: freshPet(1, firstAnchor, true),
    dexOwned: [],
    archive: [],
    achievementsEarned: {},
    habitatsUnlocked: [],
    trinketsUnlocked: [],
    selectedHabitat: '',
    selectedTrinkets: [],
    baselines: {},
    rngState: (firstAnchor ^ 0x9e3779b9) >>> 0,
    simulatedTo: firstAnchor === 0 ? 0 : firstAnchor - 1,
    lineage: [],
  };
}

/** Deep, JSON-safe clone that does not depend on structuredClone availability. */
export function cloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s)) as GameState;
}
