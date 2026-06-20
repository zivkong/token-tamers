/**
 * Per-adapter baseline normalization.
 *
 * Maintains a running mean of window essence so each adapter's activity
 * is judged relative to that adapter's own historical baseline (self-normalization).
 */

import { deriveCycleEvents, WEEK_MS } from '../cycle';
import { eventEssence, eventTokens } from '../evaluation';
import type {
  AdapterBaseline,
  AdapterConfig,
  CycleConfig,
  GameState,
  MoltEvent,
  UsageEvent,
} from '../types';

/** Snapshot of each adapter's current rolling mean window essence. */
export function baselineMeans(baselines: Record<string, AdapterBaseline>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [adapter, b] of Object.entries(baselines)) out[adapter] = b.meanWindowTokens;
  return out;
}

/**
 * Fold a closed (real, non-hatch) window into the running totals: each adapter's
 * own normalization baseline (design §6) AND the pet-global lifetime raw-token
 * tally that drives the token-spending Feats. Called once per real molt — the
 * single place real-window stats accumulate, so both live here together.
 */
export function foldWindowBaselines(state: GameState, evs: readonly UsageEvent[]): void {
  const essenceByAdapter = new Map<string, number>();
  for (const ev of evs) {
    essenceByAdapter.set(ev.adapter, (essenceByAdapter.get(ev.adapter) ?? 0) + eventEssence(ev));
    state.lifetimeTokens += eventTokens(ev);
  }
  for (const [adapter, essence] of essenceByAdapter) updateBaseline(state, adapter, essence);
}

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
 * Seed each adapter's normalization baseline from backfill history.
 *
 * The baseline answers "what's a normal-sized 5-h window of essence for THIS
 * adapter?", so it is derived per adapter from that adapter's OWN event stream —
 * each adapter self-normalizes (a non-anchor provider still gets a baseline even
 * when the live molt clock is driven by a different anchor). Window SHAPE follows
 * the global policy: static ⇒ fixed tiles from the week anchor; subscription ⇒
 * 5-h windows inferred from the adapter's own usage gaps. Each window's essence is
 * folded through the exact `updateBaseline` accumulator.
 *
 * For a single-adapter pet this is identical to replaying the global clock's molts
 * (the lone adapter IS the anchor), so the seed == replay property holds for the
 * common case. Pure: identical (events, cycle, adapters, now) => identical baselines.
 */
export function seedBaselinesFromHistory(
  events: readonly UsageEvent[],
  cycle: CycleConfig,
  adapters: readonly AdapterConfig[],
  now: number,
): Record<string, AdapterBaseline> {
  // A scratch state whose only field we touch is `baselines`.
  const scratch = { baselines: {} as Record<string, AdapterBaseline> } as GameState;
  for (const adapter of adapters) {
    const adEvents = events
      .filter((e) => e.adapter === adapter.provider)
      .sort((a, b) => a.ts - b.ts);
    if (adEvents.length === 0) continue;
    // Self-derive this adapter's windows: static tiles, or subscription windows
    // inferred from its OWN gaps (anchor = this adapter). Only the normal 5-h
    // windows feed the baseline; egg-hatch checkpoints are excluded (they never
    // call updateBaseline in replay either).
    const adCycle: CycleConfig =
      cycle.policy === 'static'
        ? cycle
        : { policy: 'subscription', anchorAdapter: adapter.provider, weekAnchor: cycle.weekAnchor };
    const cycles = deriveCycleEvents(adEvents, adCycle, -Infinity, now);
    for (const ev of cycles) {
      if (ev.type !== 'molt') continue;
      updateBaseline(scratch, adapter.provider, windowEssence(adEvents, ev));
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
