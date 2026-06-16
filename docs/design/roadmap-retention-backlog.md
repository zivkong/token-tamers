# Token Tamers — Roadmap, Retention & Implementation Backlog

This page is a permanent engineering reference derived from the v1.0.3 design baseline
(dated June 12 2026). It covers design baseline §18, §19, and §20, plus the
document-level version history recorded at the top of that baseline. The original design file will be
deleted after all reference pages are verified complete; this file is the surviving record of these
sections.

---

## Version History (design-phase provenance) (design baseline header)

The design document's version history line, preserved verbatim:

> 0.1 brainstorm consolidation · 0.2 provider-agnostic (3 adapters, init wizard, cycle policies, Houses)
> · 0.3 visual engine (half-block, palette indirection, beauty ladder) · 0.4 art direction +
> CLAUDE.md/skills + wiki plan · 0.5 IP-clean · 0.6 canonical cycle rule · 0.7 habitats & trinkets ·
> 0.8 grade-roll system · 0.9 30fps slim default · 0.10 evolution tree + retention plan · 0.11
> fully-offline + completionist core + achievements · 0.12 clickable 4:3 TUI shell ·
> **1.0 finalized MVP**.

The full document version at baseline freeze is **1.0.3-MVP** (status: FINAL design baseline —
implementation starts (GitHub + Claude Code)).

---

## §18 — MVP Scope (v1.0) (design baseline §18)

### In scope — MVP (milestone M1)

> **Note:** M1 has shipped (engine, Claude Code adapter, TUI shell, starter content pack, `tt` CLI). The nine items below
> define what was declared in scope for that milestone.

1. `tt init` wizard: adapter detection, the one global cycle policy (subscription/static) +
   anchor-adapter pick, week anchor, backfill baseline, Calibration Egg
2. **Claude Code adapter** (reference) + the adapter interface contract
3. Cycle policies: subscription (session-window) + static (fixed tiles), molt/rebirth events
4. Core evolution: Houses via models.json, stage track to Apex, traits, pattern locking, mutations,
   grade roll system (monotonic, odds-transparent)
5. Rebirth + lineage carry-over; Archive records (best-per-species)
6. TUI shell: clickable 4:3 canvas, bottom menu, Pet + Dex + Archive + Settings pages; 30fps
   renderer with half-block sprites, grade beauty ladder, Gradeshift
7. Starter content pack: Aether + Cipher lines complete (egg→Apex), 3 habitats, 6 trinkets, ~30
   achievements, Completion Meter
8. `tt watch` + statusline one-liner; `--no-color` fallback
9. CLAUDE.md + the four project skills; docs/wiki skeleton + CI spoiler check; CI zero-network check

### Post-MVP — the Season roadmap (unified)

**Seasons are the single planning unit.** The old M-milestone ids (M1–M3) are retained only as
**engineering tags** in parentheses so the design-baseline lineage is traceable — they are no
longer a parallel schedule. The release spine is: **Season 0 → Season 1 → Season 2 → Season 3**,
with a continuous **Art & Polish** track running underneath. Each Season bumps the pack `season`
and (when it adds content) raises the live `dexTotal` to that Season's obtainable roster, so 100%
is always reachable inside the current Season.

| Season       | Codename        | Headline                                                  | Status      |
| ------------ | --------------- | --------------------------------------------------------- | ----------- |
| **Season 0** | **Genesis**     | Foundation (shipped) + **Battle** + **Deco/collection**   | in progress |
| **Season 1** | **Crossbreed**  | The whole **DNA grafting + fusion** system + its content  | next        |
| **Season 2** | **Coliseum** \* | **Leagues + standings**, Drifter DNA, **Codex adapter**   | planned     |
| **Season 3** | **Tempest** \*  | **Weather/live-ops** + the full **collections** build-out | planned     |
| _ongoing_    | **Atelier** \*  | Art pipeline, hand-crafted sprites, more adapters, perf   | continuous  |

\* Season 2/3 codenames are provisional working titles.

Invariants every Season honors: battle/graft engines are **pure + seeded** (invariant 5, no
`Date.now`/`Math.random`); all new species/traits/achievements/habitats/trinkets are **additive**
to the one content tree (invariants 6–7); the model→House map never affects stats/grades/speed
(invariant 3); schema bumps are backend-only and never surface as player copy.

---

#### Season 0 — "Genesis" (current)

**Goal:** the launch creature game is feature-complete to _play with what you've raised_ — you
can fight your pets and dress their world. No new content is authored this Season; it makes the
shipped 56 species / 72 achievements / 12 habitats / 6 trinkets fully _usable_.

**Already shipped (the foundation, M1 + M2.1 codec):** five House lines · 56 species · evolution /
traits / patterns / mutations / monotonic grade rolls · rebirth + lineage · Archive · Dex +
per-species record store + Dex-detail (shows the DNA code + battle/graft readiness banners) ·
the DNA **codec** (encode/decode `TTX…`, forward-compat) · clickable 4:3 TUI shell
(Pet/Dex/Archive/Settings) · Claude Code + OpenCode adapters · `tt watch` + statusline · opt-in
updater · the Seasons framing itself (`season: 0`, `dexTotal: 56`, Settings "Season" row).

**Deliverable A — Battle system** (eng tag: M2.2). **DONE (2026-06-16).** Battle consumes a
**decoded code read-only**; it never mutates the pet's stats/grade/Dex (so it cannot violate
invariant 3 — no model becomes "stronger"; the House wheel is _circular_ and stat budgets stay
equal).

- [x] **A1 — Battle engine** (`packages/core/src/battle/`): pure `simulateBattle(a, b, ruleset)`
      → a deterministic, replayable event timeline + outcome. RNG seeded from the two combatants + `ruleset.version` (invariant 5). Same inputs ⇒ identical timeline, forever.
- [x] **A2 — House type wheel:** Aether > Cipher > Flux > Forge > Aether; Wild neutral. Circular by
      construction (no House is net-stronger). Multiplier table is **content data**
      (`ContentPack.battle.wheel` / `battle.json`), not hardcoded (invariant 9).
- [x] **A3 — Trait procs & behavioral counters:** data-driven proc table (`battle.procs`: Sprinter
      counters Marathoner, Deepdiver counters Swarm).
- [x] **A4 — Grade stat-floor (~+5% for S):** `GRADE_STAT_FLOOR` (constants), applied as a
      battle-only floor (never a permanent stat add — equal budgets hold).
- [x] **A5 — Ruleset versioning + negotiation:** `BattleRuleset.version`; `BattleResult` records the
      version it ran under (min-common negotiation is the documented forward path for two codes).
- [x] **A6 — `tt battle` command** (`apps/cli/src/commands/battle.ts`): live pet vs. an Archive
      record, or vs. a pasted `TTX…` code (`tt battle <code>`); enforces the Evolved readiness
      gate; text summary in non-interactive mode (`--text` / piped).
- [x] **A7 — Battle TUI page** (`packages/tui/src/pages/battle.ts`): split-pane, HP meters,
      blow-by-blow log + winner banner, scrub/replay; renders the engine timeline; golden-frame
      tests. (Lunges/screen-shake/floating-damage flourishes left as polish.)
- [x] **A8 — Shell entry point:** from the Archive, select a record and press **`b`** to battle the
      live pet (kept Battle off the top menu to preserve the 34-col min-size layout).
- [x] **A9 — Determinism + golden tests** (engine timeline + page frames, content-ruleset
      validation, cli summary) and a **wiki page** (`docs/wiki/battles.md`) for battles (rules,
      the House wheel, the "no model is stronger" guarantee).

**Deliverable B — Deco & basic-unlockables loop** (eng tag: M2.5 subset; content-free).

- [ ] **B1 — Unlock-condition schema as data:** formalize each habitat/trinket's unlock condition
      as declarative content (achievements already carry condition + reward); verify all 72
      achievements map to a reward.
- [ ] **B2 — Loadout storage:** equipped habitat + trinket slots in `UserConfig` (backend schema
      bump + cli migration — `SCHEMA_VERSION`, never surfaced).
- [ ] **B3 — `tt deco` command** (`apps/cli/src/commands/deco.ts`) + `--auto` (auto-equip the
      newest/best unlocked).
- [ ] **B4 — Deco TUI page** (`packages/tui/src/pages/deco.ts`): browse unlocked habitats/trinkets,
      equip into slots; golden frames.
- [ ] **B5 — Pet page integration:** render the equipped habitat (96×48) behind the pet + trinkets
      in their slots; basic idle interaction (pet plays with a trinket). (Full trait×trinket
      animation matrix is a later Season.)
- [ ] **B6 — Completion wiring + wiki:** confirm deco unlocks feed the Completion Meter
      (habitats/trinkets 10%/10%); wiki page for the collect-and-decorate loop.

**Explicitly NOT in Season 0:** any DNA apply/graft/fusion, hybrid/fusion species, Leagues/
standings, Drifter DNA, weather, the Codex adapter, and the full collections content expansion.

---

#### Season 1 — "Crossbreed" (next)

**Goal:** turn DNA codes from a shareable curio into the game's social/breeding economy. This
Season ships the **entire** grafting + fusion system **and** the new creatures it produces. Bumps
the pack `season` 0 → 1 and raises `dexTotal` to the Season-1 roster.

**Deliverable A — Graft / fusion engine** (eng tag: M2.3 · `dna-hash-battles.md` §9).

- [ ] **A1 — `applyDna(state, donorSnapshot, ruleset)`** (new `packages/core/src/fusion/`): pure,
      seeded; effect depends on the recipient's **stage tier** — Sprite/Rookie = species graft
      (hybrid sub-line), Evolved = guaranteed fusion-pool entry next molt, Prime = fusion Apex.
- [ ] **A2 — Consume `GRAFT_POTENCY`:** donor-grade-scaled grade-up nudge + battle stat-floor
      (C = 0 … S hard-capped at +0.08), grade-based only (invariant 3), capped below base odds.
- [ ] **A3 — DNA merge breeding:** splice donor traits into the recipient's trait pool for future
      molt rolls.
- [ ] **A4 — Grade carry + S-spliced marker + stat-floor bonus** (S-grade donor only; battle-only
      floor, equal budgets preserved).
- [ ] **A5 — One-application-per-lifetime:** `pet.dnaApplied` flag (backend schema bump + cli
      migration); resets on rebirth. Enforce the Evolved readiness gate on apply.
- [ ] **A6 — Determinism + golden codes:** new enum ids appended to `dna/registry.ts`
      (additive-only, invariant 7); golden tests for apply outcomes.

**Deliverable B — Hybrid & fusion content** (eng tag: M2.3 content; spoiler rule applies).

- [ ] **B1 — Hybrid-line species** (the public cross-House sub-lines, e.g. Aether×Flux) added to
      `species.json` with `since: 1` + sprites at the size law; the species-graft targets.
- [ ] **B2 — Fusion pools** (the reserved fusion-locked specials in `fusion-pools.json` — Vigil /
      Tempest / Prism / Chimera lineups); pool-evaluation logic. **Contents stay internal
      (spoiler gate).**
- [ ] **B3 — Fusion Apex variants** (Prime tier) + the **Chimera-class flagship** (cross-provider,
      Polyhost + Switcher).
- [ ] **B4 — Riddle-hint copy** for each DNA type (the Tempest/Prism/Chimera TODOs).

**Deliverable C — DNA commands + UI** (eng tag: M2.3 surface).

- [ ] **C1 — `tt dna export`** (render the shareable code — codec shipped) and **`tt dna apply
<code>`**.
- [ ] **C2 — DNA TUI page** (`packages/tui/src/pages/dna.ts`): show your code, paste/apply a code,
      fusion preview; golden frames.
- [ ] **C3 — Fusion cutscene** (parents slide in, overlap, white flash, two-tone reveal) +
      **fusion cosmetics** (two-tone split per parent, S-spliced gold outline).

**Deliverable D — Pack & completion.**

- [ ] **D1 — Bump `season` 0 → 1**; raise `dexTotal` to the Season-1 obtainable roster (base +
      hybrids + fusion entries). Fusion-locked specials require DNA trading — solo Dex ceiling
      stays intentional (§19 solo-dev cliff; "social by DNA" pillar).
- [ ] **D2 — +1 habitat set, +1 achievement page** themed to Crossbreed.

---

#### Season 2 — "Coliseum" (planned) — competition & more providers

Makes battles _matter_ and widens the player pool. Addresses the §19 "battles are shallow without
standings" risk — the first Season to do so.

- [ ] Team League standings format; `tt league import <codes>`; League TUI page (eng tag: M2.6).
- [ ] Seasonal league titles recorded in lineage.
- [ ] `tt dna drifter` — deterministic calendar-seeded solo-dev DNA bridge (same month ⇒ identical
      code, fully offline).
- [ ] **Codex adapter** (eng tag: M2.4): delta algorithm + format-generation detection; `tt init`
      detection; static-policy DST/timezone/week-anchor edge cases.

---

#### Season 3 — "Tempest" (planned) — live-ops & the full collection

- [ ] Weekly weather seed evaluation (ISO week → trait-rate bias, ambient habitat effects) (M2.7).
- [ ] Monthly weather events (special week, re-earnable trinket/habitat, twisted trait table).
- [ ] **Full collections build-out** (rest of M2.5): toward ~120 achievements; full habitat set
      (Ancestral Grove ×3 tiers, Gilded Sanctum, Cocoon Hollow); full trinket set; trait×trinket
      idle-animation matrix; habitat live-sync (day/night tint, weather, grade-aura).
- [ ] 12-month content calendar; Legacy milestones (Gen 25/52, Four-House Master, Perfect Season).

---

#### Ongoing track — "Atelier" (art & polish, eng tag: M3)

Runs continuously alongside the Seasons rather than as one milestone:

- [ ] Hand-crafted sprites for all species (replace procedural placeholders); sprite compiler
      (PNG/Aseprite → palette-indexed JSON).
- [ ] Cutscenes: molt crack & re-form, gradeshift burst, fusion cinematic; pattern-variant art.
- [ ] Future adapters: Gemini CLI, Copilot CLI, Amp, Goose, Cursor.
- [ ] Windows path support; CI bench harness + perf budgets; remaining TUI page mockups.

### Dependency graph

```
Season 0 "Genesis" (current)
  shipped: foundation + DNA codec
  build:   Battle engine ─┐         Deco/collection loop
                          │
Season 1 "Crossbreed" ◄───┘  graft/fusion engine + hybrid/fusion content + tt dna export/apply
  (needs the codec; battle's decode path is reused by apply)
                          │
Season 2 "Coliseum" ◄─────┘  Leagues + standings (needs Battle) · Drifter DNA · Codex adapter
                          │
Season 3 "Tempest" ◄──────┘  weather/live-ops · full collections build-out
                          │
Atelier (ongoing) ────────┴─ art pipeline · future adapters · perf — alongside every Season
```

Underlying engineering dependencies (unchanged): codec → battle, codec → graft/fusion, battle →
leagues, graft/fusion content → full collections.

---

## §19 — One-Year Retention Assessment (design baseline §19)

**Verdict: the current design reliably holds a dev with colleagues for ~4–6 months. A full year
requires the seasonal cadence below — added to plan.**

### What carries retention (strong)

- Weekly rebirth = a natural appointment loop; lineage makes weeks compound.
- Grade-roll rarity (A→S ≤6%) makes S a months-scale chase with visible payoff.
- DNA economy turns teams into content; new-record→new-DNA keeps trading alive.
- Zero-effort idle floor: even disengaged players accrue lineage, so re-entry is always warm (come
  back to gen 14, not a dead save).

### Honest risks

1. **Wallpaper risk:** pure-idle games fade into the background once novelty dips (~week 6–10)
   unless periodic _external_ novelty arrives.
2. **Battle shallowness:** deterministic, no-input battles are a spectator feature; without standings
   they're a one-week toy.
3. **Solo-dev cliff:** no colleagues → no fusion third → Dex ceiling ~65%.
4. **Content exhaustion:** Season 0 ships 56 species; the full multi-Season vision is ~112 Dex
   entries. A dedicated team Dex-completes a Season in ~6–9 months without new packs — which is
   exactly what the Season cadence (below) feeds.
5. **RNG frustration:** monotonic grades prevent loss-aversion pain, but long S droughts can read as
   "the game ignores my effort" — communicate odds transparently in-UI.

### Year-One Retention Plan (now in scope)

- **Seasons** are the player-facing content cadence (see the Season-scoping overlay in §18 for
  the milestone mapping). **Season 0 — "Genesis"** is the launch content (five House lines, 56
  species, `season: 0`) **plus** the Season-0 build targets: the Battle system and the deco/
  basic-unlockables loop. **Season 1 — "Crossbreed"** is the entire DNA grafting + fusion system
  and the hybrid/fusion content it produces. Each subsequent Season after that is a **quarterly
  content pack**: +1 hybrid line, +6–10 species, +1 habitat set, +1 DNA pool, +1 achievement page
  — additive-only, hash-safe, **bundled in app releases the user installs** (the game never
  fetches content itself). The pack `season` is the player-facing era; the backend
  `schemaVersion`/`SCHEMA_VERSION` numbers are dev-only and never surface in the UI.
- **Monthly weather events:** one special week per month with a unique re-earnable trinket/habitat
  and a twisted trait table.
- **Team Leagues (opt-in):** weekly standings computed locally from hashes colleagues paste to each
  other (`tt league import <codes>`); any human channel works — chat, a text file, a sticky note.
  The game itself never transmits or receives anything. Seasonal league titles recorded in lineage.
- **Legacy milestones:** year-scale lineage achievements (Gen 25/52, "Four-House Master", "Perfect
  Season") with Ancestral habitat tiers as rewards.
- **Solo-dev bridge:** monthly "Drifter DNA" — generated **locally** by `tt dna drifter` from the
  deterministic calendar seed. Every machine on the same month produces the identical code, fully
  offline — solo players get a rotating slice of fusion content with zero network and zero publishing.
- **Transparency UI:** show current grade-up odds + modifier at every molt (defuses RNG resentment;
  respects the no-guarantee rule). _Shipped (post-M1): the pet page's **Odds** row shows the live
  current→next grade chance (grade-colored, `(capped)` at the A→S ceiling, `S ★ apex` at the top),
  driven by `core.gradeOdds`. Surfacing the raw modifier breakdown is still backlog._
- **12-month content calendar** drafted before launch; packs prepared one season ahead.

---

## §20 — Implementation Backlog (design baseline §20)

These items are tracked as GitHub issues. The list is now grouped by **Season** (matching the
unified roadmap in §18); the old M-id remains in parentheses as the engineering tag. `[x]` = done.

### Shipped — Season 0 foundation (the baseline + M1 + M2.1 codec)

- [x] OpenCode adapter: SQLite (`opencode.db`) primary + legacy storage-tree walk, prune-tolerant
- [x] Full evolution tree v1 (§7) — sprites procedural for now
- [x] models.json v1 pattern list (major hosted + open-weight model-ID families)
- [x] pnpm workspace + tsup + ESLint(+Prettier) + Vitest scaffold
- [x] Rename in-game "Codex" (collision with OpenAI Codex) → Archive
- [x] Write CLAUDE.md v1 + the project skills; wiki skeletons + CI spoiler check
- [x] DNA **codec** + forward-compat parsing (M2.1) — opaque `TTX…`, obfuscation not signing
- [x] Golden-frame test harness for the renderer (string-buffer snapshots)
- [x] README pledge text for "no model judgment" + "read-only, never spends tokens"
- [x] Seasons framing: `season`/`dexTotal`, Settings "Season" row

### Season 0 — "Genesis" · open (Battle + Deco)

- [ ] Battle engine + math: damage formula, proc rates, House-wheel multipliers (data-driven) (M2.2)
- [ ] `tt battle` + Battle TUI page mockup & golden frames (M2.2)
- [ ] Deco: unlock-condition schema as data; loadout storage; `tt deco` + Deco page mockup (M2.5 subset)
- [ ] Completion-meter wiring verified for habitats/trinkets via deco
- [ ] Riddle-hint copy carry-over check (export-side is S1; battle needs none)

### Season 1 — "Crossbreed" · open (DNA grafting + fusion)

- [ ] Graft/fusion engine: `applyDna`, apply-timing tiers, one-per-life, trait splice (M2.3)
- [ ] First fusion pool lineup; Chimera-class pool design (M2.3, spoiler-internal)
- [ ] Hybrid-line species + sprites (`since: 1`); fusion Apex variants
- [ ] `tt dna export`/`apply`; DNA TUI page mockup; fusion cutscene + cosmetics
- [ ] Riddle-hint copy for each DNA type (M2.1 carry-over)
- [ ] Pack bump `season` 0 → 1 + `dexTotal` raise; +habitat set, +achievement page

### Season 2 — "Coliseum" · open (competition & providers)

- [ ] Team League standings format + League TUI page mockup (M2.6)
- [ ] Local Drifter DNA generation spec (`tt dna drifter`) (M2.6)
- [ ] Codex adapter: delta algorithm + format-generation detection spec (M2.4)
- [ ] Static-policy edge cases: timezone changes, DST, week-anchor migration (M2.4)

### Season 3 — "Tempest" · open (live-ops & full collection)

- [ ] achievements.json: full ~120-achievement list + reward mapping (M2.5)
- [ ] Full habitat/trinket sets + idle-interaction animation matrix (trait × trinket) (M2.5)
- [ ] Weather seed evaluation + monthly events (M2.7)
- [ ] 12-month content calendar; Legacy milestones (M2.7)

### Atelier — ongoing (art & polish, M3)

- [ ] Sprite compiler tool (PNG/Aseprite → palette-indexed JSON)
- [ ] Hand-crafted sprites for all species; cutscenes; pattern-variant art
- [ ] Future adapters: Gemini CLI, Copilot CLI, Amp, Goose, Cursor
- [ ] Windows path support (%USERPROFILE% variants for all adapters)
- [ ] CI bench harness + perf budgets; size-limit; dependency-change gate; jscpd/knip advisory
- [ ] Remaining TUI page mockups; mouse hit-region + SGR parser edge cases (tmux/mosh/Win Terminal)

### Cross-cutting (any Season)

- [ ] Grade roll tuning: base rates, activity-modifier weights, caps
- [ ] Molt evaluation spec: per-adapter field parsing + normalization math
- [ ] Name/namespace availability check for "Token Tamers" (npm, GitHub, app registries)

---

## Spoiler note

The Year-One Retention Plan (§19) and the MVP Scope (§18) reference DNA pool _types_ — Vigil,
Tempest, Prism, and Chimera — and the Drifter DNA mechanic. The _contents_ of those pools (the 12
fusion-locked special species names) are internal and must not appear in this file or anywhere else
under `docs/`.

Pool contents are internal — see `packages/content/content/fusion-pools.json`.

All pool mechanics, timing tiers (Sprite/Rookie = species graft; Evolved = guaranteed pool entry
next molt; Prime = fusion Apex variant), and the Drifter DNA solo-dev bridge (deterministic offline
generation from the calendar seed via `tt dna drifter`) are documented in full above. Only the
specific species names within each pool are withheld here.
