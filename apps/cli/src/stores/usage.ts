/**
 * Captured subscription rate-limit reset times (~/.tokentamers/usage.json).
 *
 * Claude Code ≥2.1.x hands the real 5-hour and 7-day reset instants to the
 * configured statusLine command on stdin (`rate_limits.five_hour.resets_at` /
 * `seven_day.resets_at`, unix SECONDS) — and persists them nowhere else. `tt
 * statusline` captures them here so the engine can anchor the cycle to the
 * player's ACTUAL reset rhythm instead of an inferred/calendar guess. Read-only
 * observation of usage already surfaced by Claude Code — never a network call.
 */

import { readJsonOrNull, writeJsonAtomic } from './atomic';

export const USAGE_FILE = 'usage.json';

export interface UsageSnapshot {
  /** Next 5-hour window reset, epoch MS (resets_at × 1000). Absent until seen. */
  fiveHourResetsAt?: number;
  /** Next 7-day (weekly) reset, epoch MS. Absent until seen. */
  sevenDayResetsAt?: number;
  /** When this snapshot was captured, epoch MS. */
  capturedAt: number;
}

export function loadUsage(): UsageSnapshot | null {
  return readJsonOrNull<UsageSnapshot>(USAGE_FILE);
}

export function saveUsage(snapshot: UsageSnapshot): void {
  writeJsonAtomic(USAGE_FILE, snapshot);
}

/**
 * Fold a freshly-parsed reading into the stored snapshot. Each window is updated
 * independently and only ever moves FORWARD — Claude reports each window
 * independently and may omit one (statusline.md: "Each window may be
 * independently absent"), so a missing or stale field must never erase a known
 * later reset. Returns the snapshot to persist.
 */
export function mergeUsage(
  prev: UsageSnapshot | null,
  reading: { fiveHourResetsAt?: number; sevenDayResetsAt?: number },
  capturedAt: number,
): UsageSnapshot {
  return {
    fiveHourResetsAt: laterReset(prev?.fiveHourResetsAt, reading.fiveHourResetsAt),
    sevenDayResetsAt: laterReset(prev?.sevenDayResetsAt, reading.sevenDayResetsAt),
    capturedAt,
  };
}

function laterReset(prev: number | undefined, next: number | undefined): number | undefined {
  if (next === undefined) return prev;
  if (prev === undefined) return next;
  return Math.max(prev, next);
}
