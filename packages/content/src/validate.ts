/**
 * Pack validation helpers.
 *
 * Each function checks one concern and returns an array of error strings.
 * validatePack() is the public entry point — it concatenates all results.
 */
import type { ContentPack, House, TraitId } from '@token-tamers/core';

const HOUSES: readonly House[] = ['aether', 'cipher', 'flux', 'forge', 'wild'];
const TRAIT_IDS: readonly TraitId[] = [
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

// ---------------------------------------------------------------------------
// Duplicate id checkers
// ---------------------------------------------------------------------------

function checkDuplicateSpeciesIds(pack: ContentPack): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const seenNums = new Set<number>();
  for (const sp of pack.species) {
    if (seenIds.has(sp.id)) errors.push(`Duplicate species id: ${sp.id}`);
    seenIds.add(sp.id);
    if (seenNums.has(sp.num)) errors.push(`Duplicate species num: ${sp.num} (species ${sp.id})`);
    seenNums.add(sp.num);
  }
  return errors;
}

function checkDuplicateHabitatIds(pack: ContentPack): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const h of pack.habitats) {
    if (seen.has(h.id)) errors.push(`Duplicate habitat id: ${h.id}`);
    seen.add(h.id);
  }
  return errors;
}

function checkDuplicateTrinketIds(pack: ContentPack): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const t of pack.trinkets) {
    if (seen.has(t.id)) errors.push(`Duplicate trinket id: ${t.id}`);
    seen.add(t.id);
  }
  return errors;
}

function checkDuplicateSpriteIds(pack: ContentPack): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const s of pack.sprites) {
    if (seen.has(s.id)) errors.push(`Duplicate sprite id: ${s.id}`);
    seen.add(s.id);
  }
  return errors;
}

function checkDuplicateAchievementIds(pack: ContentPack): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const a of pack.achievements) {
    if (seen.has(a.id)) errors.push(`Duplicate achievement id: ${a.id}`);
    seen.add(a.id);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Sprite reference checkers
// ---------------------------------------------------------------------------

function checkSpriteRefs(pack: ContentPack): string[] {
  const errors: string[] = [];
  const spriteIds = new Set(pack.sprites.map((s) => s.id));

  for (const sp of pack.species) {
    if (!spriteIds.has(sp.spriteId)) {
      errors.push(`Species ${sp.id} references unknown spriteId: ${sp.spriteId}`);
    }
  }
  for (const h of pack.habitats) {
    if (!spriteIds.has(h.spriteId)) {
      errors.push(`Habitat ${h.id} references unknown spriteId: ${h.spriteId}`);
    }
  }
  for (const t of pack.trinkets) {
    if (!spriteIds.has(t.spriteId)) {
      errors.push(`Trinket ${t.id} references unknown spriteId: ${t.spriteId}`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Evolution target / default-branch checkers
// ---------------------------------------------------------------------------

function checkEvolutionTargets(pack: ContentPack): string[] {
  const errors: string[] = [];
  const speciesIds = new Set(pack.species.map((s) => s.id));

  for (const sp of pack.species) {
    for (const branch of sp.evolvesTo) {
      if (!speciesIds.has(branch.species)) {
        errors.push(`Species ${sp.id} evolvesTo unknown species: ${branch.species}`);
      }
    }
    if (sp.evolvesTo.length > 0) {
      const hasDefault = sp.evolvesTo.some((b) => b.when.kind === 'default');
      if (!hasDefault) {
        errors.push(`Species ${sp.id} has evolvesTo branches but no 'default' branch`);
      }
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Achievement reward checker
// ---------------------------------------------------------------------------

function checkAchievementRewards(pack: ContentPack): string[] {
  const errors: string[] = [];
  const habitatIds = new Set(pack.habitats.map((h) => h.id));
  const trinketIds = new Set(pack.trinkets.map((t) => t.id));

  for (const a of pack.achievements) {
    if (!a.reward) continue;
    if (a.reward.kind === 'habitat' && !habitatIds.has(a.reward.id)) {
      errors.push(`Achievement ${a.id} rewards unknown habitat: ${a.reward.id}`);
    }
    if (a.reward.kind === 'trinket' && !trinketIds.has(a.reward.id)) {
      errors.push(`Achievement ${a.id} rewards unknown trinket: ${a.reward.id}`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Stat budget checker
// ---------------------------------------------------------------------------

function checkStatBudgets(pack: ContentPack): string[] {
  const errors: string[] = [];
  const stageGroups = new Map<string, number[]>();

  for (const sp of pack.species) {
    const total = sp.statWeights.pwr + sp.statWeights.spd + sp.statWeights.wis + sp.statWeights.grt;
    const list = stageGroups.get(sp.stage) ?? [];
    list.push(total);
    stageGroups.set(sp.stage, list);
  }
  for (const [stage, totals] of stageGroups) {
    const first = totals[0];
    if (first === undefined) continue;
    for (const t of totals) {
      if (t !== first) {
        errors.push(`Unequal stat budget in stage '${stage}': expected ${first} but found ${t}`);
      }
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Model rule checker
// ---------------------------------------------------------------------------

function checkModelRules(pack: ContentPack): string[] {
  const errors: string[] = [];
  const seenPatterns = new Set<string>();
  for (const m of pack.models) {
    if (seenPatterns.has(m.pattern)) errors.push(`Duplicate model pattern: ${m.pattern}`);
    seenPatterns.add(m.pattern);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Battle ruleset checker
// ---------------------------------------------------------------------------

function checkBattleRuleset(pack: ContentPack): string[] {
  const errors: string[] = [];
  const b = pack.battle;
  if (!b) return ['Missing battle ruleset'];
  if (!Number.isInteger(b.version) || b.version < 1) {
    errors.push(`Battle ruleset version must be an integer >= 1, got ${b.version}`);
  }
  if (!(b.variance >= 0 && b.variance <= 1)) {
    errors.push(`Battle variance must be within 0..1, got ${b.variance}`);
  }
  for (const m of b.wheel) {
    if (!HOUSES.includes(m.attacker))
      errors.push(`Battle wheel unknown attacker House: ${m.attacker}`);
    if (!HOUSES.includes(m.defender))
      errors.push(`Battle wheel unknown defender House: ${m.defender}`);
    if (!(m.multiplier > 0) || !Number.isFinite(m.multiplier)) {
      errors.push(`Battle wheel multiplier must be finite and > 0, got ${m.multiplier}`);
    }
  }
  for (const p of b.procs) {
    if (!TRAIT_IDS.includes(p.trait)) errors.push(`Battle proc unknown trait: ${p.trait}`);
    if (!TRAIT_IDS.includes(p.counters))
      errors.push(`Battle proc unknown counter trait: ${p.counters}`);
    if (!(p.multiplier > 0) || !Number.isFinite(p.multiplier)) {
      errors.push(`Battle proc multiplier must be finite and > 0, got ${p.multiplier}`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Validates a ContentPack for internal consistency.
 * Returns an array of error strings; an empty array means the pack is valid.
 */
export function validatePack(pack: ContentPack): string[] {
  return [
    ...checkDuplicateSpeciesIds(pack),
    ...checkDuplicateHabitatIds(pack),
    ...checkDuplicateTrinketIds(pack),
    ...checkDuplicateSpriteIds(pack),
    ...checkDuplicateAchievementIds(pack),
    ...checkSpriteRefs(pack),
    ...checkEvolutionTargets(pack),
    ...checkAchievementRewards(pack),
    ...checkStatBudgets(pack),
    ...checkModelRules(pack),
    ...checkBattleRuleset(pack),
  ];
}
