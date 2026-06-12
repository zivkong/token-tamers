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
// Sprite data integrity
// ---------------------------------------------------------------------------

describe('sprite data integrity', () => {
  it('every pet sprite has at least 2 idle frames', () => {
    const petIds = new Set(contentPackV1.species.map((s) => s.spriteId));
    for (const sprite of contentPackV1.sprites) {
      if (petIds.has(sprite.id)) {
        expect(
          sprite.frames.length,
          `pet sprite '${sprite.id}' should have >= 2 frames`,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('every pet sprite is at least 24x24', () => {
    const petIds = new Set(contentPackV1.species.map((s) => s.spriteId));
    for (const sprite of contentPackV1.sprites) {
      if (petIds.has(sprite.id)) {
        expect(sprite.width, `sprite '${sprite.id}' width`).toBeGreaterThanOrEqual(24);
        expect(sprite.height, `sprite '${sprite.id}' height`).toBeGreaterThanOrEqual(24);
      }
    }
  });

  it('all palette indices are 0–7 (transparent=0, outline=1, body=2–7)', () => {
    for (const sprite of contentPackV1.sprites) {
      for (const frame of sprite.frames) {
        for (const row of frame) {
          for (const idx of row) {
            expect(
              idx,
              `sprite '${sprite.id}' has out-of-range index ${idx}`,
            ).toBeGreaterThanOrEqual(0);
            expect(idx, `sprite '${sprite.id}' has out-of-range index ${idx}`).toBeLessThanOrEqual(
              7,
            );
          }
        }
      }
    }
  });
});
