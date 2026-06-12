/**
 * Wires the engine + adapters into a ShellHost for the interactive shell.
 *
 * The shell calls host.advance(now) ~1/sec. We don't rescan adapters that
 * often — rescanning hits the filesystem — so we throttle re-scans to at most
 * once every ~5s. Between scans, advance() just feeds the engine the new clock
 * (ingest nothing) so molts/rebirths still fire on time.
 */

import { contentPackV1 } from '@token-tamers/content';
import {
  createEngine,
  type Engine,
  type EngineConfig,
  type GameEffect,
  type GameState,
  type UserConfig,
} from '@token-tamers/core';
import type { ShellHost } from '@token-tamers/tui';
import { scanAll } from './catchup';
import { loadCheckpoints, saveCheckpoints, saveState, type CheckpointMap } from '../stores';

const RESCAN_MS = 5000;

export interface ShellHostHandle {
  host: ShellHost;
  /** Persist current engine state + checkpoints (call on shell exit). */
  persist(): void;
}

/**
 * Build a ShellHost over an existing engine. Rescans are async-fire-and-forget
 * (the shell's advance is synchronous): a scan kicked off on one tick ingests
 * its events on a later tick. State is persisted on every advance so a crash
 * loses at most one tick.
 */
export function createShellHost(config: UserConfig, engine: Engine): ShellHostHandle {
  let checkpoints: CheckpointMap = loadCheckpoints();
  let lastScan = 0;
  let scanning = false;

  const maybeRescan = (t: number): void => {
    if (scanning || t - lastScan < RESCAN_MS) return;
    scanning = true;
    lastScan = t;
    void scanAll(config, checkpoints)
      .then((result) => {
        if (result.events.length > 0) engine.ingest(result.events);
        checkpoints = result.checkpoints;
        saveCheckpoints(checkpoints);
      })
      .finally(() => {
        scanning = false;
      });
  };

  const host: ShellHost = {
    pack: contentPackV1,
    getState(): GameState {
      return engine.state();
    },
    advance(t: number): GameEffect[] {
      maybeRescan(t);
      const effects = engine.advanceTo(t);
      saveState(engine.state());
      return effects;
    },
    completion(): { overall: number } {
      return engine.completion();
    },
  };

  return {
    host,
    persist(): void {
      saveState(engine.state());
      saveCheckpoints(checkpoints);
    },
  };
}

/** Re-create an engine from a saved state for the shell (used after catchUp). */
export function engineFromState(config: UserConfig, state: GameState): Engine {
  const engineConfig: EngineConfig = { adapters: config.adapters };
  return createEngine(contentPackV1, engineConfig, state);
}
