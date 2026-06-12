/**
 * Per-window molt evaluation. From the UsageEvents that fall inside a closed
 * session window, derive model-neutral signals (design §6) and from them:
 *  - which of the 9 traits trigger this window,
 *  - the window's rhythm classification (steady vs bursty),
 *  - the trait *class* (endurance / tempo / breadth) for evolution branching,
 *  - an activity modifier in [0.5, 2.0] that scales grade-roll odds (design §12).
 *
 * MODEL-NEUTRAL INVARIANT (pillar 2): nothing here reads token volume or model
 * id to grade the window. Token counts are only used as a *normalization*
 * denominator against the player's own baseline (consistency vs self), never as
 * absolute power. Model ids feed only diversity/switching counts (identity), and
 * are never compared for quality.
 */

import type { TraitId, UsageEvent } from './types';

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
  /** Number of events in the window. */
  eventCount: number;
}

export type RhythmKind = 'steady' | 'bursty';
export type TraitClass = 'endurance' | 'tempo' | 'breadth';

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
  // Use UTC to stay deterministic and platform-independent; the engine treats
  // weekAnchor as the canonical reference, so this is a stable proxy.
  return Math.floor((ts % 86_400_000) / 3_600_000);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
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

  const sessions = new Map<string, number>();
  const adapters = new Set<string>();
  const models = new Set<string>();
  const langs = new Set<string>();
  let night = 0;
  let morning = 0;
  let totalEssence = 0;

  for (const ev of sorted) {
    sessions.set(ev.sessionKey, (sessions.get(ev.sessionKey) ?? 0) + 1);
    adapters.add(ev.adapter);
    models.add(ev.modelId);
    for (const l of ev.langHints ?? []) langs.add(l);
    const h = hourOf(ev.ts);
    if (h < 6 || h >= 22) night++;
    if (h >= 5 && h < 9) morning++;
    totalEssence += eventEssence(ev);
  }

  // Gaps between consecutive events.
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i]!.ts - sorted[i - 1]!.ts);
  const medianGapMs = median(gaps);
  const meanGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const variance = gaps.length ? gaps.reduce((a, g) => a + (g - meanGap) ** 2, 0) / gaps.length : 0;
  const gapCv = meanGap > 0 ? Math.sqrt(variance) / meanGap : 0;

  // Cap proximity: how much of the window span is spanned by activity.
  const firstTs = sorted.length ? sorted[0]!.ts : windowStart;
  const lastTs = sorted.length ? sorted[sorted.length - 1]!.ts : windowStart;
  const capProximity = Math.min(1, (lastTs - firstTs) / span);

  const sessionSizes = [...sessions.values()];
  const longestSessionEvents = sessionSizes.length ? Math.max(...sessionSizes) : 0;
  const shortSessionCount = sessionSizes.filter((n) => n <= 2).length;

  const essenceRatio = baselineMean > 0 ? totalEssence / baselineMean : eventCount > 0 ? 1 : 0;

  return {
    sessionCount: sessions.size,
    adapterCount: adapters.size,
    modelCount: models.size,
    langCount: langs.size,
    capProximity,
    medianGapMs,
    gapCv,
    nightFraction: eventCount ? night / eventCount : 0,
    morningFraction: eventCount ? morning / eventCount : 0,
    longestSessionEvents,
    shortSessionCount,
    essenceRatio,
    totalEssence,
    eventCount,
  };
}

/** steady = low gap variability; bursty = spiky gaps or single tight cluster. */
export function classifyRhythm(s: WindowSignals): RhythmKind {
  return s.gapCv >= 1 ? 'bursty' : 'steady';
}

const ENDURANCE: ReadonlySet<TraitId> = new Set(['marathoner', 'deepdiver']);
const TEMPO: ReadonlySet<TraitId> = new Set(['sprinter', 'swarm']);
const BREADTH: ReadonlySet<TraitId> = new Set(['polyglot', 'switcher', 'polyhost']);

/** Dominant trait class of a window's triggered traits (design §7 Evolved fork). */
export function dominantTraitClass(traits: readonly TraitId[]): TraitClass {
  let e = 0;
  let t = 0;
  let b = 0;
  for (const tr of traits) {
    if (ENDURANCE.has(tr)) e++;
    else if (TEMPO.has(tr)) t++;
    else if (BREADTH.has(tr)) b++;
  }
  // Ties resolve deterministically: endurance > tempo > breadth.
  if (e >= t && e >= b) return 'endurance';
  if (t >= b) return 'tempo';
  return 'breadth';
}

/**
 * Evaluate which traits trigger for this window. Pure threshold logic over the
 * signals; all model-neutral. Returns ids in a stable order.
 */
export function evaluateTraits(s: WindowSignals): TraitId[] {
  const out: TraitId[] = [];
  if (s.eventCount === 0) return out;

  // Marathoner: rode the window near its cap (broad span of continuous-ish use).
  if (s.capProximity >= 0.8 && s.eventCount >= 4) out.push('marathoner');
  // Sprinter: short intense bursts with long gaps (spiky rhythm, few sessions).
  if (s.gapCv >= 1.2 && s.eventCount >= 3 && s.capProximity < 0.8) out.push('sprinter');
  // Polyglot: 3+ languages/file types touched.
  if (s.langCount >= 3) out.push('polyglot');
  // Nightshade: majority usage after midnight / late night.
  if (s.nightFraction > 0.5) out.push('nightshade');
  // Daybreaker: meaningful pre-9am sessions.
  if (s.morningFraction > 0.5) out.push('daybreaker');
  // Switcher: changed model ids mid-window (never punishes mono-model).
  if (s.modelCount >= 2) out.push('switcher');
  // Deepdiver: one long continuous conversation thread.
  if (s.longestSessionEvents >= 6 && s.sessionCount <= 2) out.push('deepdiver');
  // Swarm: many parallel short sessions.
  if (s.shortSessionCount >= 3 && s.sessionCount >= 3) out.push('swarm');
  // Polyhost: meaningful usage from 2+ provider adapters in one window.
  if (s.adapterCount >= 2) out.push('polyhost');

  return out;
}

/**
 * Activity modifier in [0.5, 2.0] that scales grade-roll base odds (design §12).
 * Built from model-neutral signals only: consistency vs the player's own
 * baseline (essenceRatio), trait synergy that window, and rhythm quality.
 * Never reads absolute token volume or model id.
 */
export function activityModifier(s: WindowSignals, traits: readonly TraitId[]): number {
  if (s.eventCount === 0) return 0.5;

  // Consistency vs own baseline: on-or-above baseline is good, thin is penalized.
  // Map essenceRatio (relative to self) into a bounded contribution.
  const consistency = Math.max(0, Math.min(1, s.essenceRatio));
  // Trait synergy: more distinct triggered traits this window => higher odds.
  const synergy = Math.min(1, traits.length / 4);
  // Rhythm quality: steady, well-spread windows read as "excellent".
  const rhythm = Math.max(0, Math.min(1, s.capProximity));

  // Weighted blend in [0,1], then map to [0.5, 2.0].
  const quality = 0.45 * consistency + 0.3 * synergy + 0.25 * rhythm;
  const mod = 0.5 + quality * 1.5;
  return Math.max(0.5, Math.min(2.0, mod));
}
