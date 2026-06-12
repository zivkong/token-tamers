---
name: sprite-design
description: Art-direction rules for Token Tamers pet/habitat/trinket sprites — palette-indexed grids, grade beauty ladder, originality requirements. Use when creating or editing any sprite asset.
---

# Sprite design rules

- **Format:** palette-indexed integer grids in content JSON (`SpriteDef`):
  `frames[frame][row][col]` = palette index, `0` = transparent. NEVER store RGB in
  assets — House tint + grade LUT resolve color at render time (palette indirection).
- **Size:** pets target 48×48–64×64 px (MVP placeholders may be ≥24×24, flagged with a
  `// TODO art pass`); rendered via half-blocks (`▀`) = 2 vertical px per cell.
- **Grade beauty ladder** (richness budget, applied by the renderer, not the asset):
  C Slate = flat 4-color, 2-frame idle · B Verdant = 8-color + blink ·
  A Violet = 16-color + dithered shading + sparkle · S Aurum = full ramps, shimmer
  sweep, particle aura, breathing glow.
- **Style:** modern high-density monster sprite — 1px dark outline, rim-light pixels on
  the silhouette, expressive readable silhouette at tiny sizes.
- **Originality (hard rule):** every pet must pass a "clearly its own monster" check.
  No resemblance to existing franchise creatures, poses, or signature palettes.
- Idle loops use accumulator timing; keep frame counts within the grade's budget.
- Habitats: mostly static cells, a few animated; trinkets: small sprites at habitat
  anchor slots.
