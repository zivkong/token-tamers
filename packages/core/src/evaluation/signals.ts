/**
 * Window signal computation — the model-neutral measurement layer.
 *
 * From the UsageEvents inside a closed session window, derive the numeric
 * signals that drive trait evaluation, rhythm classification, and grade-roll
 * modifier. No token volumes are compared absolutely; everything is relative
 * to the player's own per-adapter baseline (design pillar 2 / §6).
 */

import type { UsageEvent } from '../types';

// 5-hour session window; re-declared locally to avoid a cross-module value
// import (cycle.ts owns the exported WINDOW_MS for consumers).
const WINDOW_MS = 5 * 60 * 60 * 1000;

/** A window's wall-clock span, used to judge cap proximity and time-of-day. */
export interface WindowSignals {
  /** Number of distinct provider-side sessions touched in this window. */
  sessionCount: number;
  /** Distinct adapters that contributed (Polyhost / adapter diversity). */
  adapterCount: number;
  /** Distinct model ids consumed (Switcher / diet diversity). */
  modelCount: number;
  /** Distinct language hints across the window (Polyglot). */
  langCount: number;
  /** Fraction of the window's active span covered by usage, 0..1. */
  capProximity: number;
  /** Median inter-event gap in ms (rhythm). */
  medianGapMs: number;
  /** Coefficient-of-variation of gaps; high => bursty, low => steady. */
  gapCv: number;
  /** Fraction of events whose local hour is < 6 or >= 22 (Nightshade). */
  nightFraction: number;
  /** Fraction of events whose local hour is in [5, 9) (Daybreaker). */
  morningFraction: number;
  /** Longest single-session run length (events), for Deepdiver. */
  longestSessionEvents: number;
  /** Number of distinct sessions with few events (Swarm). */
  shortSessionCount: number;
  /** Events normalized to baseline mean essence; 1.0 == on-baseline. */
  essenceRatio: number;
  /** Total essence (cache-weighted tokens) — for baseline accounting only. */
  totalEssence: number;
  /** Total RAW tokens (in+out+cache+reasoning) — drives the capped vitality bonus. */
  totalTokens: number;
  /** Number of events in the window. */
  eventCount: number;
}

/** Raw token total of one event (no cache weighting) — the vitality metric. */
export function eventTokens(ev: UsageEvent): number {
  return (
    ev.inputTokens +
    ev.outputTokens +
    (ev.reasoningTokens ?? 0) +
    ev.cacheReadTokens +
    ev.cacheWriteTokens
  );
}

/** Cache reads count less than fresh tokens; cache writes a bit more. */
export function eventEssence(ev: UsageEvent): number {
  return (
    ev.inputTokens +
    ev.outputTokens +
    (ev.reasoningTokens ?? 0) +
    ev.cacheWriteTokens * 1.25 +
    ev.cacheReadTokens * 0.1
  );
}

/** Local hour (0..23) for a timestamp. Deterministic: UTC-based, no wall clock. */
function hourOf(ts: number): number {
  // Use UTC to stay deterministic and platform-independent.
  return Math.floor((ts % 86_400_000) / 3_600_000);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

interface DiversityCounts {
  sessions: Map<string, number>;
  adapterCount: number;
  modelCount: number;
  langCount: number;
  nightCount: number;
  morningCount: number;
  totalEssence: number;
  totalTokens: number;
}

/** Scan events once for all diversity/essence counts. */
function collectDiversityCounts(sorted: readonly UsageEvent[]): DiversityCounts {
  const sessions = new Map<string, number>();
  const adapters = new Set<string>();
  const models = new Set<string>();
  const langs = new Set<string>();
  let nightCount = 0;
  let morningCount = 0;
  let totalEssence = 0;
  let totalTokens = 0;

  for (const ev of sorted) {
    sessions.set(ev.sessionKey, (sessions.get(ev.sessionKey) ?? 0) + 1);
    adapters.add(ev.adapter);
    models.add(ev.modelId);
    for (const l of ev.langHints ?? []) langs.add(l);
    const h = hourOf(ev.ts);
    if (h < 6 || h >= 22) nightCount++;
    if (h >= 5 && h < 9) morningCount++;
    totalEssence += eventEssence(ev);
    totalTokens += eventTokens(ev);
  }

  return {
    sessions,
    adapterCount: adapters.size,
    modelCount: models.size,
    langCount: langs.size,
    nightCount,
    morningCount,
    totalEssence,
    totalTokens,
  };
}

interface GapStats {
  medianGapMs: number;
  gapCv: number;
}

/** Compute gap median and coefficient of variation from a sorted event list. */
function computeGapStats(sorted: readonly UsageEvent[]): GapStats {
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i]!.ts - sorted[i - 1]!.ts);
  const medianGapMs = median(gaps);
  const meanGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const variance = gaps.length ? gaps.reduce((a, g) => a + (g - meanGap) ** 2, 0) / gaps.length : 0;
  const gapCv = meanGap > 0 ? Math.sqrt(variance) / meanGap : 0;
  return { medianGapMs, gapCv };
}

/**
 * Compute window signals. `events` are the usage events inside the window (any
 * order). `baselineMean` is the per-adapter rolling mean window essence used to
 * normalize; pass 0 when no baseline exists yet (essenceRatio defaults to 1).
 */
export function computeWindowSignals(
  events: readonly UsageEvent[],
  windowStart: number,
  windowEnd: number,
  baselineMean: number,
): WindowSignals {
  const span = windowEnd - windowStart || WINDOW_MS;
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const eventCount = sorted.length;

  const counts = collectDiversityCounts(sorted);
  const { medianGapMs, gapCv } = computeGapStats(sorted);

  const firstTs = sorted.length ? sorted[0]!.ts : windowStart;
  const lastTs = sorted.length ? sorted[sorted.length - 1]!.ts : windowStart;
  const capProximity = Math.min(1, (lastTs - firstTs) / span);

  const sessionSizes = [...counts.sessions.values()];
  const longestSessionEvents = sessionSizes.length ? Math.max(...sessionSizes) : 0;
  const shortSessionCount = sessionSizes.filter((n) => n <= 2).length;

  const essenceRatio =
    baselineMean > 0 ? counts.totalEssence / baselineMean : eventCount > 0 ? 1 : 0;

  return {
    sessionCount: counts.sessions.size,
    adapterCount: counts.adapterCount,
    modelCount: counts.modelCount,
    langCount: counts.langCount,
    capProximity,
    medianGapMs,
    gapCv,
    nightFraction: eventCount ? counts.nightCount / eventCount : 0,
    morningFraction: eventCount ? counts.morningCount / eventCount : 0,
    longestSessionEvents,
    shortSessionCount,
    essenceRatio,
    totalEssence: counts.totalEssence,
    totalTokens: counts.totalTokens,
    eventCount,
  };
}
