/**
 * Window and week time math — constants, floor helpers, and event constructors.
 */

import type { MoltEvent, RebirthEvent, UsageEvent } from '../types';

export const WINDOW_MS = 5 * 60 * 60 * 1000;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Egg fast-hatch span (design §5). A newly placed egg hatches this soon after
 * its first feeding rather than waiting for a full 5-h window to close. See
 * {@link eggHatchMolts}.
 */
export const EGG_HATCH_MS = 10 * 60 * 1000;

/** Floor `ts` to the start of its fixed window tiled from `anchor`. */
export function windowStartFor(ts: number, anchor: number): number {
  const delta = ts - anchor;
  const k = Math.floor(delta / WINDOW_MS);
  return anchor + k * WINDOW_MS;
}

/** Floor `ts` to the start of its fixed 7-day week tiled from `weekAnchor`. */
export function weekStartFor(ts: number, weekAnchor: number): number {
  const delta = ts - weekAnchor;
  const k = Math.floor(delta / WEEK_MS);
  return weekAnchor + k * WEEK_MS;
}

export function makeMolt(windowStart: number, windowEnd: number): MoltEvent {
  return { type: 'molt', at: windowEnd, windowStart, windowEnd };
}

export function makeRebirth(weekStart: number): RebirthEvent {
  const weekEnd = weekStart + WEEK_MS;
  return { type: 'rebirth', at: weekEnd, weekStart, weekEnd };
}

/**
 * Egg fast-hatch checkpoints: one extra `hatch` molt per used week, fired
 * EGG_HATCH_MS after that week's FIRST event, on top of the normal 5-h windows.
 *
 * Every generation begins as an egg at a week boundary (rebirth), so one hatch
 * checkpoint per week covers every egg. These are ADDITIVE — they never alter
 * the normal window chain — and the engine only lets one ACT while the pet is
 * an egg (hatching it early); otherwise it is a no-op. Pure function of (events,
 * weekAnchor): deterministic under any advance granularity. An unhatched egg
 * implies no molt has consumed this week's events yet, so the buffer is intact
 * and the week's first event is always correctly identified.
 */
export function eggHatchMolts(
  events: readonly UsageEvent[],
  weekAnchor: number,
  after: number,
  now: number,
): MoltEvent[] {
  const firstByWeek = new Map<number, number>();
  for (const ev of events) {
    const week = weekStartFor(ev.ts, weekAnchor);
    const prev = firstByWeek.get(week);
    if (prev === undefined || ev.ts < prev) firstByWeek.set(week, ev.ts);
  }
  const out: MoltEvent[] = [];
  for (const first of firstByWeek.values()) {
    const end = first + EGG_HATCH_MS;
    if (end > after && end <= now) {
      out.push({ type: 'molt', at: end, windowStart: first, windowEnd: end, hatch: true });
    }
  }
  out.sort((a, b) => a.at - b.at);
  return out;
}
