/**
 * `tt init` — the one-time setup wizard.
 *
 * Detects installed adapters, confirms which to enable, asks the single
 * pet-global cycle question (subscription vs static, plus the anchor adapter when
 * subscription runs with more than one adapter) under Preferences, picks a week
 * anchor (default: next Monday 00:00 local), writes config.json, runs a backfill
 * scan, creates the engine, ingests history, advances to now, and saves state.json.
 *
 * `--yes` takes all defaults non-interactively (CI / smoke tests).
 */

import readline from 'node:readline';
import os from 'node:os';
import { adapters as allAdapters, type ProviderAdapter } from '@token-tamers/adapters';
import { contentPackV1 } from '@token-tamers/content';
import {
  createEngine,
  SCHEMA_VERSION,
  type AdapterConfig,
  type ColorPreference,
  type CycleConfig,
  type CyclePolicyKind,
  type EngineConfig,
  type GameState,
  type SettingsFile,
  type UsageEvent,
  type UserConfig,
} from '@token-tamers/core';
import { adapterFor } from '../services/catchup';
import {
  dataDir,
  loadCheckpoints,
  loadConfig,
  loadPending,
  loadSettings,
  loadState,
  saveCheckpoints,
  saveConfig,
  saveSettings,
  savePending,
  saveState,
  settingsRootsFor,
  type CheckpointMap,
} from '../stores';
import {
  shouldStyle,
  formatEnableQuestion,
  formatCycleQuestion,
  formatAnchorQuestion,
  parseCycleChoice,
  parseAnchorChoice,
  formatColorQuestion,
  formatPathQuestion,
  formatUpdateQuestion,
  parseColorChoice,
  parseUpdateChoice,
} from '../helpers/init-style';
import {
  renderBanner,
  renderStepHeader,
  renderAdapterFound,
  renderAdapterMissing,
  renderAdapterSkipped,
  renderAdapterEnabled,
  renderCycleChoice,
  renderCustomPathSet,
  renderColorChoice,
  renderUpdateChoice,
  renderNoAdapters,
  renderRerunBackfill,
  renderRerunMessage,
  renderNextStepsLine,
  renderFirstInitSummary,
  renderWarnings,
} from '../helpers/init-render';

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

type Asker = (question: string, fallback: string) => Promise<string>;

/** Run the init wizard. Exported so tests can drive it without spawning a process. */
export async function runInit(options: InitOptions): Promise<InitResult> {
  const now = options.now ?? Date.now;
  const out = options.out ?? ((s: string) => process.stdout.write(s));
  const settings = loadSettings();
  // Styling is gated on settings.color + TTY (no env). When `out` is injected
  // (tests/CI) the process stdout isTTY check still works correctly.
  const styled = shouldStyle(settings.color);
  const { ask, close } = makeAsker(options.yes);

  const warnings: string[] = [];
  const adapterConfigs: AdapterConfig[] = [];
  const enabledAdapters: ProviderAdapter[] = [];
  const enabled: string[] = [];
  let settingsDirty = false;
  let cycle: CycleConfig = { policy: 'static', weekAnchor: nextMondayLocal(now()) };

  try {
    out(renderBanner(styled));

    out(renderStepHeader(1, 3, 'Detecting agents', styled));
    for (const adapter of allAdapters) {
      const res = await configureAdapter({ adapter, settings, ask, out, styled });
      warnings.push(...res.warnings);
      if (res.settingsChanged) settingsDirty = true;
      if (res.config) {
        adapterConfigs.push(res.config);
        enabledAdapters.push(adapter);
        enabled.push(adapter.id);
      }
    }

    out(renderStepHeader(2, 3, 'Preferences', styled));

    // ONE cycle clock for the pet (never per adapter), grouped with the other
    // preferences. Ask only when at least one adapter is enabled; the week anchor
    // is preserved across re-inits so an existing pet's rebirth schedule never shifts.
    if (adapterConfigs.length > 0) {
      cycle = await askCycle({ enabledAdapters, ask, out, styled, now });
    }

    const nextColor = await askColor(settings.color, styled, ask);
    out(renderColorChoice(nextColor, nextColor !== settings.color, styled));
    if (nextColor !== settings.color) {
      settings.color = nextColor;
      settingsDirty = true;
    }

    // Opt-in updates — default stays 'off' (the offline pledge holds until the
    // player chooses otherwise here). The empty / `--yes` answer keeps current.
    const currentUpdate = settings.update?.mode ?? 'off';
    const nextUpdate = parseUpdateChoice(
      await ask(formatUpdateQuestion(currentUpdate, styled), ''),
      currentUpdate,
    );
    out(renderUpdateChoice(nextUpdate, nextUpdate !== currentUpdate, styled));
    if (nextUpdate !== currentUpdate) {
      settings.update = { mode: nextUpdate };
      settingsDirty = true;
    }
  } finally {
    close();
  }

  if (settingsDirty) saveSettings(settings);

  if (adapterConfigs.length === 0) {
    out(renderNoAdapters(styled));
    out(renderWarnings(warnings, styled));
    return { enabled, warnings, wrote: false };
  }

  const config: UserConfig = { schemaVersion: SCHEMA_VERSION, cycle, adapters: adapterConfigs };
  saveConfig(config);

  // Re-run semantics (design §4): re-init adds/removes adapters WITHOUT touching
  // pet state. Only a genuine first init (no prior state.json) backfills history
  // and seeds the normalization baseline. Adapters newly added by a re-run still
  // get their own history backfilled into a baseline, like a first init would.
  const savedState = loadState();
  out(renderStepHeader(3, 3, savedState ? 'Updating' : 'Hatching', styled));
  if (savedState !== null) {
    out(renderRerunMessage(styled));
    await backfillNewAdapters({ adapterConfigs, cycle, saved: savedState, now, out, styled });
    out(renderNextStepsLine(styled));
    out(renderWarnings(warnings, styled));
    return { enabled, warnings, wrote: true };
  }

  await firstInitBackfill(adapterConfigs, cycle, now, out, styled);
  out(renderWarnings(warnings, styled));
  return { enabled, warnings, wrote: true };
}

interface ConfigureAdapterOptions {
  adapter: ProviderAdapter;
  settings: SettingsFile;
  ask: Asker;
  out: (s: string) => void;
  styled: boolean;
}

interface ConfigureAdapterResult {
  config: AdapterConfig | null;
  warnings: string[];
  /** True if a custom scan root was written into `settings.adapterRoots`. */
  settingsChanged: boolean;
}

/**
 * Detect, optionally recover, and confirm one adapter. When detection fails at
 * the default (or settings-configured) roots, offer a custom path: a non-empty
 * answer is saved to settings.json `adapterRoots` and detection retries there.
 * Returns the AdapterConfig to persist (or null if missing/skipped). An adapter
 * is a pure data source now — no per-adapter plan/cycle (the clock is global).
 */
async function configureAdapter(o: ConfigureAdapterOptions): Promise<ConfigureAdapterResult> {
  const { adapter, settings, ask, out, styled } = o;
  const warnings: string[] = [];
  let settingsChanged = false;

  let detection = await adapter.detect(settingsRootsFor(settings, adapter.id));
  for (const w of detection.warnings) warnings.push(`[${adapter.id}] ${w}`);

  if (detection.installed) {
    out(renderAdapterFound(adapter.displayName, detection.paths, adapter.id, styled));
  } else {
    out(renderAdapterMissing(adapter.displayName, styled));
    const custom = (await ask(formatPathQuestion(adapter.displayName, styled), '')).trim();
    if (custom) {
      settings.adapterRoots = { ...settings.adapterRoots, [adapter.id]: [custom] };
      settingsChanged = true;
      detection = await adapter.detect([custom]);
      for (const w of detection.warnings) warnings.push(`[${adapter.id}] ${w}`);
      if (detection.installed) out(renderCustomPathSet(detection.paths, styled));
    }
  }

  if (!detection.installed) {
    out(renderAdapterSkipped(styled));
    return { config: null, warnings, settingsChanged };
  }

  const enable = await ask(formatEnableQuestion(adapter.displayName, styled), 'y');
  if (!yesish(enable)) {
    out(renderAdapterSkipped(styled));
    return { config: null, warnings, settingsChanged };
  }

  out(renderAdapterEnabled(styled));
  return {
    config: { provider: adapter.id, paths: detection.paths },
    warnings,
    settingsChanged,
  };
}

interface AskCycleOptions {
  enabledAdapters: readonly ProviderAdapter[];
  ask: Asker;
  out: (s: string) => void;
  styled: boolean;
  now: () => number;
}

/**
 * Ask the single pet-global cycle question. The default policy follows the
 * enabled adapters' hints (any `defaultPlan: 'subscription'` ⇒ subscription, else
 * static). For subscription with multiple adapters, also pick the anchor adapter
 * whose session rhythm drives the molt clock; a single adapter is the implicit
 * anchor. The week anchor is preserved from an existing config so re-init never
 * shifts an existing pet's rebirth schedule.
 */
async function askCycle(o: AskCycleOptions): Promise<CycleConfig> {
  const { enabledAdapters, ask, out, styled, now } = o;
  const ids = enabledAdapters.map((a) => a.id);
  const weekAnchor = loadConfig()?.cycle.weekAnchor ?? nextMondayLocal(now());

  const defaultPolicy: CyclePolicyKind = enabledAdapters.some(
    (a) => (a.defaultPlan ?? 'subscription') === 'subscription',
  )
    ? 'subscription'
    : 'static';
  const policy = parseCycleChoice(
    await ask(formatCycleQuestion(defaultPolicy, styled), defaultPolicy === 'static' ? 'a' : 's'),
    defaultPolicy,
  );

  if (policy === 'static') {
    out(renderCycleChoice('static', undefined, styled));
    return { policy: 'static', weekAnchor };
  }

  let anchorAdapter = ids[0]!;
  if (ids.length > 1) {
    const subDefault = enabledAdapters.find(
      (a) => (a.defaultPlan ?? 'subscription') === 'subscription',
    );
    const fallbackIdx = subDefault ? ids.indexOf(subDefault.id) + 1 : 1;
    anchorAdapter = parseAnchorChoice(
      await ask(formatAnchorQuestion(ids, styled), String(fallbackIdx)),
      ids,
    );
  }
  out(renderCycleChoice('subscription', anchorAdapter, styled));
  return { policy: 'subscription', anchorAdapter, weekAnchor };
}

/**
 * Ask for a color preference. The empty answer (also the `--yes` fallback) keeps
 * the current value, so non-interactive runs never change settings.json.
 */
async function askColor(
  current: ColorPreference,
  styled: boolean,
  ask: Asker,
): Promise<ColorPreference> {
  const raw = await ask(formatColorQuestion(current, styled), '');
  return parseColorChoice(raw, current);
}

/** Tilde-collapsed data dir for display in the summary. */
function tildeDataDir(): string {
  const dir = dataDir();
  const home = os.homedir();
  return dir === home || dir.startsWith(`${home}/`) ? `~${dir.slice(home.length)}` : dir;
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
  cycle: CycleConfig;
  saved: GameState;
  now: () => number;
  out: (s: string) => void;
  styled: boolean;
}): Promise<void> {
  const { adapterConfigs, cycle, saved, now, out, styled } = input;
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

  const engine = createEngine(contentPackV1, { adapters: adapterConfigs, cycle }, saved);
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
  cycle: CycleConfig,
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

  const engineConfig: EngineConfig = { adapters: adapterConfigs, cycle, startAt };
  const engine = createEngine(contentPackV1, engineConfig);
  engine.ingest(events);
  engine.seedBaselines(startAt);
  engine.advanceTo(startAt);

  saveState(engine.state());
  saveCheckpoints(checkpoints);
  savePending(engine.pendingEvents());

  const windowsObserved = totalWindowsObserved(engine);
  out(
    renderFirstInitSummary(
      { eventCount: events.length, windowsObserved, dataDir: tildeDataDir() },
      styled,
    ),
  );
  out(renderNextStepsLine(styled));
}

/** Sum of windows observed across all seeded adapter baselines. */
function totalWindowsObserved(engine: ReturnType<typeof createEngine>): number {
  let total = 0;
  for (const b of Object.values(engine.state().baselines)) total += b.windowsObserved;
  return total;
}
