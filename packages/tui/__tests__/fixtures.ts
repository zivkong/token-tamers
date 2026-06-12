/**
 * Test fixtures: a tiny ContentPack and GameState, deterministic, for golden
 * frames and unit tests. Not exported from the package index.
 */

import type { ContentPack, GameState, PetState, SpriteDef, SpeciesDef } from '@token-tamers/core';

/** A 4x4 pixel sprite (2 cell rows) with a single animation frame. */
export const TEST_SPRITE: SpriteDef = {
  id: 'spr_wisp',
  width: 4,
  height: 4,
  frames: [
    [
      [0, 2, 2, 0],
      [2, 3, 3, 2],
      [2, 3, 3, 2],
      [0, 2, 2, 0],
    ],
    [
      [0, 3, 3, 0],
      [3, 2, 2, 3],
      [3, 2, 2, 3],
      [0, 3, 3, 0],
    ],
  ],
  fps: 4,
};

const WISP: SpeciesDef = {
  id: 'wisp',
  num: 1,
  name: 'Wisp',
  house: 'aether',
  stage: 'sprite',
  statWeights: { pwr: 1, spd: 1, wis: 1, grt: 1 },
  evolvesTo: [],
  spriteId: 'spr_wisp',
};

const EMBER: SpeciesDef = {
  id: 'ember',
  num: 2,
  name: 'Ember',
  house: 'forge',
  stage: 'sprite',
  statWeights: { pwr: 2, spd: 1, wis: 1, grt: 1 },
  evolvesTo: [],
  spriteId: 'spr_wisp',
};

export function makePack(): ContentPack {
  return {
    schemaVersion: 1,
    revision: 1,
    models: [{ pattern: 'claude-*', house: 'aether', geneId: 'g_aether', tint: '#8a7cff' }],
    species: [WISP, EMBER],
    traits: [],
    patterns: [],
    achievements: [],
    habitats: [],
    trinkets: [],
    sprites: [TEST_SPRITE],
    dexTotal: 6,
  };
}

export function makePet(overrides: Partial<PetState> = {}): PetState {
  return {
    speciesId: 'wisp',
    stage: 'sprite',
    house: 'aether',
    grade: 'C',
    traits: [],
    pattern: null,
    rhythmVariant: null,
    stats: { pwr: 10, spd: 10, wis: 10, grt: 10 },
    moltCount: 3,
    generation: 1,
    hatchedAt: 1000,
    dormant: false,
    calibrating: false,
    dietGenes: {},
    mutations: [],
    lastGradeRoll: { from: 'C', to: 'B', chance: 0.35, succeeded: false },
    ...overrides,
  };
}

export function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    schemaVersion: 1,
    pet: makePet(),
    dexOwned: ['wisp'],
    archive: [
      {
        speciesId: 'ember',
        grade: 'B',
        stats: { pwr: 14, spd: 9, wis: 8, grt: 11 },
        generation: 1,
        contentVersion: 1,
        recordedAt: 5000,
      },
    ],
    achievementsEarned: {},
    habitatsUnlocked: [],
    trinketsUnlocked: [],
    selectedHabitat: '',
    selectedTrinkets: [],
    baselines: {},
    rngState: 12345,
    simulatedTo: 10000,
    lineage: [],
    ...overrides,
  };
}
