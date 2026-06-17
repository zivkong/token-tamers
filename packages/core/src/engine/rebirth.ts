/**
 * Rebirth and lineage helpers: stat carry-over, archive comparison + insert.
 */

import { GRADE_ORDER, type ArchiveRecord, type Stats } from '../types';

export function scaleStats(s: Stats, frac: number): Stats {
  return {
    pwr: Math.round(s.pwr * frac),
    spd: Math.round(s.spd * frac),
    wis: Math.round(s.wis * frac),
    grt: Math.round(s.grt * frac),
  };
}

export function statTotal(s: Stats): number {
  return s.pwr + s.spd + s.wis + s.grt;
}

export function isStrictlyBetter(candidate: ArchiveRecord, existing: ArchiveRecord): boolean {
  const cg = GRADE_ORDER.indexOf(candidate.grade);
  const eg = GRADE_ORDER.indexOf(existing.grade);
  if (cg !== eg) return cg > eg;
  return statTotal(candidate.stats) > statTotal(existing.stats);
}

/**
 * Insert/replace `record` in the legacy per-species `archive` mirror (one
 * strictly-best record per species). Returns whether the archive changed.
 */
export function archiveRecord(archive: ArchiveRecord[], record: ArchiveRecord): boolean {
  const idx = archive.findIndex((r) => r.speciesId === record.speciesId);
  if (idx < 0) {
    archive.push(record);
    return true;
  }
  if (isStrictlyBetter(record, archive[idx]!)) {
    archive[idx] = record;
    return true;
  }
  return false;
}
