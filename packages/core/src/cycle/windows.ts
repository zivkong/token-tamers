/**
 * Window and week time math — constants, floor helpers, and event constructors.
 */

import type { CycleConfig, MoltEvent, RebirthEvent, UsageEvent } from '../types';

export const WINDOW_MS = 5 * 60 * 60 * 1000;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Egg fast-hatch span (design §5). A newly placed egg hatches this soon after
 * its first feeding rather than waiting for a full 5-h window to close. See
 * {@link eggHatchMolts}.
 */
export const EGG_HATCH_MS = 10 * 60 * 1000;

/**
 * The subset of `events` that DEFINES the window boundaries under `cycle`. For
 * subscription that is the anchor adapter's stream alone (its session rhythm is
 * the clock); for static every event is eligible (windows are fixed, opened by any
 * usage). When no anchor is configured (single-adapter setups) the full stream is
 * the anchor.
 */
export function windowDrivingEvents(
  events: readonly UsageEvent[],
  cycle: CycleConfig,
): readonly UsageEvent[] {
  if (cycle.policy === 'static' || !cycle.anchorAdapter) return events;
  return events.filter((e) => e.adapter === cycle.anchorAdapter);
}

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

/**
 * Egg fast-hatch checkpoints: one extra `hatch` molt per used week, fired
 * EGG_HATCH_MS after that week's first event, on top of the normal 5-h windows.
 *
 * Every generation begins as an egg at a week boundary (rebirth), so one hatch
 * checkpoint per week covers every egg. These are ADDITIVE — they never alter
 * the normal window chain — and the engine only lets one ACT while the pet is
 * an egg (hatching it early); otherwise it is a no-op.
 *
 * Bounded only by `end <= now` — there is deliberately NO `after`/`simulatedTo`
 * lower bound. A reborn egg is back-dated to its week boundary while the sim clock
 * already sits at real-now, so its hatch instant (first feeding + EGG_HATCH_MS) can
 * land BEFORE `simulatedTo`; an `after` gate would silently drop it and strand the
 * egg (it would then only hatch at the first full 5-h window close, hours late). The
 * engine gates the CALL on `pet.stage === 'egg'` and `replayMolt` no-ops a hatch on
 * an already-hatched pet, so re-deriving a past hatch never double-fires — emitting
 * it unconditionally is what lets a stuck/overrun egg self-heal on the next advance.
 *
 * `notBefore` floors the search at the current generation's placement
 * (`pet.hatchedAt`): the egg hatches off its OWN first feeding, not off usage
 * that predates it. This matters for the very first egg, placed mid-week at
 * `tt init` — without the floor its week's "first event" is days-old history
 * from before the egg existed, so the hatch lands before the egg and is filtered
 * out. For later generations the week boundary already exceeds `hatchedAt`, so
 * the floor is a no-op and per-week timing is unchanged. Deterministic:
 * `hatchedAt` is persisted state, identical under any advance granularity, and
 * an unhatched egg implies an intact buffer.
 */
export function eggHatchMolts(
  events: readonly UsageEvent[],
  weekAnchor: number,
  now: number,
  notBefore = -Infinity,
): MoltEvent[] {
  const firstByWeek = new Map<number, number>();
  for (const ev of events) {
    if (ev.ts < notBefore) continue;
    const week = weekStartFor(ev.ts, weekAnchor);
    const prev = firstByWeek.get(week);
    if (prev === undefined || ev.ts < prev) firstByWeek.set(week, ev.ts);
  }
  const out: MoltEvent[] = [];
  for (const first of firstByWeek.values()) {
    const end = first + EGG_HATCH_MS;
    if (end <= now) {
      out.push({ type: 'molt', at: end, windowStart: first, windowEnd: end, hatch: true });
    }
  }
  out.sort((a, b) => a.at - b.at);
  return out;
}
