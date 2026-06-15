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
import { makeRebirth, WEEK_MS, weekStartFor, windowDrivingEvents } from './windows';

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

  const rebirths = weekRebirths(cycle.weekAnchor, after, now);

  return mergeOrdered(molts, rebirths);
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
