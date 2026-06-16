import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SCHEMA_VERSION } from '@token-tamers/core';
import { loadConfig, setDataDirForTesting } from '../src/stores';

let home: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-cfg-'));
  setDataDirForTesting(home);
});

afterEach(() => {
  setDataDirForTesting(null);
  fs.rmSync(home, { recursive: true, force: true });
});

function writeConfig(obj: unknown): void {
  fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify(obj), 'utf8');
}

describe('config v3 → v4 migration (per-adapter cycle → pet-global CycleConfig)', () => {
  it('synthesizes a subscription clock from a single subscription adapter', () => {
    writeConfig({
      schemaVersion: 3,
      adapters: [{ provider: 'claude-code', paths: ['/p'], plan: 'subscription', weekAnchor: 111 }],
    });
    const cfg = loadConfig()!;
    expect(cfg.schemaVersion).toBe(SCHEMA_VERSION);
    expect(cfg.cycle).toEqual({
      policy: 'subscription',
      anchorAdapter: 'claude-code',
      weekAnchor: 111,
    });
    // Adapters are slimmed to pure data sources.
    expect(cfg.adapters).toEqual([{ provider: 'claude-code', paths: ['/p'] }]);
  });

  it('also recognizes the legacy `cyclePolicy: dynamic` spelling', () => {
    writeConfig({
      schemaVersion: 3,
      adapters: [{ provider: 'claude-code', paths: [], cyclePolicy: 'dynamic', weekAnchor: 7 }],
    });
    const cfg = loadConfig()!;
    expect(cfg.cycle.policy).toBe('subscription');
    expect(cfg.cycle.anchorAdapter).toBe('claude-code');
  });

  it("takes the anchor + weekAnchor from the subscription adapter even when it isn't first", () => {
    // Regression: a static adapter at index 0, the subscription one at index 1
    // with a DISTINCT week anchor. The synthesized clock must follow the
    // subscription adapter, not adapters[0].
    writeConfig({
      schemaVersion: 3,
      adapters: [
        { provider: 'claude-code', paths: [], plan: 'api', weekAnchor: 1000 },
        { provider: 'opencode', paths: [], plan: 'subscription', weekAnchor: 2000 },
      ],
    });
    const cfg = loadConfig()!;
    expect(cfg.cycle).toEqual({
      policy: 'subscription',
      anchorAdapter: 'opencode',
      weekAnchor: 2000,
    });
  });

  it('synthesizes a static clock when no adapter ran the subscription policy', () => {
    writeConfig({
      schemaVersion: 3,
      adapters: [
        { provider: 'claude-code', paths: [], plan: 'api', weekAnchor: 555 },
        { provider: 'opencode', paths: [], plan: 'api', weekAnchor: 999 },
      ],
    });
    const cfg = loadConfig()!;
    expect(cfg.cycle).toEqual({ policy: 'static', weekAnchor: 555 });
    expect('anchorAdapter' in cfg.cycle).toBe(false);
  });

  it('leaves an already-v4 config (with a cycle) unchanged but re-stamps the schema', () => {
    const cycle = { policy: 'subscription', anchorAdapter: 'codex', weekAnchor: 42 };
    writeConfig({
      schemaVersion: 4,
      cycle,
      adapters: [{ provider: 'codex', paths: ['/c'] }],
    });
    const cfg = loadConfig()!;
    expect(cfg.cycle).toEqual(cycle);
    expect(cfg.adapters).toEqual([{ provider: 'codex', paths: ['/c'] }]);
    expect(cfg.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('does not crash on a zero-adapter legacy config', () => {
    writeConfig({ schemaVersion: 3, adapters: [] });
    const cfg = loadConfig()!;
    expect(cfg.adapters).toEqual([]);
    expect(cfg.cycle.policy).toBe('static');
  });
});
