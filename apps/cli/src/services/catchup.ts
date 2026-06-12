/**
 * Shared "catch the pet up to now" routine used by every command.
 *
 * Loads config + state, incrementally rescans each configured adapter from its
 * saved checkpoint, ingests the new usage into the engine, advances to the
 * current wall-clock time, persists the updated state + checkpoints, and hands
 * back the live engine plus the effects produced by this advance.
 */

import { adapters as allAdapters, type ProviderAdapter } from '@token-tamers/adapters';
import { contentPackV1 } from '@token-tamers/content';
import {
  createEngine,
  type Engine,
  type EngineConfig,
  type GameEffect,
  type UsageEvent,
  type UserConfig,
} from '@token-tamers/core';
import {
  loadCheckpoints,
  loadConfig,
  loadPending,
  loadState,
  saveCheckpoints,
  savePending,
  saveState,
  type CheckpointMap,
} from '../stores';

export interface CatchUpResult {
  config: UserConfig;
  engine: Engine;
  effects: GameEffect[];
}

/** Look up the adapter implementation for a configured provider id. */
export function adapterFor(provider: string): ProviderAdapter | undefined {
  return allAdapters.find((a) => a.id === provider);
}

/** Scan every configured adapter from its checkpoint; returns events + updated checkpoints. */
export async function scanAll(
  config: UserConfig,
  checkpoints: CheckpointMap,
): Promise<{ events: UsageEvent[]; checkpoints: CheckpointMap }> {
  const events: UsageEvent[] = [];
  const nextCheckpoints: CheckpointMap = { ...checkpoints };

  for (const adapterCfg of config.adapters) {
    const impl = adapterFor(adapterCfg.provider);
    if (!impl) continue;
    const result = await impl.scan(adapterCfg.paths, checkpoints[adapterCfg.provider]);
    for (const ev of result.events) events.push(ev);
    nextCheckpoints[adapterCfg.provider] = result.checkpoint;
  }

  return { events, checkpoints: nextCheckpoints };
}

/**
 * Full catch-up: rescan, ingest, advance to `now`, persist. `now` is injected
 * for tests; defaults to the real wall clock (the cli is the time source — core
 * stays deterministic).
 */
export async function catchUp(now: () => number = Date.now): Promise<CatchUpResult> {
  const config = loadConfig();
  if (!config) {
    throw new NotInitializedError();
  }
  const saved = loadState();
  if (!saved) {
    throw new NotInitializedError();
  }

  const engineConfig: EngineConfig = { adapters: config.adapters };
  const engine = createEngine(contentPackV1, engineConfig, saved);

  const checkpoints = loadCheckpoints();
  const scan = await scanAll(config, checkpoints);
  // Re-feed the open-window buffer persisted last run alongside the new scan so
  // events in an as-yet-unclosed window are never lost (checkpoints advanced past
  // their bytes, so the scan will not surface them again).
  engine.ingest([...loadPending(), ...scan.events]);
  const effects = engine.advanceTo(now());

  saveState(engine.state());
  saveCheckpoints(scan.checkpoints);
  savePending(engine.pendingEvents());

  return { config, engine, effects };
}

/** Thrown by catchUp when the user has not run `tt init`. */
export class NotInitializedError extends Error {
  constructor() {
    super('Token Tamers is not initialized. Run `tt init` first.');
    this.name = 'NotInitializedError';
  }
}
