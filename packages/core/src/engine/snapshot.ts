/**
 * Build a self-contained {@link DexSnapshot} from live pet state. Arrays and
 * stats are CLONED so a stored snapshot never aliases (and is never rewritten by)
 * the live pet that produced it. Pure; time enters only as the `recordedAt`
 * event timestamp.
 */

import type { DexSnapshot, PetState } from '../types';
import { cloneStats } from './houses';

export function petSnapshot(
  pet: PetState,
  contentVersion: number,
  recordedAt: number,
  reason: DexSnapshot['reason'],
): DexSnapshot {
  return {
    speciesId: pet.speciesId,
    stage: pet.stage,
    grade: pet.grade,
    stats: cloneStats(pet.stats),
    house: pet.house,
    traits: [...pet.traits],
    pattern: pet.pattern,
    rhythmVariant: pet.rhythmVariant,
    mutations: [...pet.mutations],
    generation: pet.generation,
    contentVersion,
    recordedAt,
    reason,
  };
}
