import { describe, expect, it } from 'vitest';
import { createEngine, earnedTitles, type BattleResult, type ContentPack } from '../src/index';
import { adapters, ev, HOUR, makePack, staticCycle, WEEK_ANCHOR } from './fixture';

/** A minimal resolved battle with the given winner (timeline is irrelevant to the tally). */
function result(winner: BattleResult['winner']): BattleResult {
  return { version: 1, winner, startHp: { a: 100, b: 100 }, timeline: [] };
}

/** makePack + a battles_won / battle_streak / lifetime_tokens achievement to award. */
function packWithBattleFeats(): ContentPack {
  const base = makePack();
  return {
    ...base,
    achievements: [
      ...base.achievements,
      {
        id: 'first-win',
        name: 'First Win',
        description: '',
        condition: { type: 'battles_won', count: 1 },
        // A multi-reward Feat: a title AND a trinket, both granted at once.
        rewards: [
          { kind: 'title', id: 'champ', name: 'Champ' },
          { kind: 'trinket', id: 'ball' },
        ],
      },
      {
        id: 'streak-2',
        name: 'Streak',
        description: '',
        condition: { type: 'battle_streak', count: 2 },
      },
      {
        id: 'tok-1',
        name: 'Tokens',
        description: '',
        condition: { type: 'lifetime_tokens', tokens: 1 },
      },
    ],
  };
}

describe('token-spending Feats — lifetimeTokens accrual', () => {
  it('accumulates raw window tokens across molts (and awards a lifetime_tokens Feat)', () => {
    const eng = createEngine(packWithBattleFeats(), { adapters: adapters(), cycle: staticCycle() });
    expect(eng.state().lifetimeTokens).toBe(0);
    // Two active 5h windows with usage.
    eng.ingest([ev(0, { modelId: 'claude-opus-4' }), ev(5 * HOUR, { modelId: 'claude-opus-4' })]);
    eng.advanceTo(WEEK_ANCHOR + 11 * HOUR);
    const st = eng.state();
    expect(st.lifetimeTokens).toBeGreaterThan(0);
    // The lifetime_tokens Feat (threshold 1) fired at the molt.
    expect(st.achievementsEarned['tok-1']).toBeDefined();
  });
});

describe('battle-record Feats — recordBattle tally', () => {
  it('counts wins/losses/draws and tracks the best streak; awards battle Feats', () => {
    const eng = createEngine(packWithBattleFeats(), { adapters: adapters(), cycle: staticCycle() });
    const won = eng.recordBattle(result('a'), 'a', 1000);
    // A win awards the battles_won Feat (returned for the UI banner).
    expect(won.some((e) => e.type === 'achievement' && e.id === 'first-win')).toBe(true);
    eng.recordBattle(result('a'), 'a', 2000); // second straight win → streak 2
    eng.recordBattle(result('draw'), 'a', 3000); // draw: played++, streak intact
    eng.recordBattle(result('b'), 'a', 4000); // loss: streak resets

    const rec = eng.state().battleRecord;
    expect(rec).toEqual({ played: 4, won: 2, streak: 0, bestStreak: 2 });
    expect(eng.state().achievementsEarned['streak-2']).toBeDefined();
  });

  it('grants every reward of a multi-reward Feat (title AND trinket)', () => {
    const pack = packWithBattleFeats();
    const eng = createEngine(pack, { adapters: adapters(), cycle: staticCycle() });
    eng.recordBattle(result('a'), 'a', 1000); // wins → fires first-win (rewards[])
    const st = eng.state();
    expect(st.trinketsUnlocked).toContain('ball');
    expect(earnedTitles(st, pack)).toContain('Champ');
  });
});
