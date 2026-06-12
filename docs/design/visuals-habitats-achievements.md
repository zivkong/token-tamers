# Visual Design, Habitats & Trinkets, and Achievements

Derived from the Token Tamers v1.0.3 design baseline. Covers design §13 (Visual Design) and
§14 (Habitats & Trinkets, including the Achievements subsection).

---

## §13 Visual Design — lightweight, richly animated, grade-driven beauty (design baseline §13)

**Goal:** genuinely beautiful colorful pixel-art pets in the terminal, with grade determining
visual _richness_ (S = the most beautiful), at <1% CPU.

### Art direction: modern high-density monster sprites (design baseline §13)

- **Style target:** modern high-density monster-sprite production quality — high color density,
  rich shading, vibrant saturated palettes, expressive silhouettes. **Original creature designs
  only.** Every pet must pass a "clearly its own monster" check; no resemblance to existing
  franchise creatures, poses, or signature palettes.
- **Sprite resolution upgraded:** 48×48 to 64×64 pixels per pet (Apex/fusion forms at 64×64).
  Via half-blocks that's a 64×32-cell render — still tiny text.
- **Density techniques:**
  - Quadrant blocks (`▘▝▖▗▚▞`) where sub-cell shaping helps silhouettes
  - Ordered dithering for smooth shading ramps
  - 1px dark outlines with selective anti-alias pixels for the "modern sprite" crispness
  - Rim-light pixels on the silhouette edge (the signature modern-sprite pop), budgeted by
    grade (S gets animated rim light)
- **Shading depth per grade** rides the beauty ladder below — C is flat-shaded, S gets full
  ramp shading + specular highlights.

### Rendering technique (design baseline §13)

- **Half-block pixel rendering:** sprites drawn with `▀` cells — fg color = top pixel, bg color
  = bottom pixel → 2 vertical pixels per cell. A 32×32-pixel pet fits 32×16 cells and reads as
  true colorful pixel art (chafa-style). Braille chars layer fine details (whiskers, sparkles).
- **Palette indirection:** sprite assets store palette _indices_, never RGB. Grade + House
  select the LUT at render time → one asset, many beauty levels.

  > Now implemented as: `packages/tui` (half-block compositor, LUT hot-swap) and
  > `packages/content` (palette-indexed sprite JSON format).

### Grade beauty ladder (design baseline §13)

Richness, not just hue. House tint = base hue family of the body; grade = color depth + motion
budget.

| Grade | Name    | Base accent | Visual budget                                                                                                                                                                               |
| ----- | ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C     | Slate   | `#8b8b8b`   | Flat 4-color palette, 2-frame idle. Charming, plain.                                                                                                                                        |
| B     | Verdant | `#4ade80`   | 8-color palette, 1 highlight tone, 3-frame idle + blink.                                                                                                                                    |
| A     | Violet  | `#a78bfa`   | 16-color palette, static dithered gradient shading, occasional sparkle glint.                                                                                                               |
| S     | Aurum   | `#fbbf24`   | Full 24-bit gradient ramps; animated shimmer sweep (gold→amber→white traveling highlight); **particle aura** (drifting `✦ · ˚` sparkles); breathing outline glow. Visibly alive & luminous. |

### Mid-life Gradeshift LUT hot-swap (design baseline §13)

**Grades change mid-life (§12):** the renderer hot-swaps the grade LUT on a Gradeshift — the
same sprite asset instantly re-renders richer, with a burst cutscene (flash + falling sparkles)
marking the upgrade. This is the mid-week jackpot moment worth screenshotting.

### Mutation, fusion, and S-spliced cosmetics (design baseline §13)

- Mutations hue-shift the palette.
- Fusion specials apply a two-tone split per parent.
- S-spliced = gold outline.

### Badges (design baseline §13)

Badges are always shown alongside the pet:

- `[S]★` — S grade
- `[A]◆` — A grade
- `[B]●` — B grade
- `[C]○` — C grade

### Degradation ladder (design baseline §13)

Beauty scales down; information never disappears:

1. Truecolor
2. 256-color quantized
3. 8-color + badges
4. Pure ASCII (`--no-color`)

### Lightweight by architecture (design baseline §13)

- **Diff renderer:** front/back buffers; emit ANSI only for changed cells. Idle pet redraws
  ~30 cells/frame, never the screen.
- **Precomputed LUTs:** color ramps, shimmer frames, dither patterns baked at load — zero
  per-frame color math or allocation.
- **Layered compositing:** base sprite / aura+particles / UI chrome — only dirty layers
  re-composite.

  > Now implemented as: `packages/tui` (diff renderer, LUT system, layered compositor).

### 30fps slim-first + adaptive down / opt-in 60 (design baseline §13)

- **30fps default, slim-first:** fixed-timestep render loop at **30fps default** — the sweet
  spot for terminal animation: smooth shimmer/particle motion at roughly half the output and
  wake-up cost of 60. The diff renderer still does the heavy lifting (only changed cells emit
  ANSI). Animation timing uses an accumulator, so motion stays even at any rate.
- **Adaptive down:** if the terminal emulator or SSH link can't drain output, coalesce to 15fps
  automatically — beauty degrades before correctness.
- **Idle scene rate:** idle scenes with little motion drop to an event-driven ~10fps.
- **Cutscene/battle rate:** cutscenes and battles run the full 30fps.
- **Opt-in 60:** a `render.fps: 60` config opt-in exists for users who want max smoothness
  and accept the cost — never the default.

### Slim guarantees with all budget numbers (design baseline §13)

- Per-frame budget: **~2ms**
- Frame-skip when: unfocused / `tt watch` background
- Daemon: never renders
- CPU target: **~1–2%** at 30fps foreground; **~0** with no viewer open

### Tiny assets (design baseline §13)

Palette-indexed pixel grids → a full species (all stages + frames) is a few KB of JSON; 100+
pet content packs stay light.

### Animation set (design baseline §13)

Sprite pack schema: `{species_id, stage, frames(palette-indexed grids), fps, anchors}`.

**Idle loops:**

- Per grade (accumulator timing as described above)
- Trait-flavored idles: e.g., Nightshade pets sleep in your daytime

**Cutscenes:**

- **Molt cutscene:** crack & re-form
- **Gradeshift cutscene:** burst cutscene — flash + falling sparkles marking the grade upgrade
- **Fusion cutscene:** parents slide in, overlap, white flash, two-tone reveal — the signature
  fusion cinematic

**Battle view:**

- Split-pane layout: HP bars, lunges, screen-shake, floating damage
- Pure playback of the resolved deterministic battle log

---

## §14 Habitats & Trinkets (design baseline §14)

Cosmetic depth layer in the spirit of classic virtual-pet devices: the pet lives in a
**Habitat** (background scene) decorated with **Trinkets** (toys/objects) the player selects.
Both are unlockable collections — and strictly cosmetic (pillar-safe: zero stat, grade, or
rarity influence).

### Habitats (backgrounds) (design baseline §14)

- Rendered as a palette-indexed layer _behind_ the pet in `tt`, `tt watch`, and battle view.
  Mostly static cells + a few animated ones (drifting clouds, flickering terminal glow, falling
  leaves, twinkling stars) — costs almost nothing under the diff renderer.

**Live-sync touches:**

- Day/night tint follows the player's real clock
- The weekly weather seed adds ambient effects (storm week = occasional rain cells)

**Grade aura interaction:**

- An S-rank's glow softly lights nearby background cells

**Starter set:**

- Terminal Den (default)
- Meadow
- Rooftop Night

**Unlock sources (achievement-driven, all model-neutral):**

- First pattern form earned → that pattern's themed habitat:
  - Vigil → Midnight Observatory
  - Tempest → Stormfront
  - Prism → Refractory
  - Chimera → The Crossroads
- House mastery (10 lifecycles dominant in a House) → House habitat:
  - Aether Spire
  - Cipher Vault
  - Flux Garden
  - Forge Hollow
- Lineage depth milestones (gen 5 / 10 / 25) → Ancestral Grove tiers
- First S-grade record → Gilded Sanctum
- Surviving a Dormant week → Cocoon Hollow (badge of honor, not shame)

### Trinkets (toys & objects) (design baseline §14)

- Small sprites placed at anchor slots in the habitat (2–3 slots).
- The pet's **idle animations interact with them**: bats the ball, naps on the cushion, stares
  into the lava lamp, waters the bonsai.
- **Trait-flavored:** Nightshade pets prefer the cushion at night; Sprinter pets chase the ball
  more.
- Purely cosmetic — trinkets influence _which idle animations play_, never stats.

**Unlock sources:**

- Trait milestones: e.g., earn Marathoner ×5 → Tiny Treadmill
- Molt-count lifetime milestones
- Weather-week participation
- First DNA export → Gift Box
- First fusion → Twin Orb
- Archive page completion → Trophy Shelf
- Seasonal weather weeks (limited-window unlocks, still re-earnable later — nothing is ever
  permanently missable)

### Selection & idle-friendliness (design baseline §14)

- `tt deco` — pick habitat + trinket slots
- `tt deco --auto` (default) — curates automatically from the pet's traits/House so pure-idle
  players still see variety without ever touching it

**Loadout storage:**

- Loadout stored in local config
- Battle view shows each side's own habitat behind their pet (flex layer)
- The rebirth hash carries a `habitat_id` flag so shared codes display in their home scene

### Content & versioning (design baseline §14)

- Data packs: `content/vN/habitats.json`, `trinkets.json` — same palette-indexed sprite format,
  same additive-only ID rules
- Unknown habitat IDs in a hash render as the default scene (graceful, version-agnostic)
- Unlock conditions are declarative data:
  ```json
  { "unlock": { "type": "pattern_first", "id": "vigil" } }
  ```
  So new collections ship without engine changes.

---

## §14 (cont.) Achievements — the completionist spine (design baseline §14)

Achievements are the formal layer that couples progression to the habitat & trinket collections
— every achievement grants something tangible.

### Registry format (design baseline §14)

- **File:** `content/vN/achievements.json`
- **Schema:** declarative `{id, name, condition, reward: {habitat|trinket|title|dex_flair}}`
- **Rules:** additive-only IDs like everything else
- **Evaluation:** locally by the daemon at molt/rebirth events
- No achievement ever requires network, purchases, or a specific model

  > Now implemented as: `packages/content` (content schema and pack validator).

### Achievement categories — v1 target ~120 achievements (design baseline §14)

**Lineage:**

- Generations reached
- Carry-over milestones
- Kaleido hatched (3× Prism ancestors lineage perk)

**Evolution:**

- Each stage reached
- Each House Apex
- Each hybrid line
- Each pattern variant earned

**Traits:**

- Earn each trait once
- Earn each trait ×10 lifetime
- Full trait sheet in one life

**Rhythm:**

- Disciplined / Burnout / Nocturne variants raised
- Dormancy survived

**Grades:**

- First B / A / S
- S in each House
  - (Grade gates these achievements — but the goal is the achievement, completing the page, not
    the grade itself)

**Social:**

- First DNA export / apply / merge
- Each DNA pool entered
- Progenitor counts
- Battles fought / won via exchanged codes

  > Note on fusion pool contents: pool contents are internal — see
  > `packages/content/content/v1/fusion-pools.json`. The DNA types (Vigil, Tempest, Prism,
  > Chimera) are public; the specific species within each pool are not.

**Collection meta:**

- Dex 25% / 50% / 75% / 100%
- Habitat set completion
- Trinket set completion

**Calendar:**

- Weather-week participation set (all re-earnable, never missable)

### Completion Meter (design baseline §14)

- **Command:** `tt complete`
- Shows the single number that defines the game: **overall % = weighted union of Dex,
  achievements, habitats, trinkets**
- Per-page breakdowns included
- The endgame is driving this to 100%
- The live Completion Meter is also displayed on the right edge of the bottom menu bar in the
  main TUI shell (e.g., `67.4%`)

  > Weighting formula: backlog item — see `docs/design/` and GitHub issues.

### Titles & flair (design baseline §14)

- Some achievements grant lineage **titles** (e.g., "Four-House Master")
- Some grant **Dex flair** (border styles)
- Both titles and flair ride along in shared hashes
