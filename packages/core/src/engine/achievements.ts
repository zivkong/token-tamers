/**
 * Achievement condition evaluation helpers and pattern satisfaction check.
 */

import {
  STAGE_ORDER,
  type AchievementCondition,
  type AchievementDef,
  type GameState,
  type PatternDef,
  type SpeciesDef,
  type Stage,
  type TraitId,
} from '../types';
import { gradeAtLeast } from './grades';

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
      return false;
  }
}
