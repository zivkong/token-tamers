/**
 * Seeded PRNG for the deterministic core.
 *
 * `core` is forbidden from `Math.random()` (ESLint-enforced). All randomness in
 * the engine flows through this mulberry32 generator, whose entire state is a
 * single 32-bit integer — so it serializes into `GameState.rngState` and a
 * resumed engine produces the exact same stream forever.
 */

export interface Rng {
  /** Current serializable state (a uint32). */
  state: number;
}

const UINT32 = 0x100000000;

/** Create an RNG from a seed (or a persisted state value). */
export function createRng(seed: number): Rng {
  return { state: seed >>> 0 };
}

/**
 * Advance the generator and return a float in [0, 1). Mutates `rng.state` so the
 * stream is reproducible from any persisted state.
 */
export function nextFloat(rng: Rng): number {
  // mulberry32
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / UINT32;
}

/** Roll a probability `p` in [0, 1]. Always consumes exactly one draw. */
export function chance(rng: Rng, p: number): boolean {
  const r = nextFloat(rng);
  if (p <= 0) return false;
  if (p >= 1) return true;
  return r < p;
}

/** Integer in [0, max) (max must be > 0). Consumes one draw. */
export function nextInt(rng: Rng, max: number): number {
  return Math.floor(nextFloat(rng) * max);
}

/**
 * Pick an index from `weights` proportional to its weight. Non-positive total
 * weight falls back to a uniform pick. Consumes exactly one draw.
 */
export function pickWeighted(rng: Rng, weights: readonly number[]): number {
  const total = weights.reduce((sum, w) => sum + (w > 0 ? w : 0), 0);
  const r = nextFloat(rng);
  if (total <= 0) {
    return Math.min(weights.length - 1, Math.floor(r * weights.length));
  }
  let acc = 0;
  const target = r * total;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] ?? 0;
    if (w > 0) {
      acc += w;
      if (target < acc) return i;
    }
  }
  return weights.length - 1;
}
