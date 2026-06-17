/**
 * Sub-cell density resolution: turn the `SubcellPreference` (settings.json) into a
 * concrete renderer mode.
 *
 * `octant`/`sextant`/`half` are returned as-is — an explicit opt-in for terminals
 * the player knows render those glyphs. `auto` resolves to the universally-safe
 * `half` (only the ancient block elements ▀ ▄ █, drawn by every terminal + font).
 *
 * Why no auto-detection of octant/sextant? A terminal advances the cursor by the
 * Unicode WIDTH TABLE, not by whether its font actually has the glyph. BLOCK OCTANT
 * (U+1CD00) is an assigned NARROW character, so it advances exactly one column on
 * EVERY terminal — the ones that draw the real octant AND the ones that draw a
 * width-1 "tofu" box (e.g. macOS Terminal.app, the macOS default). A cursor-position
 * probe therefore cannot tell "renders the octant" from "renders a box", and there
 * is no env-free capability query for font coverage (invariant: zero env config).
 * Rather than risk an unreadable tofu screen on the default terminal, `auto` stays
 * on the safe floor; players on octant-capable terminals (iTerm2, Ghostty, WezTerm,
 * Kitty, Alacritty, …) set `subcell` to `octant`/`sextant` explicitly.
 */

import type { SubcellPreference } from '@token-tamers/core';
import type { SubcellName } from '@token-tamers/tui';

/**
 * Resolve the preference to a concrete renderer mode. An explicit
 * `octant`/`sextant`/`half` is returned unchanged; `auto` resolves to `half`, the
 * one mode every terminal can render (see the module comment for why richer modes
 * can't be safely auto-detected).
 */
export function resolveSubcellMode(pref: SubcellPreference): SubcellName {
  return pref === 'octant' || pref === 'sextant' || pref === 'half' ? pref : 'half';
}
