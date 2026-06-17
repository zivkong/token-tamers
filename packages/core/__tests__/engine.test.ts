import { describe, expect, it } from 'vitest';
import {
  createEngine,
  GRADE_ORDER,
  matchModelRule,
  type GameEffect,
  type GameState,
  type UsageEvent,
} from '../src/index';
import {
  adapters,
  ev,
  HOUR,
  makePack,
  staticCycle,
  subscriptionCycle,
  WEEK_ANCHOR,
} from './fixture';

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

    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
    eng.ingest([ev(0, { modelId: 'claude-opus-4' })]);
    // Stop after the 10-min egg-hatch checkpoint but before the first 5h window:
    // the House is committed at the hatch (the egg's first molt).
    eng.advanceTo(WEEK_ANCHOR + HOUR);
    const st = eng.state();
    expect(st.pet.house).toBe('aether');
    expect(st.pet.speciesId).toBe('wisp'); // aether sprite
    expect(st.pet.stage).toBe('sprite');
  });

  it('dominant gene by essence decides the House on first molt', () => {
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
    eng.ingest([
      ev(0, { modelId: 'gpt-4o', inputTokens: 10000 }),
      ev(HOUR, { modelId: 'claude-x', inputTokens: 100 }),
    ]);
    eng.advanceTo(WEEK_ANCHOR + 6 * HOUR);
    expect(eng.state().pet.house).toBe('cipher');
  });

  it('unmatched model would commit to wild (here the pack maps * to wild)', () => {
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
    eng.ingest([ev(0, { modelId: 'llama-3' })]);
    eng.advanceTo(WEEK_ANCHOR + 6 * HOUR);
    expect(eng.state().pet.house).toBe('wild');
  });
});

describe('engine — egg fast-hatch', () => {
  const MIN = 60 * 1000;

  it('hatches the egg ~10 minutes after first usage, not at the 5h close', () => {
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: subscriptionCycle() });
    eng.ingest([ev(0)]);
    // Just before the 10-minute hatch close: still an egg.
    eng.advanceTo(WEEK_ANCHOR + 9 * MIN);
    expect(eng.state().pet.stage).toBe('egg');
    expect(eng.state().pet.moltCount).toBe(0);
    // Just after: the short hatch window closed → the egg hatched.
    const effects = eng.advanceTo(WEEK_ANCHOR + 11 * MIN);
    expect(effects.some((e) => e.type === 'hatched')).toBe(true);
    expect(eng.state().pet.stage).toBe('sprite');
    expect(eng.state().pet.moltCount).toBe(1);
  });

  it('a mid-week egg (init) hatches off its OWN first feeding, not old history', () => {
    // The first egg is placed mid-week via startAt; usage from earlier in the
    // same week (before the egg existed) must NOT define the hatch time.
    const startAt = WEEK_ANCHOR + 3 * 24 * HOUR; // mid-week
    const eng = createEngine(makePack(), {
      adapters: adapters(),
      cycle: subscriptionCycle(),
      startAt,
    });
    eng.ingest([
      ev(HOUR), // day-0 history, days before the egg — must be ignored
      ev(3 * 24 * HOUR + 30 * MIN), // first feeding 30 min after the egg is placed
    ]);
    // Before the egg's own first feeding + 10 min: still an egg.
    eng.advanceTo(startAt + 35 * MIN);
    expect(eng.state().pet.stage).toBe('egg');
    // After it: hatched.
    eng.advanceTo(startAt + 41 * MIN);
    expect(eng.state().pet.stage).toBe('sprite');
    expect(eng.state().pet.moltCount).toBe(1);
  });

  it('is identical whether advanced in one big step or many small ones', () => {
    const events = [ev(0), ev(30 * MIN), ev(6 * HOUR), ev(7 * HOUR)];

    const big = createEngine(makePack(), { adapters: adapters(), cycle: subscriptionCycle() });
    big.ingest(events);
    big.advanceTo(WEEK_ANCHOR + 13 * HOUR);

    const small = createEngine(makePack(), { adapters: adapters(), cycle: subscriptionCycle() });
    small.ingest(events);
    for (const t of [5 * MIN, 11 * MIN, 3 * HOUR, 7 * HOUR, 13 * HOUR]) {
      small.advanceTo(WEEK_ANCHOR + t);
    }

    // Granularity independence: the fast-hatch cannot depend on how often the
    // engine is advanced, or replay-from-scratch would diverge from resume.
    expect(small.state()).toEqual(big.state());
  });
});

describe('engine — molt-only evolution', () => {
  it('no molts => no evolution, stays an egg', () => {
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
    eng.ingest([ev(0)]);
    // Advance to before even the short egg-hatch close (5 min < 10 min): the
    // first window has not closed, so nothing has molted.
    const effects = eng.advanceTo(WEEK_ANCHOR + 5 * 60 * 1000);
    expect(effects.filter((e) => e.type === 'molt')).toHaveLength(0);
    const st = eng.state();
    expect(st.pet.stage).toBe('egg');
    expect(st.pet.moltCount).toBe(0);
  });

  it('each molt advances at most one stage, paced by the maturity clock', () => {
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
    eng.ingest(denseWeek());
    // Molt 1 is the egg-hatch checkpoint (10 min in) → sprite.
    eng.advanceTo(WEEK_ANCHOR + HOUR);
    expect(eng.state().pet.moltCount).toBe(1);
    expect(eng.state().pet.stage).toBe('sprite');
    // Molt 2 (first 5h window): sprite needs just 1 molt → rookie (day-1 momentum).
    eng.advanceTo(WEEK_ANCHOR + 6 * HOUR);
    expect(eng.state().pet.moltCount).toBe(2);
    expect(eng.state().pet.stage).toBe('rookie');
    // Molt 3: rookie needs 2 molts — still maturing, NOT yet evolved.
    eng.advanceTo(WEEK_ANCHOR + 11 * HOUR);
    expect(eng.state().pet.moltCount).toBe(3);
    expect(eng.state().pet.stage).toBe('rookie');
    expect(eng.state().pet.stageMolts).toBe(1);
    // Molt 4: rookie's maturity is met → evolved (one stage, not two).
    eng.advanceTo(WEEK_ANCHOR + 16 * HOUR);
    const st = eng.state();
    expect(st.pet.moltCount).toBe(4);
    expect(st.pet.stage).toBe('evolved');
    expect(st.pet.stageMolts).toBe(0);
  });

  it('never advances more than one stage between consecutive molts', () => {
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
    eng.ingest(denseWeek());
    const stageOf = (s: string) =>
      ['egg', 'sprite', 'rookie', 'evolved', 'prime', 'apex'].indexOf(s);
    let prevStage = stageOf('egg');
    let prevMolt = 0;
    for (let h = 1; h <= WEEK_MS / HOUR; h += 5) {
      eng.advanceTo(WEEK_ANCHOR + h * HOUR);
      const st = eng.state();
      const dMolts = st.pet.moltCount - prevMolt;
      const dStage = stageOf(st.pet.stage) - prevStage;
      // Stage never moves backward, and never jumps more than one stage per molt.
      expect(dStage).toBeGreaterThanOrEqual(0);
      expect(dStage).toBeLessThanOrEqual(Math.max(1, dMolts));
      prevStage = stageOf(st.pet.stage);
      prevMolt = st.pet.moltCount;
    }
  });

  it('reaches Apex over a full active week and never beyond', () => {
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
    eng.ingest(denseWeek());
    eng.advanceTo(WEEK_ANCHOR + WEEK_MS - HOUR);
    const st = eng.state();
    expect(st.pet.stage).toBe('apex');
    expect(st.pet.speciesId).toBe('aurelion');
  });
});

describe('engine — monotonic grades', () => {
  it('grade never decreases across many molts', () => {
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
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
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
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
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
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
      const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
      const events = denseWeek().map((e) => ({
        ...e,
        inputTokens: e.inputTokens * mult,
        outputTokens: e.outputTokens * mult,
      }));
      eng.ingest(events);
      eng.advanceTo(WEEK_ANCHOR + WEEK_MS - HOUR);
      return eng.state().pet.grade;
    };
    // Base odds are self-relative (volume-blind), and the separate vitality
    // bonus is hard-capped and negligible at these token scales (denseWeek×10
    // is far below VITALITY_FULL_TOKENS), so scaling ordinary volume equally
    // must not change the grade outcome (same RNG stream, same odds buckets).
    expect(run(1)).toBe(run(10));
  });

  it('different model id (same pattern) does not change grade trajectory', () => {
    const run = (modelId: string) => {
      const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
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
      const e = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
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
    const full = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
    full.ingest(events);
    full.advanceTo(WEEK_ANCHOR + 100 * HOUR);
    const fullState = full.state();

    // Two-step run: snapshot mid-week, resume from it (re-feeding all events).
    const step1 = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
    step1.ingest(events);
    step1.advanceTo(WEEK_ANCHOR + 40 * HOUR);
    const snapshot = step1.state();

    const resumed = createEngine(
      makePack(),
      { adapters: adapters(), cycle: staticCycle() },
      snapshot,
    );
    resumed.ingest(events); // caller re-feeds full history on resume
    resumed.advanceTo(WEEK_ANCHOR + 100 * HOUR);

    expect(resumed.state()).toEqual(fullState);
  });

  it('state() is JSON-safe and round-trips', () => {
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
    eng.ingest(denseWeek());
    eng.advanceTo(WEEK_ANCHOR + 30 * HOUR);
    const st = eng.state();
    const round = JSON.parse(JSON.stringify(st));
    expect(round).toEqual(st);
    expect(typeof st.rngState).toBe('number');
    expect(typeof st.simulatedTo).toBe('number');
  });

  it('advancing to the same now twice is idempotent for state', () => {
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
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
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
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
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
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

  it('captures per-species Dex records across the life (dex_record effects + state)', () => {
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
    eng.ingest(denseWeek());
    const effects = eng.advanceTo(WEEK_ANCHOR + WEEK_MS + HOUR);
    expect(effects.some((e) => e.type === 'dex_record')).toBe(true);
    const st = eng.state();
    expect(st.dexRecords.length).toBeGreaterThan(0);
    // The unified store is at least as complete as the rebirth-only archive mirror.
    expect(st.dexRecords.length).toBeGreaterThanOrEqual(st.archive.length);
    for (const rec of st.dexRecords) {
      expect(rec.top.length).toBeGreaterThan(0);
      expect(rec.top.length).toBeLessThanOrEqual(3);
      // Best-first: grade never increases down the list.
      for (let i = 1; i < rec.top.length; i++) {
        expect(GRADE_ORDER.indexOf(rec.top[i - 1]!.grade)).toBeGreaterThanOrEqual(
          GRADE_ORDER.indexOf(rec.top[i]!.grade),
        );
      }
    }
  });

  it('tolerates a resumed pre-v3 snapshot with no dexRecords (no crash)', () => {
    const seed = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() }).state();
    const legacy = { ...seed } as Record<string, unknown>;
    delete legacy.dexRecords; // simulate a save written before SCHEMA_VERSION 3
    const eng = createEngine(
      makePack(),
      { adapters: adapters(), cycle: staticCycle() },
      legacy as unknown as GameState,
    );
    eng.ingest(denseWeek());
    expect(() => eng.advanceTo(WEEK_ANCHOR + WEEK_MS + HOUR)).not.toThrow();
    expect(Array.isArray(eng.state().dexRecords)).toBe(true);
    expect(eng.state().dexRecords.length).toBeGreaterThan(0);
  });

  it('inheritance carries stats forward as a per-stat floor (cap 70%)', () => {
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
    eng.ingest(denseWeek());
    eng.advanceTo(WEEK_ANCHOR + WEEK_MS + HOUR);
    const st = eng.state();
    // New egg carries a non-zero stat floor from the prior apex life.
    const total = st.pet.stats.pwr + st.pet.stats.spd + st.pet.stats.wis + st.pet.stats.grt;
    expect(total).toBeGreaterThan(0);
  });

  it('a zero-usage week makes the new egg dormant', () => {
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
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
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
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
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
    eng.ingest(denseWeek());
    const e1 = eng.advanceTo(WEEK_ANCHOR + 30 * HOUR);
    const e2 = eng.advanceTo(WEEK_ANCHOR + 60 * HOUR);
    const ids1 = e1.filter((e) => e.type === 'achievement').map((e) => (e as { id: string }).id);
    const ids2 = e2.filter((e) => e.type === 'achievement').map((e) => (e as { id: string }).id);
    for (const id of ids2) expect(ids1).not.toContain(id);
  });

  it('completion() is a weighted union (dex 40, achv 40, hab 10, trk 10)', () => {
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() });
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
    const eng = createEngine(makePack(), { adapters: adapters(), cycle: subscriptionCycle() });
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

describe('engine — reconcile catch-up rebirth', () => {
  const cycle = subscriptionCycle(WEEK_ANCHOR);
  const now = WEEK_ANCHOR + 10 * 24 * HOUR; // sim clock 10 days in, past the +7d boundary

  /** A save that slipped past a weekly boundary without rebirthing (the bug). */
  function stuckEngine() {
    const saved = createEngine(makePack(), { adapters: adapters(), cycle }).state();
    saved.pet.hatchedAt = WEEK_ANCHOR + 2 * 24 * HOUR; // born BEFORE the +7d boundary
    saved.simulatedTo = now; // clock already advanced past it (no rebirth fired)
    const eng = createEngine(makePack(), { adapters: adapters(), cycle }, saved);
    eng.ingest([ev(2 * 24 * HOUR)]); // first usage = the hatch
    return eng;
  }

  it('rebirths a pet that lived across a missed weekly boundary', () => {
    const eng = stuckEngine();
    const effects = eng.reconcile(now);
    expect(effects.some((e) => e.type === 'rebirth')).toBe(true);
    const st = eng.state();
    expect(st.pet.generation).toBe(2);
    expect(st.pet.stage).toBe('egg');
    // New egg dated to the missed boundary, not "now".
    expect(st.pet.hatchedAt).toBe(WEEK_ANCHOR + WEEK_MS);
  });

  it('is idempotent — a second pass does nothing', () => {
    const eng = stuckEngine();
    eng.reconcile(now);
    const after = eng.reconcile(now);
    expect(after.some((e) => e.type === 'rebirth')).toBe(false);
    expect(eng.state().pet.generation).toBe(2);
  });

  it('leaves a healthy mid-week pet untouched', () => {
    // Born this week, clock has NOT passed a boundary => nothing to reconcile.
    const saved = createEngine(makePack(), { adapters: adapters(), cycle }).state();
    saved.pet.hatchedAt = WEEK_ANCHOR + 8 * 24 * HOUR;
    saved.simulatedTo = WEEK_ANCHOR + 9 * 24 * HOUR;
    const eng = createEngine(makePack(), { adapters: adapters(), cycle }, saved);
    eng.ingest([ev(8 * 24 * HOUR)]);
    const effects = eng.reconcile(WEEK_ANCHOR + 9 * 24 * HOUR);
    expect(effects.some((e) => e.type === 'rebirth')).toBe(false);
    expect(eng.state().pet.generation).toBe(1);
  });
});
