/**
 * Small read-only lookups over a ContentPack used by the renderer. Pure
 * helpers; no side effects.
 */

import type { ContentPack, House, SpeciesDef, SpriteDef } from '@token-tamers/core';
import { hexToRgb, type Rgb } from '../terminal/ansi';

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

/** Find a habitat definition, or undefined. */
export function findHabitat(pack: ContentPack, habitatId: string) {
  return pack.habitats.find((h) => h.id === habitatId);
}

/**
 * The CANONICAL per-House color map — the single source of truth for House
 * identity color everywhere in the UI (Diet bar, stats accent, pet sprite
 * palette, Dex dot). Houses are identity/cosmetics ONLY (invariant #3): these
 * colors never touch stats/grades, and they are a NEUTRAL categorical palette —
 * five equal-weight hues so no House looks superior to another. They are kept
 * DISJOINT from the grade rarity ladder (`GRADE_ACCENT`: C grey · B green ·
 * A violet · S gold), which alone signals value — no House borrows gold/violet.
 */
export const HOUSE_ACCENT: Record<House, string> = {
  aether: '#38bdf8', // ethereal / mind — sky cyan
  cipher: '#f87171', // glyph / geometry — red
  flux: '#f472b6', // light / current — rose magenta
  forge: '#ff8c42', // metal / ember — bright orange (legible on the dark theme)
  wild: '#5ec962', // The Bloom (plants/feral) + the home of unmapped genes — verdant green
};

/** House identity color as a hex string (for `buildPalette`). */
export function houseTint(house: House): string {
  return HOUSE_ACCENT[house];
}

/** House identity color as RGB (for direct buffer tinting). */
export function houseColor(house: House): Rgb {
  return hexToRgb(HOUSE_ACCENT[house]);
}

/**
 * The Tamer maker's-mark to show for a combatant: its OWN decoded owner (from a
 * pasted code), else the viewer's own handle (`fbName`/`fbTitle`, for your pet or
 * Dex record). Returns '' when there is no handle to show.
 */
export function ownerLabel(
  c: { owner?: string; ownerTitle?: string },
  fbName: string,
  fbTitle: string,
): string {
  const name = c.owner ?? fbName;
  const title = c.owner ? (c.ownerTitle ?? '') : fbTitle;
  if (!name) return '';
  return title ? `${name} · ${title}` : name;
}
