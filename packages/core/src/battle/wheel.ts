/**
 * The 4-House type wheel (design §11) — Aether > Cipher > Flux > Forge > Aether,
 * with Wild neutral. All multipliers are CONTENT DATA (the ruleset's `wheel`),
 * never hardcoded here (invariant 9). The wheel is circular by construction, so
 * no House — and thus no model — is ever net-stronger (invariant 3). Pure.
 */

import type { BattleRuleset, House } from '../types';

/**
 * Damage multiplier when `attacker`'s House strikes `defender`'s House. Any pair
 * absent from the ruleset wheel (including every Wild pairing) is neutral (1.0),
 * so Wild suffers no disadvantage and gains no advantage.
 */
export function typeMultiplier(attacker: House, defender: House, ruleset: BattleRuleset): number {
  for (const m of ruleset.wheel) {
    if (m.attacker === attacker && m.defender === defender) return m.multiplier;
  }
  return 1;
}
