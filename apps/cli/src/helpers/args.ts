/**
 * CLI argument parsing: parseArgs, the HELP text, and the known-commands set.
 */

export interface ParsedArgs {
  command: string;
  /** Positionals after the command (e.g. `tt battle <code>` → ['<code>']). */
  rest: string[];
  noColor: boolean;
  yes: boolean;
  /** Force non-interactive text output (e.g. `tt battle --text`). */
  text: boolean;
  help: boolean;
  version: boolean;
}

export const KNOWN_COMMANDS = new Set([
  'init',
  'watch',
  'status',
  'dex',
  'archive',
  'battle',
  'complete',
  'adapters',
  'update',
  'shell',
]);

export const HELP = `tt — Token Tamers

Usage: tt [command] [flags]

Commands:
  init        Set up Token Tamers (detect agents, plan, week anchor).
  (none)      Open the interactive shell (Pet / Dex / Archive / Settings).
  watch       Slim live status line (statusline-friendly).
  status      One-shot text status.
  dex         List discovered species.
  archive     List past lives.
  battle      Battle your pet vs an Archive record or a DNA code (tt battle [code]).
  complete    Completion meter breakdown.
  adapters    Adapter detection + paths.
  update      Check GitHub for a newer tt and update (opt-in; off by default).

Flags:
  --yes, -y       Take defaults non-interactively (for init).
  --text          Print a text battle summary instead of the interactive view.
  --no-color      Disable ANSI color.
  --version, -v   Print version.
  --help, -h      Print this help.
`;

/** Hand-rolled arg parsing. First non-flag positional is the command. */
export function parseArgs(argv: string[]): ParsedArgs {
  let command = '';
  const rest: string[] = [];
  let noColor = false;
  let yes = false;
  let text = false;
  let help = false;
  let version = false;

  for (const arg of argv) {
    if (arg === '--no-color') noColor = true;
    else if (arg === '--yes' || arg === '-y') yes = true;
    else if (arg === '--text') text = true;
    else if (arg === '--help' || arg === '-h') help = true;
    else if (arg === '--version' || arg === '-v' || arg === '-V') version = true;
    else if (arg.startsWith('-')) {
      // Unknown flag — ignore for forward-compat.
      continue;
    } else if (command === '') {
      command = arg;
    } else {
      rest.push(arg);
    }
  }

  if (command === '') command = 'shell';
  return { command, rest, noColor, yes, text, help, version };
}
