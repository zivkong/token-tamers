import { describe, expect, it } from 'vitest';
import { createEngine, gradeOdds, type GameState, type Grade } from '../src/index';
import { ev, makePack, staticAdapter } from './fixture';

/** A fresh GameState whose pet sits at `grade` (defaults to the starting C). */
function stateAtGrade(grade: Grade = 'C'): GameState {
  const st = createEngine(makePack(), { adapters: [staticAdapter()] }).state();
  st.pet.grade = grade;
  return st;
}

describe('gradeOdds — the next-roll forecast', () => {
  it('reports the published base odds when there is no open window', () => {
    expect(gradeOdds(stateAtGrade('C'))).toEqual({
      from: 'C',
      to: 'B',
      chance: 0.25,
      capped: false,
    });
    expect(gradeOdds(stateAtGrade('B'))).toEqual({
      from: 'B',
      to: 'A',
      chance: 0.1,
      capped: false,
    });
    expect(gradeOdds(stateAtGrade('A'))).toEqual({
      from: 'A',
      to: 'S',
      chance: 0.03,
      capped: false,
    });
  });

  it('returns null at the S cap (no further rolls)', () => {
    expect(gradeOdds(stateAtGrade('S'))).toBeNull();
  });

  it('the vitality bonus lifts the chance as the open window grows (more food = better odds)', () => {
    const small = gradeOdds(stateAtGrade('C'), [ev(0, { inputTokens: 10_000_000 })])!;
    const large = gradeOdds(stateAtGrade('C'), [ev(0, { inputTokens: 150_000_000 })])!;
    expect(large.chance).toBeGreaterThan(small.chance);
    // The forecast is the live odds, no longer the flat 25% base.
    expect(large.chance).not.toBeCloseTo(0.25, 5);
  });

  it('marks the A→S step as capped once the raw chance exceeds the cap', () => {
    const odds = gradeOdds(stateAtGrade('A'), [ev(0, { inputTokens: 200_000_000 })])!;
    expect(odds.from).toBe('A');
    expect(odds.to).toBe('S');
    expect(odds.capped).toBe(true);
    expect(odds.chance).toBeCloseTo(0.06, 9); // clamped to A_TO_S_CAP
  });

  it('is deterministic: same state + events yield identical odds', () => {
    const events = [ev(0, { inputTokens: 5_000_000 }), ev(60_000, { inputTokens: 5_000_000 })];
    expect(gradeOdds(stateAtGrade('B'), events)).toEqual(gradeOdds(stateAtGrade('B'), events));
  });
});
