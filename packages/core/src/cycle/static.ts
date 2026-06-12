/**
 * Static cycle policy: fixed 5-h windows tiled from the week anchor.
 * A window only molts if it contained at least one usage event.
 */

import type { MoltEvent, UsageEvent } from '../types';
import { makeMolt, WINDOW_MS, windowStartFor } from './windows';

/** Static policy: fixed windows tiled from the week anchor; molt only if used. */
export function staticMolts(
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
      out.push(makeMolt(start, end));
    }
  }
  out.sort((a, b) => a.at - b.at);
  return out;
}
