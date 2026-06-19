/**
 * Stat-derived combat-mechanic chances (design §11) — dodge, crit, parry, and the
 * double-strike. Each chance is a pure function of the governing EFFECTIVE stat, so
 * a higher grade (via the grade stat-floor in {@link effectiveStats}) gently lifts
 * every proc — never a model id (invariant 3). The rates themselves are content data
 * ({@link BattleMechanics}); only the stat→mechanic mapping is fixed here (invariant 9).
 *
 * The roll itself runs in the turn loop against the seeded battle RNG, so a fixed
 * matchup always procs identically — variety comes from the battle nonce, not from
 * ambient randomness (invariant 5).
 */

import type { MechanicTuning } from '../types';

/**
 * Resolve a mechanic's chance for a governing `stat`:
 * `clamp(base + (max(0, stat) / scale) * perPoint, 0, cap)`. The stat is clamped at
 * 0 (a SPD disadvantage never yields a negative dodge chance), and the result is
 * hard-capped so grade stays an edge, never a runaway.
 */
export function mechanicChance(t: MechanicTuning, stat: number): number {
  const raw = t.base + (Math.max(0, stat) / t.scale) * t.perPoint;
  return Math.min(t.cap, Math.max(0, raw));
}
