/**
 * Shared contracts for the opt-in updater. Kept separate so `net.ts` (the one
 * network file) and the pure logic both depend on data shapes, never on each
 * other — no import cycle, and the network seam stays injectable.
 */

/**
 * The injected HTTP seam. The real implementation lives in `net.ts` (the ONLY
 * file allowed to touch the network); tests pass a fake so the whole suite runs
 * offline and deterministic. Outbound-read-only: GET, no body, no telemetry.
 */
export interface UpdateClient {
  getJson(url: string): Promise<unknown>;
  getBuffer(url: string): Promise<Buffer>;
}

/** One downloadable asset on a GitHub release. */
export interface ReleaseAsset {
  name: string;
  url: string;
}

/** The minimal release shape we read from GitHub's `releases/latest`. */
export interface LatestRelease {
  /** Tag name, e.g. `v1.2.3`. */
  version: string;
  assets: ReleaseAsset[];
}

/** Result of a version check against GitHub. */
export interface UpdateCheck {
  current: string;
  latest: string;
  isNewer: boolean;
  release: LatestRelease;
}

/** What `tt update` (or an `auto` launch) actually did. */
export type UpdateOutcome =
  | { kind: 'up-to-date'; current: string }
  | { kind: 'check-failed' }
  | { kind: 'notify'; current: string; latest: string }
  | { kind: 'applied'; from: string; latest: string }
  | { kind: 'failed'; reason: string };

/** Ambient facts the updater needs, passed in so the logic stays testable. */
export interface UpdateEnv {
  platform: NodeJS.Platform;
  arch: string;
  execPath: string;
  argv1: string | undefined;
}
