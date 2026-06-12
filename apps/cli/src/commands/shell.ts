/**
 * `tt` (no command) — the interactive 4:3 shell (Pet / Dex / Archive pages).
 */

import { runShell, type ColorMode } from '@token-tamers/tui';
import { catchUp, NotInitializedError } from '../services/catchup';
import { createShellHost } from '../services/shell-host';

type Out = (s: string) => void;

const NOT_INIT_MSG = 'Token Tamers is not set up yet. Run `tt init` first.\n';

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
  const color: ColorMode = noColor ? 'none' : 'truecolor';
  try {
    await runShell({ host, color });
  } finally {
    persist();
  }
}
