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

### Post-MVP — Granular Milestones

M2 was too large; it is decomposed into seven independently shippable milestones (M2.1–M2.7).
M3 follows as art pipeline, future adapters, and polish.

#### Season scoping (overlay on the milestones)

**Seasons are the player-facing release units; the M-ids are the engineering milestones that fill
them.** The current scope decision (2026-06-16):

| Season                   | Theme          | Milestones it ships                                                                      | Status                                  |
| ------------------------ | -------------- | ---------------------------------------------------------------------------------------- | --------------------------------------- |
| **Season 0**             | **Genesis**    | M1 (shipped) + M2.1 codec (shipped) + **M2.2 Battle** + **deco subset of M2.5**          | M1/M2.1 shipped; battle + deco to build |
| **Season 1**             | **Crossbreed** | **M2.3** — the entire DNA apply + grafting + fusion system, with its content             | to build                                |
| **Season 2+ / live-ops** | (rolling)      | M2.4 Codex adapter · rest of M2.5 collections · M2.6 leagues/drifter · M2.7 weather · M3 | future                                  |

Notes that follow from this split:

- **Battle is Season 0, grafting/fusion is Season 1.** Battle only needs the shipped DNA codec
  (decode-only): you battle your own archive records, or a foreign code pasted into `tt battle`
  (the Dex detail page already displays a pet's code for sharing). No `tt dna` command and no
  apply/graft is needed in Season 0.
- **"Basic unlockables" = the deco loop on existing content** (the content-free subset of M2.5):
  `tt deco` + Deco page + loadout storage + declarative unlock-condition schema over the existing
  12 habitats / 6 trinkets / 72 achievements. The full M2.5 content expansion (toward ~120
  achievements, Ancestral Grove tiers, etc.) is a later Season.
- **Season 1 "Crossbreed" is the whole DNA story** — `tt dna export`/`apply`, the graft engine
  (Layer A: `GRAFT_POTENCY`, trait-splice, grade carry, S-spliced marker, one-per-life) AND the
  fusion content it produces (Layer B: hybrid sub-lines, fusion pools, fusion Apex, Chimera-class,
  cutscenes/cosmetics). It bumps the pack `season` 0 → 1 and raises `dexTotal` to the Season-1 roster.
- **Leagues (M2.6) deferred past Season 1.** Battles ship without standings in Season 0; the
  retention risk (§19) is acknowledged — local Leagues are the first live-ops Season after Crossbreed.

#### M2.1 — DNA Codec & Export (social foundation)

- Hash codec in `packages/core` — encode/decode the opaque `TTX<v>-XXXX-…` token (**encoder
  shipped**; see `dna-hash-battles.md` §10)
- Forward-compatibility parsing: old clients parse newer hashes, dormant genes, `graded_under` tags
- Content schema draft & hash payload spec finalized
- `tt dna export` command
- Riddle-hint copy for Vigil / Tempest / Prism / Chimera DNA types

#### M2.2 — Battle Engine & TUI · **Season 0**

- Deterministic battle formula: `outcome = f(hashA, hashB, ruleset_version)`
- 4-House type wheel (Aether > Cipher > Flux > Forge > Aether; Wild neutral)
- Trait procs & behavioral counters (Sprinter counters Marathoner, Deepdiver counters Swarm)
- Grade stat-floor (~+5% for S)
- Ruleset negotiation & versioning; battle math tuning (damage formula, proc rates, multipliers)
- `tt battle` command; Battle TUI page (split-pane, HP bars, lunges, screen-shake, floating damage)
- Archive-record battles

#### M2.3 — DNA Apply & Fusion Pools · **Season 1 ("Crossbreed")**

- `tt dna apply <code>` with timing tiers (Sprite/Rookie = graft, Evolved = pool entry, Prime = fusion Apex)
- One-application-per-lifetime enforcement; DNA merge breeding (trait pool splicing)
- Cross-provider fusion first-class (Chimera-class flagship); grade carry, S-spliced marker, stat-floor bonus
- Fusion pool evaluation logic (Vigil / Tempest / Prism / Chimera); first fusion pool lineup + Chimera-class pool design
- Fusion cutscene (parents slide in, overlap, white flash, two-tone reveal)
- Fusion cosmetics (two-tone split per parent, S-spliced gold outline); DNA TUI page

#### M2.4 — Codex Adapter

- Codex adapter: delta algorithm + format-generation detection
- Integration with adapter registry + `tt init` detection
- Static-policy edge cases: DST, timezone, week-anchor migration

#### M2.5 — Collections: Achievements, Habitats, Trinkets, Deco · (**deco loop = Season 0**; content expansion = later)

- Full achievements.json v1 (~120 total): lineage, evolution, traits, rhythm, grades, social, collection meta, calendar
- Full habitat set: pattern-themed (×4), House (×4), Ancestral Grove (×3 tiers), Gilded Sanctum, Cocoon Hollow
- Full trinket set: trait milestones, molt milestones, weather, DNA export, fusion, archive completion
- Unlock-condition schema as declarative data; habitat/trinket unlock schemas + idle-interaction animation matrix
- `tt deco` command + `--auto` mode; Deco TUI page; loadout storage in local config
- Habitat sprites (96×48) + trinket sprites (12×12)
- Habitat live-sync touches (day/night tint, weather ambient effects, grade aura interaction)

#### M2.6 — Leagues & Drifter DNA

- Team League standings format; `tt league import <codes>` command; League TUI page
- Seasonal league titles recorded in lineage
- `tt dna drifter` — deterministic calendar-seeded solo-dev DNA bridge
- Solo-dev bridge: every machine on the same month produces an identical code, fully offline

#### M2.7 — Weather & Live Ops · (a later live-ops Season)

- Weekly weather seed evaluation (ISO week → trait rate bias, ambient habitat effects)
- Monthly weather events (special week, re-earnable trinket/habitat, twisted trait table)
- 12-month content calendar; Legacy milestones (Gen 25/52, Four-House Master, Perfect Season)

> **Note (2026-06-16 rescope):** the **"Crossbreed" content pack is Season 1**, shipped with the
> grafting/fusion engine in **M2.3** — not here. Each later Season is still a quarterly additive
> pack (+1 hybrid line, +6–10 species, +1 habitat set, +1 DNA pool, +1 achievement page) that
> bumps the pack `season` and raises the live `dexTotal` to that Season's obtainable roster.

### M3 — Art Pipeline, Future Adapters & Polish

- Hand-crafted sprites for all species (replace procedural placeholders)
- Sprite compiler tool (PNG → palette-indexed JSON)
- Cutscenes: molt crack & re-form, gradeshift burst, fusion cinematic
- Pattern-variant art completion
- Windows path support; CI bench harness + initial perf budgets
- Future adapters: Gemini CLI, Copilot CLI, Amp, Goose, Cursor
- Page-by-page mockups for any remaining TUI pages

### Dependency graph

```
M1 (shipped) ─┬─ Season 0 "Genesis" ─────────────────────────────────────────────────┐
              │   M2.1 (DNA codec, shipped) · M2.2 (battle engine + TUI) · deco subset of M2.5
              │                                                                          │
              ├─► Season 1 "Crossbreed":  M2.3 (DNA apply + grafting + fusion pools + content)
              │                                                                          │
              ├─► Later live-ops Seasons: M2.6 (leagues + drifter) · M2.7 (weather) · rest of M2.5
              ├─► M2.4 (Codex adapter) — independent, can run in parallel
              └─► M3 (art pipeline + polish) — after content shape stabilizes
```

(Engineering dependency still holds underneath the Season labels: M2.1 → M2.2 and M2.1 → M2.3;
M2.3 → M2.5 content; M2.2 → M2.6.)

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

These items are tracked as GitHub issues from day one. The list below preserves the original
baseline items, now grouped by the new milestone structure (§18). Items marked `[x]` were
complete at baseline freeze; all others remain open.

### Completed at baseline

- [x] OpenCode adapter: SQLite (`opencode.db`) primary + legacy storage-tree walk, prune-tolerant
- [x] Full evolution tree v1 (§7) — sprites pending
- [x] models.json v1 pattern list (major hosted + open-weight model-ID families)
- [x] pnpm workspace + tsup + ESLint(+Prettier) + Vitest scaffold
- [x] Rename in-game "Codex" (collision with OpenAI Codex) → Archive
- [x] Write CLAUDE.md v1 + the four project skills
- [x] Wiki page skeletons in docs/wiki + CI spoiler check

### M2.1 — DNA Codec & Export

- [ ] Content schema draft; hash payload spec + signing scheme
- [ ] Riddle-hint copy for each DNA type

### M2.2 — Battle Engine & TUI

- [ ] Battle math: damage formula, proc rates, House-wheel multipliers
- [ ] Page-by-page mockups: Battle page inside the 4:3 shell

### M2.3 — DNA Apply & Fusion Pools

- [ ] First fusion pool lineup; Chimera-class pool design

### M2.4 — Codex Adapter

- [ ] Codex adapter: delta algorithm + format-generation detection spec
- [ ] Static-policy edge cases: timezone changes, DST, week-anchor migration

### M2.5 — Collections: Achievements, Habitats, Trinkets, Deco

- [ ] achievements.json v1: full 120-achievement list + reward mapping
- [ ] Completion Meter weighting formula
- [ ] Habitat/trinket v1 art list + unlock-condition schema; idle-interaction animation matrix (trait × trinket)
- [ ] Page-by-page mockups: Deco page inside the 4:3 shell

### M2.6 — Leagues & Drifter DNA

- [ ] Team League standings format + local Drifter DNA generation spec
- [ ] Page-by-page mockups: League page inside the 4:3 shell

### M2.7 — Weather, Seasons & Live Ops

- [ ] 12-month content calendar + Season 1 pack outline

### M3 — Art Pipeline, Future Adapters & Polish

- [ ] Sprite compiler tool (PNG/Aseprite → palette-indexed JSON)
- [ ] Future adapters: Gemini CLI, Copilot CLI, Amp, Goose, Cursor
- [ ] Windows path support (%USERPROFILE% variants for all three adapters)
- [ ] CI bench harness + initial perf budgets; size-limit config; import-boundary rules; dependency-change gate; jscpd/knip advisory
- [ ] Page-by-page mockups: DNA page inside the 4:3 shell
- [ ] Mouse hit-region registry design + SGR parser edge cases (tmux passthrough, mosh, Windows Terminal)

### Cross-cutting (not milestone-specific)

- [ ] Grade roll tuning: base rates, activity-modifier weights, caps
- [ ] Molt evaluation spec: per-adapter field parsing + normalization math
- [ ] Golden-frame test harness for the renderer (string-buffer snapshots)
- [ ] Name/namespace availability check for "Token Tamers" (npm, GitHub, app registries)
- [ ] README pledge text for "no model judgment" + "read-only, never spends tokens"

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
