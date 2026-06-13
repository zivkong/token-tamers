/**
 * Grade roll math helpers.
 */

import { GRADE_ORDER, type Grade } from '../types';
import { VITALITY_FULL_TOKENS, VITALITY_MAX_BONUS } from './constants';

export function gradeAtLeast(current: Grade, target: Grade): boolean {
  return GRADE_ORDER.indexOf(current) >= GRADE_ORDER.indexOf(target);
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Capped vitality bonus added to a grade roll from the closing window's RAW
 * token volume (hybrid FOMO). 0 at no usage, ramping linearly to
 * VITALITY_MAX_BONUS at VITALITY_FULL_TOKENS and clamped there — so a bigger
 * session helps the molt, but the bonus can never run away. Pure + deterministic.
 */
export function vitalityBonus(totalTokens: number): number {
  const frac = Math.max(0, Math.min(1, totalTokens / VITALITY_FULL_TOKENS));
  return frac * VITALITY_MAX_BONUS;
}
