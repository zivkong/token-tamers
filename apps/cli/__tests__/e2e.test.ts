import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runInit } from '../src/commands/init';
import { statusCommand } from '../src/commands/status';
import { loadConfig } from '../src/stores/config';
import { loadState } from '../src/stores/state';
import { defaultSettings, saveSettings, setDataDirForTesting } from '../src/stores';

/**
 * End-to-end: redirect the data dir to a temp home, point the Claude Code
 * adapter at a temp fixture root via settings.json (the file-based replacement
 * for CLAUDE_CONFIG_DIR), run init --yes, then assert state.json exists and the
 * status output mentions the pet.
 */

let home: string;
let claudeDir: string;

function writeFixture(claudeRoot: string): void {
  const projectDir = path.join(claudeRoot, 'projects', 'encoded-path-test');
  fs.mkdirSync(projectDir, { recursive: true });

  // Spread events across several days so multiple 5h windows close.
  const base = Date.parse('2024-03-04T09:00:00.000Z'); // a Monday
  const lines: string[] = [];
  for (let day = 0; day < 6; day++) {
    for (let i = 0; i < 4; i++) {
      const ts = new Date(base + day * 86_400_000 + i * 3_600_000).toISOString();
      lines.push(
        JSON.stringify({
          type: 'assistant',
          message: {
            role: 'assistant',
            model: 'claude-sonnet-4-5-20250929',
            content: 'ok',
            usage: {
              input_tokens: 100 + i,
              output_tokens: 200 + i,
              cache_read_input_tokens: 10,
              cache_creation_input_tokens: 0,
            },
          },
          timestamp: ts,
          sessionId: 'sess-e2e',
          cwd: '/home/dev/proj',
        }),
      );
    }
  }
  fs.writeFileSync(path.join(projectDir, 'sess-e2e.jsonl'), lines.join('\n') + '\n', 'utf8');
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-home-'));
  claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-claude-'));
  setDataDirForTesting(home);
  writeFixture(claudeDir);
  // Point the Claude Code adapter at the fixture root via settings.json.
  saveSettings({ ...defaultSettings(), adapterRoots: { 'claude-code': [claudeDir] } });
});

afterEach(() => {
  setDataDirForTesting(null);
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(claudeDir, { recursive: true, force: true });
});

describe('tt init --yes -> status (e2e)', () => {
  // A fixed clock well after the fixture window so molts have fired.
  const now = () => Date.parse('2024-03-20T00:00:00.000Z');

  it('writes config + state and surfaces the pet in status', async () => {
    let initOut = '';
    const result = await runInit({ yes: true, now, out: (s) => (initOut += s) });

    expect(result.wrote).toBe(true);
    expect(result.enabled).toContain('claude-code');
    expect(initOut).toContain('Calibration Egg');

    // Files exist on disk.
    expect(fs.existsSync(path.join(home, 'config.json'))).toBe(true);
    expect(fs.existsSync(path.join(home, 'state.json'))).toBe(true);
    expect(fs.existsSync(path.join(home, 'checkpoints.json'))).toBe(true);

    const config = loadConfig();
    expect(config?.adapters[0]?.provider).toBe('claude-code');
    expect(config?.adapters[0]?.cyclePolicy).toBe('dynamic');

    const state = loadState();
    expect(state).not.toBeNull();
    expect(state?.pet).toBeTruthy();
    // Fresh init writes the current schema (v3) with the per-species record store.
    expect(state?.schemaVersion).toBe(3);
    expect(Array.isArray(state?.dexRecords)).toBe(true);

    // status output mentions the pet (name/stage/grade fields present).
    let statusOut = '';
    await statusCommand((s) => (statusOut += s), now);
    expect(statusOut).toContain('species:');
    expect(statusOut).toContain('grade:');
    expect(statusOut).toContain('stage:');
  });

  it('upgrades an existing v2 save through the update (catch-up) path', async () => {
    await runInit({ yes: true, now, out: () => {} });

    // Downgrade the on-disk save to a synthetic pre-v3 shape: drop dexRecords and
    // plant a rebirth Archive entry the migration should back-fill.
    const downgraded = {
      ...loadState()!,
      schemaVersion: 2,
      archive: [
        {
          speciesId: 'wisp',
          grade: 'A',
          stats: { pwr: 5, spd: 5, wis: 5, grt: 5 },
          generation: 1,
          contentVersion: 1,
          recordedAt: 1,
        },
      ],
    } as Record<string, unknown>;
    delete downgraded.dexRecords;
    fs.writeFileSync(path.join(home, 'state.json'), JSON.stringify(downgraded), 'utf8');

    // The update path (status → catchUp) loads, migrates, advances, and re-saves.
    await statusCommand(() => {}, now);

    const upgraded = loadState()!;
    expect(upgraded.schemaVersion).toBe(3);
    expect(Array.isArray(upgraded.dexRecords)).toBe(true);
    // The Archive entry was preserved into the new record store.
    expect(upgraded.dexRecords.some((r) => r.speciesId === 'wisp')).toBe(true);
  });
});
