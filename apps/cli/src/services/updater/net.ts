/**
 * THE ONLY network surface in all of Token Tamers.
 *
 * Outbound-read-only HTTPS GETs to GitHub Releases, used ONLY by the opt-in
 * updater (default off). It sends no body, no query parameters, no telemetry —
 * it just fetches the latest release metadata and signed binary assets. The host
 * is allowlisted, TLS validation stays on, redirects are bounded, and requests
 * time out. See `docs/design/auto-update.md`.
 *
 * This file is the sole exception to the zero-network pledge: it is explicitly
 * allowlisted in `eslint.config.js` and `scripts/check-zero-network.sh`, and
 * `scripts/check-updater-isolation.sh` asserts network-capable code appears in NO
 * other file. Keep this file dumb (no app logic) so the network seam stays tiny
 * and auditable; everything else in the updater is pure/fs and unit-tested.
 */

// node:https is allowlisted for THIS file only (eslint.config.js +
// scripts/check-zero-network.sh). It is the sole network surface in the repo.
import https from 'node:https';

import type { UpdateClient } from './types';

/** Hosts the updater is ever allowed to reach (GitHub + its release-asset CDN). */
const ALLOWED_HOSTS = new Set([
  'api.github.com',
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
]);

const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;
const MAX_BYTES = 200 * 1024 * 1024; // refuse absurdly large responses
const USER_AGENT = 'token-tamers-updater';

function getOnce(url: string, redirectsLeft: number): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      reject(new Error('updater: invalid URL'));
      return;
    }
    if (u.protocol !== 'https:') {
      reject(new Error('updater: https only'));
      return;
    }
    if (!ALLOWED_HOSTS.has(u.hostname)) {
      reject(new Error(`updater: host not allowed: ${u.hostname}`));
      return;
    }

    const req = https.get(
      url,
      { headers: { 'User-Agent': USER_AGENT, Accept: '*/*' }, timeout: TIMEOUT_MS },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location) {
          res.resume();
          if (redirectsLeft <= 0) {
            reject(new Error('updater: too many redirects'));
            return;
          }
          resolve(getOnce(new URL(location, url).toString(), redirectsLeft - 1));
          return;
        }
        if (status !== 200) {
          res.resume();
          reject(new Error(`updater: HTTP ${status}`));
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (c: Buffer) => {
          total += c.length;
          if (total > MAX_BYTES) {
            req.destroy(new Error('updater: response too large'));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('updater: request timed out')));
    req.on('error', reject);
  });
}

/** GET a URL and return the raw bytes. */
export async function getBuffer(url: string): Promise<Buffer> {
  return getOnce(url, MAX_REDIRECTS);
}

/** GET a URL and parse the body as JSON. */
export async function getJson(url: string): Promise<unknown> {
  const buf = await getOnce(url, MAX_REDIRECTS);
  return JSON.parse(buf.toString('utf8'));
}

/** The real network client injected into the updater in production. */
export const defaultClient: UpdateClient = { getJson, getBuffer };
