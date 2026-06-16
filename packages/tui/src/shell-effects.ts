/**
 * Transient UI effects: the gradeshift / evolution / rebirth / copy flash banner.
 * Split out of `shell.ts` to keep that file under the line ceiling.
 */

import type { GameEffect } from '@token-tamers/core';

/** The slice of the shell runtime a flash mutates. */
export interface FlashTarget {
  flash: string | null;
  flashUntilFrame: number;
  frame: number;
}

/** Show a transient banner for ~2 seconds of frames (assumes the ~30fps cadence). */
export function flash(rt: FlashTarget, msg: string): void {
  rt.flash = msg;
  rt.flashUntilFrame = rt.frame + 60;
}

/** Translate engine effects into transient flash banners (the only UI they drive today). */
export function applyEffects(rt: FlashTarget, effects: GameEffect[]): void {
  for (const e of effects) {
    if (e.type === 'gradeshift') {
      flash(rt, `✦ Grade up! ${e.from} → ${e.to} (${Math.round(e.chance * 100)}%)`);
    } else if (e.type === 'evolved') {
      flash(rt, `✦ Evolved: ${e.from} → ${e.to}`);
    } else if (e.type === 'grade_roll_failed') {
      flash(rt, `Grade held at ${e.grade} (${Math.round(e.chance * 100)}%)`);
    } else if (e.type === 'rebirth') {
      flash(rt, `↻ Rebirth — legacy grade ${e.legacyGrade}, gen ${e.newGeneration}`);
    }
  }
}
