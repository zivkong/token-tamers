/**
 * Persistence for the open-window pending-event buffer (pending.json).
 *
 * Events whose containing 5-h window has not yet closed are not consumed by any
 * molt, so they live only in the engine's in-memory buffer. Persisting them here
 * and re-feeding them on the next run keeps usage in an as-yet-unclosed window
 * from being lost between `tt` invocations (the catch-up-on-launch model).
 */

import type { UsageEvent } from '@token-tamers/core';
import { readJsonOrNull, writeJsonAtomicCompact } from './atomic';

export const PENDING_FILE = 'pending.json';

export function loadPending(): UsageEvent[] {
  return readJsonOrNull<UsageEvent[]>(PENDING_FILE) ?? [];
}

export function savePending(events: UsageEvent[]): void {
  writeJsonAtomicCompact(PENDING_FILE, events);
}
