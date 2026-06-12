/**
 * Dynamic cycle policy: 5-h session windows inferred from usage gaps.
 * A window opens at the first event; closes WINDOW_MS later. The next event
 * at or after the close opens a fresh window.
 */

import type { MoltEvent, UsageEvent } from '../types';
import { makeMolt, WINDOW_MS } from './windows';

export function dynamicMolts(
  events: readonly UsageEvent[],
  after: number,
  now: number,
): MoltEvent[] {
  const out: MoltEvent[] = [];
  let windowStart = -1;
  let windowEnd = -1;
  for (const ev of events) {
    if (windowStart < 0 || ev.ts >= windowEnd) {
      // Close the previous window (it had usage by construction).
      if (windowStart >= 0 && windowEnd > after && windowEnd <= now) {
        out.push(makeMolt(windowStart, windowEnd));
      }
      windowStart = ev.ts;
      windowEnd = ev.ts + WINDOW_MS;
    }
  }
  // Close the final open window if its close is in range.
  if (windowStart >= 0 && windowEnd > after && windowEnd <= now) {
    out.push(makeMolt(windowStart, windowEnd));
  }
  return out;
}
