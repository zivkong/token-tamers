/**
 * The battle RNG seed (design §11: `outcome = f(hashA, hashB, ruleset_version)`).
 *
 * The seed is a deterministic FNV-1a/32 fold over a canonical serialization of
 * both combatants' identity-and-stat fields plus the ruleset version. Because a
 * DNA code encodes exactly those fields, hashing the combatants is equivalent to
 * hashing the two codes — so the same two pets under the same ruleset version
 * always replay identically, forever. Pure: no clock, no ambient randomness
 * (invariant 5).
 *
 * (FNV-1a is reimplemented here over a char stream rather than reaching into the
 * DNA codec's byte-array `fnv32`, keeping the battle folder independent of the
 * codec's internals.)
 */

import type { Combatant } from '../types';

/** Stable, side-independent-per-combatant serialization of the battle inputs. */
function canonical(c: Combatant): string {
  const s = c.stats;
  const traits = [...c.traits].sort().join('+');
  return `${c.speciesNum},${c.house},${c.grade},${c.stage},${s.pwr},${s.spd},${s.wis},${s.grt},${traits}`;
}

/** FNV-1a/32 over a string's char codes. Deterministic, not cryptographic. */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i) & 0xff;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic 32-bit seed for a battle between `a` and `b` under `version`.
 * Side A and side B are ordered (a then b), so swapping sides is a distinct —
 * but still reproducible — battle (turn order/variance depend on the seed).
 */
export function battleSeed(a: Combatant, b: Combatant, version: number): number {
  return fnv1a(`${version}|${canonical(a)}|${canonical(b)}`);
}
