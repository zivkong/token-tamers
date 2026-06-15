/**
 * The per-species Dex record store: keep each species' top-N snapshots, ranked
 * best-first. This generalizes the rebirth Archive's "strictly-best per species"
 * (rebirth.ts:isStrictlyBetter) to a top-N list captured across the whole life
 * (molt close, evolution, rebirth — see engine/index.ts).
 *
 * Pure & deterministic: ranking is a total order (grade desc, stat total desc,
 * then recordedAt asc as a stable final tiebreak), so replay-from-scratch and
 * resume-from-snapshot produce byte-identical stores. No clock/RNG.
 */

import { GRADE_ORDER, type DexRecord, type DexSnapshot } from '../types';
import { MAX_DEX_RECORDS } from './constants';
import { statTotal } from './rebirth';

export { MAX_DEX_RECORDS };

/**
 * Total ranking comparator for snapshots (Array.sort order: best first).
 * Negative ⇒ `a` ranks ahead of `b`.
 */
export function snapshotRank(a: DexSnapshot, b: DexSnapshot): number {
  const ga = GRADE_ORDER.indexOf(a.grade);
  const gb = GRADE_ORDER.indexOf(b.grade);
  if (ga !== gb) return gb - ga; // grade desc (S ahead of C)
  const ta = statTotal(a.stats);
  const tb = statTotal(b.stats);
  if (ta !== tb) return tb - ta; // stat total desc
  return a.recordedAt - b.recordedAt; // stable: earliest peak wins ties
}

/** True when `cand` outranks `other`. */
export function snapshotStrictlyBetter(cand: DexSnapshot, other: DexSnapshot): boolean {
  return snapshotRank(cand, other) < 0;
}

/**
 * Best snapshot per species (each record's `top[0]`) — the Archive view derives
 * its best-per-species rows from this, so the Archive and Dex stay one store.
 */
export function bestSpeciesRecords(records: readonly DexRecord[]): DexSnapshot[] {
  return records.map((r) => r.top[0]).filter((s): s is DexSnapshot => s !== undefined);
}

/** Two snapshots represent the same peak (equal on every ranked dimension). */
function sameRank(a: DexSnapshot, b: DexSnapshot): boolean {
  return (
    a.grade === b.grade &&
    statTotal(a.stats) === statTotal(b.stats) &&
    a.recordedAt === b.recordedAt
  );
}

/**
 * Fold a candidate snapshot into the store, keeping the species' top-`cap`.
 * Returns true iff the candidate earned a slot (changed the kept set). Idempotent
 * under re-advance: an identical peak already present is never duplicated.
 */
export function tryCaptureSnapshot(
  records: DexRecord[],
  cand: DexSnapshot,
  cap = MAX_DEX_RECORDS,
): boolean {
  let record = records.find((r) => r.speciesId === cand.speciesId);
  if (!record) {
    record = { speciesId: cand.speciesId, top: [] };
    records.push(record);
  }
  if (record.top.some((s) => sameRank(s, cand))) return false; // dedupe equal peaks

  const merged = [...record.top, cand].sort(snapshotRank).slice(0, cap);
  const earnedSlot = merged.includes(cand);
  record.top = merged;
  return earnedSlot;
}
