# Visual Design, Habitats & Trinkets, and Achievements

Derived from the Token Tamers v1.0.3 design baseline. Covers design §13 (Visual Design) and
§14 (Habitats & Trinkets, including the Achievements subsection).

---

## Decision records

### 2026-06-16 — Octant art direction v2 (cute→majestic, higher density, 4:3 habitats, per-species accent)

**Owner direction (2026-06-16):** players found the half-block sprites too chunky to shrink
without distortion, too similar within a House, under-detailed, NOT CUTE, and too big vs the
habitat. This entry SUPERSEDES the 2026-06-15 size law below.

1. **Octant rendering baseline.** The target sub-cell glyph is the **octant (2×4)** — 8
   sub-pixels per terminal cell (4× the half-block's 1×2), square in a ~1:2 cell, 2 colors per
   cell. Degradation ladder **octant → sextant (2×3) → half-block (1×2) → ASCII**; assets are
   authored ONCE at octant resolution and lower rungs are strict downsamples. (Implementation:
   true octant is LIVE — `render/octant-table.ts` (the verified Unicode 16 256-glyph map) is the
   default; the mode is chosen per session via the `subcell` setting / a cursor-width terminal
   probe — `setSubcellMode`, `apps/cli/.../subcell.ts` — stepping down to sextant/half as needed.)
2. **New size law (octant source px — square, even, height ÷ 4):** egg 16 · sprite 20 · rookie
   24 · evolved 28 · prime 32 · **apex 36** (the new safe ceiling). On-screen footprint =
   `cols = px/2`, `rows = px/4` under octant — so the apex is SMALLER on screen than the old
   32px half-block apex yet carries ~2.25× the source detail.
3. **Habitats 128×96 (4:3)** (was 96×48, 2:1) · **trinkets 28×28** (was 20×20). The taller 4:3
   scene gives real sky/ground so the pet reads as a creature in a world; target species ≈ ¼ of
   the habitat width.
4. **Cute → majestic arc:** the small stages are adorable (head ≈ body, big catch-lit eyes
   ~45–55% of head, blush, stubby nub limbs) and sharpen monotonically to a majestic boss at
   apex (small head on a tall body, crown/wings/plates/core). **Distinct → converge:**
   sprite/rookie get varied per-species silhouettes (fixes "too similar"); prime/apex converge on
   the House archetype.
5. **Per-species signature accent color:** each species declares a SECONDARY `accent` hex
   (cosmetic, invariant-3 safe — never touches stats/grades/speed) resolving the sprite's accent
   band (palette indices **16/17/18**, ~10–20% of pixels) over the House-hue-dominant body
   (~70–85%, indices 2..14); index **20** is a cream belly. House still reads at a glance; the
   grade beauty ladder (C flat → S gold-glow) applies on top.

### 2026-06-15 — Species Identity System (Creature Kingdoms) + higher-resolution size law

**Owner direction (2026-06-15):** species must read as **actual creatures with their own
identity**, not abstract blobs — each themed by a real archetype (flying animal, ground beast,
plant, robot, …) and recognizable across its whole evolution line. Two changes land together:

1. **Houses become Creature Kingdoms.** Each House's existing theme + stat lean resolves into a
   concrete creature kingdom (body-plan family + silhouette grammar + locomotion + a signature
   motif). House remains **identity/cosmetics ONLY** (invariant 3 unchanged) — the kingdom is a
   _visual_ resolution of the House's theme, never a mechanic. The mapping:

   | House  | Kingdom          | Archetype           | Theme (was)      | Stat lean |
   | ------ | ---------------- | ------------------- | ---------------- | --------- |
   | Aether | **Sky Court**    | flying animals      | ethereal / mind  | WIS       |
   | Cipher | **Crag Beasts**  | ground predators    | glyph / geometry | PWR       |
   | Flux   | **Tide Runners** | aquatic / swift     | light / current  | SPD       |
   | Forge  | **Iron Brood**   | robots / constructs | metal / ember    | GRT       |
   | Wild   | **The Bloom**    | plants / feral      | `???` dormant    | neutral   |

2. **Higher-resolution size law (SUPERSEDES the 2026-06-13 10–20px ramp).** More identity needs
   more pixels. Species sprites stay **exactly square**, sized by stage on a uniform +4 ramp that
   ends at the renderer's safe maximum (apex 32px ≈ 16 half-block cell-rows, comfortably inside
   the 96×48 habitat scene):

   | Stage   | NEW size (square px) | Half-block cell render | (was) |
   | ------- | -------------------- | ---------------------- | ----- |
   | egg     | 12 × 12              | 12 × 6                 | 10    |
   | sprite  | 16 × 16              | 16 × 8                 | 12    |
   | rookie  | 20 × 20              | 20 × 10                | 14    |
   | evolved | 24 × 24              | 24 × 12                | 16    |
   | prime   | 28 × 28              | 28 × 14                | 18    |
   | apex    | 32 × 32              | 32 × 16                | 20    |
   - **Square, exact, even.** The content-pack test enforces these exact sizes (hard law). All
     even → clean half-block pairs. **Habitats stay 96 × 48; trinkets are raised to 20 × 20**
     (the whole game goes high-res together — see the trinket note in §14).
   - **32px is the renderer's safe ceiling** — at the golden 100×30 terminal an apex sits ~1/3
     the habitat width with floor clearance; do not exceed it.
   - The **flat-tone rule still holds** at these sizes (tones, not dither ramps) — but the extra
     pixels buy a clearer silhouette, real limbs/wings/plates, and a readable signature motif.

The full creature bible (per-kingdom body plans, the 5-layer identity stack, lineage-continuity
rules, branch→form divergence) lives in **§13 → Species identity system (Creature Kingdoms)**
below. It is the source of truth for every current and future species sprite. The 2026-06-13
record is retained for history but its size ramp is superseded by the table above.

### 2026-06-13 — Small, high-density characters (~1/3 size); SUPERSEDES the 48–64px sizing

**Owner direction (2026-06-13):** pets are **small, high-density characters at roughly one
third** of the previously-specified 48–64px footprint. The old "48×48 → 64×64, Apex/fusion at
64×64" rule below (§13) is **superseded** by an exact per-stage square size law:

| Stage   | Species size (square px) | Half-block cell render |
| ------- | ------------------------ | ---------------------- |
| egg     | 10 × 10                  | 10 × 5                 |
| sprite  | 12 × 12                  | 12 × 6                 |
| rookie  | 14 × 14                  | 14 × 7                 |
| evolved | 16 × 16                  | 16 × 8                 |
| prime   | 18 × 18                  | 18 × 9                 |
| apex    | 20 × 20                  | 20 × 10                |

- **Square and exact:** every species sprite is exactly its stage's size (no range). The
  content-pack test enforces this; it is a hard law, not a guideline. **(Sizes superseded
  2026-06-15 — see the record above; the "square/exact/even, test-enforced" principle still
  holds, only the per-stage px values changed to 12/16/20/24/28/32.)**
- **Habitats stay 96 × 48** and **trinkets stay 12 × 12** (unchanged). **(Trinkets later
  raised to 20 × 20 on 2026-06-15 so the whole asset set is high-res; habitats unchanged.)**
- **Tone over gradient.** At these sizes ordered-dither gradients read as noise. Author **flat
  tones** — a small fixed vocabulary (outline 1, shadow ~3, body ~7, light ~11, rim 13, glint 15) with at most a 2–3px dither seam where two tones meet. Depth comes from a clean
  silhouette + a few well-placed light/shadow/rim pixels, not from ramps. (The ≥6 distinct
  non-zero indices complexity floor still holds — flat tones, not flat color.)
- **Every species ships all four animation banks** (idle / walk / jump / play), authored as
  small deltas of the idle base; each bank shares the idle frames' exact dims. See §13
  Animation set and the `create-sprites` skill.
- **Habitats own their colors** via a direct multi-color `palette` (8–15 hexes) mapped index
  1 → palette[0] (index 0 transparent) — no grade ladder, no dimming.

The prose in §13 below is retained for context but **defers to this record** wherever the two
disagree on sizing.

---

## §13 Visual Design — lightweight, richly animated, grade-driven beauty (design baseline §13)

**Goal:** genuinely beautiful colorful pixel-art pets in the terminal, with grade determining
visual _richness_ (S = the most beautiful), at <1% CPU.

### Art direction: modern high-density monster sprites (design baseline §13)

- **Style target:** modern high-density monster-sprite production quality — high color density,
  rich shading, vibrant saturated palettes, expressive silhouettes. **Original creature designs
  only.** Every pet must pass a "clearly its own monster" check; no resemblance to existing
  franchise creatures, poses, or signature palettes.
- **Sprite resolution (SUPERSEDED twice — see the decision records above):** ~~48×48 to
  64×64~~ → ~~egg 10 … apex 20~~ → now an exact per-stage square law: **egg 12, sprite 16,
  rookie 20, evolved 24, prime 28, apex 32** (square px, even, +4 ramp). High-density
  characters with enough room for a real creature silhouette + signature motif.
- **Density techniques:**
  - Quadrant blocks (`▘▝▖▗▚▞`) where sub-cell shaping helps silhouettes
  - Ordered dithering for smooth shading ramps
  - 1px dark outlines with selective anti-alias pixels for the "modern sprite" crispness
  - Rim-light pixels on the silhouette edge (the signature modern-sprite pop), budgeted by
    grade (S gets animated rim light)
- **Shading depth per grade** rides the beauty ladder below — C is flat-shaded, S gets full
  ramp shading + specular highlights.

### Species identity system — Creature Kingdoms (owner direction 2026-06-15)

Species are **creatures with a real identity**, not abstract blobs. Identity is built from a
**5-layer stack**, each layer owned by a different part of the system so the layers stay
orthogonal — and crucially, **none of layers 1–4 touch game logic** (House/grade/evolution are
unchanged; this is pure presentation):

| Layer          | Owned by           | Decides                                                           |
| -------------- | ------------------ | ----------------------------------------------------------------- |
| 1. **Kingdom** | House              | Body-plan family, silhouette grammar, locomotion, signature motif |
| 2. **Order**   | Branch             | Sub-archetype within the kingdom (predator vs grazer, etc.)       |
| 3. **Growth**  | Stage              | Silhouette complexity arc egg→apex, keeping lineage cues          |
| 4. **Motif**   | Species            | The _one_ memorable individual hook                               |
| 5. **Finish**  | House tint + Grade | Body hue + richness/shimmer (palette indirection, unchanged)      |

The headline: **House isn't just a color, it's a body plan.** A player should identify a
creature's kingdom from silhouette alone, at 16px, before color even resolves.

#### Layer 1 — the five Kingdoms (body-plan bible)

Each kingdom resolves a House's established theme + stat lean into a concrete creature family.
A sprite's `house` field already selects the tint; the kingdom selects the **shape**.

- **🌤 Sky Court — Aether** (cyan, WIS, ethereal/mind). _Flying animals._ Archetypes: moth-sages,
  sky-mantas, owl-oracles, cloud-jellies, astral herons. **Body plan:** never touches the
  ground — floats; vertical teardrop or winged-cross silhouette; light/veil trails below.
  **Signature motif:** a single luminous **eye/halo** (wisdom) + **wing-sheets** that multiply
  with stage (2 → 4 → 6 wing-planes). **Locomotion:** idle = hover-bob; walk = drift-glide (no
  legs); jump = updraft rise; play = circle-swoop.
- **⛰ Crag Beasts — Cipher** (red, PWR, angular/glyph). _Ground predators._ Archetypes: crystal
  raptors, beetle-knights, mantis-blades, glyph-rams. **Body plan:** heavy, low, planted —
  quadruped or coiled-predator stance; faceted/angular carapace; wide base. **Signature motif:**
  **glyph-etched plates** glowing along the seams (glint slot) + a **blade/horn/claw** that
  sharpens each stage. **Locomotion:** idle = breathing crouch; walk = stomp-stride; jump =
  pounce coil; play = head-butt lunge.
- **🌊 Tide Runners — Flux** (magenta, SPD, light/current). _Aquatic / swift._ Archetypes:
  dart-eels, current-rays, lightning-serpents, hummer-jellies. **Body plan:** streamlined
  **horizontal teardrop**, fins/ribbons trailing back, always reads "mid-motion." **Signature
  motif:** **current-ribbons** off the tail + a **swept fin-crest** that grows more back-swept
  (faster-looking) each stage. **Locomotion:** idle = fin-flutter; walk = darting skim; jump =
  arcing leap; play = zig-zag chase.
- **🔥 Iron Brood — Forge** (orange, GRT, metal/ember). _Robots / constructs._ Archetypes:
  ember-core golems, furnace-beetles, anvil-crabs, automaton-bears. **Body plan:** boxy,
  riveted, symmetrical, rooted heavy stance; plated armor with visible seams. **Signature
  motif:** glowing **ember-vents** in the seams (the pulsing core, glint slot) + **bolt/rivet
  studs** that increase with stage. **Locomotion:** idle = ember-pulse / vent-flicker; walk =
  heavy clank-step; jump = piston-launch; play = ground-pound.
- **🌱 The Bloom — Wild** (verdant green `#5ec962`, neutral/balanced budget). _Plants / feral
  nature._ Archetypes: moss-stags, bloom-sprites, thorn-coils, fungal-owls. **Body plan:**
  asymmetric, organic, sprouting; rooted base of tendrils + a soft bulb body with a gentle face.
  **Signature motif:** a **bloom-crown** of petals/leaves (or thorns, or a mushroom cap) that
  opens wider as it matures + **root-tendrils** for a base + drifting pollen glints. SHIPPED as
  the real 5th house — the feral home for unmapped model families (an unmapped model grows a
  Bloom rather than a blank silhouette; the dormant-gene "awakening" into a mapped House still
  applies). The shared **Mote** egg lives here as the neutral, pre-House orb.

> **Invariant guard:** the kingdom is cosmetic shape only. The maker→House grouping, the
> kingdom→House mapping, and the creature archetypes never affect stats, grades, rarity, or
> speed (invariant 3). Kingdoms are re-balanceable content art, not frozen registry data.

#### Layer 2 — Order: branches become physical divergence

A branch fork should make the two siblings look like **different species of the same kingdom**,
not recolors. Map each branch axis to a body divergence:

- **Rhythm (sprite→rookie):** steady → bulkier, more plates/mass; bursty → leaner, more
  spikes/edges, swept-back.
- **Trait class (rookie→evolved):** endurance → thicker base & shell; tempo → more limbs/fins
  (motion); breadth → more eyes / wider crown / extra appendages.
- **Consistency (evolved→prime):** high → symmetric, crowned, regal; mid → balanced;
  low → asymmetric, jagged, feral.
- **Arc (prime→apex):** early → radiant/open form; late → dense/crystallized form.

#### Layer 3 — Growth: the silhouette arc & feature budget

Each stage gets a fixed feature budget (driven by the size law) so growth reads as a real
creature maturing while the lineage motif persists:

| Stage   | px  | Feature budget                           | Reads as               |
| ------- | --- | ---------------------------------------- | ---------------------- |
| egg     | 12  | body + 1 hint pixel of the future motif  | a cracked-open promise |
| sprite  | 16  | body + 1 signature feature               | a hatchling            |
| rookie  | 20  | + stance + 2nd feature                   | a juvenile             |
| evolved | 24  | + branch divergence becomes visible      | an adult               |
| prime   | 28  | + crown / elaboration                    | an elder               |
| apex    | 32  | full motif, max planes/vents/wings/limbs | a legend               |

**Lineage-continuity rule (the recognition test):** the _eye shape_, the _core/vent/halo
position_, and the _signature feature_ carry through every stage of a line unchanged in **kind**,
growing only in **count/size**. A player should look at the apex and say "that's grown-up
Wisp." That continuity is the identity blobs can't deliver.

#### Layer 4 — Motif: the individual hook

On top of kingdom + order, each species gets **one** thing nothing else has — a third eye, a
split tail, a cracked horn, a backwards crest, a lantern-bloom. At 16–32px you get exactly one
"huh, neat" detail; spend it deliberately. This is what turns "an Aether flyer" into "**Murmur,
the twin-tailed echo-moth.**"

#### Layer 5 — Finish stays exactly the system it is

Unchanged: **House tint = body hue family, Grade = richness/shimmer**, resolved by the LUT at
render (palette indirection). Sprites ship **flat-tone** silhouettes; the grade ladder makes the
same grid go flat-4-color (C) → shimmering 24-bit + aura (S). Motif glints (ember-vents, glyph
seams, halo sparks) use the index-15 glint slot so they animate at high grades. **Nothing about
color baking changes** — this redesign is silhouette + motif only.

#### Authoring & scope notes

- **Content-only.** Lives in `packages/content/tools/designs/*.ts` (per-kingdom kit + per-species
  composition) → regenerated `sprites.json`. Zero engine / House / grade / evolution-tree change.
- **Shared kingdom kit.** Each kingdom exposes reusable helpers (e.g. Sky Court: body, wing-plane,
  halo-eye, veil-trail; Crag Beasts: carapace, glyph-seam, claw-horn, planted stance) so a whole
  line is coherent by construction and lineage continuity is automatic.
- **Additive-only safe.** Species **ids/`num`s never change** — only their pixel grids; no
  registry-freeze violation. Originality rule (§13) still applies — archetype-level, never any
  franchise creature.
- **Roadmap.** Aether (Sky Court) + Cipher (Crag Beasts) ship redesigned now. Flux (Tide
  Runners), Forge (Iron Brood), and Wild (Bloom) inherit this bible when their rosters land
  (M2); the reserved canon names in `evolution-grades-lineage.md` §7 are unchanged.

### Rendering technique (design baseline §13)

- **Half-block pixel rendering:** sprites drawn with `▀` cells — fg color = top pixel, bg color
  = bottom pixel → 2 vertical pixels per cell. A 32×32-pixel pet fits 32×16 cells and reads as
  true colorful pixel art (chafa-style). Braille chars layer fine details (whiskers, sparkles).
- **Palette indirection:** sprite assets store palette _indices_, never RGB. Grade + House
  select the LUT at render time → one asset, many beauty levels.

  > Now implemented as: `packages/tui` (sub-cell sextant/octant compositor, LUT hot-swap) and
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

- **Sprite size: 20 × 20** (raised 2026-06-15 from 12 × 12, alongside the species
  higher-resolution pass, so toys read as crisply as the pets). Rendered at the scene's scale,
  bottom-aligned on the floor beside the pet during its play idle. The content-pack test enforces
  the exact size; `trinketSlots` in `habitats.json` are anchor points (positions), not size-bound,
  so the bump needed no layout change.
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

- Data packs: `content/habitats.json`, `trinkets.json` — same palette-indexed sprite format,
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

- **File:** `content/achievements.json`
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
  > `packages/content/content/fusion-pools.json`. The DNA types (Vigil, Tempest, Prism,
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
- In the TUI shell the meter is shown **per-page** (not in the menu): the Dex page's header
  bar shows species discovered, the Archive page's shows species recorded — each a mini bar +
  `NN.N%` top-right. The pet page shows the pet's own vitals (Food / Diet / Grow / Odds), not a
  completion bar — a four-row LIVE panel (Food, Diet, Grow, Odds) below the canvas. The pet's Stats
  (PWR/SPD/WIS/GRT, a fixed equal budget) live up in the identity header beside the name, kept
  apart from the live vitals.

#### Standard page scaffold (Dex / Archive / Settings)

Every full-screen page except Pet shares ONE chrome so they read as one app (`components/page.ts`):
a left-aligned `icon Title` header with an optional right-aligned completion bar, the standard
divider beneath it, the page body, and a single left-aligned footer status line on the bottom row.
The completion bar appears only where there's something to track (Dex, Archive); Settings omits it.
Pages NEVER draw their own navigation legend — the global `── Menu ──` buttons are the only nav, so
a per-page key legend would just duplicate them. The **Pet page is deliberately exempt** — it is the
game canvas (identity header + scene + VITALS panel), not a standard page.

#### Evolution-mystery rule (amended — Growth row names the stage + counts down; the NEXT form stays hidden)

The "Grow" vitals row now NAMES the current stage (`Mote` · `Sprite` · `Rookie` · `Evolved` ·
`Prime` · `Apex`) and counts down to the next molt — e.g. `Evolved · 4h 59m 12s` — beside its
maturation bar (the bar fill still reads the spoiler-free `core.growthProgress(state)`). The
countdown is the live `ctx.live.secsToMolt` (the host's `nextMoltCloseAt`); golden frames
(no `live`) show the stage name alone. The mystery now covers only **the NEXT form and which branch
it takes** — what the pet _becomes_ is still never shown (the row names the CURRENT stage, never the
target species or the branch). At **Apex** the row becomes the clickable **"Reborn Now" button**
(`Reborn Now · 2d 4h 9m 12s`, `ctx.live.secsToRebirth` → `nextRebirthAt`): pressing it forces an
early rebirth, with a warn-then-confirm guard when the grade isn't yet S (a non-S Apex still rolls
toward S at each molt — the button flips to a caution `Confirm Rebirth?`; a second press confirms;
an S-grade Apex rebirths on the first press). The **Odds** row (`from › to NN%`) replaces the old
static `rolls at next molt` hint with the live **`Reborn <countdown>`** to the next weekly rebirth
(`ctx.live.secsToRebirth`), shown INLINE right after the odds — the deadline for the grade to keep
rolling up before the pet re-eggs (omitted at the S cap / when there's no live readout / in golden
frames). The Grow row's molt countdown and the Odds row's reborn countdown are therefore two
DISTINCT timers. Keep the `calibrating` cue (data readiness, not evolution).

> Weighting formula: backlog item — see `docs/design/` and GitHub issues.

### Titles & flair (design baseline §14)

- Some achievements grant lineage **titles** (e.g., "Four-House Master")
- Some grant **Dex flair** (border styles)
- Both titles and flair ride along in shared hashes
