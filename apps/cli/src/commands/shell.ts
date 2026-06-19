/**
 * `tt` (no command) — the interactive 4:3 shell (Pet / Dex / Loot / Feats / Settings).
 */

import os from 'node:os';
import {
  runShell,
  setSubcellMode,
  type AdapterInfo,
  type BattleView,
  type ColorMode,
  type PageId,
  type ShellInfo,
} from '@token-tamers/tui';
import {
  earnedTitles,
  sanitizeTamerName,
  type ColorPreference,
  type SettingsFile,
  type UpdateMode,
  type UserConfig,
} from '@token-tamers/core';
import { contentPackV1 } from '@token-tamers/content';
import { catchUp, NotInitializedError, type CatchUpResult } from '../services/catchup';
import { resolveSubcellMode } from '../services/subcell';
import { createShellHost } from '../services/shell-host';
import { backgroundUpdateCheck, pendingUpdate } from '../services/update-check';
import { VERSION } from '../version';
import { dataDir, loadSettings, saveConfig, saveSettings } from '../stores';

type Out = (s: string) => void;

const NOT_INIT_MSG = 'Token Tamers is not set up yet. Run `tt init` first.\n';
const DEFAULT_FPS = 30;

/**
 * Resolve the shell's color mode. The `--no-color` flag always wins; otherwise
 * the preference from settings.json applies, with 'auto' mapping to truecolor
 * for the interactive shell (always a TTY here). No environment variables.
 */
function resolveColorMode(noColor: boolean, pref: ColorPreference): ColorMode {
  if (noColor || pref === 'none') return 'none';
  if (pref === 'auto') return 'truecolor';
  return pref;
}

/** Collapse the home prefix to `~` for a compact, privacy-friendly path. */
function tildePath(abs: string): string {
  const home = os.homedir();
  return abs === home || abs.startsWith(`${home}/`) ? `~${abs.slice(home.length)}` : abs;
}

/** Compose the static build/config facts surfaced on the Settings page. */
function buildShellInfo(config: UserConfig): ShellInfo {
  return {
    version: VERSION,
    runtime: `node ${process.version}`,
    fps: config.render?.fps ?? DEFAULT_FPS,
    dataDir: tildePath(dataDir()),
    tamer: config.tamer ?? '',
    tamerTitle: config.tamerTitle ?? '',
  };
}

/** The read-only adapter summaries handed to the Settings page, in config order. */
function toAdapterInfo(config: UserConfig): AdapterInfo[] {
  return config.adapters.map((a) => ({ provider: a.provider }));
}

/**
 * Persist the edited pet-global cycle clock back to config.json. Only `cycle` is
 * touched (policy + anchor); adapters, paths, and the week anchor are kept intact.
 * Static drops the anchor; subscription keeps the chosen anchor adapter. The
 * running engine keeps the original config, so changes apply on the next launch.
 */
function persistCycle(config: UserConfig, policy: string, anchorAdapter: string): void {
  const next: UserConfig = {
    ...config,
    cycle:
      policy === 'subscription'
        ? {
            policy: 'subscription',
            anchorAdapter: anchorAdapter || config.adapters[0]?.provider,
            weekAnchor: config.cycle.weekAnchor,
          }
        : { policy: 'static', weekAnchor: config.cycle.weekAnchor },
  };
  saveConfig(next);
}

/**
 * Persist the edited opt-in update mode back to settings.json (off by default —
 * the offline pledge holds until the player opts in). The running session keeps
 * its current behavior; the new mode takes effect on the next launch.
 */
function persistUpdateMode(settings: SettingsFile, mode: string): void {
  saveSettings({ ...settings, update: { mode: mode as UpdateMode } });
}

/**
 * Persist the edited Tamer identity back to config.json: the handle (sanitized +
 * capped, the same rule the DNA codec applies) and the chosen wearable title.
 * Cosmetic/identity only; the running session keeps its current values.
 */
function persistTamer(config: UserConfig, name: string, title: string): void {
  saveConfig({ ...config, tamer: sanitizeTamerName(name), tamerTitle: title || undefined });
}

/** Options for launching the interactive shell from an already-caught-up engine. */
export interface LaunchShellOptions {
  noColor: boolean;
  /** Page to open on (defaults to 'pet'); `tt battle` passes 'battle'. */
  initialPage?: PageId;
  /** A battle to play back immediately (e.g. from `tt battle <code>`). */
  initialBattle?: BattleView;
}

/**
 * Wire an already-caught-up engine into the interactive shell and run it. Shared
 * by `tt` (the default shell) and `tt battle` (which opens straight on the Battle
 * page). Persists state on exit.
 */
export async function launchShell(caught: CatchUpResult, opts: LaunchShellOptions): Promise<void> {
  const { config, engine } = caught;
  const { host, persist } = createShellHost(config, engine);
  const settings = loadSettings();
  const color = resolveColorMode(opts.noColor, settings.color);
  // Pick the sub-cell sprite density once, before the render loop: honor an
  // explicit setting, or use the universally-safe `half` when 'auto' (richer modes
  // can't be auto-detected without risking tofu — see services/subcell.ts).
  setSubcellMode(resolveSubcellMode(settings.subcell ?? 'auto'));
  const info: ShellInfo = {
    ...buildShellInfo(config),
    updateMode: settings.update?.mode ?? 'off',
    updateAvailable: pendingUpdate() ?? undefined,
  };
  // Opt-in, throttled, best-effort — a no-op when update.mode is 'off', and it
  // never blocks the render loop (the result surfaces on the next launch).
  void backgroundUpdateCheck();
  try {
    await runShell({
      host,
      color,
      info,
      adapters: toAdapterInfo(config),
      cyclePolicy: config.cycle.policy,
      anchorAdapter: config.cycle.anchorAdapter ?? '',
      updateMode: settings.update?.mode ?? 'off',
      tamerName: config.tamer ?? '',
      tamerTitle: config.tamerTitle ?? '',
      earnedTitles: earnedTitles(engine.state(), contentPackV1),
      onCycleChange: (policy, anchorAdapter) => persistCycle(config, policy, anchorAdapter),
      onUpdateModeChange: (mode) => persistUpdateMode(settings, mode),
      onTamerChange: (name, title) => persistTamer(config, name, title),
      initialPage: opts.initialPage,
      initialBattle: opts.initialBattle,
    });
  } finally {
    persist();
  }
}

export async function runShellCommand(noColor: boolean, out: Out): Promise<void> {
  let caught;
  try {
    caught = await catchUp();
  } catch (err) {
    if (err instanceof NotInitializedError) {
      out(NOT_INIT_MSG);
      return;
    }
    throw err;
  }
  await launchShell(caught, { noColor });
}
