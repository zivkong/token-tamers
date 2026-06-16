/**
 * UI chrome tiles — NOT creature content. These are the square "?" icons the Dex
 * constellation shows in its focus rail for an undiscovered star: a plain slate
 * tile for a locked species and an ornate gold tile for a reserved "legend" slot
 * (dormant in Season 0 — no obtainable species is special yet).
 *
 * They live in `tui` (not the content pack) on purpose: they're renderer chrome,
 * not species/habitat/trinket art, so they sit outside the content size-law test
 * and the import boundary. They reuse the same half-block `drawSprite` pipeline as
 * real sprites (palette-indexed grid + a palette), so they composite and
 * golden-test identically — only the palette is custom (no grade beauty ladder).
 */

import type { SpriteDef } from '@token-tamers/core';
import { paletteFromHexes, type Palette } from './sprite';

// A 16×16 "?" glyph. Index 0 transparent · 1 outline · 2 body · 3 rim highlight.
// prettier-ignore
const QMARK_FRAME: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0],
  [0, 0, 1, 2, 2, 2, 3, 3, 2, 2, 2, 1, 0, 0, 0, 0],
  [0, 0, 1, 2, 1, 1, 0, 2, 2, 2, 2, 1, 0, 0, 0, 0],
  [0, 0, 1, 1, 0, 0, 0, 1, 2, 2, 2, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 2, 2, 2, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 2, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
];

/** The shared "?" tile sprite (one static frame; the palette carries the mood). */
export const QMARK_TILE: SpriteDef = {
  id: 'ui-qmark-tile',
  width: 16,
  height: 16,
  frames: [QMARK_FRAME],
  fps: 1,
};

/** Plain undiscovered species — slate, no glow. */
export const LOCKED_PALETTE: Palette = paletteFromHexes(['#3a3f52', '#5b6076', '#878ca6']);

/**
 * Reserved "legend" slot — gold. A traveling highlight makes it visibly shimmer
 * (deterministic in `frame`, so golden frames stay stable). Pairs with the gold
 * aura glyphs the focus rail scatters around it.
 */
export function legendPalette(frame: number): Palette {
  // Phase the rim toward white so the "?" catches light over time.
  const lit = (frame >> 1) % 2 === 0;
  return paletteFromHexes(['#8a6a16', '#e0a92a', lit ? '#fff1c2' : '#ffd76e']);
}
