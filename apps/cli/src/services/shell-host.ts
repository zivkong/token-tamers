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
  eventEssence,
  gradeOdds,
  type Engine,
  type EngineConfig,
  type GameEffect,
  type GameState,
  type UsageEvent,
  type UserConfig,
} from '@token-tamers/core';
import type { LiveStats, ShellHost } from '@token-tamers/tui';
import { scanAll } from './catchup';
import {
  loadCheckpoints,
  saveCheckpoints,
  savePending,
  saveState,
  type CheckpointMap,
} from '../stores';

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
 * loses at most one tick; checkpoints + the open-window pending buffer are
 * persisted together after each scan and on exit.
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
        // Checkpoints just advanced past the scanned bytes; without persisting
        // the open-window buffer too, usage ingested during a shell session
        // would exist only in memory and be lost when the process exits.
        savePending(engine.pendingEvents());
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
    completion() {
      return engine.completion();
    },
    liveStats(): LiveStats {
      return computeLiveStats(engine.pendingEvents(), engine.state());
    },
  };

  return {
    host,
    persist(): void {
      saveState(engine.state());
      saveCheckpoints(checkpoints);
      savePending(engine.pendingEvents());
    },
  };
}

/**
 * Derive the real-time token readout from the engine's OPEN window (events whose
 * 5-h window has not closed yet) plus the rolling baselines. As the player keeps
 * using their agent, scans fold new events into `pendingEvents`, so the open
 * window's tokens/essence climb live — and the engine judges that window's
 * essence against `baselineEssence` to set the next molt's grade-roll odds.
 */
function computeLiveStats(pending: readonly UsageEvent[], state: GameState): LiveStats {
  let windowTokens = 0;
  let windowEssence = 0;
  for (const ev of pending) {
    windowTokens +=
      ev.inputTokens +
      ev.outputTokens +
      (ev.reasoningTokens ?? 0) +
      ev.cacheReadTokens +
      ev.cacheWriteTokens;
    windowEssence += eventEssence(ev);
  }
  let baselineEssence = 0;
  let windowsObserved = 0;
  for (const b of Object.values(state.baselines)) {
    baselineEssence += b.meanWindowTokens;
    windowsObserved = Math.max(windowsObserved, b.windowsObserved);
  }
  // Forecast the next grade roll from the SAME open window the readout shows, so
  // the Odds row tracks Food/activity live (null at the S cap). Core owns the math.
  const nextGrade = gradeOdds(state, pending);
  return { windowTokens, windowEssence, baselineEssence, windowsObserved, nextGrade };
}

/** Re-create an engine from a saved state for the shell (used after catchUp). */
export function engineFromState(config: UserConfig, state: GameState): Engine {
  const engineConfig: EngineConfig = { adapters: config.adapters };
  return createEngine(contentPackV1, engineConfig, state);
}
