/**
 * Persistence for GameState (state.json).
 */

import { SCHEMA_VERSION, type GameState } from '@token-tamers/core';
import { readJsonOrNull, writeJsonAtomic } from './atomic';

export const STATE_FILE = 'state.json';

export function loadState(): GameState | null {
  const raw = readJsonOrNull<GameState>(STATE_FILE);
  return raw === null ? null : migrateState(raw);
}

export function saveState(state: GameState): void {
  writeJsonAtomic(STATE_FILE, state);
}

/**
 * Forward-migrate a loaded save to the current schema. Additive only — fills
 * fields newer engine versions expect so a resumed snapshot never carries
 * `undefined` into the engine.
 *
 * v1 → v2: `pet.stageMolts` (the per-stage maturity clock). Old saves restart
 * their current stage's clock at 0 — a one-time pacing artifact: an in-progress
 * pet takes a few extra molts to reach its next evolution under the new pacing,
 * which is harmless and self-corrects within the life.
 */
function migrateState(state: GameState): GameState {
  if (state.pet && typeof state.pet.stageMolts !== 'number') {
    state.pet.stageMolts = 0;
  }
  state.schemaVersion = SCHEMA_VERSION;
  return state;
}
