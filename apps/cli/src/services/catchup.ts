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
  seedBaselinesFromHistory,
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
  loadUsage,
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

  // Sync the weekly cycle to the player's REAL subscription reset when it has been
  // captured (`tt statusline`). Engine.effectiveWeekAnchor slides this real phase
  // into the past, so reconcile and every future rebirth land on the actual reset
  // instant — not an inferred/calendar guess. In-memory only: usage.json is the
  // durable source synced each run, config.json is never rewritten.
  const realWeekly = loadUsage()?.sevenDayResetsAt;
  if (realWeekly !== undefined) config.cycle = { ...config.cycle, weekAnchor: realWeekly };

  const checkpoints = loadCheckpoints();
  // Adapters configured but never scanned before (e.g. enabled after the pet was
  // already running). Their whole history would otherwise flood the engine AFTER
  // the sim clock has already moved past it — stranding it (captured nowhere) yet
  // advancing the checkpoint past it. Forward-only fix: calibrate their baseline
  // from history, then molt ONLY their events at/after the sim clock; never replay
  // the backlog into the pet (no backtracking).
  const freshProviders = new Set(
    config.adapters.filter((a) => checkpoints[a.provider] === undefined).map((a) => a.provider),
  );

  const at = now();
  const scan = await scanAll(config, checkpoints);

  const liveEvents: UsageEvent[] = [];
  const freshBacklog: UsageEvent[] = [];
  for (const ev of scan.events) {
    (freshProviders.has(ev.adapter) ? freshBacklog : liveEvents).push(ev);
  }
  if (freshBacklog.length > 0) {
    const freshConfigs = config.adapters.filter((a) => freshProviders.has(a.provider));
    // Calibrate the new adapter's normalization baseline from its full history…
    Object.assign(
      saved.baselines,
      seedBaselinesFromHistory(freshBacklog, config.cycle, freshConfigs, at),
    );
    // …but only its events at/after the sim clock count going forward.
    for (const ev of freshBacklog) {
      if (ev.ts >= saved.simulatedTo) liveEvents.push(ev);
    }
  }

  const engineConfig: EngineConfig = {
    adapters: config.adapters,
    cycle: config.cycle,
    salt: config.salt,
  };
  const engine = createEngine(contentPackV1, engineConfig, saved);
  // Re-feed the open-window buffer persisted last run alongside the new scan so
  // events in an as-yet-unclosed window are never lost (checkpoints advanced past
  // their bytes, so the scan will not surface them again).
  engine.ingest([...loadPending(), ...liveEvents]);
  // Catch-up repair BEFORE advancing: rebirth a pet whose clock slipped past a
  // weekly boundary while an old future-anchored cycle had rebirth frozen.
  // Idempotent and a no-op on healthy saves; advanceTo can't double-fire it.
  const effects = [...engine.reconcile(at), ...engine.advanceTo(at)];

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
