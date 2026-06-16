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

  // Scrambled, mixed-provenance Houses: every House blends providers, none is
  // pure-Western or pure-Chinese (design: evolution-grades-lineage §House map).
  it('minimax -> aether (with Claude)', () => {
    expect(resolveHouse('minimax-01', models)).toBe('aether');
    expect(resolveHouse('abab6.5-chat', models)).toBe('aether');
  });

  it('glm / mimo -> cipher (with GPT)', () => {
    expect(resolveHouse('glm-4.6', models)).toBe('cipher');
    expect(resolveHouse('codegeex-4', models)).toBe('cipher');
    expect(resolveHouse('mimo-7b-rl', models)).toBe('cipher');
  });

  it('qwen / kimi -> flux (with Gemini)', () => {
    expect(resolveHouse('qwen2.5-coder', models)).toBe('flux');
    expect(resolveHouse('qwq-32b', models)).toBe('flux');
    expect(resolveHouse('kimi-k2', models)).toBe('flux');
    expect(resolveHouse('moonshot-v1-128k', models)).toBe('flux');
  });

  // CamelCase regression guard: case-insensitive matcher must fold these to
  // their lowercase patterns, or the canonical provider slug falls to Wild.
  it('matches CamelCase provider slugs case-insensitively', () => {
    expect(resolveHouse('MiniMax-Text-01', models)).toBe('aether');
    expect(resolveHouse('MiMo-7B-RL', models)).toBe('cipher');
    expect(resolveHouse('GLM-4.6', models)).toBe('cipher');
  });

  // De-scoped to Wild — only popular families are mapped; the rest stay dormant.
  it('phi / gemma / niche -> wild', () => {
    expect(resolveHouse('phi-3-mini', models)).toBe('wild');
    expect(resolveHouse('gemma2-9b', models)).toBe('wild');
    expect(resolveHouse('yi-34b', models)).toBe('wild');
    expect(resolveHouse('hunyuan-large', models)).toBe('wild');
  });

  // Gap coverage: patterns not exercised by the named cases above.
  it('qvq / mistral / casing -> correct house', () => {
    expect(resolveHouse('qvq-72b-preview', models)).toBe('flux');
    expect(resolveHouse('mistral-large-2', models)).toBe('forge');
    expect(resolveHouse('Mistral-Small-3', models)).toBe('forge');
    expect(resolveHouse('Gemini-2.0-Flash', models)).toBe('flux');
    expect(resolveHouse('Qwen3-Coder', models)).toBe('flux');
  });

  // COMPLETE coverage: every pattern shipped in models.json must resolve to its
  // declared house (a sample id built from the pattern itself). Guards against a
  // rule being shadowed by an earlier broad rule, dropped, or mis-housed.
  it('every models.json pattern resolves to its own declared house', () => {
    for (const rule of models) {
      const sample = rule.pattern.replace(/\*/g, 'x');
      expect(
        resolveHouse(sample, models),
        `pattern '${rule.pattern}' (sample '${sample}') must resolve to '${rule.house}'`,
      ).toBe(rule.house);
    }
  });
});

// ---------------------------------------------------------------------------
// dexTotal sanity
// ---------------------------------------------------------------------------

describe('dexTotal', () => {
  // The live Dex denominator is the current Season's obtainable roster, so 100%
  // is reachable within the Season. Season 0 ships the 56 base species.
  it('dexTotal is 56 (Season 0 obtainable roster)', () => {
    expect(contentPackV1.dexTotal).toBe(56);
  });

  it('dexTotal matches the shipped species count (no unreachable slots)', () => {
    expect(contentPackV1.dexTotal).toBe(contentPackV1.species.length);
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

  it('has at least 3 habitats', () => {
    expect(contentPackV1.habitats.length).toBeGreaterThanOrEqual(3);
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
// Sprite data integrity — new art contract (owner direction 2026-06-13:
// small high-density characters, ~1/3 of the old 48-64px sizing)
//
// Rules (matching the art-direction contract in docs/design/ and SKILL.md):
//   - All palette indices must be in 0..15 (0=transparent, 1=outline/darkest,
//     2..12=body shading ramp, 13/14=rim-light, 15=animated glint slot)
//   - Species sprites: EXACTLY square, sized by stage —
//       egg 10, sprite 12, rookie 14, evolved 16, prime 18, apex 20
//   - Every species sprite HAS walk + jump + play banks, each with the SAME
//     dims as its idle frames (the idle base contract)
//   - Habitat sprites: exactly 96x48, with a `palette` of 8..15 hexes and
//     >= 2 frames
//   - Trinket sprites: exactly 20x20 (2026-06-15 high-res bump)
//   - Every sprite (species/habitat/trinket): at least 2 animation frames
//   - Every sprite: all frames (and all anim banks) share the same width/height
//   - Every sprite: at least 6 distinct non-zero palette indices across all
//     frames (complexity floor — depth comes from many ramp indices)
//   - Every species/habitat/trinket id must resolve in the sprites array
//
// SIZE LAW (square px, keyed by stage); the egg stage is the 'mote' species.
// 2026-06-15 higher-resolution ramp (was 10/12/14/16/18/20) — uniform +4, apex 32 is the
// renderer's safe ceiling. See docs/design/visuals-habitats-achievements.md §13.
const SPECIES_STAGE_SIZE: Record<Stage, number> = {
  egg: 12,
  sprite: 16,
  rookie: 20,
  evolved: 24,
  prime: 28,
  apex: 32,
};
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

  it('every species sprite is EXACTLY square at its stage size (12/16/20/24/28/32)', () => {
    const spriteMap = new Map(contentPackV1.sprites.map((s) => [s.id, s]));
    for (const sp of contentPackV1.species) {
      const sprite = spriteMap.get(sp.spriteId);
      expect(sprite, `species '${sp.id}' sprite '${sp.spriteId}' not found`).toBeDefined();
      if (!sprite) continue;
      const want = SPECIES_STAGE_SIZE[sp.stage];
      expect(sprite.width, `species '${sp.id}' (${sp.stage}) width must be ${want}`).toBe(want);
      expect(sprite.height, `species '${sp.id}' (${sp.stage}) height must be ${want}`).toBe(want);
    }
  });

  it('every species sprite HAS walk/jump/play banks with idle-matching dims', () => {
    const spriteMap = new Map(contentPackV1.sprites.map((s) => [s.id, s]));
    const banks = ['walk', 'jump', 'play'] as const;
    for (const sp of contentPackV1.species) {
      const sprite = spriteMap.get(sp.spriteId);
      expect(sprite, `species '${sp.id}' sprite '${sp.spriteId}' not found`).toBeDefined();
      if (!sprite) continue;
      const w = sprite.width;
      const h = sprite.height;
      for (const bank of banks) {
        const frames = sprite[bank];
        expect(frames, `species '${sp.id}' is missing the '${bank}' bank`).toBeDefined();
        if (!frames) continue;
        expect(
          frames.length,
          `species '${sp.id}' '${bank}' bank should have >= 2 frames`,
        ).toBeGreaterThanOrEqual(2);
        for (let fi = 0; fi < frames.length; fi++) {
          const frame = frames[fi]!;
          expect(
            frame.length,
            `species '${sp.id}' '${bank}' frame ${fi} height must match idle`,
          ).toBe(h);
          for (let ri = 0; ri < frame.length; ri++) {
            expect(
              frame[ri]!.length,
              `species '${sp.id}' '${bank}' frame ${fi} row ${ri} width must match idle`,
            ).toBe(w);
          }
        }
      }
    }
  });

  it('habitat sprites are exactly 96x48 with a palette of 8..15 hexes and >= 2 frames', () => {
    const spriteMap = new Map(contentPackV1.sprites.map((s) => [s.id, s]));
    const hexRe = /^#[0-9a-fA-F]{6}$/;
    for (const h of contentPackV1.habitats) {
      const sprite = spriteMap.get(h.spriteId);
      expect(sprite, `habitat '${h.id}' sprite '${h.spriteId}' not found`).toBeDefined();
      if (!sprite) continue;
      expect(sprite.width, `habitat sprite '${h.spriteId}' width must be 96`).toBe(96);
      expect(sprite.height, `habitat sprite '${h.spriteId}' height must be 48`).toBe(48);
      expect(
        sprite.frames.length,
        `habitat sprite '${h.spriteId}' should have >= 2 frames`,
      ).toBeGreaterThanOrEqual(2);
      // Every habitat owns a direct multi-color palette of 8..15 hexes.
      expect(h.palette, `habitat '${h.id}' must declare a palette`).toBeDefined();
      const pal = h.palette ?? [];
      expect(pal.length, `habitat '${h.id}' palette must have >= 8 hexes`).toBeGreaterThanOrEqual(
        8,
      );
      expect(pal.length, `habitat '${h.id}' palette must have <= 15 hexes`).toBeLessThanOrEqual(15);
      for (const hex of pal) {
        expect(
          hexRe.test(hex),
          `habitat '${h.id}' palette entry '${hex}' must be a #rrggbb hex`,
        ).toBe(true);
      }
    }
  });

  it('trinket sprites are exactly 20x20', () => {
    const trinketSpriteIds = new Set(contentPackV1.trinkets.map((t) => t.spriteId));
    const spriteMap = new Map(contentPackV1.sprites.map((s) => [s.id, s]));
    for (const id of trinketSpriteIds) {
      const sprite = spriteMap.get(id);
      expect(sprite, `trinket sprite '${id}' not found`).toBeDefined();
      if (!sprite) continue;
      expect(sprite.width, `trinket sprite '${id}' width must be 20`).toBe(20);
      expect(sprite.height, `trinket sprite '${id}' height must be 20`).toBe(20);
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
