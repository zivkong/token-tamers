/**
 * Per-adapter baseline normalization.
 *
 * Maintains a running mean of window essence so each adapter's activity
 * is judged relative to that adapter's own historical baseline (self-normalization).
 */

import type { AdapterBaseline, GameState } from '../types';

export function updateBaseline(state: GameState, adapter: string, windowEssence: number): void {
  const prev = state.baselines[adapter];
  if (!prev) {
    state.baselines[adapter] = {
      meanWindowTokens: windowEssence,
      windowsObserved: 1,
    };
    return;
  }
  const n = prev.windowsObserved + 1;
  const mean = prev.meanWindowTokens + (windowEssence - prev.meanWindowTokens) / n;
  const next: AdapterBaseline = { meanWindowTokens: mean, windowsObserved: n };
  state.baselines[adapter] = next;
}
