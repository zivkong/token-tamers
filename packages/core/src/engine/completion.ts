/**
 * Completion meter math — weighted union of Dex, achievements, habitats, trinkets.
 */

import type { ContentPack, GameState } from '../types';

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface CompletionResult {
  overall: number;
  dex: number;
  achievements: number;
  habitats: number;
  trinkets: number;
}

export function computeCompletion(state: GameState, pack: ContentPack): CompletionResult {
  const dexTotal = pack.dexTotal || 1;
  const achTotal = pack.achievements.length || 1;
  const habTotal = pack.habitats.length || 1;
  const trkTotal = pack.trinkets.length || 1;

  const dex = clamp01(state.dexOwned.length / dexTotal);
  const achievements = clamp01(Object.keys(state.achievementsEarned).length / achTotal);
  const habitats = clamp01(state.habitatsUnlocked.length / habTotal);
  const trinkets = clamp01(state.trinketsUnlocked.length / trkTotal);

  const overall = dex * 0.4 + achievements * 0.4 + habitats * 0.1 + trinkets * 0.1;
  return {
    overall: round1(overall * 100),
    dex: round1(dex * 100),
    achievements: round1(achievements * 100),
    habitats: round1(habitats * 100),
    trinkets: round1(trinkets * 100),
  };
}
