/**
 * Window and week time math — constants, floor helpers, and event constructors.
 */

import type { MoltEvent, RebirthEvent } from '../types';

export const WINDOW_MS = 5 * 60 * 60 * 1000;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Floor `ts` to the start of its fixed window tiled from `anchor`. */
export function windowStartFor(ts: number, anchor: number): number {
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

export function makeMolt(windowStart: number, windowEnd: number): MoltEvent {
  return { type: 'molt', at: windowEnd, windowStart, windowEnd };
}

export function makeRebirth(weekStart: number): RebirthEvent {
  const weekEnd = weekStart + WEEK_MS;
  return { type: 'rebirth', at: weekEnd, weekStart, weekEnd };
}
