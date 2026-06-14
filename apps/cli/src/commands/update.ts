/**
 * `tt update` — user-initiated update (always allowed; typing it is consent).
 *
 * Checks GitHub Releases for a newer version; standalone binaries download +
 * SHA-256-verify + atomically self-replace, while `node tt.js` / dev runs (and
 * Windows binaries) just print the release page to update from. Sends no data.
 */

import { VERSION } from '../version';
import { currentEnv, defaultClient, RELEASES_PAGE, runUpdate } from '../services/updater';
import { saveUpdateState } from '../stores/updates';

type Out = (s: string) => void;

export async function updateCommand(out: Out, now: number = Date.now()): Promise<void> {
  out(`Token Tamers ${VERSION} — checking for updates…\n`);
  const outcome = await runUpdate(defaultClient, VERSION, currentEnv());

  switch (outcome.kind) {
    case 'up-to-date':
      out(`You're on the latest version (${VERSION}).\n`);
      return;
    case 'check-failed':
      out('Could not reach GitHub to check for updates. Try again later.\n');
      return;
    case 'notify':
      saveUpdateState({ lastCheckAt: now, latestSeen: outcome.latest });
      out(
        `A newer version is available: ${outcome.latest} (you have ${outcome.current}).\n` +
          `Update from ${RELEASES_PAGE}\n`,
      );
      return;
    case 'applied':
      saveUpdateState({ lastCheckAt: now, latestSeen: outcome.latest });
      out(`Updated ${outcome.from} → ${outcome.latest}. Restart tt to run the new version.\n`);
      return;
    case 'failed':
      out(`Update failed: ${outcome.reason}\nUpdate manually from ${RELEASES_PAGE}\n`);
      return;
  }
}
