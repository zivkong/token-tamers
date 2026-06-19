import { describe, it, expect } from 'vitest';
import { encodeDna, type DexSnapshot } from '@token-tamers/core';
import {
  confirmBattle,
  fighterCandidates,
  opponentRecords,
  resolveSetupOpponent,
} from '../src/pages/battle-setup';
import { handleBattleKey } from '../src/pages/battle';
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

  it('hides the chosen fighter’s own species from the opponent list (self-mirror)', () => {
    const h = host();
    // The only record is Ember; fielding Ember filters it out (can't fight your own kind)…
    expect(opponentRecords(h, 'ember')).toEqual([]);
    // …while a different fighter species keeps Ember as a valid opponent.
    expect(opponentRecords(h, 'wisp').map((s) => s.speciesId)).toEqual(['ember']);
  });

  it('hides sealed (not battle-ready) records from the opponent list', () => {
    const sealed: DexSnapshot = { ...WISP_SNAP, speciesId: 'murmur', stage: 'sprite' };
    const state = makeState({
      dexRecords: [
        { speciesId: 'ember', top: [makeState().dexRecords[0]!.top[0]!] },
        { speciesId: 'murmur', top: [sealed] },
      ],
    });
    const ids = opponentRecords(host(state), 'wisp').map((s) => s.speciesId);
    expect(ids).toContain('ember'); // battle-ready → shown
    expect(ids).not.toContain('murmur'); // sealed → hidden
  });

  it('allows a pasted same-species code — it is another player, not a self-mirror', () => {
    const res = resolveSetupOpponent(host(), setupUi({ input: WISP_CODE }), 'wisp');
    expect('opp' in res).toBe(true);
  });
});

describe('battle arena — rematch (r)', () => {
  it('re-simulates the same fighters with a bumped nonce, resetting playback', () => {
    const h = host();
    const rt = shell(setupUi({ input: WISP_CODE }));
    confirmBattle(rt, h);
    const first = rt.battle!;
    expect(first.nonce ?? 0).toBe(0); // the canonical, shared-replay fight
    const fighters = { left: first.left, right: first.right };

    expect(handleBattleKey(rt, h, 'r')).toBe(true);
    const second = rt.battle!;
    expect(second.nonce).toBe(1);
    expect(second.cursor).toBe(0);
    expect(second.playing).toBe(true);
    expect(second.left).toBe(fighters.left); // same matchup, just reseeded
    expect(second.right).toBe(fighters.right);

    expect(handleBattleKey(rt, h, 'r')).toBe(true);
    expect(rt.battle!.nonce).toBe(2); // each press fights again
  });
});
