---
name: maintain-content-packs
description: Content-pack rules for Token Tamers — species/evolution tree, Houses, models.json, achievements, habitats, trinkets, additive-only registries, spoiler policy. Use when adding or changing anything under packages/content.
---

# Maintain content packs (packages/content)

Source of truth: `token-tamers-design.md` §6, §7, §14. Content is DATA, never code:
versioned JSON under `packages/content/content/v1/`, assembled into the typed
`contentPackV1` in `src/index.ts` (statically imported so the cli bundle embeds it).
Schemas live in `packages/core/src/types.ts`. Validate with `validatePack()` + the
pack tests (`pnpm test`).

## Iron rules

- **Additive-only registries.** Never remove or renumber an id (species `num`, trait,
  achievement, habitat, trinket, gene). Retired content becomes **Ancient** — a
  permanent Dex entry, still battle-legal. Every hash ever shared stays valid forever.
- **No model judgment.** Houses/model IDs are identity & cosmetics ONLY. Equal stat
  budgets per stage; `statWeights` redistribute, never exceed (tests enforce).
- **Unknown model IDs → `wild`** house, stored as a dormant gene ("???" silhouette),
  awakened when a later registry update adds the pattern.
- **Spoilers:** fusion-pool contents (M2+) exist only under `packages/content/` —
  never in docs/wiki/README. `scripts/check-spoilers.sh` greps; pools are published
  as _types_ with riddle hints only.

## Houses (v1) — models.json (ordered, first match wins, '\*' wildcard)

| House  | Model-ID family                                     | Theme            | Stat lean |
| ------ | --------------------------------------------------- | ---------------- | --------- |
| Aether | `claude-*`                                          | ethereal / mind  | WIS       |
| Cipher | `gpt-*` / `o*`                                      | glyph / geometry | PWR       |
| Flux   | `gemini-*`                                          | light / current  | SPD       |
| Forge  | open-weight (llama/qwen/mistral/deepseek/phi/gemma) | metal / ember    | GRT       |
| Wild   | anything unmatched                                  | "???"            | neutral   |

Each distinct model ID consumed = a gene in the diet profile. Dominant House →
species line; cross-House diet (≥35/35) → hybrid lines.

## Evolution tree v1 (Dex target 112: 45 base + 8 hybrid + 35 pattern + 12 fusion + 12 reserved)

Universal egg: **Mote** (first molt commits House). Shipped lines (MVP):

- **AETHER:** Wisp → Aetherling·Murmur → Oraclet·Cirrux·Nimbusk →
  Seraphix·Thoughtwarden·Halcyore → Aurelion·Mindspire
- **CIPHER:** Glyphit → Cipherling·Bitfang → Runeclaw·Vectorix·Glyphound →
  Cryptarch·Matrixion·Sigilus → Enigmax·Keystrix

Reserved for M2 (names are canon — do not repurpose):

- **FLUX:** Sparkit → Fluxling·Voltby → Arcfin·Photonix·Surgewing →
  Stormlynx·Luminaire·Ionyx → Voltaicore·Radiantus
- **FORGE:** Emberit → Forgeling·Cindcub → Anvilisk·Slaghorn·Kilnox →
  Smeltitan·Ironmaw·Basaltus → Magmarok·Adamantor
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
  purchases, or a specific model. v1 ships ~30 of the ~120 target. Categories:
  lineage, evolution, traits, rhythm, grades, social (M2), collection meta, calendar.
- Habitats: starter set Terminal Den (default), Meadow, Rooftop Night. Unlocks are
  achievement-driven (pattern firsts → themed habitats like Vigil → Midnight
  Observatory; House mastery; lineage depth; first S → Gilded Sanctum; Dormant week
  survived → Cocoon Hollow). 2–3 trinket anchor slots each.
- Trinkets: cosmetic only — they influence which idle animations play, never stats.
  Unlocks: trait milestones, molt-count milestones, weather weeks (re-earnable —
  nothing is ever permanently missable).
- Completion Meter weighting: dex 40% + achievements 40% + habitats 10% + trinkets 10%;
  `dexTotal` (112) drives the Dex denominator and "???" rows.

## Sprites

Every species/habitat/trinket id must resolve to a `SpriteDef` in sprites.json.
Current sprites are deterministic placeholders from `tools/gen-sprites.ts` (re-run
with `pnpm tsx packages/content/tools/gen-sprites.ts`). For art rules, use the
**create-sprites** skill.
