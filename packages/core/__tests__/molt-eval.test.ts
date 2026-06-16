import { describe, expect, it } from 'vitest';
import {
  activityModifier,
  classifyRhythm,
  computeWindowSignals,
  dominantTraitClass,
  evaluateTraits,
} from '../src/evaluation';
import { vitalityBonus, VITALITY_FULL_TOKENS, VITALITY_MAX_BONUS } from '../src/engine';
import { ev, HOUR, MIN, WEEK_ANCHOR } from './fixture';

const WSTART = WEEK_ANCHOR;
const WEND = WEEK_ANCHOR + 5 * HOUR;

describe('molt-eval — signals', () => {
  it('counts sessions, adapters, models, langs', () => {
    const events = [
      ev(0, {
        sessionKey: 'a',
        modelId: 'claude-x',
        adapter: 'claude-code',
        langHints: ['ts', 'js'],
      }),
      ev(MIN, { sessionKey: 'a', modelId: 'gpt-4', adapter: 'claude-code', langHints: ['py'] }),
      ev(2 * MIN, { sessionKey: 'b', modelId: 'claude-x', adapter: 'codex' }),
    ];
    const s = computeWindowSignals(events, WSTART, WEND, {});
    expect(s.sessionCount).toBe(2);
    expect(s.adapterCount).toBe(2);
    expect(s.modelCount).toBe(2);
    expect(s.langCount).toBe(3);
    expect(s.eventCount).toBe(3);
  });

  it('essenceRatio normalizes to baseline mean', () => {
    const events = [ev(0, { inputTokens: 1000, outputTokens: 0 })];
    const s1 = computeWindowSignals(events, WSTART, WEND, { 'claude-code': 1000 });
    expect(s1.essenceRatio).toBeCloseTo(1, 5);
    const s2 = computeWindowSignals([ev(0, { inputTokens: 5000, outputTokens: 0 })], WSTART, WEND, {
      'claude-code': 1000,
    });
    expect(s2.essenceRatio).toBeCloseTo(5, 5);
  });

  it('defaults essenceRatio to 1 when no baseline yet', () => {
    const s = computeWindowSignals([ev(0)], WSTART, WEND, {});
    expect(s.essenceRatio).toBe(1);
  });

  it('combines essence per-adapter: Σ essence / Σ mean over baselined adapters', () => {
    // Adapter A: 2000 essence vs 1000 baseline; adapter B: 3000 vs 1000.
    // Combined = (2000 + 3000) / (1000 + 1000) = 2.5.
    const events = [
      ev(0, { adapter: 'claude-code', inputTokens: 2000, outputTokens: 0 }),
      ev(MIN, { adapter: 'opencode', inputTokens: 3000, outputTokens: 0 }),
    ];
    const s = computeWindowSignals(events, WSTART, WEND, {
      'claude-code': 1000,
      opencode: 1000,
    });
    expect(s.essenceRatio).toBeCloseTo(2.5, 9);
  });

  it('treats an active adapter with no baseline as neutral (excluded, not zeroing)', () => {
    // A is on-baseline (ratio 1); B has huge usage but NO baseline yet. B must be
    // excluded from both sums — not drag the ratio toward 0 — so the result is 1.
    const events = [
      ev(0, { adapter: 'claude-code', inputTokens: 1000, outputTokens: 0 }),
      ev(MIN, { adapter: 'opencode', inputTokens: 999_999, outputTokens: 0 }),
    ];
    const s = computeWindowSignals(events, WSTART, WEND, { 'claude-code': 1000 });
    expect(s.essenceRatio).toBeCloseTo(1, 9);
  });

  it('does not inflate power when the same essence is split across two agents (§6)', () => {
    // One adapter carrying 2000 essence over a 1000 baseline reads as ratio 2...
    const solo = computeWindowSignals(
      [ev(0, { adapter: 'claude-code', inputTokens: 2000, outputTokens: 0 })],
      WSTART,
      WEND,
      { 'claude-code': 1000 },
    );
    expect(solo.essenceRatio).toBeCloseTo(2, 9);
    // ...but the SAME total essence split 1000/1000 across two equally-baselined
    // adapters normalizes to 1 — diversity, not inflated power.
    const split = computeWindowSignals(
      [
        ev(0, { adapter: 'claude-code', inputTokens: 1000, outputTokens: 0 }),
        ev(MIN, { adapter: 'opencode', inputTokens: 1000, outputTokens: 0 }),
      ],
      WSTART,
      WEND,
      { 'claude-code': 1000, opencode: 1000 },
    );
    expect(split.essenceRatio).toBeCloseTo(1, 9);
    expect(split.essenceRatio).toBeLessThan(solo.essenceRatio);
  });
});

describe('molt-eval — traits', () => {
  it('Marathoner: near-cap continuous span', () => {
    const events = [ev(0), ev(2 * HOUR), ev(4 * HOUR), ev(4.5 * HOUR)];
    const s = computeWindowSignals(events, WSTART, WEND, {});
    expect(evaluateTraits(s)).toContain('marathoner');
  });

  it('Switcher fires on 2+ models, never punishes mono-model', () => {
    const multi = computeWindowSignals(
      [ev(0, { modelId: 'claude-x' }), ev(MIN, { modelId: 'gpt-4' })],
      WSTART,
      WEND,
      {},
    );
    expect(evaluateTraits(multi)).toContain('switcher');
    const mono = computeWindowSignals(
      [ev(0, { modelId: 'claude-x' }), ev(MIN, { modelId: 'claude-x' })],
      WSTART,
      WEND,
      {},
    );
    expect(evaluateTraits(mono)).not.toContain('switcher');
  });

  it('Polyglot fires on 3+ langs', () => {
    const s = computeWindowSignals(
      [ev(0, { langHints: ['ts', 'py', 'go', 'rs'] })],
      WSTART,
      WEND,
      {},
    );
    expect(evaluateTraits(s)).toContain('polyglot');
  });

  it('Polyhost fires on 2+ adapters', () => {
    const s = computeWindowSignals(
      [ev(0, { adapter: 'claude-code' }), ev(MIN, { adapter: 'codex' })],
      WSTART,
      WEND,
      {},
    );
    expect(evaluateTraits(s)).toContain('polyhost');
  });

  it('no traits for an empty window', () => {
    const s = computeWindowSignals([], WSTART, WEND, {});
    expect(evaluateTraits(s)).toEqual([]);
  });
});

describe('molt-eval — modifiers (model-neutral)', () => {
  it('activity modifier stays within [0.5, 2.0]', () => {
    const empty = computeWindowSignals([], WSTART, WEND, {});
    expect(activityModifier(empty, [])).toBe(0.5);
    const rich = computeWindowSignals(
      [ev(0), ev(2 * HOUR), ev(4 * HOUR, { modelId: 'gpt-4', langHints: ['a', 'b', 'c'] })],
      WSTART,
      WEND,
      { 'claude-code': 1000 },
    );
    const m = activityModifier(rich, ['marathoner', 'switcher', 'polyglot', 'swarm']);
    expect(m).toBeGreaterThanOrEqual(0.5);
    expect(m).toBeLessThanOrEqual(2.0);
  });

  it('is identical for 1x vs 10x token volume with the same pattern (pillar 2)', () => {
    const mk = (mult: number) =>
      computeWindowSignals(
        [
          ev(0, { inputTokens: 1000 * mult, outputTokens: 500 * mult }),
          ev(2 * HOUR, { inputTokens: 1000 * mult, outputTokens: 500 * mult }),
          ev(4 * HOUR, { inputTokens: 1000 * mult, outputTokens: 500 * mult }),
        ],
        WSTART,
        WEND,
        { 'claude-code': 1500 * mult }, // baseline scales with the player's own volume
      );
    const s1 = mk(1);
    const s10 = mk(10);
    // essenceRatio (relative to self) is identical, so the modifier is identical.
    expect(s1.essenceRatio).toBeCloseTo(s10.essenceRatio, 9);
    expect(activityModifier(s1, ['marathoner'])).toBeCloseTo(
      activityModifier(s10, ['marathoner']),
      9,
    );
  });

  it('vitality bonus is zero at no usage and hard-capped at the max', () => {
    expect(vitalityBonus(0)).toBe(0);
    expect(vitalityBonus(VITALITY_FULL_TOKENS)).toBeCloseTo(VITALITY_MAX_BONUS, 9);
    // Beyond 200M it cannot run away — the bonus stays clamped at the cap.
    expect(vitalityBonus(VITALITY_FULL_TOKENS * 5)).toBe(VITALITY_MAX_BONUS);
  });

  it('vitality bonus rises monotonically with session token volume', () => {
    expect(vitalityBonus(50_000_000)).toBeGreaterThan(vitalityBonus(10_000_000));
    expect(vitalityBonus(VITALITY_FULL_TOKENS / 2)).toBeCloseTo(VITALITY_MAX_BONUS / 2, 9);
  });

  it('window signals carry the raw (cache-inclusive) token total for vitality', () => {
    const s = computeWindowSignals(
      [ev(0, { inputTokens: 100, outputTokens: 50, cacheReadTokens: 1000, cacheWriteTokens: 10 })],
      WSTART,
      WEND,
      {},
    );
    expect(s.totalTokens).toBe(1160);
  });

  it('classifyRhythm distinguishes steady vs bursty', () => {
    const steady = computeWindowSignals(
      [ev(0), ev(HOUR), ev(2 * HOUR), ev(3 * HOUR)],
      WSTART,
      WEND,
      {},
    );
    expect(classifyRhythm(steady)).toBe('steady');
  });

  it('dominantTraitClass groups traits', () => {
    expect(dominantTraitClass(['marathoner', 'deepdiver'])).toBe('endurance');
    expect(dominantTraitClass(['sprinter', 'swarm'])).toBe('tempo');
    expect(dominantTraitClass(['polyglot', 'switcher', 'polyhost'])).toBe('breadth');
  });
});
