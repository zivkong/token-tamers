/**
 * Evolution branch selection — data-driven branching at molt time.
 */

import type { BranchCondition } from '../types';
import type { RhythmKind, TraitClass } from '../evaluation/traits';
import { pickWeighted, type Rng } from '../helpers/rng';

export interface BranchInputs {
  rhythm: RhythmKind;
  traitClass: TraitClass;
  consistency: 'low' | 'mid' | 'high';
  arc: 'early' | 'late';
}

/**
 * Choose an evolution branch. Branches whose condition matches the inputs are
 * preferred; among matches the first in declaration order wins. If nothing
 * matches, fall back to a 'default' branch, else a deterministic weighted pick
 * over all branches (one RNG draw, always consumed for stream stability).
 */
export function pickBranch(
  branches: readonly { species: string; when: BranchCondition }[],
  rng: Rng,
  inputs: BranchInputs,
): string | null {
  if (branches.length === 0) return null;
  const matches = branches.filter((b) => branchMatches(b.when, inputs));
  // Always consume exactly one draw so the RNG stream is independent of which
  // path is taken (keeps replay determinism robust to data tweaks).
  const idx = pickWeighted(
    rng,
    branches.map(() => 1),
  );
  if (matches.length > 0) {
    // Prefer the most specific matching branch (non-default), first in order.
    const specific = matches.find((b) => b.when.kind !== 'default');
    return (specific ?? matches[0]!).species;
  }
  const def = branches.find((b) => b.when.kind === 'default');
  if (def) return def.species;
  return branches[idx]!.species;
}

export function consistencyBand(ratio: number): 'low' | 'mid' | 'high' {
  if (ratio < 0.5) return 'low';
  if (ratio < 1.25) return 'mid';
  return 'high';
}

function branchMatches(when: BranchCondition, inputs: BranchInputs): boolean {
  switch (when.kind) {
    case 'default':
      return true;
    case 'rhythm':
      return inputs.rhythm === when.value;
    case 'traitClass':
      return inputs.traitClass === when.value;
    case 'consistency':
      return inputs.consistency === when.value;
    case 'arc':
      return inputs.arc === when.value;
    default:
      return false;
  }
}
