import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SCHEMA_VERSION } from '@token-tamers/core';
import { loadState } from '../src/stores/state';
import { setDataDirForTesting } from '../src/stores';

let home: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-mig-'));
  setDataDirForTesting(home);
});

afterEach(() => {
  setDataDirForTesting(null);
  fs.rmSync(home, { recursive: true, force: true });
});

function writeState(obj: unknown): void {
  fs.writeFileSync(path.join(home, 'state.json'), JSON.stringify(obj), 'utf8');
}

const PET = {
  speciesId: 'ember',
  stage: 'apex',
  house: 'forge',
  grade: 'B',
  traits: [],
  pattern: null,
  rhythmVariant: null,
  stats: { pwr: 14, spd: 9, wis: 8, grt: 11 },
  moltCount: 5,
  stageMolts: 0,
  generation: 1,
  hatchedAt: 0,
  dormant: false,
  calibrating: false,
  dietGenes: {},
  mutations: [],
};

const V2_STATE = {
  schemaVersion: 2,
  pet: PET,
  dexOwned: ['ember'],
  archive: [
    {
      speciesId: 'ember',
      grade: 'B',
      stats: { pwr: 14, spd: 9, wis: 8, grt: 11 },
      generation: 1,
      contentVersion: 1,
      recordedAt: 5000,
    },
  ],
  achievementsEarned: {},
  habitatsUnlocked: [],
  trinketsUnlocked: [],
  selectedHabitat: '',
  selectedTrinkets: [],
  baselines: {},
  rngState: 1,
  simulatedTo: 0,
  lineage: [],
};

function mk(grade: string, recordedAt: number, generation = recordedAt) {
  return {
    speciesId: 'x',
    stage: 'apex',
    grade,
    stats: { pwr: 9, spd: 9, wis: 9, grt: 9 },
    house: 'aether',
    traits: [],
    pattern: null,
    rhythmVariant: null,
    mutations: [],
    generation,
    contentVersion: 1,
    recordedAt,
    reason: 'molt',
  };
}

describe('v2 → v3 dex-records migration + auto-repair', () => {
  it('back-fills dexRecords from the archive and bumps schemaVersion to current', () => {
    writeState(V2_STATE);
    const st = loadState()!;
    expect(st.schemaVersion).toBe(SCHEMA_VERSION);
    expect(st.dexRecords).toHaveLength(1);
    const rec = st.dexRecords[0]!;
    expect(rec.speciesId).toBe('ember');
    expect(rec.top[0]!.grade).toBe('B');
    // Proven completed lives default to apex → battle/graft-ready.
    expect(rec.top[0]!.stage).toBe('apex');
  });

  it('caps each species to the top-3 (distinct lives) and orders best-first', () => {
    writeState({
      ...V2_STATE,
      schemaVersion: 3,
      dexRecords: [{ speciesId: 'x', top: [mk('A', 5), mk('S', 6), mk('B', 7), mk('C', 8)] }],
    });
    const st = loadState()!;
    expect(st.dexRecords[0]!.top).toHaveLength(3);
    expect(st.dexRecords[0]!.top[0]!.grade).toBe('S');
  });

  it('self-heals an old store with multiple records from ONE life (same generation)', () => {
    writeState({
      ...V2_STATE,
      schemaVersion: 3,
      // Three captures of the same life (generation 1) — the pre-fix bug.
      dexRecords: [{ speciesId: 'x', top: [mk('C', 5, 1), mk('B', 6, 1), mk('A', 7, 1)] }],
    });
    const st = loadState()!;
    expect(st.dexRecords[0]!.top).toHaveLength(1); // collapsed to one entry for the life
    expect(st.dexRecords[0]!.top[0]!.grade).toBe('A'); // the life's best peak
  });

  it('clamps invalid enums and stats on a kept record', () => {
    writeState({
      ...V2_STATE,
      schemaVersion: 3,
      dexRecords: [
        {
          speciesId: 'x',
          top: [
            {
              speciesId: 'x',
              stage: '??',
              grade: 'Z',
              stats: { pwr: '5' },
              house: '??',
              generation: 1,
              contentVersion: 1,
              recordedAt: 4,
              reason: '??',
            },
          ],
        },
      ],
    });
    const st = loadState()!;
    const s = st.dexRecords[0]!.top[0]!;
    expect(s.grade).toBe('C');
    expect(s.stage).toBe('sprite');
    expect(s.house).toBe('wild');
    expect(s.stats).toEqual({ pwr: 0, spd: 0, wis: 0, grt: 0 });
    expect(s.reason).toBe('molt');
  });

  it('repairs a corrupt (non-array) dexRecords field by back-filling from archive', () => {
    // Non-array dexRecords with no archive to seed from → safe empty store.
    writeState({ ...V2_STATE, schemaVersion: 3, archive: [], dexRecords: 'oops' });
    const st = loadState()!;
    expect(Array.isArray(st.dexRecords)).toBe(true);
    expect(st.dexRecords).toHaveLength(0);
  });
});
