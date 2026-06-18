import { describe, it, expect } from 'vitest';
import { encodeDna, type DexSnapshot } from '@token-tamers/core';
import { confirmBattle, fighterCandidates, resolveSetupOpponent } from '../src/pages/battle-setup';
import type { BattleView, PageId, PageUiState } from '../src/pages/types';
import { makePack, makePet, makeState } from './fixtures';

/** A battle-ready (Evolved) foreign Wisp + its DNA code — same species as a live Wisp pet. */
const WISP_SNAP: DexSnapshot = {
  speciesId: 'wisp',
  stage: 'evolved',
  grade: 'A',
  stats: { pwr: 60, spd: 70, wis: 55, grt: 55 },
  house: 'aether',
  traits: [],
  pattern: null,
  rhythmVariant: null,
  mutations: [],
  generation: 2,
  contentVersion: 1,
  recordedAt: 7000,
  reason: 'molt',
};
const WISP_CODE = encodeDna(WISP_SNAP, { speciesNum: 1 });

const host = (state = makeState()) => ({ pack: makePack(), getState: () => state });

function setupUi(over: Partial<PageUiState>): PageUiState {
  return { selected: 0, scroll: 0, input: '', focus: 'input', fighterSel: 0, ...over };
}

/** A minimal SetupShell whose battle slot is the given setup UI. */
function shell(ui: PageUiState) {
  return {
    page: 'battle' as PageId,
    battle: undefined as BattleView | undefined,
    ui: { battle: ui } as Record<PageId, PageUiState>,
    flash: null as string | null,
    flashUntilFrame: 0,
    frame: 0,
  };
}

describe('battle setup — fighter selection', () => {
  it('fields a battle-ready Dex record when the live pet is sealed (the original bug)', () => {
    // Default fixture: sealed sprite-stage live pet + a battle-ready Ember record.
    const h = host();
    const candidates = fighterCandidates(h);
    expect(candidates.map((f) => f.c.name)).toEqual(['Ember']); // live pet excluded (sealed)

    // Opponent: a pasted foreign Wisp (different species from Ember) → allowed.
    const rt = shell(setupUi({ input: WISP_CODE }));
    confirmBattle(rt, h);
    expect(rt.battle).toBeDefined();
    expect(rt.battle!.left.name).toBe('Ember'); // the ready record fights, not the sealed pet
  });

  it('includes the live pet first once it is Evolved', () => {
    const h = host(makeState({ pet: makePet({ stage: 'evolved' }) }));
    const names = fighterCandidates(h).map((f) => ({ name: f.c.name, live: f.isLive }));
    expect(names[0]).toEqual({ name: 'Wisp', live: true });
  });

  it('blocks an own Dex opponent of the same species as the chosen fighter', () => {
    const res = resolveSetupOpponent(host(), setupUi({ input: '' }), 'ember');
    expect('error' in res && /your own kind/i.test(res.error)).toBe(true);
  });

  it('allows a pasted same-species code — it is another player, not a self-mirror', () => {
    const res = resolveSetupOpponent(host(), setupUi({ input: WISP_CODE }), 'wisp');
    expect('opp' in res).toBe(true);
  });
});
