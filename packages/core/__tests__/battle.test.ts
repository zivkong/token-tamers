/**
 * Battle engine tests (design §11): determinism, the circular House wheel, Wild
 * neutrality, trait procs, and the battle-only grade stat-floor (invariant 3 —
 * combat never mutates a combatant). The whole engine must be
 * `f(combatantA, combatantB, ruleset.version)`.
 */

import { describe, expect, it } from 'vitest';
import {
  combatantFromSnapshot,
  effectiveStats,
  resolveProcs,
  sameSpecies,
  simulateBattle,
  typeMultiplier,
  type BattleRuleset,
  type Combatant,
  type DexSnapshot,
  type House,
  type Stats,
  type TraitId,
} from '../src';
import { makePack } from './fixture';

const RULESET: BattleRuleset = makePack().battle;

function combatant(over: Partial<Combatant> = {}): Combatant {
  return {
    speciesNum: 1,
    speciesId: 'aurelion',
    name: 'Aurelion',
    house: 'aether',
    grade: 'B',
    stage: 'evolved',
    stats: { pwr: 60, spd: 60, wis: 60, grt: 60 },
    traits: [],
    ...over,
  };
}

describe('simulateBattle determinism', () => {
  it('produces an identical timeline + winner for the same inputs', () => {
    const a = combatant({
      name: 'A',
      house: 'aether',
      stats: { pwr: 70, spd: 55, wis: 60, grt: 75 },
    });
    const b = combatant({
      name: 'B',
      house: 'flux',
      stats: { pwr: 65, spd: 80, wis: 50, grt: 65 },
    });
    const r1 = simulateBattle(a, b, RULESET);
    // Fresh, structurally-equal combatants (different object identity) must replay identically.
    const r2 = simulateBattle(
      { ...a, stats: { ...a.stats } },
      { ...b, stats: { ...b.stats } },
      RULESET,
    );
    expect(r2).toEqual(r1);
    expect(r1.timeline.length).toBeGreaterThan(0);
    expect(['a', 'b', 'draw']).toContain(r1.winner);
  });

  it('ends with a faint event when there is a winner', () => {
    const a = combatant({ stats: { pwr: 120, spd: 90, wis: 40, grt: 80 } });
    const b = combatant({ house: 'forge', stats: { pwr: 30, spd: 20, wis: 30, grt: 20 } });
    const r = simulateBattle(a, b, RULESET);
    expect(r.winner).toBe('a');
    expect(r.timeline[r.timeline.length - 1]!.kind).toBe('faint');
  });
});

describe('the House type wheel', () => {
  const edges: Array<[House, House]> = [
    ['aether', 'cipher'],
    ['cipher', 'flux'],
    ['flux', 'forge'],
    ['forge', 'aether'],
  ];

  it('is circular: each edge is an advantage and its reverse a disadvantage', () => {
    for (const [atk, def] of edges) {
      expect(typeMultiplier(atk, def, RULESET)).toBeGreaterThan(1);
      expect(typeMultiplier(def, atk, RULESET)).toBeLessThan(1);
    }
  });

  it('no House is net-stronger: advantages and disadvantages cancel around the wheel', () => {
    const houses: House[] = ['aether', 'cipher', 'flux', 'forge'];
    for (const h of houses) {
      let net = 1;
      for (const other of houses) {
        if (other === h) continue;
        net *= typeMultiplier(h, other, RULESET) * typeMultiplier(other, h, RULESET);
      }
      // Each (h→other)·(other→h) advantage/disadvantage pair multiplies to ~1.
      expect(net).toBeCloseTo(1, 5);
    }
  });

  it('Wild is neutral on both attack and defense', () => {
    for (const h of ['aether', 'cipher', 'flux', 'forge', 'wild'] as House[]) {
      expect(typeMultiplier('wild', h, RULESET)).toBe(1);
      expect(typeMultiplier(h, 'wild', RULESET)).toBe(1);
    }
  });
});

describe('trait procs', () => {
  it('fires the counter when attacker has the trait and defender the countered trait', () => {
    const res = resolveProcs(['sprinter'] as TraitId[], ['marathoner'] as TraitId[], RULESET);
    expect(res.multiplier).toBeGreaterThan(1);
    expect(res.procs).toContain('sprinter');
  });

  it('does not fire without the matching pair', () => {
    const res = resolveProcs(['sprinter'] as TraitId[], ['swarm'] as TraitId[], RULESET);
    expect(res.multiplier).toBe(1);
    expect(res.procs).toEqual([]);
  });
});

describe('grade stat-floor is battle-only (invariant 3)', () => {
  it('floors S effective stats ~+5% but leaves the recorded stats untouched', () => {
    const base: Stats = { pwr: 60, spd: 60, wis: 60, grt: 60 };
    const s = combatant({ grade: 'S', stats: { ...base } });
    const eff = effectiveStats(s);
    expect(eff.pwr).toBe(63); // 60 * 1.05
    expect(s.stats).toEqual(base); // input never mutated
  });

  it('leaves non-S grades at their recorded stats', () => {
    const c = combatant({ grade: 'A', stats: { pwr: 50, spd: 50, wis: 50, grt: 50 } });
    expect(effectiveStats(c)).toEqual(c.stats);
  });

  it('a full battle never mutates either combatant', () => {
    const a = combatant({ grade: 'S', stats: { pwr: 70, spd: 70, wis: 50, grt: 50 } });
    const b = combatant({ house: 'cipher', stats: { pwr: 60, spd: 60, wis: 60, grt: 60 } });
    const beforeA = JSON.stringify(a);
    const beforeB = JSON.stringify(b);
    simulateBattle(a, b, RULESET);
    expect(JSON.stringify(a)).toBe(beforeA);
    expect(JSON.stringify(b)).toBe(beforeB);
  });
});

describe('combatantFromSnapshot', () => {
  it('maps a snapshot to a combatant, cloning its stats/traits', () => {
    const snap: DexSnapshot = {
      speciesId: 'aurelion',
      stage: 'evolved',
      grade: 'A',
      stats: { pwr: 40, spd: 50, wis: 60, grt: 70 },
      house: 'aether',
      traits: ['marathoner'],
      pattern: null,
      rhythmVariant: null,
      mutations: [],
      generation: 3,
      contentVersion: 0,
      recordedAt: 1000,
      reason: 'molt',
    };
    const c = combatantFromSnapshot(snap, 1, 'Aurelion');
    expect(c).toMatchObject({ speciesNum: 1, name: 'Aurelion', house: 'aether', grade: 'A' });
    expect(c.stats).toEqual(snap.stats);
    expect(c.stats).not.toBe(snap.stats); // cloned
  });
});

describe('sameSpecies (the self-mirror rule)', () => {
  it('is true for two of the same species', () => {
    expect(sameSpecies({ speciesId: 'aurelion' }, { speciesId: 'aurelion' })).toBe(true);
  });

  it('is false for different species', () => {
    expect(sameSpecies({ speciesId: 'aurelion' }, { speciesId: 'glyphit' })).toBe(false);
  });

  it('is false when an id is empty (a decoded foreign code is never a self-mirror)', () => {
    expect(sameSpecies({ speciesId: '' }, { speciesId: '' })).toBe(false);
    expect(sameSpecies({ speciesId: 'aurelion' }, { speciesId: '' })).toBe(false);
  });
});
