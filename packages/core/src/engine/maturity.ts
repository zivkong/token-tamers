/**
 * Stage maturity pacing & the quality gate (design: lifecycle §evolution pacing).
 *
 * Two levers slow the egg→apex climb from one-stage-per-molt into a ~5-active-day
 * journey, so the form keeps growing across the week instead of finalizing in two
 * days:
 *
 *   A. MATURITY — a stage must accrue `STAGE_MATURITY[stage]` molts before it is
 *      eligible to evolve (`pet.stageMolts`, reset on every stage change). The
 *      ramp rises with stage so growth visibly slows as the pet matures, while
 *      day-1 momentum is preserved (sprite→rookie needs just one molt).
 *   B. GATE — the final step (prime→apex) additionally requires a quality
 *      threshold (grade ≥ B), turning apex into an earned "good week" instead of
 *      a guaranteed default. Mature-but-gated pets sit at the crest until the
 *      threshold is met.
 *
 * Both are deterministic pure functions of persisted state (stageMolts, grade),
 * so replay-from-scratch == resume-from-snapshot is unaffected. The numbers live
 * here as engine pacing constants (like grade odds / window size), NOT in content
 * — they are temporal cycle rules, not species data.
 */

import {
  GRADE_ORDER,
  STAGE_ORDER,
  type GameState,
  type Grade,
  type PetState,
  type Stage,
} from '../types';

/**
 * The maturity a pet (or any captured snapshot) must reach before its DNA becomes
 * usable for battle AND for grafting/fusion. Below this, the DNA code still shows
 * but battle/graft are SEALED — a maturity bar that blocks too-early battles and
 * graft farming from fresh hatchlings.
 *
 * The gate is the Evolved stage (egg→sprite→rookie→[evolved]→prime→apex) — about
 * the midpoint of the ~5-day climb, always eventually reachable. It is derived
 * PURELY from `stage`, which the DNA encodes, so a foreign code's readiness is
 * tamper-evident without trusting any side channel. Identity-only (invariant 3):
 * never model/grade/volume-dependent.
 */
export const BATTLE_READY_STAGE: Stage = 'evolved';

/** True once `stage` is at least the {@link BATTLE_READY_STAGE} on the climb. */
export function stageMature(stage: Stage): boolean {
  return STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(BATTLE_READY_STAGE);
}

/** Whether a snapshot's pet is mature enough to battle. */
export function isBattleReady(snap: Pick<PetState, 'stage'>): boolean {
  return stageMature(snap.stage);
}

/** Whether a snapshot's DNA is mature enough to graft/fuse. Same gate as battle today. */
export function isGraftReady(snap: Pick<PetState, 'stage'>): boolean {
  return stageMature(snap.stage);
}

/**
 * Molts a stage must accrue before it can evolve. Ascending so growth slows as
 * the pet matures; the sum (1+2+3+4 = 10 molts after the hatch) lands the apex
 * climb around day 4–5 at a typical 2–3 molts/day cadence. Stages absent from the
 * table (egg, apex) have no maturity requirement.
 */
export const STAGE_MATURITY: Partial<Record<Stage, number>> = {
  sprite: 1,
  rookie: 2,
  evolved: 3,
  prime: 4,
};

/** A quality gate a stage must clear (beyond maturity) before it can evolve. */
interface StageGate {
  /** Minimum grade required to evolve out of this stage. */
  minGrade?: Grade;
}

/**
 * Quality gates keyed by the stage being evolved FROM. Only the final step is
 * gated: prime→apex requires grade ≥ B, so apex reflects a sustained week.
 */
export const STAGE_GATE: Partial<Record<Stage, StageGate>> = {
  prime: { minGrade: 'B' },
};

/** Molts the given stage must accrue before it is eligible to evolve (0 if none). */
export function requiredMaturity(stage: Stage): number {
  return STAGE_MATURITY[stage] ?? 0;
}

/** True when `grade` is at least `min` on the C<B<A<S ladder. */
export function gradeAtLeast(grade: Grade, min: Grade): boolean {
  return GRADE_ORDER.indexOf(grade) >= GRADE_ORDER.indexOf(min);
}

/**
 * Whether the pet clears its current stage's quality gate (always true for
 * un-gated stages). Checked AFTER maturity, so a mature pet still waits here until
 * the threshold is met.
 */
export function evolutionGateMet(pet: Pick<PetState, 'stage' | 'grade'>): boolean {
  const gate = STAGE_GATE[pet.stage];
  if (!gate) return true;
  if (gate.minGrade !== undefined && !gradeAtLeast(pet.grade, gate.minGrade)) return false;
  return true;
}

/**
 * Spoiler-free growth readout for the Pet page. Deliberately exposes ONLY a fill
 * fraction and coarse state flags — NEVER the stage name, the molt counts, or the
 * next form — so the UI can show that the pet IS maturing without breaking the
 * evolution-mystery rule (what it becomes, and exactly when, stays a surprise).
 */
export interface GrowthProgress {
  /** Maturation toward the next evolution's eligibility, 0..1 (1 = at the crest). */
  frac: number;
  /** The in-stage maturity requirement has been met. */
  matured: boolean;
  /** Matured, but a quality gate still blocks the evolution (held at the crest). */
  gated: boolean;
  /** Terminal stage (apex): fully grown, no further evolution. */
  terminal: boolean;
  /** Pre-hatch egg: growth has not begun yet. */
  incubating: boolean;
}

/** Compute the abstract Growth cue for the current pet. Pure; reads state only. */
export function growthProgress(state: GameState): GrowthProgress {
  const pet = state.pet;
  const terminal = pet.stage === 'apex';
  const incubating = pet.stage === 'egg';
  const required = requiredMaturity(pet.stage);
  const have = Math.min(pet.stageMolts, required);
  const matured = required > 0 && pet.stageMolts >= required;
  const gated = matured && !evolutionGateMet(pet);
  const frac = required > 0 ? have / required : terminal ? 1 : 0;
  return { frac, matured, gated, terminal, incubating };
}
