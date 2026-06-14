/**
 * Updater orchestration — the opt-in, off-by-default version check + self-replace.
 *
 * Everything here is pure logic around an INJECTED `UpdateClient` (see `net.ts`
 * for the real one), so the whole suite runs offline. The game never imports
 * this unless the user has set `update.mode` to `notify`/`auto` or run
 * `tt update`. Fail-silent: a check that can't reach GitHub returns null.
 */

import { assetNameFor, installKind } from './assets';
import { isNewer } from './version';
import { applyBinaryUpdate } from './apply';
import type { LatestRelease, UpdateCheck, UpdateClient, UpdateEnv, UpdateOutcome } from './types';

export type {
  LatestRelease,
  ReleaseAsset,
  UpdateCheck,
  UpdateClient,
  UpdateEnv,
  UpdateOutcome,
} from './types';
export { defaultClient } from './net';

/** The official source of truth — releases are only ever fetched from here. */
export const REPO = 'zivkong/token-tamers';
const LATEST_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
/** Human-facing page to point manual / non-binary installs at. */
export const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

/** Parse GitHub's `releases/latest` JSON into our minimal shape (or null). */
export function parseLatest(json: unknown): LatestRelease | null {
  if (typeof json !== 'object' || json === null) return null;
  const o = json as Record<string, unknown>;
  if (typeof o.tag_name !== 'string') return null;
  const assets: LatestRelease['assets'] = [];
  if (Array.isArray(o.assets)) {
    for (const a of o.assets) {
      if (typeof a === 'object' && a !== null) {
        const r = a as Record<string, unknown>;
        if (typeof r.name === 'string' && typeof r.browser_download_url === 'string') {
          assets.push({ name: r.name, url: r.browser_download_url });
        }
      }
    }
  }
  return { version: o.tag_name, assets };
}

/** Check GitHub for a newer release. Returns null on ANY failure (fail-silent). */
export async function checkForUpdate(
  client: UpdateClient,
  current: string,
): Promise<UpdateCheck | null> {
  try {
    const release = parseLatest(await client.getJson(LATEST_URL));
    if (!release) return null;
    return {
      current,
      latest: release.version,
      isNewer: isNewer(release.version, current),
      release,
    };
  } catch {
    return null;
  }
}

/**
 * Apply an update if one exists. Standalone pkg binaries self-replace (after
 * checksum verification); `node`/`tsx` installs and Windows binaries are
 * notify-only. Pure aside from the eventual atomic binary swap in `apply.ts`.
 */
export async function runUpdate(
  client: UpdateClient,
  current: string,
  env: UpdateEnv,
): Promise<UpdateOutcome> {
  const check = await checkForUpdate(client, current);
  if (!check) return { kind: 'check-failed' };
  if (!check.isNewer) return { kind: 'up-to-date', current };

  // Only self-contained binaries on non-Windows can swap themselves in place.
  const kind = installKind(env.execPath, env.argv1);
  if (kind !== 'binary' || env.platform === 'win32') {
    return { kind: 'notify', current, latest: check.latest };
  }

  const assetName = assetNameFor(env.platform, env.arch);
  if (!assetName) return { kind: 'notify', current, latest: check.latest };

  try {
    await applyBinaryUpdate(client, check.release, assetName, env.execPath);
    return { kind: 'applied', from: current, latest: check.latest };
  } catch (err) {
    return { kind: 'failed', reason: err instanceof Error ? err.message : 'update failed' };
  }
}

/** Read the running process's update environment (call site for the real values). */
export function currentEnv(): UpdateEnv {
  return {
    platform: process.platform,
    arch: process.arch,
    execPath: process.execPath,
    argv1: process.argv[1],
  };
}
