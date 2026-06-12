/**
 * Activity modifier — scales grade-roll base odds (design §12).
 *
 * Built from model-neutral signals only: consistency vs the player's own
 * baseline (essenceRatio), trait synergy, and rhythm quality. Never reads
 * absolute token volume or model id.
 */

import type { TraitId } from '../types';
import type { WindowSignals } from './signals';

/**
 * Activity modifier in [0.5, 2.0] that scales grade-roll base odds.
 * Model-neutral: the only volume measure is essenceRatio (relative to the
 * player's own past windows), so 10x absolute tokens with the same pattern
 * yields the same modifier.
 */
export function activityModifier(s: WindowSignals, traits: readonly TraitId[]): number {
  if (s.eventCount === 0) return 0.5;

  // Consistency vs own baseline: on-or-above baseline is good, thin is penalized.
  const consistency = Math.max(0, Math.min(1, s.essenceRatio));
  // Trait synergy: more distinct triggered traits this window => higher odds.
  const synergy = Math.min(1, traits.length / 4);
  // Rhythm quality: steady, well-spread windows read as "excellent".
  const rhythm = Math.max(0, Math.min(1, s.capProximity));

  // Weighted blend in [0,1], then map to [0.5, 2.0].
  const quality = 0.45 * consistency + 0.3 * synergy + 0.25 * rhythm;
  const mod = 0.5 + quality * 1.5;
  return Math.max(0.5, Math.min(2.0, mod));
}
