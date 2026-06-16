/**
 * Combatant adapters + effective-stats (design §11).
 *
 * A {@link Combatant} is the common subset of a DexSnapshot and a DecodedDna, so
 * a live pet, an Archive record, and a pasted `TTX…` code all feed ONE battle
 * engine. These adapters are pure and pack-agnostic — the caller resolves the
 * display `name` (from the content pack) and passes it in; an unresolved foreign
 * code becomes a dormant '???' combatant (invariant 7).
 */

import type { Combatant, DexSnapshot, Stats } from '../types';
import type { DecodedDna } from '../dna';
import { GRADE_STAT_FLOOR } from '../engine/constants';

/** Build a combatant from a captured snapshot (live pet / Archive record). */
export function combatantFromSnapshot(
  snap: DexSnapshot,
  speciesNum: number,
  name: string,
): Combatant {
  return {
    speciesNum,
    speciesId: snap.speciesId,
    name,
    house: snap.house,
    grade: snap.grade,
    stage: snap.stage,
    stats: { ...snap.stats },
    traits: [...snap.traits],
  };
}

/**
 * Build a combatant from a decoded DNA code. A decoded code carries no species
 * id; the caller resolves a display `name` from the pack by `speciesNum` (or
 * passes '???' for content this client doesn't have — invariant 7).
 */
export function combatantFromDecoded(decoded: DecodedDna, name: string): Combatant {
  return {
    speciesNum: decoded.speciesNum,
    speciesId: '',
    name,
    house: decoded.house,
    grade: decoded.grade,
    stage: decoded.stage,
    stats: { ...decoded.stats },
    traits: [...decoded.traits],
  };
}

/**
 * The combatant's EFFECTIVE battle stats: the recorded equal-budget stats with
 * the grade stat-floor applied (S ≈ +5%, design §11). Returns a fresh object —
 * the floor is battle-only and is NEVER written back to the snapshot/state, so
 * horizontal evolution's equal stat budgets hold (invariant 3). Grade-based
 * only, never model-derived.
 */
export function effectiveStats(c: Combatant): Stats {
  const floor = 1 + (GRADE_STAT_FLOOR[c.grade] ?? 0);
  return {
    pwr: Math.round(c.stats.pwr * floor),
    spd: Math.round(c.stats.spd * floor),
    wis: Math.round(c.stats.wis * floor),
    grt: Math.round(c.stats.grt * floor),
  };
}
