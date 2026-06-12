/**
 * Pending (unconsumed) event extraction.
 *
 * An event is "pending" when the 5-h window that contains it has NOT yet closed
 * by `now` under its adapter's cycle policy — i.e. no molt has consumed it. Those
 * events live in the engine's open-window buffer and must be persisted between
 * runs and re-fed, otherwise usage in an as-yet-unclosed window is lost.
 *
 * Pure: time enters only as event timestamps and config anchors. Mirrors the
 * exact window math the molt derivation uses (static tiles / dynamic chain).
 */

import type { AdapterConfig, UsageEvent } from '../types';
import { WINDOW_MS, windowStartFor } from './windows';

/**
 * The events from `events` (for this adapter) whose containing window's close is
 * strictly after `now` — the buffer the caller must persist and re-feed.
 *
 * - **static**: an event is pending if its fixed tile's end (`tileStart +
 *   WINDOW_MS`) is `> now`.
 * - **dynamic**: rebuild the inferred window chain (open at first event, close
 *   WINDOW_MS later, next event at/after the close opens a fresh window) and keep
 *   the events whose window close is `> now`. Because closes are monotonic along
 *   the chain, only the trailing run of windows can still be open.
 */
export function unconsumedEvents(
  events: readonly UsageEvent[],
  config: AdapterConfig,
  now: number,
): UsageEvent[] {
  const mine = events.filter((e) => e.adapter === config.provider);
  if (config.cyclePolicy === 'static') {
    return staticPending(mine, config.weekAnchor, now);
  }
  return dynamicPending(mine, now);
}

function staticPending(events: readonly UsageEvent[], anchor: number, now: number): UsageEvent[] {
  return events.filter((e) => windowStartFor(e.ts, anchor) + WINDOW_MS > now);
}

function dynamicPending(events: readonly UsageEvent[], now: number): UsageEvent[] {
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const out: UsageEvent[] = [];
  let windowEnd = -1;
  for (const ev of sorted) {
    if (windowEnd < 0 || ev.ts >= windowEnd) {
      windowEnd = ev.ts + WINDOW_MS;
    }
    if (windowEnd > now) out.push(ev);
  }
  return out;
}
