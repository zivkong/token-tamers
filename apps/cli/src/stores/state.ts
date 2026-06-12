/**
 * Persistence for GameState (state.json).
 */

import type { GameState } from '@token-tamers/core';
import { readJsonOrNull, writeJsonAtomic } from './atomic';

export const STATE_FILE = 'state.json';

export function loadState(): GameState | null {
  return readJsonOrNull<GameState>(STATE_FILE);
}

export function saveState(state: GameState): void {
  writeJsonAtomic(STATE_FILE, state);
}
