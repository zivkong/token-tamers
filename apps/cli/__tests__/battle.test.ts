import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SCHEMA_VERSION,
  type DexSnapshot,
  type GameState,
  type UserConfig,
} from '@token-tamers/core';
import { encodeDna } from '@token-tamers/core';
import { battleCommand } from '../src/commands/battle';
import { saveConfig } from '../src/stores/config';
import { saveState } from '../src/stores/state';
import { setDataDirForTesting } from '../src/stores';

/**
 * `tt battle --text` is deterministic and read-only. We craft a battle-ready
 * state directly (an Evolved pet + one Evolved Archive record), point the adapter
 * at an empty dir so catchUp finds no new usage and never advances the pet, then
 * assert the text summary. The simulation itself is unit-tested in core.
 */

const NOW = Date.parse('2024-03-04T00:00:00.000Z'); // a Monday (the week anchor)

let home: string;
let emptyRoot: string;

function snap(over: Partial<DexSnapshot> = {}): DexSnapshot {
  return {
    speciesId: 'oraclet',
    stage: 'evolved',
    grade: 'B',
    stats: { pwr: 50, spd: 55, wis: 70, grt: 65 },
    house: 'aether',
    traits: [],
    pattern: null,
    rhythmVariant: null,
    mutations: [],
    generation: 2,
    contentVersion: 0,
    recordedAt: NOW,
    reason: 'molt',
    ...over,
  };
}

function readyState(): GameState {
  return {
    schemaVersion: SCHEMA_VERSION,
    pet: {
      speciesId: 'oraclet',
      stage: 'evolved',
      house: 'aether',
      grade: 'A',
      traits: ['sprinter'],
      pattern: null,
      rhythmVariant: null,
      stats: { pwr: 60, spd: 70, wis: 60, grt: 50 },
      moltCount: 6,
      stageMolts: 1,
      generation: 1,
      hatchedAt: NOW,
      dormant: false,
      calibrating: false,
      dietGenes: { 'aether-1': 1 },
      mutations: [],
    },
    dexOwned: ['oraclet'],
    archive: [],
    dexRecords: [{ speciesId: 'cirrux', top: [snap({ speciesId: 'cirrux', house: 'aether' })] }],
    achievementsEarned: {},
    habitatsUnlocked: [],
    trinketsUnlocked: [],
    selectedHabitat: '',
    selectedTrinkets: [],
    baselines: {},
    rngState: 12345,
    simulatedTo: NOW,
    lineage: [],
  };
}

function config(): UserConfig {
  return {
    schemaVersion: SCHEMA_VERSION,
    cycle: { policy: 'static', weekAnchor: NOW },
    adapters: [{ provider: 'claude-code', paths: [emptyRoot] }],
  };
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-battle-home-'));
  emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-battle-root-'));
  setDataDirForTesting(home);
});

afterEach(() => {
  setDataDirForTesting(null);
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(emptyRoot, { recursive: true, force: true });
});

describe('tt battle --text', () => {
  it('prints a deterministic summary battling the best Archive record', async () => {
    saveConfig(config());
    saveState(readyState());
    let out = '';
    await battleCommand(
      { text: true, noColor: true },
      (s) => (out += s),
      () => NOW,
    );
    expect(out).toContain('⚔');
    expect(out).toMatch(/wins!|Draw/);
    // Same inputs reproduce the same summary.
    let out2 = '';
    saveState(readyState());
    await battleCommand(
      { text: true, noColor: true },
      (s) => (out2 += s),
      () => NOW,
    );
    expect(out2).toBe(out);
  });

  it('battles a pasted DNA code read-only', async () => {
    saveConfig(config());
    saveState(readyState());
    const code = encodeDna(snap({ speciesId: 'cirrux', grade: 'S', stage: 'prime' }), {
      speciesNum: 6,
    });
    let out = '';
    await battleCommand(
      { text: true, noColor: true, code },
      (s) => (out += s),
      () => NOW,
    );
    expect(out).toMatch(/wins!|Draw/);
  });

  it('seals battles for a too-young pet (readiness gate)', async () => {
    saveConfig(config());
    saveState({ ...readyState(), pet: { ...readyState().pet, stage: 'sprite' } });
    let out = '';
    await battleCommand(
      { text: true, noColor: true },
      (s) => (out += s),
      () => NOW,
    );
    expect(out).toContain('sealed');
  });

  it('reports no opponent when the Archive has no battle-ready record', async () => {
    saveConfig(config());
    saveState({ ...readyState(), dexRecords: [] });
    let out = '';
    await battleCommand(
      { text: true, noColor: true },
      (s) => (out += s),
      () => NOW,
    );
    expect(out).toContain('No battle-ready opponent');
  });

  it('refuses a self mirror match — same species in your own Archive', async () => {
    saveConfig(config());
    // The only record is the SAME species as the live pet (oraclet) — a self-mirror.
    saveState({
      ...readyState(),
      dexRecords: [{ speciesId: 'oraclet', top: [snap({ speciesId: 'oraclet' })] }],
    });
    let out = '';
    await battleCommand(
      { text: true, noColor: true },
      (s) => (out += s),
      () => NOW,
    );
    expect(out).toContain('different species');
  });

  it('allows a same-species battle against a pasted (foreign) code', async () => {
    saveConfig(config());
    saveState(readyState());
    // A foreign code of the SAME species as the live pet (oraclet, num 5) — allowed,
    // because a pasted code is another player, not a self-mirror.
    const code = encodeDna(snap({ speciesId: 'oraclet', grade: 'S', stage: 'prime' }), {
      speciesNum: 5,
    });
    let out = '';
    await battleCommand(
      { text: true, noColor: true, code },
      (s) => (out += s),
      () => NOW,
    );
    expect(out).toMatch(/wins!|Draw/);
  });
});
