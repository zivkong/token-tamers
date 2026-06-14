import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  defaultSettings,
  loadSettings,
  saveSettings,
  settingsRootsFor,
  setDataDirForTesting,
} from '../src/stores';

let home: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-settings-'));
  setDataDirForTesting(home);
});

afterEach(() => {
  setDataDirForTesting(null);
  fs.rmSync(home, { recursive: true, force: true });
});

describe('settings store', () => {
  it('returns all-defaults when settings.json is absent', () => {
    const s = loadSettings();
    expect(s).toEqual({
      schemaVersion: 1,
      color: 'auto',
      adapterRoots: {},
      update: { mode: 'off' },
    });
  });

  it('round-trips a saved settings file', () => {
    saveSettings({
      ...defaultSettings(),
      color: 'none',
      adapterRoots: { 'claude-code': ['/tmp/a', '/tmp/b'] },
    });
    const s = loadSettings();
    expect(s.color).toBe('none');
    expect(settingsRootsFor(s, 'claude-code')).toEqual(['/tmp/a', '/tmp/b']);
  });

  it('fills missing fields from defaults for a partial file', () => {
    fs.writeFileSync(path.join(home, 'settings.json'), JSON.stringify({ color: '256' }), 'utf8');
    const s = loadSettings();
    expect(s.color).toBe('256');
    expect(s.schemaVersion).toBe(1);
    expect(s.adapterRoots).toEqual({});
  });

  it('settingsRootsFor returns [] for an unconfigured adapter', () => {
    expect(settingsRootsFor(defaultSettings(), 'opencode')).toEqual([]);
  });
});
