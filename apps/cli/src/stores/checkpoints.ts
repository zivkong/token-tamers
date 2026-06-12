/**
 * Persistence for the per-adapter checkpoint map (checkpoints.json).
 */

import type { AdapterCheckpoint } from '@token-tamers/adapters';
import { readJsonOrNull, writeJsonAtomic } from './atomic';

export const CHECKPOINTS_FILE = 'checkpoints.json';

export type CheckpointMap = Record<string, AdapterCheckpoint>;

export function loadCheckpoints(): CheckpointMap {
  return readJsonOrNull<CheckpointMap>(CHECKPOINTS_FILE) ?? {};
}

export function saveCheckpoints(checkpoints: CheckpointMap): void {
  writeJsonAtomic(CHECKPOINTS_FILE, checkpoints);
}
