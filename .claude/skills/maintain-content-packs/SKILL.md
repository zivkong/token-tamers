---
name: maintain-content-packs
description: Content-pack rules for Token Tamers — species/evolution tree, Houses, models.json, achievements, habitats, trinkets, additive-only registries, spoiler policy. Use when adding or changing anything under packages/content.
---

# Maintain content packs (packages/content)

Source of truth: `docs/design/evolution-grades-lineage.md` and
`docs/design/visuals-habitats-achievements.md`. Content is DATA, never code:
ONE additive JSON tree under `packages/content/content/` (no versioned folders —
the pack manifest carries a backend `schemaVersion` for JSON-shape changes and the
player-facing `season` number, the content era starting at 0, bumped once per content
release / Season; renamed & renumbered from the old `revision`. Each release = one Season.
Entries may tag `since` = the Season an id first ships in, omitted = 0), assembled into the typed
`contentPackV1` in `src/index.ts` (statically imported so the cli bundle embeds it).
Schemas live in `packages/core/src/types.ts`. Validate with `validatePack()` + the
pack tests (`pnpm test`).

## Iron rules

- **Additive-only registries.** Never remove or renumber an id (species `num`, trait,
  achievement, habitat, trinket, gene). Every id ever shipped is frozen in
  `content/registry-freeze.json` — register new ids there in the same PR; the
  freeze test fails on any removal/renumber. Retired content becomes **Ancient** — a
  permanent Dex entry, still battle-legal. Every hash ever shared stays valid forever.
- **DNA-encoded ids are double-frozen.** The DNA codec (`packages/core/src/dna/registry.ts`)
  encodes trait / pattern / rhythm / mutation values as their INDEX in append-only tables.
  When you add such an id to content, you must **append** it to the end of the matching
  `*_CODES` array in `dna/registry.ts` (never reorder/remove) — old DNA codes decode by index
  forever (invariant 7), and a golden test in `__tests__/dna.test.ts` locks the byte layout.
  Species are encoded by their additive-stable `num`, so they need no codec change.
- **No model judgment.** Houses/model IDs are identity & cosmetics ONLY. Equal stat
  budgets per stage; `statWeights` redistribute, never exceed (tests enforce).
- **Unknown model IDs → `wild`** house — now a real playable line, **The Bloom**
  (plants/feral, neutral/balanced budget). Still a dormant gene: when a later registry update
  maps the model, it awakens into its newly-recognized House. (An unknown _species_ referenced
  in a shared hash still renders as a "???" Dex silhouette — that forward-compat discovery is
  unchanged; only the unmapped-_model_ rendering became a Bloom creature instead of blank.)
- **Spoilers:** fusion-pool contents (M2+) exist only under `packages/content/` —
  never in docs/wiki/README. `scripts/check-spoilers.sh` greps; pools are published
  as _types_ with riddle hints only.

## Houses (v1) — models.json (ordered, first match wins, '\*' wildcard)

| House  | Model-ID family                     | Kingdom (creature identity) | Theme            | Stat lean |
| ------ | ----------------------------------- | --------------------------- | ---------------- | --------- |
| Aether | `claude-*`                          | Sky Court (flying)          | ethereal / mind  | WIS       |
| Cipher | `gpt-*` / `o*`                      | Crag Beasts (ground)        | glyph / geometry | PWR       |
| Flux   | `gemini-*`                          | Tide Runners (aquatic)      | light / current  | SPD       |
| Forge  | `llama*` · `mistral*` · `deepseek*` | Iron Brood (robots)         | metal / ember    | GRT       |
| Wild   | anything unmatched                  | The Bloom (plants)          | "???"            | neutral   |

**Kingdom = cosmetic creature body-plan only** (flying/ground/aquatic/robot/plant), never a
mechanic — same no-model-judgment rule as the House itself. The kingdom→House mapping is
re-balanceable content art, NOT frozen in `registry-freeze.json` (only ids are additive-only).
Full body-plan bible: `docs/design/visuals-habitats-achievements.md` §13 + the **create-sprites**
skill.

Each distinct model ID consumed = a gene in the diet profile. Dominant House →
species line; cross-House diet (≥35/35) → hybrid lines.

## Evolution tree — Season 0 (56 obtainable; cross-Season vision ~112: 56 base + 8 hybrid + 35 pattern + 12 fusion + 1 reserved)

Universal egg: **Mote** (first molt commits House). Shipped lines (MVP):

- **AETHER:** Wisp → Aetherling·Murmur → Oraclet·Cirrux·Nimbusk →
  Seraphix·Thoughtwarden·Halcyore → Aurelion·Mindspire
- **CIPHER:** Glyphit → Cipherling·Bitfang → Runeclaw·Vectorix·Glyphound →
  Cryptarch·Matrixion·Sigilus → Enigmax·Keystrix
- **FLUX:** Sparkit → Fluxling·Voltby → Arcfin·Photonix·Surgewing →
  Stormlynx·Luminaire·Ionyx → Voltaicore·Radiantus
- **FORGE:** Emberit → Forgeling·Cindcub → Anvilisk·Slaghorn·Kilnox →
  Smeltitan·Ironmaw·Basaltus → Magmarok·Adamantor
- **WILD (The Bloom):** Sprout → Mosskit·Thornkit → Bramblox·Pollenix·Sporecap →
  Verdantyr·Bloomwarden·Gnarloak → Sylvaroot·Eldergrove

All five playable lines are SHIPPED (56 base species, nums 1–56; Wild = the feral Bloom for
unmapped models, neutral budget). Reserved for M2 (names are canon — do not repurpose):

- **Hybrids:** Mistral line (Aether×Flux): Zephling→Galewisp→Aeolyx→Mistralis;
  Obsidian line (Forge×Cipher): Shardling→Vitrix→Obsidianth→Tessellor

Branch logic per stage: rookie = rhythm (steady→first slot, bursty→second);
evolved = dominant trait class (endurance/tempo/breadth); prime = consistency band
(low/mid/high — all different, none stronger); apex = lifetime arc (early/late).
Every fork needs a `default` branch so evaluation never dead-ends. Pattern variants
(Vigil/Tempest/Prism/Chimera overlays at Prime/Apex) are distinct Dex entries.

## Achievements, habitats, trinkets (declarative, model-neutral, all re-earnable)

- Achievements: `{id, name, condition, reward}` — conditions are typed
  `AchievementCondition`s; evaluated at molt/rebirth; never require network,
  purchases, or a specific model. Season 0 ships 44 of the ~120 long-term target. Categories:
  lineage, evolution, traits, rhythm, grades, social (M2), collection meta, calendar.
- Habitats: starter set Terminal Den (default), Meadow, Rooftop Night. Unlocks are
  achievement-driven (pattern firsts → themed habitats like Vigil → Midnight
  Observatory; House mastery; lineage depth; first S → Gilded Sanctum; Dormant week
  survived → Cocoon Hollow). 2–3 trinket anchor slots each.
- Trinkets: cosmetic only — they influence which idle animations play, never stats.
  Unlocks: trait milestones, molt-count milestones, weather weeks (re-earnable —
  nothing is ever permanently missable).
- Completion Meter weighting: dex 40% + achievements 40% + habitats 10% + trinkets 10%;
  `dexTotal` drives the Dex denominator and "???" rows. It is the CURRENT Season's obtainable
  roster (Season 0 = `56`), so 100% is reachable within the Season; a new Season raises it.

## Sprites

Every species/habitat/trinket id must resolve to a `SpriteDef` in sprites.json.
Sprites are generated deterministically from `tools/gen-sprites.ts` (re-run with
`pnpm tsx packages/content/tools/gen-sprites.ts`); species art is authored per-kingdom
in `tools/designs/*.ts`. Species sprites are exactly square at the **octant v2 size law
(2026-06-16)**: egg 16 · sprite 20 · rookie 24 · evolved 28 · prime 32 · apex 36 (habitats
128×96 (4:3), trinkets 28×28) — enforced by the content-pack test. Each species also declares a
cosmetic `accent` hex (secondary color; palette indices 16–18; never affects mechanics — invariant
3). Each House's creatures follow its **Kingdom**
body-plan (Sky Court / Crag Beasts / Tide Runners / Iron Brood / Bloom). For art rules, use the
**create-sprites** skill.
