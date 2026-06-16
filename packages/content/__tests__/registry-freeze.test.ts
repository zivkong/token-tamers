import { describe, expect, it } from 'vitest';
import { contentPackV1 } from '../src/index';
import freezeRaw from '../content/registry-freeze.json' with { type: 'json' };
import fusionPoolsRaw from '../content/fusion-pools.json' with { type: 'json' };

// The additive-only invariant, made mechanical: every id ever shipped is frozen
// in registry-freeze.json. Removing or renumbering anything breaks every hash
// that ever referenced it — so these tests must never be weakened. Retiring
// content = mark it Ancient in the pack; its id stays here forever.

const freeze = freezeRaw as {
  species: Record<string, number>;
  traits: string[];
  patterns: string[];
  achievements: string[];
  habitats: string[];
  trinkets: string[];
  reservedFusionSpecies: string[];
};

const pack = contentPackV1;

describe('registry freeze (additive-only invariant)', () => {
  it('every frozen species id still exists with its frozen dex num', () => {
    const current = new Map(pack.species.map((s) => [s.id, s.num]));
    for (const [id, num] of Object.entries(freeze.species)) {
      expect(current.has(id), `species '${id}' was removed — additive-only violated`).toBe(true);
      expect(current.get(id), `species '${id}' was renumbered`).toBe(num);
    }
  });

  it.each([
    ['traits', () => pack.traits.map((t) => t.id)],
    ['patterns', () => pack.patterns.map((p) => p.id)],
    ['achievements', () => pack.achievements.map((a) => a.id)],
    ['habitats', () => pack.habitats.map((h) => h.id)],
    ['trinkets', () => pack.trinkets.map((t) => t.id)],
  ] as const)('every frozen %s id still exists', (kind, currentIds) => {
    const current = new Set(currentIds());
    for (const id of freeze[kind]) {
      expect(current.has(id), `${kind} id '${id}' was removed — additive-only violated`).toBe(true);
    }
  });

  it('every frozen reserved fusion species id is still reserved', () => {
    const reserved = new Set(
      fusionPoolsRaw.pools.flatMap((p) => p.species.map((s) => s.species_id)),
    );
    for (const id of freeze.reservedFusionSpecies) {
      expect(reserved.has(id), `reserved fusion id '${id}' was removed`).toBe(true);
    }
  });

  it('every current id is registered in the freeze (add new ids deliberately)', () => {
    const msg = (kind: string, id: string) =>
      `${kind} '${id}' is not in registry-freeze.json — add it there in the same PR ` +
      '(this is the deliberate-registration step for new content)';
    for (const s of pack.species) {
      expect(freeze.species[s.id], msg('species', s.id)).toBe(s.num);
    }
    for (const t of pack.traits) expect(freeze.traits, msg('trait', t.id)).toContain(t.id);
    for (const p of pack.patterns) expect(freeze.patterns, msg('pattern', p.id)).toContain(p.id);
    for (const a of pack.achievements)
      expect(freeze.achievements, msg('achievement', a.id)).toContain(a.id);
    for (const h of pack.habitats) expect(freeze.habitats, msg('habitat', h.id)).toContain(h.id);
    for (const t of pack.trinkets) expect(freeze.trinkets, msg('trinket', t.id)).toContain(t.id);
  });

  it('pack season is a non-negative integer (monotonic content era)', () => {
    expect(Number.isInteger(pack.season)).toBe(true);
    expect(pack.season).toBeGreaterThanOrEqual(0);
  });
});
