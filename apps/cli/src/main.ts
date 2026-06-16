/**
 * Entry point for the `tt` binary. Commands (MVP):
 *   tt init      one-time wizard: detect adapters, plan type, week anchor, backfill
 *   tt           the clickable 4:3 shell (Pet / Dex / Archive / Settings pages)
 *   tt watch     slim live view (statusline-friendly)
 *   tt status    one-shot text status
 *   tt dex       text Dex listing
 *   tt archive   text Archive (best-record) listing
 *   tt battle    battle the pet vs an Archive record or a pasted DNA code
 *   tt complete  completion meter breakdown
 *   tt adapters  adapter health/paths
 *   tt update    opt-in update check + self-replace (off by default)
 *   tt --version / tt --help
 *
 * Global flags: --no-color, --yes.
 */

import { NotInitializedError } from './services/catchup';
import { VERSION } from './version';
import { parseArgs, KNOWN_COMMANDS, HELP, type ParsedArgs } from './helpers/args';
import {
  runInit,
  statusCommand,
  dexCommand,
  archiveCommand,
  battleCommand,
  completeCommand,
  adaptersCommand,
  watchCommand,
  runShellCommand,
  updateCommand,
} from './commands';

export { parseArgs, type ParsedArgs } from './helpers/args';
export { VERSION } from './version';

// node:sqlite (used by the OpenCode adapter) is experimental on Node 22.x and
// emits one ExperimentalWarning on first import. Node's default printer is a
// 'warning' listener, so replace it with one that drops only that warning and
// keeps the default output for everything else. (A `-S`-style shebang flag is
// not portable to coreutils < 8.30 — see apps/cli/tsup.config.ts.)
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'ExperimentalWarning' && warning.message.includes('SQLite')) return;
  process.stderr.write(`(node:${process.pid}) ${warning.name}: ${warning.message}\n`);
});

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
    case 'battle':
      return guarded(() =>
        battleCommand({ code: parsed.rest[0], text: parsed.text, noColor: parsed.noColor }, out),
      );
    case 'complete':
      return guarded(() => completeCommand(out));
    case 'adapters':
      await adaptersCommand(out);
      return 0;
    case 'update':
      await updateCommand(out);
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
