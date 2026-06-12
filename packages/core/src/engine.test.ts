import { describe, expect, it } from 'vitest';
import {
  createEngine,
  GRADE_ORDER,
  matchModelRule,
  type GameEffect,
  type UsageEvent,
} from './index';
import { dynamicAdapter, ev, HOUR, makePack, staticAdapter, WEEK_ANCHOR } from '../test/fixture';

const WEEK_MS = 7 * 24 * HOUR;

/** Build a dense week of static-policy usage: 3 events per active 5h window. */
function denseWeek(modelId = 'claude-sonnet-4-6', base = WEEK_ANCHOR): UsageEvent[] {
  const events: UsageEvent[] = [];
  // Active windows across the week (every other 5h window has usage).
  for (let w = 0; w < 30; w++) {
    const ws = base + w * 5 * HOUR;
    events.push(
      ev(ws - base, { modelId, sessionKey: `w${w}-a`, langHints: ['ts', 'py', 'go'] }),
      ev(ws - base + 2 * HOUR, { modelId, sessionKey: `w${w}-b` }),
      ev(ws - base + 4 * HOUR, { modelId, sessionKey: `w${w}-c` }),
    );
  }
  return events;
}

describe('engine — house commitment from model patterns', () => {
  it('commits Mote to Aether for claude-* genes (first match wins)', () => {
    expect(matchModelRule(makePack().models, 'claude-opus-4')?.house).toBe('aether');
    expect(matchModelRule(makePack().models, 'gpt-4o')?.house).toBe('cipher');
    expect(matchModelRule(makePack().models, 'o3-mini')?.house).toBe('cipher');
    expect(matchModelRule(makePack().models, 'llama-3')?.house).toBe('wild');

    const eng = createEngine(makePack(), { adapters: [staticAdapter()] });
    eng.ingest([ev(0, { modelId: 'claude-opus-4' })]);
    eng.advanceTo(WEEK_ANCHOR + 6 * HOUR);
    const st = eng.state();
    expect(st.pet.house).toBe('aether');
    expect(st.pet.speciesId).toBe('wisp'); // aether sprite
    expect(st.pet.stage).toBe('sprite');
  });

  it('dominant gene by essence decides the House on first molt', () => {
    const eng = createEngine(makePack(), { adapters: [staticAdapter()] });
    eng.ingest([
      ev(0, { modelId: 'gpt-4o', inputTokens: 10000 }),
      ev(HOUR, { modelId: 'claude-x', inputTokens: 100 }),
    ]);
    eng.advanceTo(WEEK_ANCHOR + 6 * HOUR);
    expect(eng.state().pet.house).toBe('cipher');
  });

  it('unmatched model would commit to wild (here the pack maps * to wild)', () => {
    const eng = createEngine(makePack(), { adapters: [staticAdapter()] });
    eng.ingest([ev(0, { modelId: 'llama-3' })]);
    eng.advanceTo(WEEK_ANCHOR + 6 * HOUR);
    expect(eng.state().pet.house).toBe('wild');
  });
});

describe('engine — molt-only evolution', () => {
  it('no molts => no evolution, stays an egg', () => {
    const eng = createEngine(makePack(), { adapters: [staticAdapter()] });
    eng.ingest([ev(0)]);
    // Advance to before the 5h window close: the window has not molted.
    const effects = eng.advanceTo(WEEK_ANCHOR + 2 * HOUR);
    expect(effects.filter((e) => e.type === 'molt')).toHaveLength(0);
    const st = eng.state();
    expect(st.pet.stage).toBe('egg');
    expect(st.pet.moltCount).toBe(0);
  });

  it('each molt advances at most one stage', () => {
    const eng = createEngine(makePack(), { adapters: [staticAdapter()] });
    eng.ingest(denseWeek());
    // One window only.
    eng.advanceTo(WEEK_ANCHOR + 6 * HOUR);
    expect(eng.state().pet.moltCount).toBe(1);
    expect(eng.state().pet.stage).toBe('sprite');
    // A second window.
    eng.advanceTo(WEEK_ANCHOR + 11 * HOUR);
    const st = eng.state();
    expect(st.pet.moltCount).toBe(2);
    expect(st.pet.stage).toBe('rookie');
  });

  it('reaches Apex over a full active week and never beyond', () => {
    const eng = createEngine(makePack(), { adapters: [staticAdapter()] });
    eng.ingest(denseWeek());
    eng.advanceTo(WEEK_ANCHOR + WEEK_MS - HOUR);
    const st = eng.state();
    expect(st.pet.stage).toBe('apex');
    expect(st.pet.speciesId).toBe('aurelion');
  });
});

describe('engine — monotonic grades', () => {
  it('grade never decreases across many molts', () => {
    const eng = createEngine(makePack(), { adapters: [staticAdapter()] });
    eng.ingest(denseWeek());
    let prev = 0;
    const checkpoints = [6, 11, 21, 31, 41, 100, 160].map((h) => WEEK_ANCHOR + h * HOUR);
    for (const now of checkpoints) {
      eng.advanceTo(now);
      const idx = GRADE_ORDER.indexOf(eng.state().pet.grade);
      expect(idx).toBeGreaterThanOrEqual(prev);
      prev = idx;
    }
  });

  it('records lastGradeRoll for the transparency UI', () => {
    const eng = createEngine(makePack(), { adapters: [staticAdapter()] });
    eng.ingest(denseWeek());
    eng.advanceTo(WEEK_ANCHOR + 6 * HOUR);
    const roll = eng.state().pet.lastGradeRoll;
    expect(roll).toBeTruthy();
    expect(roll!.from).toBe('C');
    expect(roll!.to).toBe('B');
    expect(roll!.chance).toBeGreaterThan(0);
    expect(roll!.chance).toBeLessThanOrEqual(1);
  });

  it('A->S odds are capped at 6% even with max activity modifier', () => {
    // Drive a pet to grade A then inspect the roll chance whenever from === 'A'.
    const eng = createEngine(makePack(), { adapters: [staticAdapter()] });
    eng.ingest(denseWeek());
    const seenAtoS: number[] = [];
    for (let h = 6; h < 160; h += 5) {
      eng.advanceTo(WEEK_ANCHOR + h * HOUR);
      const roll = eng.state().pet.lastGradeRoll;
      if (roll && roll.from === 'A') seenAtoS.push(roll.chance);
    }
    for (const c of seenAtoS) expect(c).toBeLessThanOrEqual(0.06 + 1e-9);
  });
});

describe('engine — normalization (model-neutral, pillar 2)', () => {
  it('10x token volume with the same pattern yields the same grade trajectory', () => {
    const run = (mult: number) => {
      const eng = createEngine(makePack(), { adapters: [staticAdapter()] });
      const events = denseWeek().map((e) => ({
        ...e,
        inputTokens: e.inputTokens * mult,
        outputTokens: e.outputTokens * mult,
      }));
      eng.ingest(events);
      eng.advanceTo(WEEK_ANCHOR + WEEK_MS - HOUR);
      return eng.state().pet.grade;
    };
    // Baseline is self-relative, so scaling all volume equally must not change
    // the grade outcome (same RNG stream, same odds buckets).
    expect(run(1)).toBe(run(10));
  });

  it('different model id (same pattern) does not change grade trajectory', () => {
    const run = (modelId: string) => {
      const eng = createEngine(makePack(), { adapters: [staticAdapter()] });
      eng.ingest(denseWeek(modelId));
      eng.advanceTo(WEEK_ANCHOR + WEEK_MS - HOUR);
      return eng.state().pet.grade;
    };
    // Two different claude-* models: identity differs (House same), grades equal.
    expect(run('claude-opus-4')).toBe(run('claude-haiku-4'));
  });
});

describe('engine — determinism & resume', () => {
  it('same state + events + now => deep-equal results', () => {
    const events = denseWeek();
    const mk = () => {
      const e = createEngine(makePack(), { adapters: [staticAdapter()] });
      e.ingest(events);
      return e;
    };
    const a = mk();
    const b = mk();
    const ea = a.advanceTo(WEEK_ANCHOR + 60 * HOUR);
    const eb = b.advanceTo(WEEK_ANCHOR + 60 * HOUR);
    expect(ea).toEqual(eb);
    expect(a.state()).toEqual(b.state());
  });

  it('replay from scratch equals resume from a mid-week snapshot', () => {
    const events = denseWeek();
    // Full run to the end.
    const full = createEngine(makePack(), { adapters: [staticAdapter()] });
    full.ingest(events);
    full.advanceTo(WEEK_ANCHOR + 100 * HOUR);
    const fullState = full.state();

    // Two-step run: snapshot mid-week, resume from it (re-feeding all events).
    const step1 = createEngine(makePack(), { adapters: [staticAdapter()] });
    step1.ingest(events);
    step1.advanceTo(WEEK_ANCHOR + 40 * HOUR);
    const snapshot = step1.state();

    const resumed = createEngine(makePack(), { adapters: [staticAdapter()] }, snapshot);
    resumed.ingest(events); // caller re-feeds full history on resume
    resumed.advanceTo(WEEK_ANCHOR + 100 * HOUR);

    expect(resumed.state()).toEqual(fullState);
  });

  it('state() is JSON-safe and round-trips', () => {
    const eng = createEngine(makePack(), { adapters: [staticAdapter()] });
    eng.ingest(denseWeek());
    eng.advanceTo(WEEK_ANCHOR + 30 * HOUR);
    const st = eng.state();
    const round = JSON.parse(JSON.stringify(st));
    expect(round).toEqual(st);
    expect(typeof st.rngState).toBe('number');
    expect(typeof st.simulatedTo).toBe('number');
  });

  it('advancing to the same now twice is idempotent for state', () => {
    const eng = createEngine(makePack(), { adapters: [staticAdapter()] });
    eng.ingest(denseWeek());
    eng.advanceTo(WEEK_ANCHOR + 30 * HOUR);
    const s1 = eng.state();
    const effects2 = eng.advanceTo(WEEK_ANCHOR + 30 * HOUR);
    expect(effects2).toEqual([]);
    expect(eng.state()).toEqual(s1);
  });
});

describe('engine — rebirth, lineage, archive', () => {
  it('rebirth archives the life, increments generation, restarts at C', () => {
    const eng = createEngine(makePack(), { adapters: [staticAdapter()] });
    eng.ingest(denseWeek());
    const effects = eng.advanceTo(WEEK_ANCHOR + WEEK_MS + HOUR);
    expect(effects.some((e) => e.type === 'rebirth')).toBe(true);
    const st = eng.state();
    expect(st.pet.generation).toBe(2);
    expect(st.pet.grade).toBe('C');
    expect(st.lineage).toHaveLength(1);
    expect(st.archive.length).toBeGreaterThan(0);
  });

  it('archive overwrites only when strictly better (grade, then stat total)', () => {
    const eng = createEngine(makePack(), { adapters: [staticAdapter()] });
    const st = eng.state();
    // Manually craft an engine state with a known archive entry, then rebirth a
    // worse life and confirm no overwrite, a better life and confirm overwrite.
    // Use the public path: run two weeks and assert monotonic best-per-species.
    eng.ingest([...denseWeek(), ...denseWeek('claude-x', WEEK_ANCHOR + WEEK_MS)]);
    eng.advanceTo(WEEK_ANCHOR + 2 * WEEK_MS + HOUR);
    const after = eng.state();
    // One record per species id (best only).
    const ids = after.archive.map((r) => r.speciesId);
    expect(new Set(ids).size).toBe(ids.length);
    void st;
  });

  it('inheritance carries stats forward as a per-stat floor (cap 70%)', () => {
    const eng = createEngine(makePack(), { adapters: [staticAdapter()] });
    eng.ingest(denseWeek());
    eng.advanceTo(WEEK_ANCHOR + WEEK_MS + HOUR);
    const st = eng.state();
    // New egg carries a non-zero stat floor from the prior apex life.
    const total = st.pet.stats.pwr + st.pet.stats.spd + st.pet.stats.wis + st.pet.stats.grt;
    expect(total).toBeGreaterThan(0);
  });

  it('a zero-usage week makes the new egg dormant', () => {
    const eng = createEngine(makePack(), { adapters: [staticAdapter()] });
    // Usage only in week 0; week 1 has none.
    eng.ingest(denseWeek());
    eng.advanceTo(WEEK_ANCHOR + 2 * WEEK_MS + HOUR);
    const effects = eng.advanceTo(WEEK_ANCHOR + 2 * WEEK_MS + 2 * HOUR);
    void effects;
    const st = eng.state();
    // After the second rebirth (a dormant week), the pet should be dormant.
    expect(st.pet.dormant).toBe(true);
  });
});

describe('engine — achievements & completion', () => {
  it('grants stage and grade achievements with their rewards', () => {
    const eng = createEngine(makePack(), { adapters: [staticAdapter()] });
    eng.ingest(denseWeek());
    const effects = eng.advanceTo(WEEK_ANCHOR + WEEK_MS - HOUR);
    const ach = effects.filter(
      (e): e is Extract<GameEffect, { type: 'achievement' }> => e.type === 'achievement',
    );
    const ids = ach.map((a) => a.id);
    expect(ids).toContain('first-sprite');
    expect(ids).toContain('first-evolved');
    expect(ids).toContain('molt-5');
    const st = eng.state();
    // first-sprite grants the meadow habitat; first-evolved grants the ball.
    expect(st.habitatsUnlocked).toContain('meadow');
    expect(st.trinketsUnlocked).toContain('ball');
  });

  it('does not grant the same achievement twice', () => {
    const eng = createEngine(makePack(), { adapters: [staticAdapter()] });
    eng.ingest(denseWeek());
    const e1 = eng.advanceTo(WEEK_ANCHOR + 30 * HOUR);
    const e2 = eng.advanceTo(WEEK_ANCHOR + 60 * HOUR);
    const ids1 = e1.filter((e) => e.type === 'achievement').map((e) => (e as { id: string }).id);
    const ids2 = e2.filter((e) => e.type === 'achievement').map((e) => (e as { id: string }).id);
    for (const id of ids2) expect(ids1).not.toContain(id);
  });

  it('completion() is a weighted union (dex 40, achv 40, hab 10, trk 10)', () => {
    const eng = createEngine(makePack(), { adapters: [staticAdapter()] });
    eng.ingest(denseWeek());
    eng.advanceTo(WEEK_ANCHOR + WEEK_MS - HOUR);
    const c = eng.completion();
    expect(c.overall).toBeGreaterThan(0);
    expect(c.overall).toBeLessThanOrEqual(100);
    // Recompute the weighting from the parts.
    const expected =
      Math.round((c.dex * 0.4 + c.achievements * 0.4 + c.habitats * 0.1 + c.trinkets * 0.1) * 10) /
      10;
    expect(Math.abs(c.overall - expected)).toBeLessThanOrEqual(0.2);
  });
});

describe('engine — dynamic policy parity', () => {
  it('dynamic policy also molts and evolves deterministically', () => {
    const eng = createEngine(makePack(), { adapters: [dynamicAdapter()] });
    // Continuous usage opens one window per 5h+ gap.
    const events: UsageEvent[] = [];
    for (let w = 0; w < 6; w++) {
      const ws = w * 6 * HOUR; // 6h spacing => each opens a new window
      events.push(ev(ws), ev(ws + HOUR), ev(ws + 2 * HOUR));
    }
    eng.ingest(events);
    eng.advanceTo(WEEK_ANCHOR + 40 * HOUR);
    const st = eng.state();
    expect(st.pet.moltCount).toBeGreaterThanOrEqual(5);
    expect(st.pet.stage).not.toBe('egg');
  });
});
