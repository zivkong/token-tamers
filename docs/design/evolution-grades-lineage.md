# Evolution, Grades & Lineage

Derived from the v1.0.3 design baseline. Covers §6 (Evolution System), §7 (Evolution Tree), §8
(Rebirth & Lineage), and §12 (Grades & the Archive). This page is the sole surviving canonical
reference for these sections; every rule, number, table, name, list item, example, caveat,
rationale, and parenthetical from those sections is reproduced here in full.

---

## §6 — Evolution System (design baseline §6)

### Stage track

**Seed → Sprite → Rookie → Evolved → Prime → Apex**

- Molt 1–2 guaranteed progression; molt 3–5 behavioral branching; molt 6+ rares, patterns, rising
  mutation chance. Solo reaches Apex — standard pool only.

### Model-ID registry & Houses (design baseline §6)

Species identity derives from **raw model IDs** via a data-driven registry — no hardcoded Claude
classes, works for any provider and any future model:

- `content/vN/models.json`: ordered pattern rules →
  `{ pattern: "claude-*", house: "aether", gene_id, tint }`, etc.

**Houses (v1)** — identity & cosmetics only, equal stat budgets:

| House      | Model-ID family                                                                                                                                | Stat flavor (content-tunable, always equal total budget) |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Aether** | `claude-*`                                                                                                                                     | WIS-lean                                                 |
| **Cipher** | `gpt-*` / `o*`                                                                                                                                 | PWR-lean                                                 |
| **Flux**   | `gemini-*`                                                                                                                                     | SPD-lean                                                 |
| **Forge**  | open-weight/local families (llama, qwen, mistral, deepseek, …)                                                                                 | GRT-lean                                                 |
| **Wild**   | unmatched model IDs → stored as a **dormant gene** ("???"), awakens when a registry update adds the pattern (version-agnostic by construction) | neutral                                                  |

- Each distinct model ID consumed = a **gene** in the pet's diet profile. Dominant House →
  species line; cross-House diet → hybrid lines; high gene diversity feeds the Polyglot/Prism end
  of the trait system.
- Stat _distribution flavor_ per line comes from content data (e.g., Aether-line leans WIS,
  Cipher-line leans PWR, Flux SPD, Forge GRT — tunable, and always an equal total budget).
  **No House is stronger; no model is "better food."**
- Old "Sage/Artisan/Swift by Opus/Sonnet/Haiku" framing is retired; those names may survive as
  _sub-line names within Aether_ in content packs.

_Now implemented as:_ `packages/content/content/v1/models.json` (model-ID pattern registry).

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

Dex target: **112 entries** — 45 base species + 8 hybrid-line species + 35 pattern variants + 12
fusion-locked specials (hidden) + 12 reserved/Ancient slots.

### Stage 0 — universal egg (design baseline §7)

- **Mote** — every lineage hatches as a Mote; first molt commits it to a House by the window's
  dominant model-ID gene.

### House lines (design baseline §7)

Full stage track: Seed → Sprite → Rookie → Evolved → Prime → Apex.

**AETHER** (`claude-*` genes; WIS-lean; ethereal/mind theme)

- Sprite: **Wisp**
- Rookie: **Aetherling** · **Murmur**
- Evolved: **Oraclet** · **Cirrux** · **Nimbusk**
- Prime: **Seraphix** · **Thoughtwarden** · **Halcyore**
- Apex: **Aurelion** · **Mindspire**

**CIPHER** (`gpt-*`/`o*` genes; PWR-lean; glyph/geometry theme)

- Sprite: **Glyphit**
- Rookie: **Cipherling** · **Bitfang**
- Evolved: **Runeclaw** · **Vectorix** · **Glyphound**
- Prime: **Cryptarch** · **Matrixion** · **Sigilus**
- Apex: **Enigmax** · **Keystrix**

**FLUX** (`gemini-*` genes; SPD-lean; light/current theme)

- Sprite: **Sparkit**
- Rookie: **Fluxling** · **Voltby**
- Evolved: **Arcfin** · **Photonix** · **Surgewing**
- Prime: **Stormlynx** · **Luminaire** · **Ionyx**
- Apex: **Voltaicore** · **Radiantus**

**FORGE** (open-weight genes; GRT-lean; metal/ember theme)

- Sprite: **Emberit**
- Rookie: **Forgeling** · **Cindcub**
- Evolved: **Anvilisk** · **Slaghorn** · **Kilnox**
- Prime: **Smeltitan** · **Ironmaw** · **Basaltus**
- Apex: **Magmarok** · **Adamantor**

### Branch logic at each molt (design baseline §7)

- **Rookie fork:** rhythm so far (steady → first slot, bursty → second).
- **Evolved fork (3-way):** dominant trait class — endurance (Marathoner/Deepdiver), tempo
  (Sprinter/Swarm), or breadth (Polyglot/Switcher).
- **Prime fork (3-way):** consistency index band vs own baseline (low/mid/high — all three are
  _different_, none stronger; horizontal budgets).
- **Apex fork (2-way):** lifetime arc — early-peaking lineage vs late-bloomer.
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
are internal — see `packages/content/content/v1/fusion-pools.json`.

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

- Every pet hatches at **C**. At **every molt (evolution checkpoint)**, the pet rolls a
  **grade-up chance**: C→B→A→S, one step at a time.
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
`packages/content/content/v1/fusion-pools.json`.

```
 ◆ TOKEN TAMERS ARCHIVE — 47/112 unlocked ◆
 ─────────────────────────────────────────
 #014 Mistral      [A]  PWR 72 SPD 91 WIS 64 GRT 80   gen 6   TT2-c14-mK4…
 #022 Aurelion  ★  [S]  PWR 88 SPD 95 WIS 79 GRT 90   gen 11  TT2-c14-x9F…
 #031 Halcyore     [B]  PWR 61 SPD 55 WIS 84 GRT 58   gen 4   TT2-c14-qL2…
 #045 ???          [—]  dormant gene — update to awaken
```
