/**
 * Launch-time update glue: a persisted "vX available" hint (read-only, no
 * network) and a throttled, best-effort background check. Both are no-ops unless
 * the user opted in (`settings.update.mode` !== 'off'), so the default stays
 * fully offline. Never throws or blocks the shell.
 */

import { VERSION } from '../version';
import { loadSettings } from '../stores';
import { isCheckDue, loadUpdateState, saveUpdateState } from '../stores/updates';
import { checkForUpdate, currentEnv, defaultClient, runUpdate } from './updater';
import { isNewer } from './updater/version';

/** The newer version to surface in-UI, from PERSISTED state only (no network). */
export function pendingUpdate(): string | null {
  if ((loadSettings().update?.mode ?? 'off') === 'off') return null;
  const seen = loadUpdateState().latestSeen;
  return seen && isNewer(seen, VERSION) ? seen : null;
}

/**
 * Fire a throttled (~once/day) best-effort check. In `auto` mode it also applies
 * a binary self-update (verified) so it takes effect next launch. Fail-silent —
 * any error (offline, locked file) is swallowed; never delays the caller.
 */
export async function backgroundUpdateCheck(now: number = Date.now()): Promise<void> {
  const mode = loadSettings().update?.mode ?? 'off';
  if (mode === 'off') return;
  const state = loadUpdateState();
  if (!isCheckDue(state, now)) return;

  try {
    if (mode === 'auto') {
      const outcome = await runUpdate(defaultClient, VERSION, currentEnv());
      const latest =
        outcome.kind === 'applied' || outcome.kind === 'notify'
          ? outcome.latest
          : outcome.kind === 'up-to-date'
            ? VERSION
            : state.latestSeen;
      saveUpdateState({ lastCheckAt: now, latestSeen: latest });
    } else {
      const check = await checkForUpdate(defaultClient, VERSION);
      saveUpdateState({ lastCheckAt: now, latestSeen: check?.latest ?? state.latestSeen });
    }
  } catch {
    // Best-effort: updates never get in the way of the game.
  }
}
