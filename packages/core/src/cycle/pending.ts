/**
 * Pending (unconsumed) event extraction.
 *
 * An event is "pending" when no CLOSED molt window has consumed it yet by `now`
 * under the pet-global cycle clock. Those events live in the engine's open-window
 * buffer and must be persisted between runs and re-fed, otherwise usage in an
 * as-yet-unclosed window is lost.
 *
 * Pure: time enters only as event timestamps and config anchors. Mirrors the exact
 * window math the molt derivation uses (static tiles / subscription anchor chain).
 */

import type { CycleConfig, UsageEvent } from '../types';
import { WINDOW_MS, windowDrivingEvents, windowStartFor } from './windows';

/**
 * The events (across all adapters) that are NOT yet consumed by a closed molt
 * window — the buffer the caller must persist and re-feed.
 *
 * - **static**: an event is pending if its fixed tile's end (`tileStart +
 *   WINDOW_MS`) is `> now`.
 * - **subscription**: rebuild the inferred window chain from the ANCHOR adapter's
 *   stream (open at first anchor event, close WINDOW_MS later, next anchor event
 *   at/after the close opens a fresh window), find the last close at/before `now`,
 *   and keep every event (any adapter) at or after that close — i.e. the
 *   currently-open window plus any trailing usage no window has closed over yet.
 *   Events before the last close are consumed (those inside a window fed its molt;
 *   any homeless ones between windows simply counted nowhere) — bounded, no leak.
 *
 * Keeping the full `>= lastClose` tail (rather than only the open window) is a
 * determinism requirement: an anchor event can arrive in a LATER scan with a
 * timestamp that retroactively opens a window over an earlier non-anchor event, so
 * dropping that non-anchor event early would diverge from a from-scratch replay
 * (which still has it). The one cost is that if the anchor adapter never logs at
 * all while other adapters do, no window ever closes and the buffer is never
 * trimmed; that requires anchoring a subscription to a provider you never use — a
 * configuration the `tt init` wizard steers away from (it defaults the anchor to a
 * provider you actually have/use).
 */
export function unconsumedEvents(
  events: readonly UsageEvent[],
  cycle: CycleConfig,
  now: number,
): UsageEvent[] {
  if (cycle.policy === 'static') {
    return events.filter((e) => windowStartFor(e.ts, cycle.weekAnchor) + WINDOW_MS > now);
  }
  const lastClose = lastClosedAnchorWindow(windowDrivingEvents(events, cycle), now);
  if (lastClose === -Infinity) return [...events];
  return events.filter((e) => e.ts >= lastClose);
}

/**
 * The close time of the latest anchor-defined window that has closed at/before
 * `now`, or -Infinity if none has closed yet (everything still pending).
 */
function lastClosedAnchorWindow(anchorEvents: readonly UsageEvent[], now: number): number {
  const sorted = [...anchorEvents].sort((a, b) => a.ts - b.ts);
  let windowEnd = -1;
  let lastClose = -Infinity;
  for (const ev of sorted) {
    if (windowEnd < 0 || ev.ts >= windowEnd) windowEnd = ev.ts + WINDOW_MS;
    if (windowEnd <= now) lastClose = windowEnd;
  }
  return lastClose;
}
