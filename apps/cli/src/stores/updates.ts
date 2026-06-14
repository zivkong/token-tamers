/**
 * Tiny persistence for the opt-in update check: when we last looked and the
 * newest version we've seen. Used to throttle the launch-time check to roughly
 * once a day and to surface a "vX available" hint without re-checking.
 */

import { readJsonOrNull, writeJsonAtomic } from './atomic';

export const UPDATES_FILE = 'updates.json';

/** ~once a day between launch-time update checks. */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface UpdateState {
  /** Epoch ms of the last GitHub check (0 ⇒ never). */
  lastCheckAt: number;
  /** Newest version tag observed, or null. */
  latestSeen: string | null;
}

export function loadUpdateState(): UpdateState {
  return readJsonOrNull<UpdateState>(UPDATES_FILE) ?? { lastCheckAt: 0, latestSeen: null };
}

export function saveUpdateState(state: UpdateState): void {
  writeJsonAtomic(UPDATES_FILE, state);
}

/** True when enough time has elapsed since `lastCheckAt` to check again. */
export function isCheckDue(state: UpdateState, now: number): boolean {
  return now - state.lastCheckAt >= CHECK_INTERVAL_MS;
}
