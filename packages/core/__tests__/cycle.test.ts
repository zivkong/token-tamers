import { describe, expect, it } from 'vitest';
import {
  deriveCycleEvents,
  eggHatchMolts,
  EGG_HATCH_MS,
  weekStartFor,
  WEEK_MS,
  WINDOW_MS,
} from '../src/cycle';
import { ev, HOUR, staticCycle, subscriptionCycle, WEEK_ANCHOR } from './fixture';

describe('cycle — static policy', () => {
  it('fires a molt only for windows that contained usage', () => {
    // Usage in window 0 (0h) and window 2 (10h), none in window 1.
    const events = [ev(0), ev(10 * HOUR)];
    const cfg = staticCycle();
    const out = deriveCycleEvents(events, cfg, 0, WEEK_ANCHOR + 20 * HOUR);
    const molts = out.filter((e) => e.type === 'molt');
    expect(molts).toHaveLength(2);
    // window 0 closes at 5h, window 2 closes at 15h.
    expect(molts[0]).toMatchObject({
      windowStart: WEEK_ANCHOR,
      windowEnd: WEEK_ANCHOR + WINDOW_MS,
    });
    expect(molts[1]).toMatchObject({
      windowStart: WEEK_ANCHOR + 10 * HOUR,
      windowEnd: WEEK_ANCHOR + 15 * HOUR,
    });
  });

  it('windows align to fixed 5h tiles from the anchor', () => {
    // Event at 4h59m is still in window 0; event at 5h01m is window 1.
    const events = [ev(WINDOW_MS - 60000), ev(WINDOW_MS + 60000)];
    const cfg = staticCycle();
    const out = deriveCycleEvents(events, cfg, 0, WEEK_ANCHOR + 12 * HOUR);
    const molts = out.filter((e) => e.type === 'molt');
    expect(molts).toHaveLength(2);
    expect(molts[0]!.windowStart).toBe(WEEK_ANCHOR);
    expect(molts[1]!.windowStart).toBe(WEEK_ANCHOR + WINDOW_MS);
  });

  it('emits a rebirth at each 7-day boundary', () => {
    const events = [ev(HOUR), ev(8 * 24 * HOUR)];
    const cfg = staticCycle();
    const out = deriveCycleEvents(events, cfg, 0, WEEK_ANCHOR + 8 * 24 * HOUR);
    const rebirths = out.filter((e) => e.type === 'rebirth');
    expect(rebirths).toHaveLength(1);
    expect(rebirths[0]).toMatchObject({
      weekStart: WEEK_ANCHOR,
      weekEnd: WEEK_ANCHOR + WEEK_MS,
    });
  });

  it('keeps the last molt that closes within a week before that rebirth', () => {
    // 33 full 5h windows fit in a 168h week (last closes at 165h, before 168h).
    // Put an event in that final in-week window; its molt precedes the rebirth.
    const events = [ev(33 * WINDOW_MS - HOUR)];
    const cfg = staticCycle();
    const out = deriveCycleEvents(events, cfg, 0, WEEK_ANCHOR + WEEK_MS + HOUR);
    const types = out.map((e) => e.type);
    expect(types).toEqual(['molt', 'rebirth']);
    expect(out[0]!.at).toBeLessThanOrEqual(out[1]!.at);
  });

  it('only emits events strictly after `after` and at or before `now`', () => {
    const events = [ev(0), ev(10 * HOUR)];
    const cfg = staticCycle();
    // after = first molt close, so only the second molt should appear.
    const out = deriveCycleEvents(events, cfg, WEEK_ANCHOR + WINDOW_MS, WEEK_ANCHOR + 20 * HOUR);
    const molts = out.filter((e) => e.type === 'molt');
    expect(molts).toHaveLength(1);
    expect(molts[0]!.windowStart).toBe(WEEK_ANCHOR + 10 * HOUR);
  });
});

describe('cycle — dynamic policy', () => {
  it('opens a window at first usage and closes 5h later', () => {
    const events = [ev(0), ev(HOUR), ev(2 * HOUR)];
    const cfg = subscriptionCycle();
    const out = deriveCycleEvents(events, cfg, 0, WEEK_ANCHOR + 6 * HOUR);
    const molts = out.filter((e) => e.type === 'molt');
    expect(molts).toHaveLength(1);
    expect(molts[0]).toMatchObject({
      windowStart: WEEK_ANCHOR,
      windowEnd: WEEK_ANCHOR + WINDOW_MS,
    });
  });

  it('opens a fresh window after the prior window closes', () => {
    // First window 0..5h (events at 0,1h). Gap; new event at 6h opens window 6..11h.
    const events = [ev(0), ev(HOUR), ev(6 * HOUR)];
    const cfg = subscriptionCycle();
    const out = deriveCycleEvents(events, cfg, 0, WEEK_ANCHOR + 12 * HOUR);
    const molts = out.filter((e) => e.type === 'molt');
    expect(molts).toHaveLength(2);
    expect(molts[0]!.windowStart).toBe(WEEK_ANCHOR);
    expect(molts[1]!.windowStart).toBe(WEEK_ANCHOR + 6 * HOUR);
  });

  it('does not emit a molt for a window whose close is beyond now', () => {
    const events = [ev(0)];
    const cfg = subscriptionCycle();
    // now is before the 5h close.
    const out = deriveCycleEvents(events, cfg, 0, WEEK_ANCHOR + 2 * HOUR);
    expect(out.filter((e) => e.type === 'molt')).toHaveLength(0);
  });
});

describe('eggHatchMolts — one bonus hatch checkpoint per used week', () => {
  it('fires EGG_HATCH_MS after a week’s first event, marked hatch', () => {
    const out = eggHatchMolts(
      [ev(2 * HOUR), ev(3 * HOUR)],
      WEEK_ANCHOR,
      -Infinity,
      WEEK_ANCHOR + 6 * HOUR,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      type: 'molt',
      hatch: true,
      windowStart: WEEK_ANCHOR + 2 * HOUR,
      windowEnd: WEEK_ANCHOR + 2 * HOUR + EGG_HATCH_MS,
    });
  });

  it('emits one per week (each week starts a fresh egg)', () => {
    const out = eggHatchMolts(
      [ev(HOUR), ev(WEEK_MS + HOUR)],
      WEEK_ANCHOR,
      -Infinity,
      WEEK_ANCHOR + WEEK_MS + 6 * HOUR,
    );
    expect(out).toHaveLength(2);
    expect(out.every((m) => m.hatch === true)).toBe(true);
  });

  it('respects the (after, now] window like normal molts', () => {
    const events = [ev(HOUR)];
    // Hatch close is HOUR + 10m; before that `now` it is not yet emitted.
    expect(
      eggHatchMolts(events, WEEK_ANCHOR, -Infinity, WEEK_ANCHOR + HOUR + 5 * 60 * 1000),
    ).toHaveLength(0);
    // After it has closed but already consumed (after past it): not re-emitted.
    expect(
      eggHatchMolts(events, WEEK_ANCHOR, WEEK_ANCHOR + HOUR + EGG_HATCH_MS, WEEK_ANCHOR + 6 * HOUR),
    ).toHaveLength(0);
  });
});

describe('weekStartFor', () => {
  it('floors to the week tile', () => {
    expect(weekStartFor(WEEK_ANCHOR, WEEK_ANCHOR)).toBe(WEEK_ANCHOR);
    expect(weekStartFor(WEEK_ANCHOR + WEEK_MS - 1, WEEK_ANCHOR)).toBe(WEEK_ANCHOR);
    expect(weekStartFor(WEEK_ANCHOR + WEEK_MS, WEEK_ANCHOR)).toBe(WEEK_ANCHOR + WEEK_MS);
  });
});
