/**
 * Small read-only lookups over a ContentPack used by the renderer. Pure
 * helpers; no side effects.
 */

import type { ContentPack, House, SpeciesDef, SpriteDef } from '@token-tamers/core';

/** Find a species by id, or undefined. */
export function findSpecies(pack: ContentPack, id: string): SpeciesDef | undefined {
  return pack.species.find((s) => s.id === id);
}

/** Find a sprite by id, or undefined. */
export function findSprite(pack: ContentPack, id: string): SpriteDef | undefined {
  return pack.sprites.find((s) => s.id === id);
}

/** Find a habitat's backdrop sprite id, or undefined. */
export function habitatSpriteId(pack: ContentPack, habitatId: string): string | undefined {
  return pack.habitats.find((h) => h.id === habitatId)?.spriteId;
}

/**
 * Resolve a House tint for a species. The pack's ModelRule carries tints keyed
 * by gene; a species only knows its House, so we pick the first model rule for
 * that House as the representative tint, falling back to a per-house default.
 */
export function houseTint(pack: ContentPack, house: House): string {
  const rule = pack.models.find((m) => m.house === house);
  if (rule) return rule.tint;
  return DEFAULT_HOUSE_TINT[house];
}

const DEFAULT_HOUSE_TINT: Record<House, string> = {
  aether: '#8a7cff',
  cipher: '#3fd0c9',
  flux: '#ff6fae',
  forge: '#ff9645',
  wild: '#6fcf6f',
};
