/**
 * Entry point for the `tt` binary. Commands (MVP):
 *   tt init      one-time wizard: detect adapters, plan type, week anchor, backfill
 *   tt           the clickable 4:3 shell (Pet / Dex / Archive pages)
 *   tt watch     slim live view (statusline-friendly)
 *   tt status    one-shot text status
 *   tt dex       text Dex listing
 *   tt archive   text Archive (best-record) listing
 *   tt complete  completion meter breakdown
 *   tt adapters  adapter health/paths
 *   tt --version / tt --help
 *
 * Global flags: --no-color, --yes.
 */

import { runShell, type ColorMode } from '@token-tamers/tui';
import {
  adaptersCommand,
  archiveCommand,
  completeCommand,
  dexCommand,
  statusCommand,
  watchCommand,
} from './commands';
import { runInit } from './init';
import { catchUp, NotInitializedError } from './catchup';
import { createShellHost } from './shell-host';

/** Kept in sync with apps/cli/package.json "version". */
export const VERSION = '0.1.0';

export interface ParsedArgs {
  command: string;
  noColor: boolean;
  yes: boolean;
  help: boolean;
  version: boolean;
}

const KNOWN_COMMANDS = new Set([
  'init',
  'watch',
  'status',
  'dex',
  'archive',
  'complete',
  'adapters',
  'shell',
]);

/** Hand-rolled arg parsing. First non-flag positional is the command. */
export function parseArgs(argv: string[]): ParsedArgs {
  let command = '';
  let noColor = false;
  let yes = false;
  let help = false;
  let version = false;

  for (const arg of argv) {
    if (arg === '--no-color') noColor = true;
    else if (arg === '--yes' || arg === '-y') yes = true;
    else if (arg === '--help' || arg === '-h') help = true;
    else if (arg === '--version' || arg === '-v' || arg === '-V') version = true;
    else if (arg.startsWith('-')) {
      // Unknown flag — ignore for forward-compat.
      continue;
    } else if (command === '') {
      command = arg;
    }
  }

  if (command === '') command = 'shell';
  return { command, noColor, yes, help, version };
}

const HELP = `tt — Token Tamers

Usage: tt [command] [flags]

Commands:
  init        Set up Token Tamers (detect agents, plan, week anchor).
  (none)      Open the interactive shell (Pet / Dex / Archive).
  watch       Slim live status line (statusline-friendly).
  status      One-shot text status.
  dex         List discovered species.
  archive     List past lives.
  complete    Completion meter breakdown.
  adapters    Adapter detection + paths.

Flags:
  --yes, -y       Take defaults non-interactively (for init).
  --no-color      Disable ANSI color.
  --version, -v   Print version.
  --help, -h      Print this help.
`;

type Out = (s: string) => void;

const NOT_INIT_MSG = 'Token Tamers is not set up yet. Run `tt init` first.\n';

async function runShellCommand(noColor: boolean, out: Out): Promise<void> {
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
  const color: ColorMode = noColor ? 'none' : 'truecolor';
  try {
    await runShell({ host, color });
  } finally {
    persist();
  }
}

/** Dispatch a parsed command. Exported for tests. */
export async function dispatch(
  parsed: ParsedArgs,
  out: Out = (s) => process.stdout.write(s),
): Promise<number> {
  if (parsed.version) {
    out(`${VERSION}\n`);
    return 0;
  }
  if (parsed.help) {
    out(HELP);
    return 0;
  }
  if (!KNOWN_COMMANDS.has(parsed.command)) {
    out(`Unknown command: ${parsed.command}\n\n${HELP}`);
    return 1;
  }

  const guarded = async (fn: () => Promise<void>): Promise<number> => {
    try {
      await fn();
      return 0;
    } catch (err) {
      if (err instanceof NotInitializedError) {
        out(NOT_INIT_MSG);
        return 1;
      }
      throw err;
    }
  };

  switch (parsed.command) {
    case 'init':
      await runInit({ yes: parsed.yes, out });
      return 0;
    case 'status':
      return guarded(() => statusCommand(out));
    case 'dex':
      return guarded(() => dexCommand(out));
    case 'archive':
      return guarded(() => archiveCommand(out));
    case 'complete':
      return guarded(() => completeCommand(out));
    case 'adapters':
      await adaptersCommand(out);
      return 0;
    case 'watch':
      // Long-running; resolves when the process is interrupted.
      await new Promise<void>(() => {
        watchCommand(out);
      });
      return 0;
    case 'shell':
    default:
      await runShellCommand(parsed.noColor, out);
      return 0;
  }
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const code = await dispatch(parsed);
  if (code !== 0) process.exitCode = code;
}

// Only auto-run when executed as the binary (not when imported by tests).
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  /(?:^|[/\\])(?:main\.ts|tt\.(?:js|cjs|mjs))$/.test(process.argv[1]);

if (isMain) {
  void main();
}
