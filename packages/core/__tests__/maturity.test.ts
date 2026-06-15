import { describe, expect, it } from 'vitest';
import { createEngine, growthProgress, requiredMaturity, type GameState } from '../src/index';
import { adapters, makePack, staticCycle } from './fixture';

/** A real engine state with the pet fields overridden (pure-function inputs). */
function stateWith(overrides: Partial<GameState['pet']>): GameState {
  const st = createEngine(makePack(), { adapters: adapters(), cycle: staticCycle() }).state();
  return { ...st, pet: { ...st.pet, ...overrides } };
}

describe('maturity — pacing constants', () => {
  it('ramps so growth visibly slows as the pet matures', () => {
    expect(requiredMaturity('sprite')).toBe(1); // day-1 momentum preserved
    expect(requiredMaturity('rookie')).toBe(2);
    expect(requiredMaturity('evolved')).toBe(3);
    expect(requiredMaturity('prime')).toBe(4);
    // Egg (hatches off its own bonus checkpoint) and apex (terminal) are unpaced.
    expect(requiredMaturity('egg')).toBe(0);
    expect(requiredMaturity('apex')).toBe(0);
  });
});

describe('maturity — abstract growth readout (spoiler-free)', () => {
  it('an egg is incubating with an empty bar', () => {
    expect(growthProgress(stateWith({ stage: 'egg', stageMolts: 0 }))).toMatchObject({
      incubating: true,
      terminal: false,
      frac: 0,
    });
  });

  it('fills proportionally while maturing', () => {
    const g = growthProgress(stateWith({ stage: 'evolved', stageMolts: 1 }));
    expect(g.frac).toBeCloseTo(1 / 3, 5);
    expect(g.matured).toBe(false);
    expect(g.gated).toBe(false);
  });

  it('caps at a full bar once the maturity requirement is met', () => {
    const g = growthProgress(stateWith({ stage: 'rookie', stageMolts: 5 }));
    expect(g.frac).toBe(1);
    expect(g.matured).toBe(true);
  });

  it('apex is terminal: fully grown, no further growth', () => {
    expect(growthProgress(stateWith({ stage: 'apex', stageMolts: 0 }))).toMatchObject({
      terminal: true,
      frac: 1,
    });
  });
});

describe('maturity — prime→apex quality gate (grade ≥ B)', () => {
  it('holds a matured prime at the crest while grade is below B', () => {
    const g = growthProgress(stateWith({ stage: 'prime', stageMolts: 4, grade: 'C' }));
    expect(g.matured).toBe(true);
    expect(g.gated).toBe(true); // would not evolve to apex yet
  });

  it('releases the gate once grade reaches B', () => {
    const g = growthProgress(stateWith({ stage: 'prime', stageMolts: 4, grade: 'B' }));
    expect(g.matured).toBe(true);
    expect(g.gated).toBe(false);
  });
});
