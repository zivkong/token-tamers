/**
 * Grade roll math helpers.
 */

import { GRADE_ORDER, type Grade } from '../types';

export function gradeAtLeast(current: Grade, target: Grade): boolean {
  return GRADE_ORDER.indexOf(current) >= GRADE_ORDER.indexOf(target);
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
