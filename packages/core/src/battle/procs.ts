/**
 * Trait behavioral counters (design §11) — e.g. Sprinter counters Marathoner,
 * Deepdiver counters Swarm. The proc table is CONTENT DATA (the ruleset's
 * `procs`), never hardcoded (invariant 9), and is trait-based, never model-based
 * (invariant 3). Pure.
 */

import type { BattleRuleset, TraitId } from '../types';

/** The combined trait-counter effect of an attacker's hit against a defender. */
export interface ProcResult {
  /** Product of every matching counter's multiplier (1 when none fire). */
  multiplier: number;
  /** The attacker traits that countered the defender, in ruleset order. */
  procs: TraitId[];
}

/**
 * Resolve every trait counter that fires when `attackerTraits` strikes
 * `defenderTraits`. Each matching counter multiplies the hit; the matched
 * attacker traits are returned (for the battle-log 'proc' event).
 */
export function resolveProcs(
  attackerTraits: readonly TraitId[],
  defenderTraits: readonly TraitId[],
  ruleset: BattleRuleset,
): ProcResult {
  let multiplier = 1;
  const procs: TraitId[] = [];
  for (const p of ruleset.procs) {
    if (attackerTraits.includes(p.trait) && defenderTraits.includes(p.counters)) {
      multiplier *= p.multiplier;
      procs.push(p.trait);
    }
  }
  return { multiplier, procs };
}
