import { describe, it, expect } from 'vitest';
import { contentPackV1, validatePack, resolveHouse } from '../src/index';
import type { Stage } from '@token-tamers/core';

// ---------------------------------------------------------------------------
// Validate pack — must produce zero errors
// ---------------------------------------------------------------------------

describe('validatePack(contentPackV1)', () => {
  it('returns no errors', () => {
    const errors = validatePack(contentPackV1);
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Stat budget equality per stage
// ---------------------------------------------------------------------------

describe('stat budget', () => {
  it('all species of the same stage have equal total stat weights', () => {
    const stageGroups = new Map<Stage, number[]>();
    for (const sp of contentPackV1.species) {
      const total =
        sp.statWeights.pwr + sp.statWeights.spd + sp.statWeights.wis + sp.statWeights.grt;
      const list = stageGroups.get(sp.stage) ?? [];
      list.push(total);
      stageGroups.set(sp.stage, list);
    }
    for (const [stage, totals] of stageGroups) {
      const first = totals[0]!;
      for (const t of totals) {
        expect(t, `stage '${stage}' has inconsistent totals`).toBe(first);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Species reachability from Mote
// ---------------------------------------------------------------------------

describe('species reachability', () => {
  it('every species is reachable from mote by some branch path', () => {
    const speciesMap = new Map(contentPackV1.species.map((s) => [s.id, s]));
    const reachable = new Set<string>();

    function visit(id: string): void {
      if (reachable.has(id)) return;
      reachable.add(id);
      const sp = speciesMap.get(id);
      if (!sp) return;
      for (const branch of sp.evolvesTo) {
        visit(branch.species);
      }
    }

    visit('mote');

    for (const sp of contentPackV1.species) {
      expect(reachable, `species '${sp.id}' should be reachable from mote`).toContain(sp.id);
    }
  });
});

// ---------------------------------------------------------------------------
// evolvesTo targets exist
// ---------------------------------------------------------------------------

describe('evolvesTo integrity', () => {
  it('every evolvesTo target references an existing species id', () => {
    const ids = new Set(contentPackV1.species.map((s) => s.id));
    for (const sp of contentPackV1.species) {
      for (const branch of sp.evolvesTo) {
        expect(ids, `${sp.id} -> ${branch.species} should exist`).toContain(branch.species);
      }
    }
  });

  it('every non-apex species has a default branch', () => {
    for (const sp of contentPackV1.species) {
      if (sp.evolvesTo.length > 0) {
        const hasDefault = sp.evolvesTo.some((b) => b.when.kind === 'default');
        expect(hasDefault, `species '${sp.id}' is missing a default branch`).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Sprite resolution
// ---------------------------------------------------------------------------

describe('sprite resolution', () => {
  it('every spriteId referenced by species resolves in sprites', () => {
    const spriteIds = new Set(contentPackV1.sprites.map((s) => s.id));
    for (const sp of contentPackV1.species) {
      expect(spriteIds, `species '${sp.id}' spriteId '${sp.spriteId}' must resolve`).toContain(
        sp.spriteId,
      );
    }
  });

  it('every spriteId referenced by habitats resolves in sprites', () => {
    const spriteIds = new Set(contentPackV1.sprites.map((s) => s.id));
    for (const h of contentPackV1.habitats) {
      expect(spriteIds, `habitat '${h.id}' spriteId '${h.spriteId}' must resolve`).toContain(
        h.spriteId,
      );
    }
  });

  it('every spriteId referenced by trinkets resolves in sprites', () => {
    const spriteIds = new Set(contentPackV1.sprites.map((s) => s.id));
    for (const t of contentPackV1.trinkets) {
      expect(spriteIds, `trinket '${t.id}' spriteId '${t.spriteId}' must resolve`).toContain(
        t.spriteId,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Achievement reward integrity
// ---------------------------------------------------------------------------

describe('achievement reward integrity', () => {
  it('all achievement habitat rewards reference existing habitat ids', () => {
    const habitatIds = new Set(contentPackV1.habitats.map((h) => h.id));
    for (const a of contentPackV1.achievements) {
      if (a.reward?.kind === 'habitat') {
        expect(
          habitatIds,
          `achievement '${a.id}' rewards unknown habitat '${a.reward.id}'`,
        ).toContain(a.reward.id);
      }
    }
  });

  it('all achievement trinket rewards reference existing trinket ids', () => {
    const trinketIds = new Set(contentPackV1.trinkets.map((t) => t.id));
    for (const a of contentPackV1.achievements) {
      if (a.reward?.kind === 'trinket') {
        expect(
          trinketIds,
          `achievement '${a.id}' rewards unknown trinket '${a.reward.id}'`,
        ).toContain(a.reward.id);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Model rule matching
// ---------------------------------------------------------------------------

describe('model rule house resolution', () => {
  const models = contentPackV1.models;

  it('claude-sonnet-4-6 -> aether', () => {
    expect(resolveHouse('claude-sonnet-4-6', models)).toBe('aether');
  });

  it('gpt-5 -> cipher', () => {
    expect(resolveHouse('gpt-5', models)).toBe('cipher');
  });

  it('o3-mini -> cipher', () => {
    expect(resolveHouse('o3-mini', models)).toBe('cipher');
  });

  it('gemini-2.5-pro -> flux', () => {
    expect(resolveHouse('gemini-2.5-pro', models)).toBe('flux');
  });

  it('qwen2.5-coder -> forge', () => {
    expect(resolveHouse('qwen2.5-coder', models)).toBe('forge');
  });

  it('weird-local-model -> wild', () => {
    expect(resolveHouse('weird-local-model', models)).toBe('wild');
  });

  it('o1-preview -> cipher', () => {
    expect(resolveHouse('o1-preview', models)).toBe('cipher');
  });

  it('o4-mini -> cipher', () => {
    expect(resolveHouse('o4-mini', models)).toBe('cipher');
  });

  it('llama3.1-8b -> forge', () => {
    expect(resolveHouse('llama3.1-8b', models)).toBe('forge');
  });

  it('deepseek-coder-v2 -> forge', () => {
    expect(resolveHouse('deepseek-coder-v2', models)).toBe('forge');
  });

  it('phi-3-mini -> forge', () => {
    expect(resolveHouse('phi-3-mini', models)).toBe('forge');
  });

  it('gemma2-9b -> forge', () => {
    expect(resolveHouse('gemma2-9b', models)).toBe('forge');
  });
});

// ---------------------------------------------------------------------------
// dexTotal sanity
// ---------------------------------------------------------------------------

describe('dexTotal', () => {
  it('dexTotal is 112', () => {
    expect(contentPackV1.dexTotal).toBe(112);
  });
});

// ---------------------------------------------------------------------------
// Content counts
// ---------------------------------------------------------------------------

describe('content counts', () => {
  it('has 9 traits', () => {
    expect(contentPackV1.traits).toHaveLength(9);
  });

  it('has 4 patterns', () => {
    expect(contentPackV1.patterns).toHaveLength(4);
  });

  it('has at least 30 achievements', () => {
    expect(contentPackV1.achievements.length).toBeGreaterThanOrEqual(30);
  });

  it('has 3 habitats', () => {
    expect(contentPackV1.habitats).toHaveLength(3);
  });

  it('has 6 trinkets', () => {
    expect(contentPackV1.trinkets).toHaveLength(6);
  });

  it('terminal-den habitat exists with no unlock condition (default)', () => {
    const h = contentPackV1.habitats.find((h) => h.id === 'terminal-den');
    expect(h).toBeDefined();
  });

  it('meadow and rooftop-night habitats exist as achievement rewards', () => {
    const achievementRewardIds = contentPackV1.achievements
      .filter((a) => a.reward?.kind === 'habitat')
      .map((a) => (a.reward as { kind: 'habitat'; id: string }).id);
    expect(achievementRewardIds).toContain('meadow');
    expect(achievementRewardIds).toContain('rooftop-night');
  });
});

// ---------------------------------------------------------------------------
// Sprite data integrity — new art contract
//
// Rules (matching the art-direction contract in docs/design/ and SKILL.md):
//   - All palette indices must be in 0..15 (0=transparent, 1=outline/darkest,
//     2..12=body shading ramp, 13/14=rim-light, 15=animated glint slot)
//   - Species sprites: even width and height, 28x28 (egg) to 48x48 (apex)
//   - Apex-stage species sprites: exactly 48x48
//   - Habitat sprites: exactly 96x48
//   - Trinket sprites: exactly 12x12
//   - Every sprite (species/habitat/trinket): at least 2 animation frames
//   - Every sprite: all frames share the same width and height
//   - Every sprite: at least 6 distinct non-zero palette indices across all
//     frames (complexity floor — depth comes from many ramp indices)
//   - Every species/habitat/trinket id must resolve in the sprites array
// ---------------------------------------------------------------------------

describe('sprite data integrity', () => {
  it('all palette indices are 0–15 (0=transparent, 1=outline, 2..14=ramp, 15=glint)', () => {
    for (const sprite of contentPackV1.sprites) {
      for (const frame of sprite.frames) {
        for (const row of frame) {
          for (const idx of row) {
            expect(
              idx,
              `sprite '${sprite.id}' has out-of-range index ${idx}`,
            ).toBeGreaterThanOrEqual(0);
            expect(idx, `sprite '${sprite.id}' has out-of-range index ${idx}`).toBeLessThanOrEqual(
              15,
            );
          }
        }
      }
    }
  });

  it('every species sprite has even width and height in 28..48', () => {
    const petIds = new Set(contentPackV1.species.map((s) => s.spriteId));
    for (const sprite of contentPackV1.sprites) {
      if (!petIds.has(sprite.id)) continue;
      expect(sprite.width % 2, `sprite '${sprite.id}' width must be even`).toBe(0);
      expect(sprite.height % 2, `sprite '${sprite.id}' height must be even`).toBe(0);
      expect(sprite.width, `sprite '${sprite.id}' width must be >= 28`).toBeGreaterThanOrEqual(28);
      expect(sprite.height, `sprite '${sprite.id}' height must be >= 28`).toBeGreaterThanOrEqual(
        28,
      );
      expect(sprite.width, `sprite '${sprite.id}' width must be <= 48`).toBeLessThanOrEqual(48);
      expect(sprite.height, `sprite '${sprite.id}' height must be <= 48`).toBeLessThanOrEqual(48);
    }
  });

  it('apex-stage species sprites are exactly 48x48', () => {
    const apexSpriteIds = new Set(
      contentPackV1.species.filter((s) => s.stage === 'apex').map((s) => s.spriteId),
    );
    const spriteMap = new Map(contentPackV1.sprites.map((s) => [s.id, s]));
    for (const id of apexSpriteIds) {
      const sprite = spriteMap.get(id);
      expect(sprite, `apex sprite '${id}' not found`).toBeDefined();
      if (!sprite) continue;
      expect(sprite.width, `apex sprite '${id}' width must be 48`).toBe(48);
      expect(sprite.height, `apex sprite '${id}' height must be 48`).toBe(48);
    }
  });

  it('habitat sprites are exactly 96x48', () => {
    const habitatSpriteIds = new Set(contentPackV1.habitats.map((h) => h.spriteId));
    const spriteMap = new Map(contentPackV1.sprites.map((s) => [s.id, s]));
    for (const id of habitatSpriteIds) {
      const sprite = spriteMap.get(id);
      expect(sprite, `habitat sprite '${id}' not found`).toBeDefined();
      if (!sprite) continue;
      expect(sprite.width, `habitat sprite '${id}' width must be 96`).toBe(96);
      expect(sprite.height, `habitat sprite '${id}' height must be 48`).toBe(48);
    }
  });

  it('trinket sprites are exactly 12x12', () => {
    const trinketSpriteIds = new Set(contentPackV1.trinkets.map((t) => t.spriteId));
    const spriteMap = new Map(contentPackV1.sprites.map((s) => [s.id, s]));
    for (const id of trinketSpriteIds) {
      const sprite = spriteMap.get(id);
      expect(sprite, `trinket sprite '${id}' not found`).toBeDefined();
      if (!sprite) continue;
      expect(sprite.width, `trinket sprite '${id}' width must be 12`).toBe(12);
      expect(sprite.height, `trinket sprite '${id}' height must be 12`).toBe(12);
    }
  });

  it('every species/habitat/trinket sprite has at least 2 animation frames', () => {
    const relevantIds = new Set([
      ...contentPackV1.species.map((s) => s.spriteId),
      ...contentPackV1.habitats.map((h) => h.spriteId),
      ...contentPackV1.trinkets.map((t) => t.spriteId),
    ]);
    for (const sprite of contentPackV1.sprites) {
      if (!relevantIds.has(sprite.id)) continue;
      expect(
        sprite.frames.length,
        `sprite '${sprite.id}' should have >= 2 frames`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it('every sprite has consistent frame dimensions (all frames same width/height)', () => {
    for (const sprite of contentPackV1.sprites) {
      const expectedH = sprite.frames[0]?.length ?? 0;
      const expectedW = sprite.frames[0]?.[0]?.length ?? 0;
      for (let fi = 0; fi < sprite.frames.length; fi++) {
        const frame = sprite.frames[fi]!;
        expect(frame.length, `sprite '${sprite.id}' frame ${fi} row count mismatch`).toBe(
          expectedH,
        );
        for (let ri = 0; ri < frame.length; ri++) {
          expect(
            frame[ri]!.length,
            `sprite '${sprite.id}' frame ${fi} row ${ri} width mismatch`,
          ).toBe(expectedW);
        }
      }
    }
  });

  it('every species/habitat/trinket sprite uses >= 6 distinct non-zero palette indices (complexity floor)', () => {
    const relevantIds = new Set([
      ...contentPackV1.species.map((s) => s.spriteId),
      ...contentPackV1.habitats.map((h) => h.spriteId),
      ...contentPackV1.trinkets.map((t) => t.spriteId),
    ]);
    for (const sprite of contentPackV1.sprites) {
      if (!relevantIds.has(sprite.id)) continue;
      const indices = new Set<number>();
      for (const frame of sprite.frames) {
        for (const row of frame) {
          for (const idx of row) {
            if (idx > 0) indices.add(idx);
          }
        }
      }
      expect(
        indices.size,
        `sprite '${sprite.id}' uses only ${indices.size} distinct non-zero indices (need >= 6)`,
      ).toBeGreaterThanOrEqual(6);
    }
  });
});
