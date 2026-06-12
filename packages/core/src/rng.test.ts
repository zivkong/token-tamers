import { describe, expect, it } from 'vitest';
import { chance, createRng, nextFloat, nextInt, pickWeighted } from './rng';

describe('rng', () => {
  it('is deterministic from a seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 10 }, () => nextFloat(a));
    const seqB = Array.from({ length: 10 }, () => nextFloat(b));
    expect(seqA).toEqual(seqB);
  });

  it('produces values in [0,1)', () => {
    const r = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const v = nextFloat(r);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('serializes state: resuming from state continues the same stream', () => {
    const r = createRng(99);
    nextFloat(r);
    nextFloat(r);
    const snapshot = r.state;
    const continued = [nextFloat(r), nextFloat(r)];
    const resumed = createRng(snapshot);
    expect([nextFloat(resumed), nextFloat(resumed)]).toEqual(continued);
  });

  it('chance(p<=0) is always false, chance(p>=1) is always true', () => {
    const r = createRng(7);
    for (let i = 0; i < 50; i++) {
      expect(chance(r, 0)).toBe(false);
      expect(chance(r, 1)).toBe(true);
    }
  });

  it('chance approximates the probability over many draws', () => {
    const r = createRng(42);
    let hits = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) if (chance(r, 0.25)) hits++;
    expect(hits / n).toBeGreaterThan(0.23);
    expect(hits / n).toBeLessThan(0.27);
  });

  it('nextInt stays in range', () => {
    const r = createRng(3);
    for (let i = 0; i < 1000; i++) {
      const v = nextInt(r, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
    }
  });

  it('pickWeighted respects weights and handles zero-total', () => {
    const r = createRng(11);
    const counts = [0, 0, 0];
    for (let i = 0; i < 30000; i++) counts[pickWeighted(r, [1, 3, 0])]!++;
    expect(counts[2]).toBe(0); // zero weight never picked
    expect(counts[1]).toBeGreaterThan(counts[0]!); // 3:1 ratio
    // zero total falls back to uniform-ish, never throws
    expect(() => pickWeighted(r, [0, 0])).not.toThrow();
  });
});
