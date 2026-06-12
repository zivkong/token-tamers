/**
 * Per-adapter baseline normalization.
 *
 * Maintains a running mean of window essence so each adapter's activity
 * is judged relative to that adapter's own historical baseline (self-normalization).
 */

import { deriveCycleEvents, WEEK_MS } from '../cycle';
import { eventEssence } from '../evaluation';
import type { AdapterBaseline, AdapterConfig, GameState, MoltEvent, UsageEvent } from '../types';

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

const WINDOW_MS = 5 * 60 * 60 * 1000;

/** Whether any adapter has observed at least one full week of 5-h windows. */
export function hasFullWeekBaseline(baselines: Record<string, AdapterBaseline>): boolean {
  const windowsPerWeek = Math.ceil(WEEK_MS / WINDOW_MS);
  let max = 0;
  for (const b of Object.values(baselines)) {
    if (b.windowsObserved > max) max = b.windowsObserved;
  }
  return max >= windowsPerWeek;
}

/**
 * Seed the per-adapter normalization baselines purely from backfill history.
 *
 * For each adapter, derive every CLOSED 5-h window up to `now` using the SAME
 * cycle-derivation code the engine uses at runtime, then fold each window's
 * total essence through the exact `updateBaseline` accumulator — so the seeded
 * baseline equals what the engine would have produced by replaying those molts.
 *
 * Pure function of its inputs: identical (events, adapters, now) => identical
 * baselines. No wall clock, no randomness.
 */
export function seedBaselinesFromHistory(
  events: readonly UsageEvent[],
  adapters: readonly AdapterConfig[],
  now: number,
): Record<string, AdapterBaseline> {
  // A scratch state whose only field we touch is `baselines`.
  const scratch = { baselines: {} as Record<string, AdapterBaseline> } as GameState;
  for (const adapter of adapters) {
    const adEvents = events
      .filter((e) => e.adapter === adapter.provider)
      .sort((a, b) => a.ts - b.ts);
    // Only the normal 5-h windows feed the baseline; egg-hatch checkpoints are
    // deliberately excluded from normalization (they never call updateBaseline
    // in replay either), so this stays equal to the engine's accumulation.
    const cycles = deriveCycleEvents(adEvents, adapter, -Infinity, now);
    for (const cycle of cycles) {
      if (cycle.type !== 'molt') continue;
      const essence = windowEssence(adEvents, cycle);
      updateBaseline(scratch, adapter.provider, essence);
    }
  }
  return scratch.baselines;
}

/** Total essence of the events that fall inside a closed molt window. */
function windowEssence(events: readonly UsageEvent[], molt: MoltEvent): number {
  let total = 0;
  for (const ev of events) {
    if (ev.ts >= molt.windowStart && ev.ts < molt.windowEnd) total += eventEssence(ev);
  }
  return total;
}
