/**
 * Self-replace the running standalone binary: download the matched asset, verify
 * its SHA-256 against the release's `SHA256SUMS`, then atomically swap it over
 * the live binary. Pure fs + the injected client — NO direct network here.
 *
 * Integrity first: it NEVER touches the live binary unless the checksum matches.
 * Any failure (missing asset/sums, mismatch, busy file) throws and leaves the
 * current install untouched.
 */

import fs from 'node:fs';
import path from 'node:path';

import { parseSha256Sums, sha256 } from './verify';
import type { LatestRelease, UpdateClient } from './types';

/** Matches the checksum asset the release workflow publishes (release.yml). */
export const SHA256SUMS_NAME = 'SHA256SUMS.txt';

export async function applyBinaryUpdate(
  client: UpdateClient,
  release: LatestRelease,
  assetName: string,
  execPath: string,
): Promise<void> {
  const asset = release.assets.find((a) => a.name === assetName);
  if (!asset) throw new Error(`release has no asset ${assetName}`);
  const sumsAsset = release.assets.find((a) => a.name === SHA256SUMS_NAME);
  if (!sumsAsset) throw new Error('release has no SHA256SUMS to verify against');

  const sums = parseSha256Sums((await client.getBuffer(sumsAsset.url)).toString('utf8'));
  const expected = sums[assetName];
  if (!expected) throw new Error(`no checksum listed for ${assetName}`);

  const data = await client.getBuffer(asset.url);
  if (sha256(data) !== expected) {
    throw new Error('checksum mismatch — refusing to apply the update');
  }

  // Stage next to the live binary, then atomic rename over it (executable bit set).
  const tmp = path.join(path.dirname(execPath), `.tt-update-${process.pid}.tmp`);
  fs.writeFileSync(tmp, data, { mode: 0o755 });
  try {
    fs.renameSync(tmp, execPath);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err instanceof Error ? err : new Error('could not replace the binary');
  }
}
