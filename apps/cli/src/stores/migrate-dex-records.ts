/**
 * v2 → v3 save migration + auto-repair for the per-species Dex record store.
 *
 * Existing saves only have the rebirth `archive` (one strictly-best record per
 * species). We seed `dexRecords` from it so users keep their best lives, then
 * defensively repair any hand-edited/corrupt store: clamp invalid enums, default
 * missing arrays, re-rank, and cap each species at MAX_DEX_RECORDS.
 */

import {
  GRADE_ORDER,
  MAX_DEX_RECORDS,
  rankBestPerLife,
  STAGE_ORDER,
  type ArchiveRecord,
  type DexRecord,
  type DexSnapshot,
  type Grade,
  type House,
  type PatternId,
  type RhythmVariant,
  type Stage,
  type Stats,
  type TraitId,
} from '@token-tamers/core';

const HOUSES: readonly House[] = ['wild', 'aether', 'cipher', 'flux', 'forge'];

function clampGrade(g: unknown): Grade {
  return typeof g === 'string' && (GRADE_ORDER as readonly string[]).includes(g)
    ? (g as Grade)
    : 'C';
}

function clampStage(s: unknown): Stage {
  return typeof s === 'string' && (STAGE_ORDER as readonly string[]).includes(s)
    ? (s as Stage)
    : 'sprite';
}

function clampHouse(h: unknown): House {
  return typeof h === 'string' && (HOUSES as readonly string[]).includes(h) ? (h as House) : 'wild';
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
}

function clampStats(s: unknown): Stats {
  const o = (s ?? {}) as Record<string, unknown>;
  return { pwr: num(o.pwr), spd: num(o.spd), wis: num(o.wis), grt: num(o.grt) };
}

function strList<T extends string>(v: unknown): T[] {
  return Array.isArray(v) ? (v.filter((x) => typeof x === 'string') as T[]) : [];
}

/** Synthesize the Dex record store from an existing rebirth Archive. */
export function backfillDexRecords(archive: ArchiveRecord[] | undefined): DexRecord[] {
  if (!Array.isArray(archive)) return [];
  const out: DexRecord[] = [];
  for (const rec of archive) {
    if (!rec || typeof rec.speciesId !== 'string') continue;
    // Archive records came from completed lives, so default to the apex stage —
    // proven best lives are battle/graft-ready. House/traits are unknown here; the
    // live engine refreshes the species' snapshot on its next capture.
    const snap: DexSnapshot = {
      speciesId: rec.speciesId,
      stage: 'apex',
      grade: clampGrade(rec.grade),
      stats: clampStats(rec.stats),
      house: 'wild',
      traits: [],
      pattern: null,
      rhythmVariant: null,
      mutations: [],
      generation: num(rec.generation),
      contentVersion: num(rec.contentVersion),
      recordedAt: num(rec.recordedAt),
      reason: 'rebirth',
    };
    const existing = out.find((r) => r.speciesId === snap.speciesId);
    if (existing) existing.top.push(snap);
    else out.push({ speciesId: snap.speciesId, top: [snap] });
  }
  return out;
}

function repairSnapshot(speciesId: string, s: Record<string, unknown>): DexSnapshot {
  const reason = s.reason;
  return {
    speciesId,
    stage: clampStage(s.stage),
    grade: clampGrade(s.grade),
    stats: clampStats(s.stats),
    house: clampHouse(s.house),
    traits: strList<TraitId>(s.traits),
    pattern: typeof s.pattern === 'string' ? (s.pattern as PatternId) : null,
    rhythmVariant: typeof s.rhythmVariant === 'string' ? (s.rhythmVariant as RhythmVariant) : null,
    mutations: strList<string>(s.mutations),
    generation: num(s.generation),
    contentVersion: num(s.contentVersion),
    recordedAt: num(s.recordedAt),
    reason: reason === 'molt' || reason === 'evolution' || reason === 'rebirth' ? reason : 'molt',
  };
}

/** Repair a (possibly hand-edited) record store: clamp, re-rank, cap top-N. */
export function repairDexRecords(records: unknown): DexRecord[] {
  if (!Array.isArray(records)) return [];
  const bySpecies = new Map<string, DexSnapshot[]>();
  for (const rec of records) {
    if (!rec || typeof rec.speciesId !== 'string' || !Array.isArray(rec.top)) continue;
    const list = bySpecies.get(rec.speciesId) ?? [];
    for (const snap of rec.top) {
      if (snap && typeof snap === 'object') {
        list.push(repairSnapshot(rec.speciesId, snap as Record<string, unknown>));
      }
    }
    bySpecies.set(rec.speciesId, list);
  }
  const out: DexRecord[] = [];
  for (const [speciesId, snaps] of bySpecies) {
    // Collapse any same-life (same-generation) duplicates a pre-fix store accrued,
    // then rank + cap — so an old save with 3 records from one life self-heals.
    const top = rankBestPerLife(snaps, MAX_DEX_RECORDS);
    if (top.length > 0) out.push({ speciesId, top });
  }
  return out;
}
