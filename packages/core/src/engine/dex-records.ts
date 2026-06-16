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

/**
 * Reduce snapshots to ONE entry per life — keyed by `generation`, the life id —
 * then rank best-first and cap to `cap`. A single life passes through a species
 * exactly once (evolution moves it to a new species; rebirth bumps `generation`),
 * so `(speciesId, generation)` uniquely identifies a "life at a tier": repeated
 * molt-close captures of the same species in the same life collapse to that
 * life's best peak, and a species' top-N becomes its best-N DISTINCT lives — not
 * three near-duplicates from one life. Pure & deterministic.
 */
export function rankBestPerLife(
  snaps: readonly DexSnapshot[],
  cap = MAX_DEX_RECORDS,
): DexSnapshot[] {
  const bestByLife = new Map<number, DexSnapshot>();
  for (const s of snaps) {
    const cur = bestByLife.get(s.generation);
    if (!cur || snapshotStrictlyBetter(s, cur)) bestByLife.set(s.generation, s);
  }
  return [...bestByLife.values()].sort(snapshotRank).slice(0, cap);
}

/**
 * Fold a candidate snapshot into the store, keeping each species' best-per-life
 * top-`cap`. Returns true iff the candidate earned a slot (changed the kept set).
 * Idempotent under re-advance: re-capturing the same life's species updates that
 * life's single entry (keeping its best peak) rather than adding a duplicate.
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
  const next = rankBestPerLife([...record.top, cand], cap);
  record.top = next;
  return next.includes(cand);
}
