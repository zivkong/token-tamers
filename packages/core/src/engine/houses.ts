/**
 * Model-pattern matching, House/gene resolution, and species stat budgeting.
 */

import type { ContentPack, House, ModelRule, PetState, SpeciesDef, Stats } from '../types';
import { STAGE_STAT_BUDGET } from './constants';

/** First-match-wins model->House/gene resolution with '*' wildcard support. */
export function matchModelRule(rules: readonly ModelRule[], modelId: string): ModelRule | null {
  for (const rule of rules) {
    if (globMatch(rule.pattern, modelId)) return rule;
  }
  return null;
}

/**
 * Minimal glob: '*' matches any run of chars. Anchored, CASE-INSENSITIVE match.
 * Case folding lets one lowercase pattern (e.g. `minimax*`) match a provider's
 * canonical CamelCase slug (`MiniMax-Text-01`, `MiMo-7B-RL`). Model ids carry no
 * case-significant identity, so this never collides existing lowercase rules.
 * Keep in lockstep with `@token-tamers/content`'s `matchesGlob`.
 */
function globMatch(pattern: string, value: string): boolean {
  if (pattern === '*') return true;
  // Build a regex from the glob, escaping regex metachars except '*'.
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i').test(value);
}

/**
 * Houses that actually have a sprite-stage species (i.e. a real evolution line).
 * Used as the alternate pool for the salt House pick so we never land a player in
 * a House with no species of its own (which would fall back to a generic sprite).
 */
export function housesWithSpecies(pack: ContentPack): House[] {
  const seen = new Set<House>();
  for (const sp of pack.species) {
    // `hybrid` is a fusion marker, not a pickable House — skip it.
    if (sp.stage === 'sprite' && sp.house !== 'hybrid') seen.add(sp.house);
  }
  // Deterministic order (Set iteration follows insertion, which follows pack order).
  return [...seen];
}

/**
 * Deterministic [0,1) from a salt. A single mulberry32 step — a PURE function of
 * the salt, independent of the molt RNG stream (so existing pets' rolls are
 * untouched). Two independent draws come from salt and a tweaked salt.
 */
function saltUnit(salt: number): number {
  let t = (salt + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Cosmetic House pick at hatch (invariant 3 — never touches mechanics). With
 * probability `pack.houseBias` (default 0.5) keep `home` (the essence-winning
 * House); otherwise the salt deterministically picks one of the other
 * species-bearing Houses. `salt === undefined` ⇒ pure model-derived House
 * (legacy behavior, existing saves/tests unaffected).
 */
export function biasedHouse(pack: ContentPack, home: House, salt: number | undefined): House {
  if (salt === undefined) return home;
  if (saltUnit(salt) < (pack.houseBias ?? 0.5)) return home;
  const others = housesWithSpecies(pack).filter((h) => h !== home);
  if (others.length === 0) return home;
  const idx = Math.floor(saltUnit((salt ^ 0x9e3779b9) >>> 0) * others.length);
  return others[idx] ?? home;
}

/** Distribute the stage budget across stats proportional to species weights. */
export function statsForSpecies(species: SpeciesDef): Stats {
  const w = species.statWeights;
  const total = w.pwr + w.spd + w.wis + w.grt || 1;
  const scale = STAGE_STAT_BUDGET / total;
  return {
    pwr: Math.round(w.pwr * scale),
    spd: Math.round(w.spd * scale),
    wis: Math.round(w.wis * scale),
    grt: Math.round(w.grt * scale),
  };
}

export function cloneStats(s: Stats): Stats {
  return { pwr: s.pwr, spd: s.spd, wis: s.wis, grt: s.grt };
}

/**
 * Apply the inheritance floor to fresh stage stats: the new pet's stats are the
 * fresh budget, but never below the carried floor (per-stat). The floor lives on
 * the new egg's stats until the first commit; we read it off pet.stats which the
 * rebirth path seeded with the carried values.
 */
export function scaleInheritedStats(fresh: Stats, pet: PetState): Stats {
  const floor = pet.stats;
  return {
    pwr: Math.max(fresh.pwr, floor.pwr),
    spd: Math.max(fresh.spd, floor.spd),
    wis: Math.max(fresh.wis, floor.wis),
    grt: Math.max(fresh.grt, floor.grt),
  };
}
