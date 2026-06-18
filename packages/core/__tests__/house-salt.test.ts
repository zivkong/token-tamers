/**
 * Per-install salt + houseBias: spreads single-model players across Houses at
 * hatch WITHOUT touching mechanics (invariant 3) or the molt RNG (invariant 5).
 *
 * The fixture pack has sprite species only in Aether and Cipher (Wild has none),
 * so for a pure-claude stream home = Aether and the only species-bearing
 * alternate is Cipher.
 */
import { describe, expect, it } from 'vitest';
import { createEngine, type ContentPack, type EngineConfig } from '../src/index';
import { adapters, ev, HOUR, makePack, staticCycle, WEEK_ANCHOR } from './fixture';

/** Hatch a pure-claude pet and return its committed House. */
function hatchHouse(salt: number | undefined, houseBias?: number): string {
  const pack: ContentPack = { ...makePack(), houseBias };
  const config: EngineConfig = { adapters: adapters(), cycle: staticCycle(), salt };
  const eng = createEngine(pack, config);
  eng.ingest([ev(0, { modelId: 'claude-opus-4' })]);
  // Stop after the 10-min egg-hatch checkpoint but before the first 5h window.
  eng.advanceTo(WEEK_ANCHOR + HOUR);
  return eng.state().pet.house;
}

describe('house salt bias', () => {
  it('no salt → pure model House (legacy behavior preserved)', () => {
    expect(hatchHouse(undefined)).toBe('aether');
    expect(hatchHouse(undefined, 0.5)).toBe('aether');
  });

  it('bias 1 keeps home for every salt; bias 0 always leaves to a species-bearing House', () => {
    for (const salt of [0, 1, 7, 42, 0xdeadbeef, 0xffffffff]) {
      expect(hatchHouse(salt, 1)).toBe('aether'); // always home
      // Never Wild (no species) — the only valid alternate is Cipher.
      expect(hatchHouse(salt, 0)).toBe('cipher');
    }
  });

  it('is deterministic: same salt → same House', () => {
    const salt = 0x1234abcd;
    expect(hatchHouse(salt, 0.5)).toBe(hatchHouse(salt, 0.5));
  });

  it('spreads a single-model cohort across Houses at ~houseBias', () => {
    const N = 2000;
    let home = 0;
    for (let salt = 1; salt <= N; salt++) {
      const house = hatchHouse(salt, 0.5);
      expect(['aether', 'cipher']).toContain(house); // never the speciesless Wild
      if (house === 'aether') home += 1;
    }
    const homeFraction = home / N;
    // ~50% stay home, the rest spread — a mono-model org is no longer one House.
    expect(homeFraction).toBeGreaterThan(0.4);
    expect(homeFraction).toBeLessThan(0.6);
  });
});
