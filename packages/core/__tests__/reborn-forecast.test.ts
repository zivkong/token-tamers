import { describe, expect, it } from 'vitest';
import { createEngine, nextMoltCloseAt, nextRebirthAt, WEEK_MS, WINDOW_MS } from '../src/index';
import {
  adapters,
  ev,
  HOUR,
  makePack,
  MIN,
  staticCycle,
  subscriptionCycle,
  WEEK_ANCHOR,
} from './fixture';

describe('forecast — nextMoltCloseAt', () => {
  it('static: the fixed tile containing now always has a close', () => {
    expect(nextMoltCloseAt([], staticCycle(), WEEK_ANCHOR + 2 * HOUR)).toBe(
      WEEK_ANCHOR + WINDOW_MS,
    );
  });

  it('subscription: the OPEN inferred window closes 5h after its first anchor event', () => {
    expect(nextMoltCloseAt([ev(0)], subscriptionCycle(), WEEK_ANCHOR + 2 * HOUR)).toBe(
      WEEK_ANCHOR + WINDOW_MS,
    );
  });

  it('subscription: returns null when every window has closed (pet idle)', () => {
    expect(nextMoltCloseAt([ev(0)], subscriptionCycle(), WEEK_ANCHOR + 6 * HOUR)).toBeNull();
  });
});

describe('forecast — nextRebirthAt', () => {
  it('returns the end of the week tile containing now', () => {
    expect(nextRebirthAt([ev(0)], staticCycle(), WEEK_ANCHOR + 2 * HOUR)).toBe(
      WEEK_ANCHOR + WEEK_MS,
    );
  });

  it('advances to the next boundary in a later week', () => {
    expect(nextRebirthAt([ev(0)], staticCycle(), WEEK_ANCHOR + WEEK_MS + 2 * HOUR)).toBe(
      WEEK_ANCHOR + 2 * WEEK_MS,
    );
  });

  it('forecasts over the open-window buffer the cli passes (pendingEvents)', () => {
    // The cli derives the countdowns from the open window alone, not the full
    // history; an open window still in progress reports the right next close.
    const pending = [ev(30 * MIN)];
    expect(nextMoltCloseAt(pending, subscriptionCycle(), WEEK_ANCHOR + HOUR)).toBe(
      WEEK_ANCHOR + 30 * MIN + WINDOW_MS,
    );
    expect(nextRebirthAt(pending, staticCycle(), WEEK_ANCHOR + HOUR)).toBe(WEEK_ANCHOR + WEEK_MS);
  });
});

describe('engine.rebornNow — the Apex player action', () => {
  /** A hatched, evolving (non-egg) pet after one static window. */
  function hatchedEngine() {
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
    eng.ingest([ev(0), ev(5 * MIN), ev(2 * HOUR)]);
    eng.advanceTo(WEEK_ANCHOR + 6 * HOUR);
    return eng;
  }

  it('archives the pet and starts a fresh gen+1 egg at grade C, consuming no RNG', () => {
    const eng = hatchedEngine();
    const before = eng.state();
    expect(before.pet.stage).not.toBe('egg');

    const at = WEEK_ANCHOR + 6 * HOUR + 1;
    const effects = eng.rebornNow(at);
    const after = eng.state();

    expect(effects.some((e) => e.type === 'rebirth')).toBe(true);
    expect(after.pet.generation).toBe(before.pet.generation + 1);
    expect(after.pet.stage).toBe('egg');
    expect(after.pet.grade).toBe('C');
    expect(after.pet.hatchedAt).toBe(at);
    expect(after.simulatedTo).toBe(at);
    // Rebirth is RNG-free, so other pets' molt streams stay byte-identical (inv 5).
    expect(after.rngState).toBe(before.rngState);
    // The pre-reborn life landed in the back-compat archive mirror.
    expect(after.archive.length).toBeGreaterThan(before.archive.length);
  });

  it('does NOT move the weekly clock — the fixed boundary still fires later', () => {
    const eng = hatchedEngine();
    const gen0 = eng.state().pet.generation;
    eng.rebornNow(WEEK_ANCHOR + 6 * HOUR + 1); // manual rebirth → gen0 + 1
    // Advance past the UNCHANGED weekly boundary: the auto-rebirth fires (gen0 + 2).
    eng.advanceTo(WEEK_ANCHOR + WEEK_MS + HOUR);
    expect(eng.state().pet.generation).toBe(gen0 + 2);
  });

  it('is a no-op on a pre-hatch egg (nothing to archive)', () => {
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
    const gen0 = eng.state().pet.generation;
    expect(eng.rebornNow(WEEK_ANCHOR + HOUR)).toHaveLength(0);
    expect(eng.state().pet.generation).toBe(gen0);
    expect(eng.state().pet.stage).toBe('egg');
  });
});
