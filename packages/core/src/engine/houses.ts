/**
 * Model-pattern matching, House/gene resolution, and species stat budgeting.
 */

import type { ModelRule, PetState, SpeciesDef, Stats, UsageEvent } from '../types';
import { STAGE_STAT_BUDGET } from './constants';

/** First-match-wins model->House/gene resolution with '*' wildcard support. */
export function matchModelRule(rules: readonly ModelRule[], modelId: string): ModelRule | null {
  for (const rule of rules) {
    if (globMatch(rule.pattern, modelId)) return rule;
  }
  return null;
}

/** Minimal glob: '*' matches any run of chars. Anchored full-string match. */
function globMatch(pattern: string, value: string): boolean {
  if (pattern === '*') return true;
  // Build a regex from the glob, escaping regex metachars except '*'.
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(value);
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

/** Filter events to a single adapter's contribution inside a window. */
export function windowEvents(
  events: readonly UsageEvent[],
  adapter: string,
  windowStart: number,
  windowEnd: number,
): UsageEvent[] {
  return events.filter((e) => e.adapter === adapter && e.ts >= windowStart && e.ts < windowEnd);
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
