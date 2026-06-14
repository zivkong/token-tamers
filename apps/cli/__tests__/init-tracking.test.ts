import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runInit } from '../src/commands/init';
import { catchUp } from '../src/services/catchup';
import { createShellHost } from '../src/services/shell-host';
import {
  defaultSettings,
  loadCheckpoints,
  loadConfig,
  saveSettings,
  setDataDirForTesting,
} from '../src/stores';
import { loadState } from '../src/stores/state';
import { loadPending } from '../src/stores/pending';

/**
 * Init/tracking-correctness coverage:
 *  - re-running `tt init` preserves pet/progress (re-run semantics)
 *  - init no longer parks the egg in the future (it plays from `now`)
 *  - catchUp persists the open-window buffer to pending.json and re-feeds it
 */

let home: string;
let claudeDir: string;
let opencodeDir: string;

/** Write `count` assistant messages on `dayCount` days starting at `baseIso`. */
function writeFixture(claudeRoot: string, baseIso: string, dayCount: number): void {
  const projectDir = path.join(claudeRoot, 'projects', 'encoded-path-test');
  fs.mkdirSync(projectDir, { recursive: true });
  const base = Date.parse(baseIso);
  const lines: string[] = [];
  for (let day = 0; day < dayCount; day++) {
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
          sessionId: 'sess-track',
          cwd: '/home/dev/proj',
        }),
      );
    }
  }
  fs.writeFileSync(path.join(projectDir, 'sess-track.jsonl'), lines.join('\n') + '\n', 'utf8');
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-home-'));
  claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-claude-'));
  opencodeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-opencode-'));
  setDataDirForTesting(home);
  // Point both adapters at temp roots via settings.json (file-based, no env).
  // The empty opencode root keeps tests hermetic — they never touch a real
  // ~/.local/share/opencode on a developer machine.
  saveSettings({
    ...defaultSettings(),
    adapterRoots: { 'claude-code': [claudeDir], opencode: [opencodeDir] },
  });
});

afterEach(() => {
  setDataDirForTesting(null);
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(claudeDir, { recursive: true, force: true });
  fs.rmSync(opencodeDir, { recursive: true, force: true });
});

/** Write a legacy OpenCode storage tree with one completed assistant message per hour. */
function writeOpencodeFixture(root: string, baseIso: string, count: number): void {
  const sessionDir = path.join(root, 'storage', 'message', 'sess-oc-1');
  fs.mkdirSync(sessionDir, { recursive: true });
  const base = Date.parse(baseIso);
  for (let i = 0; i < count; i++) {
    const created = base + i * 3_600_000;
    fs.writeFileSync(
      path.join(sessionDir, `msg-${String(i).padStart(3, '0')}.json`),
      JSON.stringify({
        id: `msg-${i}`,
        sessionID: 'sess-oc-1',
        role: 'assistant',
        modelID: 'deepseek-v4-pro',
        providerID: 'deepseek',
        tokens: {
          total: 500,
          input: 100,
          output: 150,
          reasoning: 50,
          cache: { write: 0, read: 200 },
        },
        time: { created, completed: created + 4_000 },
      }) + '\n',
      'utf8',
    );
  }
}

describe('tt init — fresh init plays from now (no future parking)', () => {
  it('hatches the egg at `now` and seeds a baseline from history', async () => {
    writeFixture(claudeDir, '2024-03-04T09:00:00.000Z', 6);
    const now = () => Date.parse('2024-03-20T00:00:00.000Z');

    let out = '';
    await runInit({ yes: true, now, out: (s) => (out += s) });

    const state = loadState();
    expect(state).not.toBeNull();
    // The pet starts living at `now`, not parked at a future week anchor.
    expect(state!.pet.hatchedAt).toBe(now());
    expect(state!.simulatedTo).toBe(now());
    // Backfill established a normalization baseline from closed history windows.
    const baseline = state!.baselines['claude-code'];
    expect(baseline).toBeTruthy();
    expect(baseline!.windowsObserved).toBeGreaterThan(0);
    expect(out).toContain('Established a baseline');
  });
});

describe('tt init — re-run preserves pet/progress', () => {
  it('a second init does not reset the pet or its baseline', async () => {
    writeFixture(claudeDir, '2024-03-04T09:00:00.000Z', 6);
    const now = () => Date.parse('2024-03-20T00:00:00.000Z');

    await runInit({ yes: true, now, out: () => {} });
    const before = loadState();
    expect(before).not.toBeNull();

    // Mutate the persisted state so we can detect any clobber on re-run.
    const tampered = structuredClone(before!);
    tampered.pet.moltCount = 42;
    tampered.dexOwned = ['sentinel-species'];
    fs.writeFileSync(
      path.join(home, 'state.json'),
      JSON.stringify(tampered, null, 2) + '\n',
      'utf8',
    );

    let out = '';
    const result = await runInit({ yes: true, now, out: (s) => (out += s) });
    expect(result.wrote).toBe(true);
    expect(out).toContain('progress are unchanged');

    const after = loadState();
    expect(after!.pet.moltCount).toBe(42);
    expect(after!.dexOwned).toEqual(['sentinel-species']);
  });
});

describe('tt init — re-run backfills a newly added adapter', () => {
  it('seeds the new adapter baseline and checkpoint without touching the pet', async () => {
    writeFixture(claudeDir, '2024-03-04T09:00:00.000Z', 6);
    const now = () => Date.parse('2024-03-20T00:00:00.000Z');

    // First init: only Claude Code exists.
    await runInit({ yes: true, now, out: () => {} });
    const before = loadState();
    expect(before!.baselines['opencode']).toBeUndefined();

    // OpenCode appears on the machine (with history), then the user re-runs init.
    writeOpencodeFixture(opencodeDir, '2024-03-10T08:00:00.000Z', 8);
    let out = '';
    await runInit({ yes: true, now, out: (s) => (out += s) });

    const after = loadState();
    // The new adapter's history seeded a normalization baseline...
    const baseline = after!.baselines['opencode'];
    expect(baseline).toBeTruthy();
    expect(baseline!.windowsObserved).toBeGreaterThan(0);
    expect(out).toContain('Backfilled');
    // ...its checkpoint is persisted so catch-up will not re-scan-and-discard...
    expect(loadCheckpoints()['opencode']).toBeTruthy();
    // ...and the existing pet/progress is untouched.
    expect(after!.pet).toEqual(before!.pet);
    expect(after!.baselines['claude-code']).toEqual(before!.baselines['claude-code']);
  });
});

describe('catchUp — a late-added adapter is forward-only (no stranding, no backtrack)', () => {
  it('calibrates a newly-configured adapter from history without molting the pet', async () => {
    writeFixture(claudeDir, '2024-03-04T09:00:00.000Z', 6);
    const now = () => Date.parse('2024-03-20T00:00:00.000Z');
    await runInit({ yes: true, now, out: () => {} });
    const before = loadState()!;
    expect(before.baselines['opencode']).toBeUndefined();

    // The user adds OpenCode to config.json by hand (NO re-init) — it has a long
    // history, all of which PREDATES the current sim clock (2024-03-20).
    const cfg = loadConfig()!;
    const weekAnchor = cfg.adapters.find((a) => a.provider === 'claude-code')!.weekAnchor;
    cfg.adapters.push({
      provider: 'opencode',
      paths: [opencodeDir],
      plan: 'api',
      cyclePolicy: 'static',
      weekAnchor,
    });
    fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify(cfg, null, 2) + '\n', 'utf8');
    writeOpencodeFixture(opencodeDir, '2024-03-08T08:00:00.000Z', 8);

    // Catch up WITHOUT re-init: the stale backlog must neither strand nor re-roll.
    const result = await catchUp(() => Date.parse('2024-03-20T01:00:00.000Z'));
    const after = result.engine.state();

    // The new adapter's baseline IS calibrated from its history (not lost)...
    expect(after.baselines['opencode']?.windowsObserved).toBeGreaterThan(0);
    // ...its checkpoint is recorded so future scans only surface NEW events...
    expect(loadCheckpoints()['opencode']).toBeTruthy();
    // ...and the existing pet is untouched: no opencode diet, same molts & stage,
    // and the claude baseline is unchanged (forward-only — no backtracking).
    expect(after.pet.moltCount).toBe(before.pet.moltCount);
    expect(after.pet.stage).toBe(before.pet.stage);
    expect(Object.keys(after.pet.dietGenes)).not.toContain('gene-deepseek');
    expect(after.baselines['claude-code']?.windowsObserved).toBe(
      before.baselines['claude-code']?.windowsObserved,
    );
  });
});

describe('catchUp — pending persistence across runs', () => {
  it('writes pending.json and re-feeds the open-window buffer next run', async () => {
    // Single recent day of usage; the latest window will still be open at `now`.
    writeFixture(claudeDir, '2024-03-18T09:00:00.000Z', 1);
    const initNow = () => Date.parse('2024-03-18T09:30:00.000Z');
    await runInit({ yes: true, now: initNow, out: () => {} });

    // First catch-up shortly after the last event: its window is still open, so
    // those events become pending and must be persisted.
    const t1 = () => Date.parse('2024-03-18T12:30:00.000Z');
    await catchUp(t1);
    const pending = loadPending();
    expect(pending.length).toBeGreaterThan(0);

    // Second catch-up after the window has closed: re-feeding the buffered events
    // lets the molt see the full window, and the pending buffer drains.
    const t2 = () => Date.parse('2024-03-19T00:00:00.000Z');
    const result = await catchUp(t2);
    expect(result.engine.state().pet.moltCount).toBeGreaterThan(0);
    expect(loadPending()).toEqual([]);
  });
});

describe('shell session — open-window usage survives exit', () => {
  it('persists in-session scans to pending.json so the next run still molts', async () => {
    // One day of usage whose latest window is still open at init time.
    writeFixture(claudeDir, '2024-03-18T09:00:00.000Z', 1);
    const initNow = () => Date.parse('2024-03-18T12:30:00.000Z');
    await runInit({ yes: true, now: initNow, out: () => {} });

    // Launch the shell: catchUp builds the engine (pending re-fed), the host
    // wraps the same engine.
    const t1 = Date.parse('2024-03-18T12:31:00.000Z');
    const caught = await catchUp(() => t1);
    const { host, persist } = createShellHost(caught.config, caught.engine);

    // New usage lands in the same still-open window while the shell is up.
    const inSessionTs = '2024-03-18T12:40:00.000Z';
    const projectDir = path.join(claudeDir, 'projects', 'encoded-path-test');
    fs.writeFileSync(
      path.join(projectDir, 'aaaa2222-bbbb-3333-cccc-444455556666.jsonl'),
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-5-20250929',
          content: 'in-session',
          usage: {
            input_tokens: 300,
            output_tokens: 400,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          },
        },
        timestamp: inSessionTs,
        sessionId: 'aaaa2222-bbbb-3333-cccc-444455556666',
        cwd: '/home/dev/proj',
      }) + '\n',
      'utf8',
    );

    // One advance kicks the fire-and-forget rescan; wait for it to land.
    host.advance(t1 + 6_000);
    const newFile = path.join(projectDir, 'aaaa2222-bbbb-3333-cccc-444455556666.jsonl');
    for (let i = 0; i < 100; i++) {
      if (loadCheckpoints()['claude-code']?.files[newFile]) break;
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(loadCheckpoints()['claude-code']?.files[newFile]).toBeTruthy();

    // Shell exits: the in-session open-window event must survive on disk.
    persist();
    const pending = loadPending();
    expect(pending.some((e) => e.ts === Date.parse(inSessionTs))).toBe(true);

    // Next launch, after the window closed: the molt sees the full window.
    const result = await catchUp(() => Date.parse('2024-03-19T00:00:00.000Z'));
    expect(result.engine.state().pet.moltCount).toBeGreaterThan(0);
    expect(loadPending()).toEqual([]);
  });
});
