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

import { NotInitializedError } from './services/catchup';
import { parseArgs, KNOWN_COMMANDS, HELP, type ParsedArgs } from './helpers/args';
import {
  runInit,
  statusCommand,
  dexCommand,
  archiveCommand,
  completeCommand,
  adaptersCommand,
  watchCommand,
  runShellCommand,
} from './commands';

export { parseArgs, type ParsedArgs } from './helpers/args';

/** Kept in sync with apps/cli/package.json "version". */
export const VERSION = '0.1.0';

type Out = (s: string) => void;

const NOT_INIT_MSG = 'Token Tamers is not set up yet. Run `tt init` first.\n';

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
