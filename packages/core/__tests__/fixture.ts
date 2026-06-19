/**
 * Minimal but complete ContentPack + helpers for engine tests. Two House lines
 * (Aether, Cipher) egg->apex with branching, all 4 patterns, a handful of
 * achievements covering each reward kind, habitats and trinkets.
 */

import type {
  AdapterConfig,
  ContentPack,
  CycleConfig,
  EvolutionBranch,
  SpeciesDef,
  Stats,
  UsageEvent,
} from '../src/index';

let dexCounter = 0;
function sp(
  id: string,
  house: SpeciesDef['house'],
  stage: SpeciesDef['stage'],
  weights: Stats,
  evolvesTo: EvolutionBranch[],
): SpeciesDef {
  return {
    id,
    num: ++dexCounter,
    name: id,
    house,
    stage,
    statWeights: weights,
    evolvesTo,
    spriteId: `${id}-spr`,
  };
}

const W = (pwr: number, spd: number, wis: number, grt: number): Stats => ({ pwr, spd, wis, grt });

// Aether line (WIS-lean): wisp -> aetherling -> oraclet -> seraphix -> aurelion
// Cipher line (PWR-lean): glyphit -> cipherling -> runeclaw -> cryptarch -> enigmax
const species: SpeciesDef[] = [
  // Aether
  sp('wisp', 'aether', 'sprite', W(1, 1, 3, 1), [
    { species: 'aetherling', when: { kind: 'default' } },
  ]),
  sp('aetherling', 'aether', 'rookie', W(1, 1, 3, 1), [
    { species: 'oraclet', when: { kind: 'rhythm', value: 'steady' } },
    { species: 'oraclet', when: { kind: 'default' } },
  ]),
  sp('oraclet', 'aether', 'evolved', W(1, 1, 3, 1), [
    { species: 'seraphix', when: { kind: 'traitClass', value: 'endurance' } },
    { species: 'seraphix', when: { kind: 'default' } },
  ]),
  sp('seraphix', 'aether', 'prime', W(1, 1, 3, 1), [
    { species: 'aurelion', when: { kind: 'consistency', value: 'high' } },
    { species: 'aurelion', when: { kind: 'default' } },
  ]),
  sp('aurelion', 'aether', 'apex', W(1, 1, 3, 1), []),
  // Cipher
  sp('glyphit', 'cipher', 'sprite', W(3, 1, 1, 1), [
    { species: 'cipherling', when: { kind: 'default' } },
  ]),
  sp('cipherling', 'cipher', 'rookie', W(3, 1, 1, 1), [
    { species: 'runeclaw', when: { kind: 'default' } },
  ]),
  sp('runeclaw', 'cipher', 'evolved', W(3, 1, 1, 1), [
    { species: 'cryptarch', when: { kind: 'default' } },
  ]),
  sp('cryptarch', 'cipher', 'prime', W(3, 1, 1, 1), [
    { species: 'enigmax', when: { kind: 'default' } },
  ]),
  sp('enigmax', 'cipher', 'apex', W(3, 1, 1, 1), []),
];

export function makePack(): ContentPack {
  return {
    schemaVersion: 1,
    season: 0,
    models: [
      { pattern: 'claude-*', house: 'aether', geneId: 'aether-1', tint: '#a78bfa' },
      { pattern: 'gpt-*', house: 'cipher', geneId: 'cipher-1', tint: '#4ade80' },
      { pattern: 'o*', house: 'cipher', geneId: 'cipher-2', tint: '#22c55e' },
      { pattern: '*', house: 'wild', geneId: 'wild', tint: '#8b8b8b' },
    ],
    species,
    traits: [
      { id: 'marathoner', name: 'Marathoner', description: '' },
      { id: 'sprinter', name: 'Sprinter', description: '' },
      { id: 'polyglot', name: 'Polyglot', description: '' },
      { id: 'nightshade', name: 'Nightshade', description: '' },
      { id: 'daybreaker', name: 'Daybreaker', description: '' },
      { id: 'switcher', name: 'Switcher', description: '' },
      { id: 'deepdiver', name: 'Deepdiver', description: '' },
      { id: 'swarm', name: 'Swarm', description: '' },
      { id: 'polyhost', name: 'Polyhost', description: '' },
    ],
    patterns: [
      { id: 'vigil', name: 'Vigil', requiresTraits: ['marathoner', 'nightshade'] },
      { id: 'tempest', name: 'Tempest', requiresTraits: ['sprinter', 'swarm'] },
      { id: 'chimera', name: 'Chimera', requiresTraits: ['polyhost', 'switcher'] },
      { id: 'prism', name: 'Prism', minDistinctTraits: 4 },
    ],
    achievements: [
      {
        id: 'first-sprite',
        name: 'Hatchling',
        description: '',
        condition: { type: 'stage_reached', stage: 'sprite' },
        reward: { kind: 'habitat', id: 'meadow' },
      },
      {
        id: 'first-evolved',
        name: 'Growing',
        description: '',
        condition: { type: 'stage_reached', stage: 'evolved' },
        reward: { kind: 'trinket', id: 'ball' },
      },
      {
        id: 'reach-b',
        name: 'Verdant',
        description: '',
        condition: { type: 'grade_reached', grade: 'B' },
        reward: { kind: 'title', id: 't-b', name: 'B-grade' },
      },
      {
        id: 'gen-2',
        name: 'Lineage',
        description: '',
        condition: { type: 'generation', count: 2 },
        reward: { kind: 'trinket', id: 'cushion' },
      },
      {
        id: 'molt-5',
        name: 'Molter',
        description: '',
        condition: { type: 'molt_count_lifetime', count: 5 },
        reward: { kind: 'habitat', id: 'rooftop' },
      },
      {
        id: 'dormant',
        name: 'Survivor',
        description: '',
        condition: { type: 'dormant_survived' },
        reward: { kind: 'habitat', id: 'cocoon' },
      },
    ],
    habitats: [
      { id: 'den', name: 'Den', spriteId: 'den-spr', trinketSlots: [{ x: 0, y: 0 }] },
      { id: 'meadow', name: 'Meadow', spriteId: 'meadow-spr', trinketSlots: [{ x: 0, y: 0 }] },
      { id: 'rooftop', name: 'Rooftop', spriteId: 'rooftop-spr', trinketSlots: [{ x: 0, y: 0 }] },
      { id: 'cocoon', name: 'Cocoon', spriteId: 'cocoon-spr', trinketSlots: [{ x: 0, y: 0 }] },
    ],
    trinkets: [
      { id: 'ball', name: 'Ball', spriteId: 'ball-spr' },
      { id: 'cushion', name: 'Cushion', spriteId: 'cushion-spr' },
    ],
    sprites: [],
    dexTotal: 20,
    battle: {
      version: 2,
      wheel: [
        { attacker: 'aether', defender: 'cipher', multiplier: 1.25 },
        { attacker: 'cipher', defender: 'flux', multiplier: 1.25 },
        { attacker: 'flux', defender: 'forge', multiplier: 1.25 },
        { attacker: 'forge', defender: 'aether', multiplier: 1.25 },
        { attacker: 'cipher', defender: 'aether', multiplier: 0.8 },
        { attacker: 'flux', defender: 'cipher', multiplier: 0.8 },
        { attacker: 'forge', defender: 'flux', multiplier: 0.8 },
        { attacker: 'aether', defender: 'forge', multiplier: 0.8 },
      ],
      procs: [
        { trait: 'sprinter', counters: 'marathoner', multiplier: 1.3 },
        { trait: 'deepdiver', counters: 'swarm', multiplier: 1.3 },
      ],
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

/** Monday 2024-01-01 00:00:00 UTC as the week anchor. */
export const WEEK_ANCHOR = Date.UTC(2024, 0, 1, 0, 0, 0, 0);

/** A pure data-source adapter (no cycle fields — the clock is global now). */
export function adapter(provider = 'claude-code'): AdapterConfig {
  return { provider, paths: [] };
}

/** The default test adapter set. */
export function adapters(provider = 'claude-code'): AdapterConfig[] {
  return [adapter(provider)];
}

/** Pet-global static cycle clock (fixed 5-h tiles from the week anchor). */
export function staticCycle(weekAnchor = WEEK_ANCHOR): CycleConfig {
  return { policy: 'static', weekAnchor };
}

/** Pet-global subscription cycle clock anchored to one adapter's session rhythm. */
export function subscriptionCycle(
  weekAnchor = WEEK_ANCHOR,
  anchorAdapter = 'claude-code',
): CycleConfig {
  return { policy: 'subscription', anchorAdapter, weekAnchor };
}

let uid = 0;
export function ev(
  tsOffsetMs: number,
  overrides: Partial<UsageEvent> = {},
  base = WEEK_ANCHOR,
): UsageEvent {
  return {
    ts: base + tsOffsetMs,
    adapter: 'claude-code',
    modelId: 'claude-sonnet-4-6',
    inputTokens: 1000,
    outputTokens: 500,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    sessionKey: `s${uid++}`,
    isSubagent: false,
    ...overrides,
  };
}

export const HOUR = 60 * 60 * 1000;
export const MIN = 60 * 1000;
