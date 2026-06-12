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
  type GameState,
  type UsageEvent,
  type UserConfig,
} from '@token-tamers/core';
import { adapterFor } from '../services/catchup';
import {
  loadCheckpoints,
  loadPending,
  loadState,
  saveCheckpoints,
  saveConfig,
  savePending,
  saveState,
  type CheckpointMap,
} from '../stores';
import {
  shouldStyle,
  renderBanner,
  renderAdapterFound,
  renderAdapterMissing,
  renderAdapterSkipped,
  renderAdapterEnabled,
  renderNoAdapters,
  renderRerunBackfill,
  renderRerunMessage,
  renderNextStepsLine,
  renderFirstInitSummary,
  renderWarnings,
  formatEnableQuestion,
  formatPlanQuestion,
} from '../helpers/init-style';

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
  // Styling is gated on TTY + NO_COLOR; when `out` is injected (tests/CI) the
  // process stdout isTTY check still works correctly.
  const styled = shouldStyle();
  const { ask, close } = makeAsker(options.yes);

  const warnings: string[] = [];
  const adapterConfigs: AdapterConfig[] = [];
  const enabled: string[] = [];

  try {
    out(renderBanner(styled));

    for (const adapter of allAdapters) {
      const detection = await adapter.detect();
      for (const w of detection.warnings) warnings.push(`[${adapter.id}] ${w}`);

      if (!detection.installed) {
        out(renderAdapterMissing(adapter.displayName, styled));
        continue;
      }

      out(renderAdapterFound(adapter.displayName, detection.paths, styled));
      const enableQ = formatEnableQuestion(adapter.displayName, styled);
      const enable = await ask(enableQ, 'y');
      if (!yesish(enable)) {
        out(renderAdapterSkipped(styled));
        continue;
      }

      const planDefault = adapter.defaultPlan ?? 'subscription';
      const planFallback = planDefault === 'api' ? 'a' : 's';
      const planQ = formatPlanQuestion(adapter.defaultPlan, styled);
      const planRaw = await ask(planQ, planFallback);
      const isApi = planRaw.trim().toLowerCase().startsWith('a');
      const plan = isApi ? 'api' : 'subscription';
      const cyclePolicy = isApi ? 'static' : 'dynamic';
      const weekAnchor = nextMondayLocal(now());

      out(renderAdapterEnabled(plan, styled));

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
    out(renderNoAdapters(styled));
    out(renderWarnings(warnings, styled));
    return { enabled, warnings, wrote: false };
  }

  const config: UserConfig = {
    schemaVersion: SCHEMA_VERSION,
    adapters: adapterConfigs,
  };
  saveConfig(config);

  // Re-run semantics (design §4): re-init adds/removes adapters WITHOUT touching
  // pet state. Only a genuine first init (no prior state.json) backfills history
  // and seeds the normalization baseline. Adapters newly added by a re-run still
  // get their own history backfilled into a baseline, like a first init would.
  const savedState = loadState();
  if (savedState !== null) {
    out(renderRerunMessage(styled));
    await backfillNewAdapters({ adapterConfigs, saved: savedState, now, out, styled });
    out(renderNextStepsLine(styled));
    out(renderWarnings(warnings, styled));
    return { enabled, warnings, wrote: true };
  }

  await firstInitBackfill(adapterConfigs, now, out, styled);
  out(renderWarnings(warnings, styled));
  return { enabled, warnings, wrote: true };
}

/**
 * Re-run backfill: adapters added by a re-init (no saved checkpoint yet) scan
 * their full history once. Windows closed up to the saved `simulatedTo` seed
 * that adapter's normalization baseline (history never retroactively evolves
 * the pet); windows closing after it replay as ordinary live molts via
 * advanceTo — the same partition a first init applies at `startAt`.
 */
async function backfillNewAdapters(input: {
  adapterConfigs: AdapterConfig[];
  saved: GameState;
  now: () => number;
  out: (s: string) => void;
  styled: boolean;
}): Promise<void> {
  const { adapterConfigs, saved, now, out, styled } = input;
  const checkpoints: CheckpointMap = loadCheckpoints();
  const fresh = adapterConfigs.filter((cfg) => checkpoints[cfg.provider] === undefined);
  if (fresh.length === 0) return;

  const events: UsageEvent[] = [];
  const perProvider: Record<string, number> = {};
  for (const cfg of fresh) {
    const impl = adapterFor(cfg.provider);
    if (!impl) continue;
    const result = await impl.scan(cfg.paths, undefined);
    for (const ev of result.events) events.push(ev);
    perProvider[cfg.provider] = result.events.length;
    checkpoints[cfg.provider] = result.checkpoint;
  }

  const engine = createEngine(contentPackV1, { adapters: adapterConfigs }, saved);
  engine.ingest([...loadPending(), ...events]);
  engine.seedBaselines(saved.simulatedTo);
  engine.advanceTo(now());

  saveState(engine.state());
  saveCheckpoints(checkpoints);
  savePending(engine.pendingEvents());

  const baselines = engine.state().baselines;
  for (const cfg of fresh) {
    const windows = baselines[cfg.provider]?.windowsObserved ?? 0;
    out(renderRerunBackfill(cfg.provider, perProvider[cfg.provider] ?? 0, windows, styled));
  }
}

/**
 * First-init backfill: scan each adapter's full history from a FRESH checkpoint,
 * seed the normalization baseline from that history, hatch the Calibration Egg
 * at `now` (so it plays from day one), and persist state/checkpoints/pending.
 */
async function firstInitBackfill(
  adapterConfigs: AdapterConfig[],
  now: () => number,
  out: (s: string) => void,
  styled: boolean,
): Promise<void> {
  const startAt = now();
  const events: UsageEvent[] = [];
  // A fresh checkpoint set: each (re-)enabled adapter scans its full history.
  const checkpoints: CheckpointMap = {};
  for (const cfg of adapterConfigs) {
    const impl = adapterFor(cfg.provider);
    if (!impl) continue;
    const result = await impl.scan(cfg.paths, undefined);
    for (const ev of result.events) events.push(ev);
    checkpoints[cfg.provider] = result.checkpoint;
  }

  const engineConfig: EngineConfig = { adapters: adapterConfigs, startAt };
  const engine = createEngine(contentPackV1, engineConfig);
  engine.ingest(events);
  engine.seedBaselines(startAt);
  engine.advanceTo(startAt);

  saveState(engine.state());
  saveCheckpoints(checkpoints);
  savePending(engine.pendingEvents());

  const windowsObserved = totalWindowsObserved(engine);
  out(renderFirstInitSummary(events.length, windowsObserved, styled));
  out(renderNextStepsLine(styled));
}

/** Sum of windows observed across all seeded adapter baselines. */
function totalWindowsObserved(engine: ReturnType<typeof createEngine>): number {
  let total = 0;
  for (const b of Object.values(engine.state().baselines)) total += b.windowsObserved;
  return total;
}
