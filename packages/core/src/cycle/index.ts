/**
 * Cycle derivation: turn a sorted UsageEvent stream + the pet-global CycleConfig
 * into the two abstract events the engine consumes — MoltEvent (5-h window close)
 * and RebirthEvent (week boundary). Design §5.
 *
 * ONE clock per pet (never per adapter — the pet has a single life):
 *  - **static** (API / fixed anchor): fixed 5-h windows tiled from `weekAnchor`,
 *    plus fixed 7-day weeks. A window only molts if it contained usage from ANY
 *    adapter.
 *  - **subscription**: 5-h session windows inferred from usage gaps in the ANCHOR
 *    adapter's stream — a window opens at the first anchor event, closes 5 h
 *    later; the next anchor event at/after the close opens a fresh window. Other
 *    adapters never open or move windows; they only feed essence into whatever
 *    window is open (handled by the engine). Weeks are anchored like static.
 *
 * Pure: time enters only as event timestamps and config anchors.
 */

import type { CycleConfig, CycleEvent, MoltEvent, RebirthEvent, UsageEvent } from '../types';
import { dynamicMolts } from './dynamic';
import { staticMolts } from './static';
import {
  makeRebirth,
  WEEK_MS,
  weekStartFor,
  WINDOW_MS,
  windowDrivingEvents,
  windowStartFor,
} from './windows';

export {
  EGG_HATCH_MS,
  eggHatchMolts,
  WEEK_MS,
  weekStartFor,
  WINDOW_MS,
  windowDrivingEvents,
} from './windows';
export { unconsumedEvents } from './pending';

/**
 * Derive the cycle events whose `at` (close time) falls in `(after, now]`.
 *
 * `events` must be sorted ascending by `ts` and may span all adapters. `after` is
 * the high-water mark of already-processed cycle closes (exclusive); only closes
 * strictly after it and at or before `now` are emitted. Rebirths and molts that
 * close at the same instant are ordered molt-first (the week's final molt precedes
 * its rebirth).
 */
export function deriveCycleEvents(
  events: readonly UsageEvent[],
  cycle: CycleConfig,
  after: number,
  now: number,
): CycleEvent[] {
  const molts =
    cycle.policy === 'static'
      ? staticMolts(events, cycle.weekAnchor, after, now)
      : dynamicMolts(windowDrivingEvents(events, cycle), after, now);

  const rebirths = weekRebirths(effectiveWeekAnchor(events, cycle.weekAnchor), after, now);

  return mergeOrdered(molts, rebirths);
}

/**
 * Forecast the next molt-window close strictly after `now` — the instant the
 * current 5-h window shuts and a molt (stage progress + grade roll) can fire. The
 * UI's "next roll" / growth countdown reads this; it mirrors the same window math
 * `deriveCycleEvents` / `unconsumedEvents` use, so the countdown lands on the real
 * molt instant.
 *
 * - **static**: always the close of the fixed tile containing `now` (a molt only
 *   fires there if the tile is used, but the tile boundary is the next opportunity).
 * - **subscription**: the close of the OPEN inferred window (its first anchor event
 *   + WINDOW_MS), or `null` when the pet is idle — every anchor window has already
 *   closed, so no molt is scheduled until fresh usage opens a new one.
 *
 * Pure forecast: no state change, time enters only as `now` + event timestamps.
 */
export function nextMoltCloseAt(
  events: readonly UsageEvent[],
  cycle: CycleConfig,
  now: number,
): number | null {
  if (cycle.policy === 'static') {
    return windowStartFor(now, cycle.weekAnchor) + WINDOW_MS;
  }
  const driving = [...windowDrivingEvents(events, cycle)].sort((a, b) => a.ts - b.ts);
  let windowEnd = -1;
  for (const ev of driving) {
    if (windowEnd < 0 || ev.ts >= windowEnd) windowEnd = ev.ts + WINDOW_MS;
  }
  return windowEnd > now ? windowEnd : null;
}

/**
 * Forecast the next weekly rebirth instant strictly after `now` — the fixed week
 * boundary the pet auto-re-eggs at. Uses the effective (past-pulled) anchor so a
 * future raw `weekAnchor` never pushes it out. The Apex "Reborn Now" countdown
 * reads this. Pure forecast (no state change).
 */
export function nextRebirthAt(
  events: readonly UsageEvent[],
  cycle: CycleConfig,
  now: number,
): number {
  const anchor = effectiveWeekAnchor(events, cycle.weekAnchor);
  return weekStartFor(Math.max(now, anchor), anchor) + WEEK_MS;
}

/**
 * The 7-day rebirth anchor, pulled into the past so it can never sit ahead of the
 * pet's life. We keep the CONFIGURED phase (e.g. Monday 00:00) but slide it back by
 * whole weeks to the tile containing the first event. This neutralizes a
 * `weekAnchor` set to a FUTURE date — e.g. `tt init` choosing next Monday, or a
 * subscription reset that hasn't been observed yet — which would otherwise let
 * `weekRebirths` suspend rebirth entirely (its `now < weekAnchor` short-circuit).
 *
 * Shifting by whole `WEEK_MS` leaves the weekly boundary PHASE identical, so the
 * emitted rebirth instants are unchanged for any anchor already in the past. It is
 * deliberately applied ONLY to the weekly rebirth math — static 5-h window tiling
 * still uses the raw `cycle.weekAnchor` (a whole-week shift is NOT a whole-window
 * shift: WEEK_MS % WINDOW_MS ≠ 0, so reusing it there would slide the 5-h grid).
 *
 * Pure: `events` must be sorted ascending (deriveCycleEvents' contract).
 */
export function effectiveWeekAnchor(events: readonly UsageEvent[], weekAnchor: number): number {
  const first = events.length > 0 ? events[0]!.ts : weekAnchor;
  return first < weekAnchor ? weekStartFor(first, weekAnchor) : weekAnchor;
}

/** Week boundaries strictly after `after` and at or before `now`. */
function weekRebirths(weekAnchor: number, after: number, now: number): RebirthEvent[] {
  const out: RebirthEvent[] = [];
  if (now < weekAnchor) return out;
  // First week whose END is > after.
  let weekStart = weekStartFor(Math.max(after, weekAnchor), weekAnchor);
  // Ensure the very first emitted rebirth ends after `after`.
  while (weekStart + WEEK_MS <= after) weekStart += WEEK_MS;
  for (let end = weekStart + WEEK_MS; end <= now; end += WEEK_MS) {
    out.push(makeRebirth(end - WEEK_MS));
    weekStart += WEEK_MS;
  }
  return out;
}

/** Merge two ascending event lists; on equal `at`, molt precedes rebirth. */
function mergeOrdered(molts: MoltEvent[], rebirths: RebirthEvent[]): CycleEvent[] {
  const out: CycleEvent[] = [];
  let i = 0;
  let j = 0;
  while (i < molts.length && j < rebirths.length) {
    const m = molts[i]!;
    const r = rebirths[j]!;
    if (m.at <= r.at) {
      out.push(m);
      i++;
    } else {
      out.push(r);
      j++;
    }
  }
  while (i < molts.length) out.push(molts[i++]!);
  while (j < rebirths.length) out.push(rebirths[j++]!);
  return out;
}
