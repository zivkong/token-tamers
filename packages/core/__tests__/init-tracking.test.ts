import { describe, expect, it } from 'vitest';
import {
  createEngine,
  seedBaselinesFromHistory,
  unconsumedEvents,
  type AdapterConfig,
  type UsageEvent,
} from '../src/index';
import { dynamicAdapter, ev, HOUR, makePack, staticAdapter, WEEK_ANCHOR } from './fixture';

const WINDOW_MS = 5 * HOUR;

/** Three events spread across the first 4h of an active window starting at `wsOffset`. */
function windowEvents(wsOffset: number): UsageEvent[] {
  return [
    ev(wsOffset, { sessionKey: `w-${wsOffset}-a` }),
    ev(wsOffset + 2 * HOUR, { sessionKey: `w-${wsOffset}-b` }),
    ev(wsOffset + 4 * HOUR, { sessionKey: `w-${wsOffset}-c` }),
  ];
}

describe('seedBaselinesFromHistory — pure baseline seeding', () => {
  it('is a pure function of its inputs (same events => identical baselines)', () => {
    const events = [...windowEvents(0), ...windowEvents(10 * HOUR), ...windowEvents(20 * HOUR)];
    const adapters = [staticAdapter()];
    const now = WEEK_ANCHOR + 30 * HOUR;
    const a = seedBaselinesFromHistory(events, adapters, now);
    const b = seedBaselinesFromHistory([...events].reverse(), adapters, now);
    expect(a).toEqual(b);
  });

  it('counts one observed window per closed history window', () => {
    const events = [...windowEvents(0), ...windowEvents(10 * HOUR)];
    const baselines = seedBaselinesFromHistory(events, [staticAdapter()], WEEK_ANCHOR + 20 * HOUR);
    expect(baselines['claude-code']?.windowsObserved).toBe(2);
    expect(baselines['claude-code']?.meanWindowTokens).toBeGreaterThan(0);
  });

  it('equals what the engine accumulates by replaying the same windows', () => {
    const events = [...windowEvents(0), ...windowEvents(10 * HOUR), ...windowEvents(20 * HOUR)];
    const now = WEEK_ANCHOR + 30 * HOUR;

    // Replay path: a legacy engine (no startAt) molts through history.
    const replay = createEngine(makePack(), { adapters: [staticAdapter()] });
    replay.ingest(events);
    replay.advanceTo(now);
    const replayBaseline = replay.state().baselines['claude-code'];

    // Seed path: pure derivation, no molts.
    const seeded = seedBaselinesFromHistory(events, [staticAdapter()], now)['claude-code'];

    expect(seeded?.windowsObserved).toBe(replayBaseline?.windowsObserved);
    expect(seeded?.meanWindowTokens).toBeCloseTo(replayBaseline?.meanWindowTokens ?? -1, 9);
  });

  it('does not advance the pet past egg (history seeds baseline only)', () => {
    const events = [...windowEvents(0), ...windowEvents(10 * HOUR)];
    const startAt = WEEK_ANCHOR + 30 * HOUR;
    const engine = createEngine(makePack(), { adapters: [staticAdapter()], startAt });
    engine.ingest(events);
    engine.seedBaselines(startAt);
    engine.advanceTo(startAt);
    const st = engine.state();
    expect(st.pet.stage).toBe('egg');
    expect(st.pet.moltCount).toBe(0);
    expect(st.baselines['claude-code']?.windowsObserved).toBe(2);
  });

  it('clears calibration once a full week of windows is observed', () => {
    // 34 closed static windows (> windows-per-week 34) across a full week.
    const events: UsageEvent[] = [];
    for (let w = 0; w < 34; w++) events.push(...windowEvents(w * WINDOW_MS));
    const startAt = WEEK_ANCHOR + 34 * WINDOW_MS;
    const engine = createEngine(makePack(), { adapters: [staticAdapter()], startAt });
    engine.ingest(events);
    engine.seedBaselines(startAt);
    expect(engine.state().pet.calibrating).toBe(false);
  });

  it('keeps calibration true with only a partial week of windows', () => {
    const events = [...windowEvents(0), ...windowEvents(10 * HOUR)];
    const startAt = WEEK_ANCHOR + 30 * HOUR;
    const engine = createEngine(makePack(), { adapters: [staticAdapter()], startAt });
    engine.ingest(events);
    engine.seedBaselines(startAt);
    expect(engine.state().pet.calibrating).toBe(true);
  });
});

describe('unconsumedEvents — open-window buffer', () => {
  it('returns nothing for an empty event list', () => {
    expect(unconsumedEvents([], staticAdapter(), WEEK_ANCHOR + HOUR)).toEqual([]);
  });

  it('static: keeps events in a tile whose end is still in the future', () => {
    const e = ev(0); // window 0: [anchor, anchor+5h)
    // now at 2h: window 0 has not closed -> pending.
    expect(unconsumedEvents([e], staticAdapter(), WEEK_ANCHOR + 2 * HOUR)).toEqual([e]);
  });

  it('static: drops events whose tile has closed', () => {
    const e = ev(0);
    // now exactly at the close boundary (tile end == now): not > now -> consumed.
    expect(unconsumedEvents([e], staticAdapter(), WEEK_ANCHOR + WINDOW_MS)).toEqual([]);
    // now strictly after the close: consumed.
    expect(unconsumedEvents([e], staticAdapter(), WEEK_ANCHOR + WINDOW_MS + 1)).toEqual([]);
  });

  it('static: splits closed vs open windows', () => {
    const closed = ev(0); // window 0 closes at 5h
    const open = ev(11 * HOUR); // window 2 [10h,15h) still open at 12h
    const pending = unconsumedEvents([closed, open], staticAdapter(), WEEK_ANCHOR + 12 * HOUR);
    expect(pending).toEqual([open]);
  });

  it('dynamic: events in the unclosed trailing window are pending', () => {
    // Window 1 opens at first event (0), closes at 5h. New event at 6h opens
    // window 2 [6h,11h). At now=8h, only the second window is open.
    const a = ev(0);
    const b = ev(6 * HOUR);
    const c = ev(7 * HOUR);
    const pending = unconsumedEvents([a, b, c], dynamicAdapter(), WEEK_ANCHOR + 8 * HOUR);
    expect(pending).toEqual([b, c]);
  });

  it('dynamic: exactly-at-close boundary is consumed', () => {
    const a = ev(0); // window [0,5h)
    // now exactly at the window close: not > now -> consumed.
    expect(unconsumedEvents([a], dynamicAdapter(), WEEK_ANCHOR + WINDOW_MS)).toEqual([]);
  });

  it('filters to the adapter provider', () => {
    const mine = ev(0, { adapter: 'claude-code' });
    const other = ev(0, { adapter: 'codex' });
    const pending = unconsumedEvents([mine, other], staticAdapter(), WEEK_ANCHOR + 2 * HOUR);
    expect(pending).toEqual([mine]);
  });
});

describe('pending persistence — snapshot resume across a simulated restart', () => {
  // Build a scenario where the process restarts MID open-window: an early window
  // closes (a molt fires), then a later window is still open at the restart, and
  // more usage lands in that same open window before it finally closes. Resuming
  // from (state + persisted pending) must match a single continuous run.
  function scenario(): { early: UsageEvent[]; late: UsageEvent[]; adapter: AdapterConfig } {
    const adapter = staticAdapter();
    // Window 0 [0,5h): three events (will close -> molt).
    const early = windowEvents(0).concat(
      // Window 4 [20h,25h): first event arrives but window not yet closed at restart.
      ev(20 * HOUR, { sessionKey: 'open-a' }),
    );
    // After restart, more usage lands in window 4, then it closes.
    const late = [ev(22 * HOUR, { sessionKey: 'open-b' }), ev(24 * HOUR, { sessionKey: 'open-c' })];
    return { early, late, adapter };
  }

  it('resume-from-snapshot + pending == continuous run', () => {
    const { early, late, adapter } = scenario();
    const restart = WEEK_ANCHOR + 21 * HOUR; // mid window 4 (still open)
    const finalNow = WEEK_ANCHOR + 30 * HOUR; // window 4 has closed by here

    // Continuous reference run: feed everything, advance straight to finalNow.
    const cont = createEngine(makePack(), { adapters: [adapter] });
    cont.ingest([...early, ...late]);
    cont.advanceTo(finalNow);
    const continuous = cont.state();

    // Restart run: phase 1 ingests `early`, advances to mid-window, snapshots
    // state + pending. Phase 2 resumes, re-feeds pending + the later events.
    const p1 = createEngine(makePack(), { adapters: [adapter] });
    p1.ingest(early);
    p1.advanceTo(restart);
    const snapshot = p1.state();
    const pending = p1.pendingEvents();
    // The open window's lone early event must be carried over.
    expect(pending.map((e) => e.sessionKey)).toContain('open-a');

    const p2 = createEngine(makePack(), { adapters: [adapter] }, snapshot);
    p2.ingest([...pending, ...late]);
    p2.advanceTo(finalNow);

    expect(p2.state()).toEqual(continuous);
  });

  it('without pending re-feed, the open window loses its early usage', () => {
    const { early, late, adapter } = scenario();
    const restart = WEEK_ANCHOR + 21 * HOUR;
    const finalNow = WEEK_ANCHOR + 30 * HOUR;

    const p1 = createEngine(makePack(), { adapters: [adapter] });
    p1.ingest(early);
    p1.advanceTo(restart);
    const snapshot = p1.state();

    // Buggy resume: only feed the late events (pending dropped).
    const p2 = createEngine(makePack(), { adapters: [adapter] }, snapshot);
    p2.ingest(late);
    p2.advanceTo(finalNow);

    const correct = createEngine(makePack(), { adapters: [adapter] });
    correct.ingest([...early, ...late]);
    correct.advanceTo(finalNow);

    // Dropping pending diverges from the correct continuous run.
    expect(p2.state()).not.toEqual(correct.state());
  });
});
