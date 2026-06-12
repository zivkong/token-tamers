/**
 * Persistence for the per-adapter checkpoint map (checkpoints.json).
 */

import type { AdapterCheckpoint } from '@token-tamers/adapters';
import { readJsonOrNull, writeJsonAtomicCompact } from './atomic';

export const CHECKPOINTS_FILE = 'checkpoints.json';

export type CheckpointMap = Record<string, AdapterCheckpoint>;

export function loadCheckpoints(): CheckpointMap {
  return readJsonOrNull<CheckpointMap>(CHECKPOINTS_FILE) ?? {};
}

export function saveCheckpoints(checkpoints: CheckpointMap): void {
  writeJsonAtomicCompact(CHECKPOINTS_FILE, checkpoints);
}
