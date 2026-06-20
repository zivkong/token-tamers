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

/** A trinket sprite so the pet scene can render an equipped toy in tests. */
export const TEST_TRINKET_SPRITE: SpriteDef = {
  id: 'trinket-bouncy-ball',
  width: 4,
  height: 4,
  frames: [
    [
      [0, 4, 4, 0],
      [4, 5, 5, 4],
      [4, 5, 5, 4],
      [0, 4, 4, 0],
    ],
  ],
  fps: 2,
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
    season: 0,
    models: [
      { pattern: 'claude-*', house: 'aether', geneId: 'g_aether', tint: '#8a7cff' },
      { pattern: 'gpt-*', house: 'cipher', geneId: 'g_cipher', tint: '#f87171' },
    ],
    species: [WISP, EMBER],
    traits: [],
    patterns: [],
    achievements: [
      {
        id: 'first-molt',
        name: 'First Molt',
        description: 'Completed your first molt.',
        condition: { type: 'stage_reached', stage: 'sprite' },
        category: 'ascension',
      },
      {
        id: 'grade-b',
        name: 'Showing Promise',
        description: 'Reach grade B.',
        condition: { type: 'grade_reached', grade: 'B' },
        category: 'ascension',
        reward: { kind: 'trinket', id: 'bouncy-ball' },
      },
      {
        id: 'first-win',
        name: 'First Blood',
        description: 'Win a battle.',
        condition: { type: 'battles_won', count: 1 },
        category: 'warpath',
      },
    ],
    habitats: [
      {
        id: 'terminal-den',
        name: 'Terminal Den',
        spriteId: 'habitat-terminal-den',
        trinketSlots: [{ x: 96, y: 38 }],
      },
      { id: 'meadow', name: 'Meadow', spriteId: 'habitat-meadow', trinketSlots: [] },
    ],
    trinkets: [
      { id: 'bouncy-ball', name: 'Bouncy Ball', spriteId: 'trinket-bouncy-ball' },
      { id: 'cushion', name: 'Cushion', spriteId: 'trinket-cushion' },
    ],
    sprites: [TEST_SPRITE, TEST_TRINKET_SPRITE],
    dexTotal: 6,
    battle: {
      version: 2,
      wheel: [
        { attacker: 'aether', defender: 'cipher', multiplier: 1.25 },
        { attacker: 'cipher', defender: 'aether', multiplier: 0.8 },
      ],
      procs: [{ trait: 'sprinter', counters: 'marathoner', multiplier: 1.3 }],
      variance: 0.15,
      mechanics: {
        dodge: { base: 0.03, perPoint: 0.5, scale: 100, cap: 0.25 },
        crit: { base: 0.05, perPoint: 0.25, scale: 100, cap: 0.3, multiplier: 1.6 },
        parry: { base: 0.04, perPoint: 0.2, scale: 100, cap: 0.2, reduction: 0.5 },
        doubleStrike: { base: 0, perPoint: 0.15, scale: 100, cap: 0.15 },
      },
    },
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
    stats: { pwr: 12, spd: 9, wis: 15, grt: 11 },
    moltCount: 3,
    stageMolts: 0,
    generation: 1,
    hatchedAt: 1000,
    dormant: false,
    calibrating: false,
    dietGenes: { g_aether: 0.7, g_cipher: 0.3 },
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
    dexRecords: [
      {
        speciesId: 'ember',
        top: [
          {
            speciesId: 'ember',
            stage: 'apex',
            grade: 'B',
            stats: { pwr: 14, spd: 9, wis: 8, grt: 11 },
            house: 'forge',
            traits: [],
            pattern: null,
            rhythmVariant: null,
            mutations: [],
            generation: 1,
            contentVersion: 1,
            recordedAt: 5000,
            reason: 'rebirth',
          },
        ],
      },
    ],
    achievementsEarned: {},
    habitatsUnlocked: [],
    trinketsUnlocked: [],
    selectedHabitat: '',
    selectedTrinkets: [],
    baselines: { 'claude-code': { meanWindowTokens: 24300, windowsObserved: 6 } },
    rngState: 12345,
    simulatedTo: 10000,
    lineage: [],
    lifetimeTokens: 0,
    battleRecord: { played: 0, won: 0, streak: 0, bestStreak: 0 },
    ...overrides,
  };
}
