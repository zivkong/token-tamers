/**
 * On-disk persistence for the `tt` binary.
 *
 * Data dir = $TOKENTAMERS_HOME || ~/.tokentamers. Three files:
 *   - config.json      (UserConfig)
 *   - state.json       (GameState)
 *   - checkpoints.json  (per-adapter AdapterCheckpoint, keyed by adapter id)
 *
 * Writes are atomic (write to a temp file, then rename) so a crash mid-write
 * never corrupts an existing file.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { GameState, UserConfig } from '@token-tamers/core';
import type { AdapterCheckpoint } from '@token-tamers/adapters';

export const CONFIG_FILE = 'config.json';
export const STATE_FILE = 'state.json';
export const CHECKPOINTS_FILE = 'checkpoints.json';

/** Resolve the Token Tamers data directory (honours TOKENTAMERS_HOME). */
export function dataDir(): string {
  const override = process.env['TOKENTAMERS_HOME'];
  if (override && override.length > 0) return override;
  return path.join(os.homedir(), '.tokentamers');
}

function pathFor(file: string): string {
  return path.join(dataDir(), file);
}

function ensureDir(): void {
  fs.mkdirSync(dataDir(), { recursive: true });
}

function readJsonOrNull<T>(file: string): T | null {
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
function writeJsonAtomic(file: string, value: unknown): void {
  ensureDir();
  const target = pathFor(file);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, target);
}

// --- config ----------------------------------------------------------------

export function loadConfig(): UserConfig | null {
  return readJsonOrNull<UserConfig>(CONFIG_FILE);
}

export function saveConfig(config: UserConfig): void {
  writeJsonAtomic(CONFIG_FILE, config);
}

export function configExists(): boolean {
  return fs.existsSync(pathFor(CONFIG_FILE));
}

// --- state ------------------------------------------------------------------

export function loadState(): GameState | null {
  return readJsonOrNull<GameState>(STATE_FILE);
}

export function saveState(state: GameState): void {
  writeJsonAtomic(STATE_FILE, state);
}

// --- checkpoints ------------------------------------------------------------

export type CheckpointMap = Record<string, AdapterCheckpoint>;

export function loadCheckpoints(): CheckpointMap {
  return readJsonOrNull<CheckpointMap>(CHECKPOINTS_FILE) ?? {};
}

export function saveCheckpoints(checkpoints: CheckpointMap): void {
  writeJsonAtomic(CHECKPOINTS_FILE, checkpoints);
}
