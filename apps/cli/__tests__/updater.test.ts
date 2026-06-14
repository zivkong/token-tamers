import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { isNewer, parseVersion } from '../src/services/updater/version';
import { assetNameFor, installKind } from '../src/services/updater/assets';
import { parseSha256Sums, sha256 } from '../src/services/updater/verify';
import { applyBinaryUpdate } from '../src/services/updater/apply';
import { checkForUpdate, parseLatest, runUpdate } from '../src/services/updater';
import type { UpdateClient, UpdateEnv } from '../src/services/updater';
import { backgroundUpdateCheck, pendingUpdate } from '../src/services/update-check';
import { defaultSettings, saveSettings, setDataDirForTesting } from '../src/stores';
import { loadUpdateState, saveUpdateState } from '../src/stores/updates';

// A fully offline fake of the network seam — the real one lives in net.ts.
function fakeClient(json: unknown, buffers: Record<string, Buffer> = {}): UpdateClient {
  return {
    getJson: async () => json,
    getBuffer: async (url: string) => buffers[url] ?? Buffer.alloc(0),
  };
}

describe('updater/version', () => {
  it('parses vX.Y.Z and bare X.Y.Z; rejects junk', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('nope')).toBeNull();
  });
  it('isNewer compares major/minor/patch; unparseable ⇒ false', () => {
    expect(isNewer('v1.2.4', 'v1.2.3')).toBe(true);
    expect(isNewer('v2.0.0', 'v1.9.9')).toBe(true);
    expect(isNewer('v1.2.3', 'v1.2.3')).toBe(false);
    expect(isNewer('v1.2.2', 'v1.2.3')).toBe(false);
    expect(isNewer('garbage', 'v1.0.0')).toBe(false);
  });
});

describe('updater/assets', () => {
  it('detects install kind from runtime facts', () => {
    expect(installKind('/usr/local/bin/tt', undefined)).toBe('binary');
    expect(installKind('/usr/bin/node', '/x/tt.js')).toBe('node');
    expect(installKind('/usr/bin/node', '/x/main.ts')).toBe('tsx');
  });
  it('maps platform+arch to the release asset name (mirrors release.yml)', () => {
    expect(assetNameFor('darwin', 'arm64')).toBe('tt-macos-arm64');
    expect(assetNameFor('darwin', 'x64')).toBe('tt-macos-x64');
    expect(assetNameFor('linux', 'arm64')).toBe('tt-linux-arm64');
    expect(assetNameFor('win32', 'x64')).toBe('tt-windows-x64.exe');
    expect(assetNameFor('linux', 'riscv64')).toBeNull();
    expect(assetNameFor('freebsd', 'x64')).toBeNull();
  });
});

describe('updater/verify', () => {
  it('hashes and parses SHA256SUMS (tolerating the * binary marker)', () => {
    const buf = Buffer.from('hello');
    const hex = sha256(buf);
    const sums = parseSha256Sums(`${hex}  tt-linux-x64\n${hex} *tt.js\nrubbish line\n`);
    expect(sums['tt-linux-x64']).toBe(hex);
    expect(sums['tt.js']).toBe(hex);
  });
});

describe('updater check (injected client, fully offline)', () => {
  const release = {
    tag_name: 'v2.0.0',
    assets: [{ name: 'tt-linux-x64', browser_download_url: 'https://x/bin' }],
  };
  it('parseLatest extracts version + named assets, rejects junk', () => {
    expect(parseLatest(release)?.version).toBe('v2.0.0');
    expect(parseLatest(release)?.assets[0]?.name).toBe('tt-linux-x64');
    expect(parseLatest({ no: 'tag' })).toBeNull();
    expect(parseLatest(42)).toBeNull();
  });
  it('checkForUpdate reports newer; returns null on any failure', async () => {
    const ok = await checkForUpdate(fakeClient(release), 'v1.0.0');
    expect(ok?.isNewer).toBe(true);
    expect(ok?.latest).toBe('v2.0.0');
    const throwing: UpdateClient = {
      getJson: async () => {
        throw new Error('offline');
      },
      getBuffer: async () => Buffer.alloc(0),
    };
    expect(await checkForUpdate(throwing, 'v1.0.0')).toBeNull();
  });
});

describe('runUpdate outcomes', () => {
  const env = (over: Partial<UpdateEnv> = {}): UpdateEnv => ({
    platform: 'linux',
    arch: 'x64',
    execPath: '/usr/local/bin/tt',
    argv1: undefined,
    ...over,
  });
  it('up-to-date when not newer', async () => {
    const json = { tag_name: 'v1.0.0', assets: [] };
    expect((await runUpdate(fakeClient(json), 'v1.0.0', env())).kind).toBe('up-to-date');
  });
  it('notify (not self-replace) for node/tsx installs and Windows', async () => {
    const json = { tag_name: 'v2.0.0', assets: [] };
    const asNode = await runUpdate(
      fakeClient(json),
      'v1.0.0',
      env({ execPath: '/usr/bin/node', argv1: '/x/tt.js' }),
    );
    expect(asNode.kind).toBe('notify');
    const asWin = await runUpdate(
      fakeClient(json),
      'v1.0.0',
      env({ platform: 'win32', execPath: 'C:/tt.exe' }),
    );
    expect(asWin.kind).toBe('notify');
  });
});

describe('applyBinaryUpdate — verify before swap, abort on mismatch', () => {
  let dir: string;
  let bin: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-apply-'));
    bin = path.join(dir, 'tt');
    fs.writeFileSync(bin, 'OLD-BINARY', { mode: 0o755 });
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const newBytes = Buffer.from('NEW-BINARY-CONTENTS');
  const release = {
    version: 'v2.0.0',
    assets: [
      { name: 'tt-linux-x64', url: 'https://x/bin' },
      { name: 'SHA256SUMS.txt', url: 'https://x/sums' },
    ],
  };

  it('swaps the binary when the checksum matches', async () => {
    const client = fakeClient(null, {
      'https://x/bin': newBytes,
      'https://x/sums': Buffer.from(`${sha256(newBytes)}  tt-linux-x64\n`),
    });
    await applyBinaryUpdate(client, release, 'tt-linux-x64', bin);
    expect(fs.readFileSync(bin)).toEqual(newBytes);
  });

  it('refuses (throws) and leaves the binary untouched on checksum mismatch', async () => {
    const client = fakeClient(null, {
      'https://x/bin': newBytes,
      'https://x/sums': Buffer.from(`${'0'.repeat(64)}  tt-linux-x64\n`),
    });
    await expect(applyBinaryUpdate(client, release, 'tt-linux-x64', bin)).rejects.toThrow(
      /checksum mismatch/,
    );
    expect(fs.readFileSync(bin, 'utf8')).toBe('OLD-BINARY'); // untouched
  });
});

describe('opt-in gating stays fully offline by default', () => {
  let home: string;
  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-upd-home-'));
    setDataDirForTesting(home);
  });
  afterEach(() => {
    setDataDirForTesting(null);
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('backgroundUpdateCheck does nothing when mode is off (no check recorded)', async () => {
    saveSettings({ ...defaultSettings(), update: { mode: 'off' } });
    await backgroundUpdateCheck(1_000_000);
    expect(loadUpdateState().lastCheckAt).toBe(0); // never reached out
  });

  it('backgroundUpdateCheck skips when the daily throttle is not due', async () => {
    saveSettings({ ...defaultSettings(), update: { mode: 'notify' } });
    saveUpdateState({ lastCheckAt: 1_000_000, latestSeen: null });
    await backgroundUpdateCheck(1_000_500); // 0.5s later — far below the 1-day cooldown
    expect(loadUpdateState().lastCheckAt).toBe(1_000_000); // unchanged, no network
  });

  it('pendingUpdate surfaces a newer seen version only when opted in', () => {
    saveUpdateState({ lastCheckAt: 1, latestSeen: 'v999.0.0' });
    saveSettings({ ...defaultSettings(), update: { mode: 'off' } });
    expect(pendingUpdate()).toBeNull(); // off ⇒ never surfaced
    saveSettings({ ...defaultSettings(), update: { mode: 'notify' } });
    expect(pendingUpdate()).toBe('v999.0.0');
    saveUpdateState({ lastCheckAt: 1, latestSeen: 'v0.0.0' });
    expect(pendingUpdate()).toBeNull(); // older than us ⇒ nothing to show
  });
});
