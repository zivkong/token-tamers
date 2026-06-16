/**
 * Persistence for UserConfig (config.json).
 */

import fs from 'node:fs';
import { SCHEMA_VERSION, type CycleConfig, type UserConfig } from '@token-tamers/core';
import { pathFor, readJsonOrNull, writeJsonAtomic } from './atomic';

export const CONFIG_FILE = 'config.json';

/** The pre-v4 per-adapter shape (cycle fields lived on each adapter). */
interface LegacyAdapter {
  provider: string;
  paths: string[];
  plan?: 'subscription' | 'api';
  cyclePolicy?: 'dynamic' | 'static';
  weekAnchor?: number;
}

export function loadConfig(): UserConfig | null {
  const raw = readJsonOrNull<UserConfig & { adapters: LegacyAdapter[] }>(CONFIG_FILE);
  return raw === null ? null : migrateConfig(raw);
}

/**
 * Forward-migrate a loaded config to the current schema.
 *
 * v3 → v4: the cycle clock moved from per-adapter (`plan`/`cyclePolicy`/
 * `weekAnchor`) to a single pet-global `cycle` (CycleConfig). A config that
 * predates v4 has no `cycle`; synthesize one from its legacy adapters — if any
 * adapter ran the dynamic (subscription) policy, the pet is on a subscription
 * clock anchored to the FIRST such adapter; otherwise it is static. The week
 * anchor carries over from the first adapter. Each adapter is then slimmed to
 * `{ provider, paths }`. Idempotent: a config that already has `cycle` is returned
 * unchanged (aside from the stamped schema version).
 */
function migrateConfig(raw: UserConfig & { adapters: LegacyAdapter[] }): UserConfig {
  const adapters = (raw.adapters ?? []).map((a) => ({ provider: a.provider, paths: a.paths }));
  const cycle = raw.cycle ?? synthesizeCycle(raw.adapters ?? []);
  return { schemaVersion: SCHEMA_VERSION, cycle, adapters, render: raw.render };
}

/** Derive a pet-global CycleConfig from legacy per-adapter cycle fields. */
function synthesizeCycle(adapters: readonly LegacyAdapter[]): CycleConfig {
  const sub = adapters.find((a) => a.cyclePolicy === 'dynamic' || a.plan === 'subscription');
  // Prefer the subscription anchor's own week anchor (it drives the clock); fall
  // back to the first adapter only when no adapter ran the subscription policy.
  const weekAnchor = sub?.weekAnchor ?? adapters[0]?.weekAnchor ?? 0;
  if (sub) return { policy: 'subscription', anchorAdapter: sub.provider, weekAnchor };
  return { policy: 'static', weekAnchor };
}

export function saveConfig(config: UserConfig): void {
  writeJsonAtomic(CONFIG_FILE, config);
}

export function configExists(): boolean {
  return fs.existsSync(pathFor(CONFIG_FILE));
}
