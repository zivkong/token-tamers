# Evolution, Grades & Lineage

Derived from the v1.0.3 design baseline. Covers §6 (Evolution System), §7 (Evolution Tree), §8
(Rebirth & Lineage), and §12 (Grades & the Archive). This page is the sole surviving canonical
reference for these sections; every rule, number, table, name, list item, example, caveat,
rationale, and parenthetical from those sections is reproduced here in full.

---

## §6 — Evolution System (design baseline §6)

### Stage track

**Egg → Sprite → Rookie → Evolved → Prime → Apex**

- Behavioral branching from Rookie on; rares, patterns, and a rising mutation chance accrue at
  later molts. Solo reaches Apex — standard pool only.

### Stage maturity & pacing (the ~5-day climb)

Evolution is **not** one stage per molt. Each stage must **mature** before it can evolve, so the
egg→Apex climb spans roughly **five active days** instead of finishing in two — leaving the back
half of the week for the form to settle and for grades to climb (it aligns evolution with the
weekly three-act arc: Growth accrues the climb, the final step lands in Bloom).

- **Maturity clock (`pet.stageMolts`).** A stage accrues one "maturity molt" per molt spent in it
  and may evolve only once it reaches its requirement; the clock resets to 0 on every stage change
  (and at hatch, entering Sprite). The requirement **rises with stage** so growth visibly slows as
  the pet matures, while day-1 momentum is preserved:

  | Stage (evolving from) | Maturity molts required |
  | --------------------- | ----------------------- |
  | Sprite → Rookie       | 1                       |
  | Rookie → Evolved      | 2                       |
  | Evolved → Prime       | 3                       |
  | Prime → Apex          | 4 (+ quality gate)      |

  Sum = 10 molts after the hatch, ≈ days 4–5 at a typical 2–3 molts/day cadence. The egg (hatches
  off its own bonus checkpoint) and Apex (terminal) are unpaced. These are **engine pacing
  constants** (`STAGE_MATURITY` in `packages/core/src/engine/maturity.ts`), like grade odds or the
  window length — temporal cycle rules, not species data.

- **Quality gate on the final step.** Reaching Apex additionally requires a quality threshold —
  **grade ≥ B** — so Apex reflects a sustained week, not a guaranteed default. A pet that has
  matured but not yet graded up sits at the **crest** of Prime until the threshold is met. (Gate
  keyed by the stage evolving _from_: `STAGE_GATE`, currently `prime → { minGrade: 'B' }`.)

- **At most one stage per molt, never backward** — both invariants still hold; maturity only
  _delays_ a stage-up, it never skips or reverses one. Fully deterministic: maturity and the gate
  are pure functions of persisted state (`stageMolts`, `grade`), so replay-from-scratch ==
  resume-from-snapshot is unaffected. (The `arc` early/late Apex split keys off lifetime molt
  count, independent of maturity; if early-peak Apex variants need re-tuning under the slower
  cadence, that is a separate `arc`-threshold change.)

- **Empty windows still never molt** (a zero-usage window fires no checkpoint at all; a zero-usage
  week goes Dormant) — maturity governs only windows that _did_ contain usage. See
  `lifecycle-and-cycles.md`.

### Model-ID registry & Houses (design baseline §6)

Species identity derives from **raw model IDs** via a data-driven registry — no hardcoded Claude
classes, works for any provider and any future model:

- `content/models.json` (single additive tree): ordered pattern rules →
  `{ pattern: "claude-*", house: "aether", gene_id, tint }`, etc. Matching is
  **case-insensitive** (a lowercase pattern catches a provider's CamelCase slug, e.g.
  `minimax*` ↔ `MiniMax-Text-01`).

**Houses are mixed-provenance aesthetic families, NOT provider brands.** Each House
deliberately blends models from several makers (Western and otherwise), grouped by
_theme_ (mind, geometry, light, metal) — so no House is "the Claude house" or "the
Chinese-models house." This stays pure identity/cosmetics: the maker→House grouping
**never** touches stats, grades, rarity, or speed (invariant 3 holds). Model→House
assignment is content data, freely re-balanced (model rules are **not** in
`registry-freeze.json`); only the gene/House/species _ids_ are additive-only.

**Houses (v1)** — identity & cosmetics only, equal stat budgets. Only popular families
are mapped; the rest stay **Wild** until a pack adopts them:

| House      | Model families (mixed by design)                                                                                                                                                                  | Stat flavor (content-tunable, always equal total budget) |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Aether** | `claude-*` · MiniMax (`minimax*`, `abab*`)                                                                                                                                                        | WIS-lean                                                 |
| **Cipher** | `gpt-*` / `o*` · GLM (`glm*`, `codegeex*`) · MiMo (`mimo*`)                                                                                                                                       | PWR-lean                                                 |
| **Flux**   | `gemini-*` · Qwen (`qwen*`, `qwq*`, `qvq*`) · Kimi (`kimi*`, `moonshot*`)                                                                                                                         | SPD-lean                                                 |
| **Forge**  | `llama*` · `mistral*` · DeepSeek (`deepseek*`)                                                                                                                                                    | GRT-lean                                                 |
| **Wild**   | unmapped model IDs → **The Bloom** (plants/feral); also a **dormant gene** — when a registry update maps the model, it awakens into its newly-recognized House (version-agnostic by construction) | neutral (balanced)                                       |

- Each distinct model ID consumed = a **gene** in the pet's diet profile. Dominant House →
  species line; cross-House diet → hybrid lines; high gene diversity feeds the Polyglot/Prism end
  of the trait system.
- Stat _distribution flavor_ per line comes from content data (e.g., Aether-line leans WIS,
  Cipher-line leans PWR, Flux SPD, Forge GRT — tunable, and always an equal total budget).
  **No House is stronger; no model is "better food."**
- Old "Sage/Artisan/Swift by Opus/Sonnet/Haiku" framing is retired; those names may survive as
  _sub-line names within Aether_ in content packs.

_Now implemented as:_ `packages/content/content/models.json` (model-ID pattern registry).

### Evolution axes (design baseline §6)

1. **Diet** (model-ID/House mix) → species line (cosmetic/identity).
2. **Appetite** (volume normalized to own per-adapter baseline) → tier gating.
3. **Rhythm** (session pattern) → variants: Burnout / Disciplined / Nocturne.

### Trait system (design baseline §6)

Rolled once per molt; up to ~5 slots. All traits are model-neutral.

| Trait        | Trigger                                                                   |
| ------------ | ------------------------------------------------------------------------- |
| Marathoner   | Rode a session window to its cap / near-continuous window                 |
| Sprinter     | Short intense bursts with long gaps                                       |
| Polyglot     | 3+ languages/file types touched                                           |
| Nightshade   | Majority usage after midnight                                             |
| Daybreaker   | Pre-9am sessions                                                          |
| Switcher     | Changed model IDs mid-session (rewards mixing, never punishes mono-model) |
| Deepdiver    | One long continuous conversation thread                                   |
| Swarm        | Many parallel short sessions                                              |
| **Polyhost** | _NEW:_ meaningful usage from 2+ provider adapters in one window           |

**Molt evaluation inputs:** session count, gap rhythm, time-of-day spread, window-cap proximity,
tool diversity, streak vs burst, adapter diversity.

### Pattern evolutions (design baseline §6)

Trait combos — checked at every molt, locked at the week's final molt.

- Marathoner + Nightshade → **Vigil**
- Sprinter + Swarm → **Tempest**
- Any 4 distinct traits → **Prism**
- _NEW:_ Polyhost + Switcher → **Chimera** (the multi-agent flex form)

### Mutations (design baseline §6)

~5% per molt: palette shift, off-line trait, or stat swap.

---

## §7 — Evolution Tree (v1 content) (design baseline §7)

Dex target: **112 entries** — 56 base species + 8 hybrid-line species + 35 pattern variants + 12
fusion-locked specials (hidden) + 1 reserved/Ancient slot. (Adding the Wild/Bloom line consumed
11 of the original 12 reserved slots; `dexTotal` is unchanged at 112.)

### Stage 0 — universal egg (design baseline §7)

- **Mote** — every lineage hatches as a Mote ~10 min after the week's first usage (the egg
  fast-hatch); first molt commits it to a House by the window's dominant model-ID gene.

### House lines (design baseline §7)

Full stage track: Egg → Sprite → Rookie → Evolved → Prime → Apex.

> **Creature Kingdoms (visual identity layer, 2026-06-15).** Each House's sprites are designed as
> a concrete creature kingdom — purely cosmetic shape, never a mechanic (invariant: no model
> judgment). Aether = **Sky Court** (flying animals) · Cipher = **Crag Beasts** (ground predators)
> · Flux = **Tide Runners** (aquatic/swift) · Forge = **Iron Brood** (robots/constructs) · Wild =
> **The Bloom** (plants/feral). Full body-plan bible + the higher-resolution size law (egg 12 …
> apex 32) live in `visuals-habitats-achievements.md` §13 → _Species identity system_.

**AETHER — Sky Court (flying)** (`claude-*` + MiniMax genes; WIS-lean; ethereal/mind theme)

- Sprite: **Wisp**
- Rookie: **Aetherling** · **Murmur**
- Evolved: **Oraclet** · **Cirrux** · **Nimbusk**
- Prime: **Seraphix** · **Thoughtwarden** · **Halcyore**
- Apex: **Aurelion** · **Mindspire**

**CIPHER — Crag Beasts (ground predators)** (`gpt-*`/`o*` + GLM + MiMo genes; PWR-lean; glyph/geometry theme)

- Sprite: **Glyphit**
- Rookie: **Cipherling** · **Bitfang**
- Evolved: **Runeclaw** · **Vectorix** · **Glyphound**
- Prime: **Cryptarch** · **Matrixion** · **Sigilus**
- Apex: **Enigmax** · **Keystrix**

**FLUX — Tide Runners (aquatic/swift)** (`gemini-*` + Qwen + Kimi genes; SPD-lean; light/current theme)

- Sprite: **Sparkit**
- Rookie: **Fluxling** · **Voltby**
- Evolved: **Arcfin** · **Photonix** · **Surgewing**
- Prime: **Stormlynx** · **Luminaire** · **Ionyx**
- Apex: **Voltaicore** · **Radiantus**

**FORGE — Iron Brood (robots/constructs)** (`llama*`/`mistral*` + DeepSeek genes; GRT-lean; metal/ember theme)

- Sprite: **Emberit**
- Rookie: **Forgeling** · **Cindcub**
- Evolved: **Anvilisk** · **Slaghorn** · **Kilnox**
- Prime: **Smeltitan** · **Ironmaw** · **Basaltus**
- Apex: **Magmarok** · **Adamantor**

**WILD — The Bloom (plants/feral)** (any unmapped model gene; neutral/balanced lean; the feral
house, doubling as the dormant-gene home until a model is mapped)

- Sprite: **Sprout**
- Rookie: **Mosskit** · **Thornkit**
- Evolved: **Bramblox** · **Pollenix** · **Sporecap**
- Prime: **Verdantyr** · **Bloomwarden** · **Gnarloak**
- Apex: **Sylvaroot** · **Eldergrove**

### Branch logic at each molt (design baseline §7)

- **Rookie fork:** rhythm so far (steady → first slot, bursty → second).
- **Evolved fork (3-way):** dominant trait class — endurance (Marathoner/Deepdiver), tempo
  (Sprinter/Swarm), or breadth (Polyglot/Switcher).
- **Prime fork (3-way):** consistency index band vs own baseline (low/mid/high — all three are
  _different_, none stronger; horizontal budgets).
- **Apex fork (2-way):** lifetime arc — early-peaking lineage vs late-bloomer. Gated: Prime must
  reach **4 maturity molts AND grade ≥ B** before it ascends (see _Stage maturity & pacing_).
- **Rhythm variants** (Burnout/Disciplined/Nocturne) are palette/pose variants applied from
  Evolved onward — not separate species, but distinct Dex entries' flair and battle intro lines.

### Hybrid lines (design baseline §7)

Cross-House diet ≥35/35 split, or early-stage DNA graft.

- **Mistral line** (Aether×Flux): Rookie **Zephling** → Evolved **Galewisp** → Prime **Aeolyx** →
  Apex **Mistralis**
- **Obsidian line** (Forge×Cipher): Rookie **Shardling** → Evolved **Vitrix** → Prime
  **Obsidianth** → Apex **Tessellor**
- (Other House pairs reserved for future packs — additive-only IDs.)

### Pattern variants (design baseline §7)

Overlay forms at Prime/Apex when pattern criteria lock. Named variants of the base species, e.g.
**Vigil Aurelion**, **Tempest Voltaicore**, **Prism Sigilus**, **Chimera Mistralis** — unique
palette, aura, and one signature battle move per pattern. 4 patterns × applicable Prime/Apex
species ≈ 35 curated variants in v1 (not every combo ships; content packs add).

### Fusion-locked specials (design baseline §7)

12 in v1 — **INTERNAL ONLY**, wiki hints only.

One pool per DNA type; pools are published as _types_ only — contents are internal. Pool contents
are internal — see `packages/content/content/fusion-pools.json`.

The four DNA types and their associated pattern triggers:

| DNA type    | Pattern that produces it | Riddle hint (public)                                           |
| ----------- | ------------------------ | -------------------------------------------------------------- |
| **Vigil**   | Vigil pattern            | "those who watch through the night are watched back…"          |
| **Tempest** | Tempest pattern          | TODO riddle copy (backlog: riddle-hint copy for each DNA type) |
| **Prism**   | Prism pattern            | TODO riddle copy (backlog: riddle-hint copy for each DNA type) |
| **Chimera** | Chimera pattern          | TODO riddle copy (backlog: riddle-hint copy for each DNA type) |

Apply timing tiers:

- **Sprite/Rookie** = species graft (hybrid sub-line, e.g. "Mistral"-type lines)
- **Evolved** = guaranteed entry into that DNA's published special pool next molt
- **Prime** = fusion Apex variant

One DNA application per pet lifetime. DNA merge (breeding) splices trait pools. Grade carries into
fusion (S-spliced marker, stat-floor bonus). Each DNA type's wiki page carries only a riddle-style
hint; Dex shows "???" silhouettes only. Discovery is community content.

### Dormant/Ancient (design baseline §7)

- **Wild-House pets** (unknown model IDs) render as silhouette forms until a registry update
  awakens them.
- Retired species become **Ancient** class — permanent Dex entries, still battle-legal.

---

## §8 — Rebirth & Lineage (design baseline §8)

- Weekly REBIRTH event = lifespan.
- **Stat carry-over:** 30% base, +10% per tier reached, cap ~70%.
- **Inherited trait:** most-repeated (automatic, stays idle).
- Species affinity by lineage.
- **Lineage perks:** 3× Prism ancestors → **Kaleido** egg.
- **Progenitor** flag for DNA donors.

---

## §12 — Grades & the Archive (Hall of Fame) (design baseline §12)

### Grade mechanic (design baseline §12)

Roll-per-evolution, monotonic.

- Every pet hatches at **C** ~10 min into the week. At **every molt (including the
  fast-hatch molt)** the pet rolls a **grade-up chance**: C→B→A→S, one step at a time.
- **Monotonic rule:** grade can only ever increase during a lifetime. It NEVER downgrades — not
  from a bad session, not from Dormancy, not at any molt. A failed roll simply keeps the current
  grade.
- **Chance, never guarantee:** developer activity during that session window _raises the odds_ of
  the roll succeeding, but no activity level guarantees a grade-up. There is no pity guarantee;
  every roll can fail.

**Slimming odds at height (base rates, content-tunable):**

| Transition | Base rate |
| ---------- | --------- |
| C → B      | 25%       |
| B → A      | 10%       |
| A → S      | 3%        |

**Activity modifier (model-neutral):** the same molt-evaluation signals — consistency vs your own
baseline, trait synergy that window, rhythm quality, diversity — scale the base rate by ×0.5
(idle/thin window) up to ×2.0 (an excellent window), hard-capped so A→S never exceeds ~6%. Token
volume and model choice never enter the modifier (pillar 2).

**Capped vitality bonus (hybrid growth, layout rev 1.1):** on TOP of the volume-blind modifier, a
SEPARATE additive bonus rewards a heavy session — the closing window's raw token total ramps a
flat bonus to the roll, **full at 200M tokens** (`VITALITY_FULL_TOKENS`) and clamped at
**+0.15** (`VITALITY_MAX_BONUS`). This is the single, deliberate exception to volume-blindness:
it gives developers a reason to keep feeding before the window closes, but it is hard-capped so it
can never dominate the self-normalized base odds, the A→S ceiling still applies after it, and it
is purely additive (the modifier itself stays volume-blind). The pet screen surfaces it live as a
single-tinted **"Food"** gauge filling toward 200M with a `+N% molt` preview, while a separate
**"Odds"** row shows the resulting live chance for the current → next grade only (grade-colored,
e.g. `B → A 18%`; `S ★ apex` at the cap) — the transparency the player acts on (see
architecture.md). The **"Diet"** row is the always-full House-share bar (identity, not power). A
**"Grow"** row sits between Diet and Odds: an _abstract_ maturation meter that fills toward the
next evolution's eligibility and resets when the pet evolves (one state word — `maturing` /
`cresting` / `fully grown` — never the stage name, molt counts, or next form, so the
evolution-mystery rule holds while the player can still see the pet is progressing). Model choice
still never enters power (pillar 2 / invariant 3).

**Gradeshift moment:** a successful roll plays a molt cutscene where the pet's palette visibly
upgrades to the new grade live (see §13) — the mid-week jackpot moment worth screenshotting.

At **rebirth**, the lifetime's final grade is what the Archive records; the new egg starts back at
C (lineage perks may slightly sweeten _roll odds_, never the starting grade, and never to
certainty).

### Archive records (design baseline §12)

- One best-record slot per species; record = final grade + final stats.
- Overwrite only if strictly better (grade first, total stats tiebreak).
- **New record → new DNA code**; old shared codes stay valid (superseded socially).
- S-grade DNA still confers the fusion stat-floor + S-spliced marker (§8).
- Records store `(species_id, grade, stats, content_version, hash)`; `graded_under: vN` tags;
  never retroactively demoted. "???" rows advertise updates.
- **RESOLVED:** the in-game record registry is named the **Archive** (avoids collision with OpenAI
  Codex). Command: `tt archive`.

_Now implemented as:_ the `tt archive` command in `apps/cli`.

### ASCII Archive mock (design baseline §12)

The two rows marked with species names in the original mock that are fusion-locked specials have
been replaced with non-spoiler Aether-line placeholders (`Aurelion`, `Halcyore`) to satisfy the
CI spoiler rule — pool contents are internal, see
`packages/content/content/fusion-pools.json`.

```
 ◆ TOKEN TAMERS ARCHIVE — 47/112 unlocked ◆
 ─────────────────────────────────────────
 #014 Mistral      [A]  PWR 72 SPD 91 WIS 64 GRT 80   gen 6   TT2-c14-mK4…
 #022 Aurelion  ★  [S]  PWR 88 SPD 95 WIS 79 GRT 90   gen 11  TT2-c14-x9F…
 #031 Halcyore     [B]  PWR 61 SPD 55 WIS 84 GRT 58   gen 4   TT2-c14-qL2…
 #045 ???          [—]  dormant gene — update to awaken
```
