---
name: create-sprites
description: Art direction and asset format for Token Tamers sprites — palette-indexed grids, sub-cell (sextant/octant) rendering, grade beauty ladder, per-species accent, density techniques, originality rules. Use when creating or editing any pet, habitat, or trinket sprite.
---

# Create sprites

Source of truth: `docs/design/visuals-habitats-achievements.md`. Goal: genuinely beautiful colorful
pixel-art pets in the terminal, with grade determining visual _richness_, at <1% CPU.

## Asset format (non-negotiable)

- Palette-indexed integer grids (`SpriteDef`): `frames[frame][row][col]` = palette
  index, `0` = transparent. **Assets NEVER store RGB** — House tint + grade LUT
  resolve color at render time (palette indirection: one asset, many beauty levels).
- **Size law (octant art direction v2, 2026-06-16 — SUPERSEDES the 2026-06-15 12–32px ramp).**
  Authored for **octant (2×4) rendering**. Species sprites are **exactly square**, even, with
  **height divisible by 4** (clean octant packing), on a uniform +4 ramp by stage:

  | Stage | egg | sprite | rookie | evolved | prime | apex |
  | ----- | --- | ------ | ------ | ------- | ----- | ---- |
  | px    | 16  | 20     | 24     | 28      | 32    | 36   |

  Habitats are **128×96 (4:3)**, trinkets **28×28**. These are exact, enforced by the
  content-pack test — not a range. Apex 36px is the renderer's safe ceiling (under octant an
  apex is `36/2 × 36/4` = 18×9 cells — SMALLER on screen than the old 32px half-block apex, yet
  more detailed; target species ≈ ¼ the habitat width). Do not exceed it.

- **Per-species accent (v2):** each species declares a secondary `accent` hex (cosmetic;
  NEVER affects stats/grades/speed). Paint its signature feature with **indices 16/17/18**
  (`ACCENT_LO/MID/HI`, dark→light) at ~10–20% of pixels; optional cream belly = **index 20**
  (`BELLY`). The House hue still dominates (~70–85%, indices 2..14). Paint accent AFTER `shade`
  (or `shade({ onlyBelow: RIM_HI })`) so it survives the body re-index.

- **Animation banks (required for every species):** besides the idle `frames`, every
  species ships `walk`, `jump`, and `play` banks (`SpriteDef.walk/jump/play`), each with
  the **same dims** as `frames`. Author them as small deltas of the idle base with
  `framesFromDeltas` (see `sprite-lib`): walk = side-stride (faces RIGHT; the renderer
  flips for left), jump = crouch→air-stretch, play = reach/bounce toward the toy.
- **Habitat palettes:** a habitat may declare a direct multi-color `palette` of 8–15
  hexes in `habitats.json`. The renderer maps index 1 → palette[0], 2 → palette[1], …
  (index 0 transparent) with **no grade ladder and no dimming** — the scene owns its
  colors. Build with `paletteFromHexes`.
- Sprite packs: `{species_id, stage, frames, fps, anchors}`; a full species (all
  stages + frames) should stay a few KB of JSON.

## Art direction: modern high-density monster sprites

- High color density, rich shading, vibrant saturated palettes, expressive
  silhouettes readable at tiny sizes.
- **Originality (hard rule):** every pet must pass a "clearly its own monster"
  check — no resemblance to existing franchise creatures, poses, or signature
  palettes.
- **Tone, not gradient (size law tone rule).** At 12–32px ordered-dither gradients
  read as noise. Author **flat tones**: a small fixed vocabulary — `outline=1`,
  `shadow≈3`, `body≈7`, `light≈11`, `rim=13` (`RIM_LO`), `glint=15` — with at most a
  2–3px dither seam where two tones meet. Depth comes from a clean silhouette plus a few
  well-placed light/shadow/rim pixels, not from ramps. The ≥6-distinct-non-zero-indices
  complexity floor still holds (flat _tones_, not flat _color_) — and beware: rim/glint
  pixels placed early can be clobbered by later fins/whiskers/decals, dropping you below
  the floor; place the surviving rim pixels last (before `outline`).
- Density techniques: quadrant blocks (`▘▝▖▗▚▞`) for sub-cell silhouette shaping; 1px
  dark outline with selective anti-alias pixels; rim-light pixels on the silhouette edge
  (the signature pop) — budgeted by grade (S gets animated rim light). Reserve heavier
  ordered-dither ramps for the larger habitats, not the tiny pets.
- **House = Creature Kingdom (body-plan, not just color).** Each House's species are a
  concrete creature family; design the silhouette so the kingdom reads at 16px before color
  resolves. Aether = **Sky Court** (flying — floats, wing-planes, single halo-eye, veil-trails,
  WIS) · Cipher = **Crag Beasts** (ground predators — heavy planted stance, faceted carapace,
  glyph-seam glints, blade/horn/claw, PWR) · Flux = **Tide Runners** (aquatic/swift — horizontal
  teardrop, fins, current-ribbons, SPD) · Forge = **Iron Brood** (robots/constructs — boxy
  riveted plating, ember-vent glints, GRT) · Wild = **The Bloom** (plants/feral — asymmetric,
  bloom-crown, root-tendrils). Carry the lineage motif (eye shape, core/halo position, signature
  feature) unchanged in _kind_ across a line, growing only in count/size. Full bible:
  `docs/design/visuals-habitats-achievements.md` §13 → _Species identity system_.

## Grade beauty ladder (richness budget, applied by the renderer)

| Grade | Name    | Accent    | Visual budget                                                                                 |
| ----- | ------- | --------- | --------------------------------------------------------------------------------------------- |
| C     | Slate   | `#8b8b8b` | Flat 4-color palette, 2-frame idle. Charming, plain.                                          |
| B     | Verdant | `#4ade80` | 8-color palette, 1 highlight tone, 3-frame idle + blink.                                      |
| A     | Violet  | `#a78bfa` | 16-color palette, static dithered gradient shading, occasional sparkle glint.                 |
| S     | Aurum   | `#fbbf24` | Full 24-bit ramps; shimmer sweep (gold→amber→white); particle aura (`✦ · ˚`); breathing glow. |

- House tint = base hue family of the body; grade = color depth + motion budget.
- Gradeshift hot-swaps the LUT live (flash + falling sparkles cutscene).
- Mutations hue-shift; fusion specials two-tone split per parent; S-spliced = gold
  outline. Badges always shown: `[S]★ [A]◆ [B]● [C]○`.
- Degradation ladder: truecolor → 256-color → 8-color + badges → pure ASCII
  (`--no-color`). Beauty scales down; information never disappears.

## Animation set

- Idle loops per grade (accumulator timing, frame counts within the grade budget);
  trait-flavored idles (Nightshade sleeps in your daytime); trinket interactions
  (bats the ball, naps on cushion). Molt cutscene = crack & re-form; fusion = parents
  slide in, overlap, white flash, two-tone reveal. Battle view: HP bars, lunges,
  screen-shake, floating damage — pure playback.
- Habitats: mostly static cells + a few animated (drifting clouds, flickering glow,
  twinkling stars) — near-free under the diff renderer. Day/night tint follows the
  real clock; weekly weather seed adds ambient effects.

Rendering implementation rules live in the **develop-tui-renderer** skill.
