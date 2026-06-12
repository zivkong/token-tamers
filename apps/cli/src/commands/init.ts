/**
 * `tt init` — the one-time setup wizard.
 *
 * Detects installed adapters, confirms which to enable, asks plan type
 * (subscription => dynamic cycle policy, api => static), picks a week anchor
 * (default: next Monday 00:00 local), writes config.json, runs a backfill scan,
 * creates the engine, ingests history, advances to now, and saves state.json.
 *
 * `--yes` takes all defaults non-interactively (CI / smoke tests).
 */

import readline from 'node:readline';
import { adapters as allAdapters } from '@token-tamers/adapters';
import { contentPackV1 } from '@token-tamers/content';
import {
  createEngine,
  SCHEMA_VERSION,
  type AdapterConfig,
  type EngineConfig,
  type UsageEvent,
  type UserConfig,
} from '@token-tamers/core';
import { adapterFor } from '../services/catchup';
import {
  loadCheckpoints,
  saveCheckpoints,
  saveConfig,
  saveState,
  type CheckpointMap,
} from '../stores';

export interface InitOptions {
  /** Take defaults non-interactively. */
  yes: boolean;
  /** Injected clock; defaults to the wall clock. */
  now?: () => number;
  /** Output sink; defaults to process.stdout. */
  out?: (s: string) => void;
}

export interface InitResult {
  /** Adapter ids that were enabled. */
  enabled: string[];
  /** Warnings surfaced during detection. */
  warnings: string[];
  /** True if at least one adapter was enabled and config was written. */
  wrote: boolean;
}

/** Compute epoch ms of the next Monday at 00:00 local time, relative to `from`. */
export function nextMondayLocal(from: number): number {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  // getDay(): 0=Sun..6=Sat. Days until next Monday (1).
  const day = d.getDay();
  let delta = (1 - day + 7) % 7;
  if (delta === 0) delta = 7; // strictly the *next* Monday
  d.setDate(d.getDate() + delta);
  return d.getTime();
}

function makeAsker(yes: boolean): {
  ask: (question: string, fallback: string) => Promise<string>;
  close: () => void;
} {
  if (yes) {
    return { ask: async (_q, fallback) => fallback, close: () => {} };
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return {
    ask: (question, fallback) =>
      new Promise<string>((resolve) => {
        rl.question(question, (answer) => {
          const trimmed = answer.trim();
          resolve(trimmed.length > 0 ? trimmed : fallback);
        });
      }),
    close: () => rl.close(),
  };
}

function yesish(s: string): boolean {
  const v = s.trim().toLowerCase();
  return v === '' || v === 'y' || v === 'yes';
}

/** Run the init wizard. Exported so tests can drive it without spawning a process. */
export async function runInit(options: InitOptions): Promise<InitResult> {
  const now = options.now ?? Date.now;
  const out = options.out ?? ((s: string) => process.stdout.write(s));
  const { ask, close } = makeAsker(options.yes);

  const warnings: string[] = [];
  const adapterConfigs: AdapterConfig[] = [];
  const enabled: string[] = [];

  try {
    out('Token Tamers — setup\n\n');

    for (const adapter of allAdapters) {
      const detection = await adapter.detect();
      for (const w of detection.warnings) warnings.push(`[${adapter.id}] ${w}`);

      if (!detection.installed) {
        out(`- ${adapter.displayName}: not detected, skipping.\n`);
        continue;
      }

      out(`- ${adapter.displayName}: detected at ${detection.paths.join(', ')}\n`);
      const enable = await ask(`  Enable ${adapter.displayName}? [Y/n] `, 'y');
      if (!yesish(enable)) {
        out(`  skipped.\n`);
        continue;
      }

      const planRaw = await ask(`  Plan type — (s)ubscription or (a)pi? [s] `, 's');
      const isApi = planRaw.trim().toLowerCase().startsWith('a');
      const plan = isApi ? 'api' : 'subscription';
      const cyclePolicy = isApi ? 'static' : 'dynamic';
      const weekAnchor = nextMondayLocal(now());

      adapterConfigs.push({
        provider: adapter.id,
        paths: detection.paths,
        plan,
        cyclePolicy,
        weekAnchor,
      });
      enabled.push(adapter.id);
    }
  } finally {
    close();
  }

  if (adapterConfigs.length === 0) {
    out('\nNo adapters enabled. Nothing to do — re-run `tt init` once an agent is installed.\n');
    for (const w of warnings) out(`! ${w}\n`);
    return { enabled, warnings, wrote: false };
  }

  const config: UserConfig = {
    schemaVersion: SCHEMA_VERSION,
    adapters: adapterConfigs,
  };
  saveConfig(config);

  // Backfill scan from a clean checkpoint set.
  const events: UsageEvent[] = [];
  const checkpoints: CheckpointMap = loadCheckpoints();
  for (const cfg of adapterConfigs) {
    const impl = adapterFor(cfg.provider);
    if (!impl) continue;
    const result = await impl.scan(cfg.paths, checkpoints[cfg.provider]);
    for (const ev of result.events) events.push(ev);
    checkpoints[cfg.provider] = result.checkpoint;
  }

  const engineConfig: EngineConfig = { adapters: adapterConfigs };
  const engine = createEngine(contentPackV1, engineConfig);
  engine.ingest(events);
  engine.advanceTo(now());

  saveState(engine.state());
  saveCheckpoints(checkpoints);

  out('\nYour Calibration Egg has been placed.\n');
  out('It is warming up to your coding rhythm — the first week is calibration, then it hatches.\n');
  out(`Backfilled ${events.length} usage event${events.length === 1 ? '' : 's'}.\n`);
  out('Run `tt` to open the shell, or `tt status` for a quick look.\n');

  if (warnings.length > 0) {
    out('\nNotes:\n');
    for (const w of warnings) out(`! ${w}\n`);
  }

  return { enabled, warnings, wrote: true };
}
