/**
 * `tt` (no command) — the interactive 4:3 shell (Pet / Dex / Archive / Settings).
 */

import os from 'node:os';
import { runShell, type AdapterInfo, type ColorMode, type ShellInfo } from '@token-tamers/tui';
import type {
  AdapterConfig,
  ColorPreference,
  CyclePolicyKind,
  UserConfig,
} from '@token-tamers/core';
import { catchUp, NotInitializedError } from '../services/catchup';
import { createShellHost } from '../services/shell-host';
import { VERSION } from '../version';
import { dataDir, loadSettings, saveConfig } from '../stores';

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
  };
}

/** The editable adapter summaries handed to the Settings page, in config order. */
function toAdapterInfo(config: UserConfig): AdapterInfo[] {
  return config.adapters.map((a) => ({
    provider: a.provider,
    plan: a.plan,
    policy: a.cyclePolicy,
  }));
}

/**
 * Persist edited adapter plan/cycle toggles back to config.json. Edits map to
 * `config.adapters` by index (the Settings page preserves order) and only touch
 * `plan` + `cyclePolicy`; paths, week anchor, and the rest are kept intact. The
 * running engine keeps the original config, so changes apply on the next launch.
 */
function persistAdapters(config: UserConfig, edited: AdapterInfo[]): void {
  const next: UserConfig = {
    ...config,
    adapters: config.adapters.map((a, i) => {
      const e = edited[i];
      if (!e) return a;
      return {
        ...a,
        plan: e.plan as AdapterConfig['plan'],
        cyclePolicy: e.policy as CyclePolicyKind,
      };
    }),
  };
  saveConfig(next);
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
  const { config, engine } = caught;
  const { host, persist } = createShellHost(config, engine);
  const color = resolveColorMode(noColor, loadSettings().color);
  try {
    await runShell({
      host,
      color,
      info: buildShellInfo(config),
      adapters: toAdapterInfo(config),
      onAdaptersChange: (edited) => persistAdapters(config, edited),
    });
  } finally {
    persist();
  }
}
