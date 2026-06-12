/**
 * Trait evaluation and rhythm classification.
 *
 * Pure threshold logic over WindowSignals — all model-neutral. No token
 * volumes are read as absolute power; all comparisons are structural
 * (session counts, time fractions, model diversity).
 */

import type { TraitId } from '../types';
import type { WindowSignals } from './signals';

export type RhythmKind = 'steady' | 'bursty';
export type TraitClass = 'endurance' | 'tempo' | 'breadth';

/** steady = low gap variability; bursty = spiky gaps or single tight cluster. */
export function classifyRhythm(s: WindowSignals): RhythmKind {
  return s.gapCv >= 1 ? 'bursty' : 'steady';
}

const ENDURANCE: ReadonlySet<TraitId> = new Set(['marathoner', 'deepdiver']);
const TEMPO: ReadonlySet<TraitId> = new Set(['sprinter', 'swarm']);
const BREADTH: ReadonlySet<TraitId> = new Set(['polyglot', 'switcher', 'polyhost']);

/** Dominant trait class of a window's triggered traits (design §7 Evolved fork). */
export function dominantTraitClass(traits: readonly TraitId[]): TraitClass {
  let e = 0;
  let t = 0;
  let b = 0;
  for (const tr of traits) {
    if (ENDURANCE.has(tr)) e++;
    else if (TEMPO.has(tr)) t++;
    else if (BREADTH.has(tr)) b++;
  }
  // Ties resolve deterministically: endurance > tempo > breadth.
  if (e >= t && e >= b) return 'endurance';
  if (t >= b) return 'tempo';
  return 'breadth';
}

/**
 * Evaluate which traits trigger for this window. Pure threshold logic over the
 * signals; all model-neutral. Returns ids in a stable order.
 */
export function evaluateTraits(s: WindowSignals): TraitId[] {
  const out: TraitId[] = [];
  if (s.eventCount === 0) return out;

  // Marathoner: rode the window near its cap (broad span of continuous-ish use).
  if (s.capProximity >= 0.8 && s.eventCount >= 4) out.push('marathoner');
  // Sprinter: short intense bursts with long gaps (spiky rhythm, few sessions).
  if (s.gapCv >= 1.2 && s.eventCount >= 3 && s.capProximity < 0.8) out.push('sprinter');
  // Polyglot: 3+ languages/file types touched.
  if (s.langCount >= 3) out.push('polyglot');
  // Nightshade: majority usage after midnight / late night.
  if (s.nightFraction > 0.5) out.push('nightshade');
  // Daybreaker: meaningful pre-9am sessions.
  if (s.morningFraction > 0.5) out.push('daybreaker');
  // Switcher: changed model ids mid-window (never punishes mono-model).
  if (s.modelCount >= 2) out.push('switcher');
  // Deepdiver: one long continuous conversation thread.
  if (s.longestSessionEvents >= 6 && s.sessionCount <= 2) out.push('deepdiver');
  // Swarm: many parallel short sessions.
  if (s.shortSessionCount >= 3 && s.sessionCount >= 3) out.push('swarm');
  // Polyhost: meaningful usage from 2+ provider adapters in one window.
  if (s.adapterCount >= 2) out.push('polyhost');

  return out;
}
