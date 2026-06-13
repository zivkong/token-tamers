/**
 * Shared helpers for the on-disk store: data-dir resolution and atomic JSON writes.
 *
 * Data dir = ~/.tokentamers (fixed). No environment variable controls it — the
 * project reads zero config from `process.env`. Writes are atomic (write to a
 * temp file, then rename) so a crash mid-write never corrupts an existing file.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Test-only override for the data dir. NOT a user-facing knob (no env, no flag)
 * — only the test suite sets it, via `setDataDirForTesting`, so suites can run
 * against a temp dir without touching the real `~/.tokentamers`. null ⇒ default.
 */
let dataDirOverride: string | null = null;

/** TEST-ONLY: redirect the data dir (or pass null to restore the default). */
export function setDataDirForTesting(dir: string | null): void {
  dataDirOverride = dir;
}

/** Resolve the Token Tamers data directory — fixed at ~/.tokentamers. */
export function dataDir(): string {
  if (dataDirOverride !== null) return dataDirOverride;
  return path.join(os.homedir(), '.tokentamers');
}

export function pathFor(file: string): string {
  return path.join(dataDir(), file);
}

export function ensureDir(): void {
  fs.mkdirSync(dataDir(), { recursive: true });
}

export function readJsonOrNull<T>(file: string): T | null {
  const p = pathFor(file);
  let raw: string;
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Atomic write: temp file in the same dir, then rename over the target. */
export function writeJsonAtomic(file: string, value: unknown): void {
  writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Atomic write without pretty-printing, for machine-only caches that are
 * rewritten on every command and scale with usage (checkpoints, pending
 * buffer) — roughly a third smaller on disk than the indented form.
 */
export function writeJsonAtomicCompact(file: string, value: unknown): void {
  writeAtomic(file, `${JSON.stringify(value)}\n`);
}

function writeAtomic(file: string, payload: string): void {
  ensureDir();
  const target = pathFor(file);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, payload, 'utf8');
  fs.renameSync(tmp, target);
}
