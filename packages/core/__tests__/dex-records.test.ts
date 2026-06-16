import { describe, expect, it } from 'vitest';
import {
  bestSpeciesRecords,
  graftPotency,
  graftPotencyTier,
  isBattleReady,
  isGraftReady,
  MAX_DEX_RECORDS,
  rankBestPerLife,
  snapshotRank,
  stageMature,
  tryCaptureSnapshot,
  type DexRecord,
  type DexSnapshot,
  type Grade,
  type Stage,
} from '../src/index';

function snap(over: Partial<DexSnapshot> = {}): DexSnapshot {
  return {
    speciesId: 'aurelion',
    stage: 'evolved',
    grade: 'C',
    stats: { pwr: 10, spd: 10, wis: 10, grt: 10 },
    house: 'aether',
    traits: [],
    pattern: null,
    rhythmVariant: null,
    mutations: [],
    generation: 1,
    contentVersion: 1,
    recordedAt: 1000,
    reason: 'molt',
    ...over,
  };
}

describe('dex records — top-N capture', () => {
  it('keeps the top-3 DISTINCT lives, ranked by grade then stat total', () => {
    const records: DexRecord[] = [];
    tryCaptureSnapshot(records, snap({ generation: 1, grade: 'C', recordedAt: 1 }));
    tryCaptureSnapshot(records, snap({ generation: 2, grade: 'A', recordedAt: 2 }));
    tryCaptureSnapshot(records, snap({ generation: 3, grade: 'B', recordedAt: 3 }));
    tryCaptureSnapshot(records, snap({ generation: 4, grade: 'S', recordedAt: 4 }));
    const top = records[0]!.top;
    expect(top).toHaveLength(MAX_DEX_RECORDS);
    expect(top.map((s) => s.grade)).toEqual(['S', 'A', 'B']);
  });

  it('returns false for a candidate (new life) that cannot beat the kept top-3', () => {
    const records: DexRecord[] = [];
    tryCaptureSnapshot(records, snap({ generation: 1, grade: 'S', recordedAt: 1 }));
    tryCaptureSnapshot(records, snap({ generation: 2, grade: 'A', recordedAt: 2 }));
    tryCaptureSnapshot(
      records,
      snap({
        generation: 3,
        grade: 'A',
        recordedAt: 3,
        stats: { pwr: 99, spd: 99, wis: 99, grt: 99 },
      }),
    );
    const earned = tryCaptureSnapshot(records, snap({ generation: 4, grade: 'C', recordedAt: 4 }));
    expect(earned).toBe(false);
    expect(records[0]!.top).toHaveLength(3);
  });

  it('dedupes an identical peak (idempotent under re-advance)', () => {
    const records: DexRecord[] = [];
    const s = snap({ grade: 'A', recordedAt: 5 });
    expect(tryCaptureSnapshot(records, s)).toBe(true);
    expect(tryCaptureSnapshot(records, { ...s })).toBe(false);
    expect(records[0]!.top).toHaveLength(1);
  });

  // Bug fix: one life that molts repeatedly at the same species must NOT fill the
  // top-3 with near-duplicates — each life keeps a single best-peak entry.
  it('collapses repeated same-life captures to that life’s best peak', () => {
    const records: DexRecord[] = [];
    tryCaptureSnapshot(records, snap({ generation: 5, grade: 'C', recordedAt: 1 }));
    tryCaptureSnapshot(records, snap({ generation: 5, grade: 'B', recordedAt: 2 }));
    const earned = tryCaptureSnapshot(records, snap({ generation: 5, grade: 'A', recordedAt: 3 }));
    expect(earned).toBe(true);
    expect(records[0]!.top).toHaveLength(1); // one entry for the life, not three
    expect(records[0]!.top[0]!.grade).toBe('A'); // kept the life's best peak
    // A later, worse capture of the same life changes nothing.
    expect(tryCaptureSnapshot(records, snap({ generation: 5, grade: 'C', recordedAt: 4 }))).toBe(
      false,
    );
    expect(records[0]!.top).toHaveLength(1);
    expect(records[0]!.top[0]!.grade).toBe('A');
  });

  it('rankBestPerLife keeps one entry per generation, ranked, capped', () => {
    const snaps = [
      snap({ generation: 1, grade: 'C', recordedAt: 1 }),
      snap({ generation: 1, grade: 'S', recordedAt: 2 }), // same life as above → only the S survives
      snap({ generation: 2, grade: 'B', recordedAt: 3 }),
      snap({ generation: 3, grade: 'A', recordedAt: 4 }),
      snap({ generation: 4, grade: 'C', recordedAt: 5 }),
    ];
    const top = rankBestPerLife(snaps);
    expect(top).toHaveLength(MAX_DEX_RECORDS);
    expect(top.map((s) => [s.generation, s.grade])).toEqual([
      [1, 'S'],
      [3, 'A'],
      [2, 'B'],
    ]);
  });

  it('snapshotRank orders grade desc, then stat total desc', () => {
    expect(snapshotRank(snap({ grade: 'S' }), snap({ grade: 'C' }))).toBeLessThan(0);
    expect(
      snapshotRank(snap({ stats: { pwr: 20, spd: 20, wis: 20, grt: 20 } }), snap()),
    ).toBeLessThan(0);
  });

  it('bestSpeciesRecords returns each species record top[0]', () => {
    const records: DexRecord[] = [];
    tryCaptureSnapshot(records, snap({ speciesId: 'a', grade: 'B', recordedAt: 1 }));
    tryCaptureSnapshot(records, snap({ speciesId: 'a', grade: 'S', recordedAt: 2 }));
    tryCaptureSnapshot(records, snap({ speciesId: 'b', grade: 'C', recordedAt: 3 }));
    expect(bestSpeciesRecords(records).map((s) => [s.speciesId, s.grade])).toEqual([
      ['a', 'S'],
      ['b', 'C'],
    ]);
  });
});

describe('battle/graft readiness gate (Evolved)', () => {
  it('is sealed below Evolved and ready at Evolved and above', () => {
    const below: Stage[] = ['egg', 'sprite', 'rookie'];
    const ready: Stage[] = ['evolved', 'prime', 'apex'];
    for (const stage of below) {
      expect(stageMature(stage)).toBe(false);
      expect(isBattleReady({ stage })).toBe(false);
      expect(isGraftReady({ stage })).toBe(false);
    }
    for (const stage of ready) {
      expect(stageMature(stage)).toBe(true);
      expect(isBattleReady({ stage })).toBe(true);
      expect(isGraftReady({ stage })).toBe(true);
    }
  });
});

describe('graft potency (donor-grade scaled)', () => {
  it('is zero at C, capped at S, and monotonic non-decreasing', () => {
    expect(graftPotency('C')).toEqual({ gradeUpChance: 0, statBoostFrac: 0 });
    const order: Grade[] = ['C', 'B', 'A', 'S'];
    for (let i = 1; i < order.length; i++) {
      const lo = graftPotency(order[i - 1]!);
      const hi = graftPotency(order[i]!);
      expect(hi.gradeUpChance).toBeGreaterThanOrEqual(lo.gradeUpChance);
      expect(hi.statBoostFrac).toBeGreaterThanOrEqual(lo.statBoostFrac);
    }
    // Even the S cap stays below the project's other capped bonus (vitality 0.15).
    expect(graftPotency('S').statBoostFrac).toBeLessThanOrEqual(0.15);
    expect(graftPotency('S').gradeUpChance).toBeLessThanOrEqual(0.15);
  });

  it('maps grades to UI tiers', () => {
    expect(graftPotencyTier('C')).toBe('none');
    expect(graftPotencyTier('B')).toBe('small');
    expect(graftPotencyTier('A')).toBe('moderate');
    expect(graftPotencyTier('S')).toBe('capped');
  });
});
