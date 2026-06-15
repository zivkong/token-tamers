/**
 * DNA codec registry — append-only index tables (invariant 7: hashes parse
 * forever). The codec encodes each enum value as its INDEX in these tables; the
 * decoder maps indices back. NEVER reorder or remove an entry — old DNA codes
 * decode by index forever. New content appends to the END only; an index a local
 * client doesn't know about decodes as a dormant/unknown gene rather than being
 * rejected.
 *
 * These tables are deliberately INDEPENDENT of GRADE_ORDER/STAGE_ORDER in
 * types.ts: those are general ordering vocabularies, while these are the frozen
 * wire layout for the DNA format. A freeze test locks their prefixes.
 */

import type { Grade, House, PatternId, RhythmVariant, Stage, TraitId } from '../types';

export const GRADE_CODES: readonly Grade[] = ['C', 'B', 'A', 'S'];

export const STAGE_CODES: readonly Stage[] = [
  'egg',
  'sprite',
  'rookie',
  'evolved',
  'prime',
  'apex',
];

export const HOUSE_CODES: readonly House[] = ['wild', 'aether', 'cipher', 'flux', 'forge'];

export const PATTERN_CODES: readonly PatternId[] = ['vigil', 'tempest', 'prism', 'chimera'];

export const RHYTHM_CODES: readonly RhythmVariant[] = ['disciplined', 'burnout', 'nocturne'];

export const TRAIT_CODES: readonly TraitId[] = [
  'marathoner',
  'sprinter',
  'polyglot',
  'nightshade',
  'daybreaker',
  'switcher',
  'deepdiver',
  'swarm',
  'polyhost',
];

export const MUTATION_CODES: readonly string[] = ['palette-shift', 'offline-trait', 'stat-swap'];

/** Index of `value` in `table`, or -1 if absent. */
export function codeIndex<T>(table: readonly T[], value: T): number {
  return table.indexOf(value);
}
