/**
 * Achievement condition evaluation helpers and pattern satisfaction check.
 */

import {
  STAGE_ORDER,
  type AchievementCondition,
  type AchievementDef,
  type AchievementReward,
  type ContentPack,
  type GameEffect,
  type GameState,
  type PatternDef,
  type SpeciesDef,
  type Stage,
  type TraitId,
} from '../types';
import { gradeAtLeast } from './grades';

/**
 * The reward list for an achievement: `rewards` if present (supersedes), else the
 * single `reward`, else none. The ONE place reward access is normalized — every
 * consumer (grant, titles, validation, UI) reads through this.
 */
export function achievementRewards(def: AchievementDef): AchievementReward[] {
  if (def.rewards && def.rewards.length > 0) return def.rewards;
  return def.reward ? [def.reward] : [];
}

export function reachedStage(current: Stage, target: Stage): boolean {
  return STAGE_ORDER.indexOf(current) >= STAGE_ORDER.indexOf(target);
}

export function patternSatisfied(def: PatternDef, traits: readonly TraitId[]): boolean {
  if (def.requiresTraits && def.requiresTraits.length > 0) {
    return def.requiresTraits.every((t) => traits.includes(t));
  }
  if (def.minDistinctTraits && def.minDistinctTraits > 0) {
    return new Set(traits).size >= def.minDistinctTraits;
  }
  return false;
}

export interface AchievementContext {
  dexTotal: number;
  lookupSpecies: (id: string) => SpeciesDef | undefined;
}

/**
 * Award every newly-met achievement: stamp `achievementsEarned`, push an effect,
 * and grant any habitat/trinket reward. Idempotent — an already-earned id is
 * skipped. Deterministic (no clock/RNG): all timestamps come from `at`.
 */
export function evaluateAchievements(
  state: GameState,
  pack: ContentPack,
  at: number,
  effects: GameEffect[],
): void {
  const ctx: AchievementContext = {
    dexTotal: pack.dexTotal,
    lookupSpecies: (id) => pack.species.find((sp) => sp.id === id),
  };
  for (const def of pack.achievements) {
    if (state.achievementsEarned[def.id] !== undefined) continue;
    if (!achievementConditionMet(def, state, ctx)) continue;
    state.achievementsEarned[def.id] = at;
    effects.push({ type: 'achievement', id: def.id });
    grantReward(state, def, effects);
  }
}

/** Unlock every habitat/trinket an earned achievement grants (auto-equips first habitat). */
function grantReward(state: GameState, def: AchievementDef, effects: GameEffect[]): void {
  for (const reward of achievementRewards(def)) grantOne(state, reward, effects);
}

function grantOne(state: GameState, reward: AchievementReward, effects: GameEffect[]): void {
  if (reward.kind === 'habitat' && !state.habitatsUnlocked.includes(reward.id)) {
    state.habitatsUnlocked.push(reward.id);
    if (state.selectedHabitat === '') state.selectedHabitat = reward.id;
    effects.push({ type: 'habitat_unlocked', id: reward.id });
  } else if (reward.kind === 'trinket' && !state.trinketsUnlocked.includes(reward.id)) {
    state.trinketsUnlocked.push(reward.id);
    effects.push({ type: 'trinket_unlocked', id: reward.id });
  }
}

/** Evaluate whether an achievement condition is met, given current state. */
export function achievementConditionMet(
  def: AchievementDef,
  state: GameState,
  ctx: AchievementContext,
): boolean {
  const c: AchievementCondition = def.condition;
  const pet = state.pet;
  switch (c.type) {
    case 'stage_reached':
      return (
        reachedStage(pet.stage, c.stage) ||
        state.dexOwned.some((id) => {
          const sp = ctx.lookupSpecies(id);
          return sp ? reachedStage(sp.stage, c.stage) : false;
        })
      );
    case 'grade_reached':
      return (
        gradeAtLeast(pet.grade, c.grade) ||
        state.archive.some((r) => gradeAtLeast(r.grade, c.grade))
      );
    case 'trait_earned':
      return pet.traits.filter((t) => t === c.trait).length >= c.count;
    case 'pattern_first':
      return pet.pattern === c.pattern;
    case 'generation':
      return pet.generation >= c.count;
    case 'molt_count_lifetime':
      return pet.moltCount >= c.count;
    case 'dormant_survived':
      return pet.dormant === true;
    case 'house_apex':
      return state.archive.some((r) => {
        const sp = ctx.lookupSpecies(r.speciesId);
        return sp?.house === c.house && sp.stage === 'apex';
      });
    case 'dex_percent':
      return (state.dexOwned.length / (ctx.dexTotal || 1)) * 100 >= c.percent;
    case 'distinct_traits_one_life':
      return new Set(pet.traits).size >= c.count;
    default:
      return tallyConditionMet(c, state);
  }
}

/**
 * Token-spending & battle-record conditions (the SCHEMA_VERSION-5 tally Feats),
 * split out to keep {@link achievementConditionMet} under the complexity ceiling.
 */
function tallyConditionMet(c: AchievementCondition, state: GameState): boolean {
  switch (c.type) {
    case 'lifetime_tokens':
      return (state.lifetimeTokens ?? 0) >= c.tokens;
    case 'battles_won':
      return (state.battleRecord?.won ?? 0) >= c.count;
    case 'battles_played':
      return (state.battleRecord?.played ?? 0) >= c.count;
    case 'battle_streak':
      return (state.battleRecord?.bestStreak ?? 0) >= c.count;
    default:
      return false;
  }
}
