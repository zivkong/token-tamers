import { describe, expect, it } from 'vitest';
import { earnedTitles, type ContentPack, type GameState } from '../src/index';

/** Minimal pack carrying only the achievement titles this test needs. */
function packWith(achievements: ContentPack['achievements']): ContentPack {
  return { achievements } as unknown as ContentPack;
}

/** Minimal state carrying only the earned map. */
function stateWith(earned: Record<string, number>): GameState {
  return { achievementsEarned: earned } as unknown as GameState;
}

describe('earnedTitles', () => {
  const pack = packWith([
    { id: 'a', name: 'A', description: '', condition: { type: 'dormant_survived' } },
    {
      id: 'b',
      name: 'B',
      description: '',
      condition: { type: 'dormant_survived' },
      reward: { kind: 'title', id: 't-b', name: 'Apex Tamer' },
    },
    {
      id: 'c',
      name: 'C',
      description: '',
      condition: { type: 'dormant_survived' },
      reward: { kind: 'title', id: 't-c', name: 'Collector' },
    },
    {
      id: 'd',
      name: 'D',
      description: '',
      condition: { type: 'dormant_survived' },
      reward: { kind: 'trinket', id: 'tr-d' },
    },
  ]);

  it('returns only earned title rewards, in pack order', () => {
    expect(earnedTitles(stateWith({ c: 1, b: 2 }), pack)).toEqual(['Apex Tamer', 'Collector']);
  });

  it('ignores unearned titles and non-title rewards', () => {
    expect(earnedTitles(stateWith({ a: 1, d: 1 }), pack)).toEqual([]);
  });

  it('is empty when nothing is earned', () => {
    expect(earnedTitles(stateWith({}), pack)).toEqual([]);
  });
});
