/**
 * Cycle derivation: turn a sorted UsageEvent stream + AdapterConfig into the two
 * abstract events the engine consumes — MoltEvent (5-h window close) and
 * RebirthEvent (week boundary). Design §5.
 *
 * Two policies:
 *  - **static** (API / OpenCode): fixed 5-h windows tiled from `weekAnchor`, plus
 *    fixed 7-day weeks. A window only molts if it contained usage.
 *  - **dynamic** (subscription): 5-h session windows inferred from usage — a
 *    window opens at the first event, closes 5 h later; the next event after the
 *    close opens a fresh window. A window molts at its close if it had usage.
 *    Weeks are anchored exactly like static for the MVP.
 *
 * Pure: time enters only as event timestamps and config anchors.
 */

import type { AdapterConfig, CycleEvent, MoltEvent, RebirthEvent, UsageEvent } from './types';

export const WINDOW_MS = 5 * 60 * 60 * 1000;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Floor `ts` to the start of its fixed window tiled from `anchor`. */
function windowStartFor(ts: number, anchor: number): number {
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

function molt(windowStart: number, windowEnd: number): MoltEvent {
  return { type: 'molt', at: windowEnd, windowStart, windowEnd };
}

function rebirth(weekStart: number): RebirthEvent {
  const weekEnd = weekStart + WEEK_MS;
  return { type: 'rebirth', at: weekEnd, weekStart, weekEnd };
}

/**
 * Derive the cycle events whose `at` (close time) falls in `(after, now]`.
 *
 * `events` must be sorted ascending by `ts`. `after` is the high-water mark of
 * already-processed cycle closes (exclusive); only closes strictly after it and
 * at or before `now` are emitted. Rebirths and molts that close at the same
 * instant are ordered molt-first (the week's final molt precedes its rebirth).
 */
export function deriveCycleEvents(
  events: readonly UsageEvent[],
  config: AdapterConfig,
  after: number,
  now: number,
): CycleEvent[] {
  const molts =
    config.cyclePolicy === 'static'
      ? staticMolts(events, config.weekAnchor, after, now)
      : dynamicMolts(events, after, now);

  const rebirths = weekRebirths(config.weekAnchor, after, now);

  return mergeOrdered(molts, rebirths);
}

/** Static policy: fixed windows tiled from the week anchor; molt only if used. */
function staticMolts(
  events: readonly UsageEvent[],
  anchor: number,
  after: number,
  now: number,
): MoltEvent[] {
  // Collect the distinct windows that contained at least one event.
  const usedStarts = new Set<number>();
  for (const ev of events) {
    usedStarts.add(windowStartFor(ev.ts, anchor));
  }
  const out: MoltEvent[] = [];
  for (const start of usedStarts) {
    const end = start + WINDOW_MS;
    if (end > after && end <= now) {
      out.push(molt(start, end));
    }
  }
  out.sort((a, b) => a.at - b.at);
  return out;
}

/**
 * Dynamic policy: infer session windows from usage. A window opens at the first
 * event after any prior window's close; it closes WINDOW_MS later. Events within
 * an open window extend nothing — the window is a fixed 5-h box from its open.
 * The next event at/after the close opens a new window.
 */
function dynamicMolts(events: readonly UsageEvent[], after: number, now: number): MoltEvent[] {
  const out: MoltEvent[] = [];
  let windowStart = -1;
  let windowEnd = -1;
  for (const ev of events) {
    if (windowStart < 0 || ev.ts >= windowEnd) {
      // Close the previous window (it had usage by construction).
      if (windowStart >= 0 && windowEnd > after && windowEnd <= now) {
        out.push(molt(windowStart, windowEnd));
      }
      windowStart = ev.ts;
      windowEnd = ev.ts + WINDOW_MS;
    }
  }
  // Close the final open window if its close is in range.
  if (windowStart >= 0 && windowEnd > after && windowEnd <= now) {
    out.push(molt(windowStart, windowEnd));
  }
  return out;
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
    out.push(rebirth(end - WEEK_MS));
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
