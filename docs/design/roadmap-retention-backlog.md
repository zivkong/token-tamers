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

1. `tt init` wizard: adapter detection, plan type, cycle policy, week anchor, backfill baseline,
   Calibration Egg
2. **Claude Code adapter** (reference) + the adapter interface contract
3. Cycle policies: dynamic (subscription) + static (API), molt/rebirth events
4. Core evolution: Houses via models.json, stage track to Apex, traits, pattern locking, mutations,
   grade roll system (monotonic, odds-transparent)
5. Rebirth + lineage carry-over; Archive records (best-per-species)
6. TUI shell: clickable 4:3 canvas, bottom menu, Pet + Dex + Archive + Settings pages; 30fps
   renderer with half-block sprites, grade beauty ladder, Gradeshift
7. Starter content pack: Aether + Cipher lines complete (egg→Apex), 3 habitats, 6 trinkets, ~30
   achievements, Completion Meter
8. `tt watch` + statusline one-liner; `--no-color` fallback
9. CLAUDE.md + the four project skills; docs/wiki skeleton + CI spoiler check; CI zero-network check

### Post-MVP (M2)

- Codex CLI adapter; Flux + Forge lines; hybrid lines
- Hash export/import; battles; DNA fusion + pools; Drifter DNA; Team Leagues
- Habitat/trinket full sets; remaining achievements; Deco/DNA/Battle/League pages

### Post-MVP (M3 / live)

- Season 1 content pack; monthly weather events; Legacy milestones
- Sprite compiler pipeline; pattern-variant art completion

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
4. **Content exhaustion:** 112 entries; a dedicated team Dex-completes in ~6–9 months without new
   packs.
5. **RNG frustration:** monotonic grades prevent loss-aversion pain, but long S droughts can read as
   "the game ignores my effort" — communicate odds transparently in-UI.

### Year-One Retention Plan (now in scope)

- **Quarterly content packs** (Seasons): +1 hybrid line, +6–10 species, +1 habitat set, +1 DNA pool,
  +1 achievement page per quarter — additive-only, hash-safe, **bundled in app releases the user
  installs** (the game never fetches content itself).
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
  respects the no-guarantee rule).
- **12-month content calendar** drafted before launch; packs prepared one season ahead.

---

## §20 — Implementation Backlog (design baseline §20)

These items are tracked as GitHub issues from day one. The list below is verbatim from the design
baseline, preserving checked/unchecked state exactly as recorded at freeze. Items marked `[x]` were
complete at baseline; all others remain open.

> **Note:** these are intended to become individual GitHub issues. The checked item (`[x]`) was
> `Full evolution tree v1 (§7) — sprites pending`, completed during the design phase. All other
> items are open backlog at baseline freeze.

- [ ] Grade roll tuning: base rates, activity-modifier weights, caps, optional sub-certainty
      soft-pity (must never reach guarantee), anti-gaming caps
- [ ] Molt evaluation spec: per-adapter field parsing + normalization math
- [ ] Codex adapter: delta algorithm + format-generation detection spec
- [x] OpenCode adapter: SQLite (`opencode.db`) primary + legacy storage-tree walk, prune-tolerant
- [ ] Static-policy edge cases: timezone changes, DST, week-anchor migration
- [x] Full evolution tree v1 (§7) — sprites pending
- [ ] 12-month content calendar + Season 1 pack outline
- [ ] Team League standings format + local Drifter DNA generation spec
- [ ] achievements.json v1: full 120-achievement list + reward mapping
- [ ] Completion Meter weighting formula
- [ ] First fusion pool lineup; Chimera-class pool design
- [ ] models.json v1 pattern list (major hosted + open-weight model-ID families)
- [ ] Content schema draft; hash payload spec + signing scheme
- [ ] Battle math: damage formula, proc rates, House-wheel multipliers
- [ ] Page-by-page mockups inside the 4:3 shell (Pet/Dex/Achv/Deco/DNA/Battle/League)
- [ ] Mouse hit-region registry design + SGR parser edge cases (tmux passthrough, mosh,
      Windows Terminal)
- [ ] Golden-frame test harness for the renderer (string-buffer snapshots)
- [ ] pnpm workspace + tsup + ESLint(+Prettier) + Vitest scaffold (first Claude Code task
      after CLAUDE.md)
- [ ] CI bench harness + initial perf budgets; size-limit config; import-boundary rules;
      dependency-change gate; jscpd/knip advisory
- [ ] Rename in-game "Codex" (collision with OpenAI Codex): Archive/Chronicle/Bestiary?
- [ ] Name/namespace availability check for "Token Tamers" (npm, GitHub, app registries)
- [ ] README pledge text for "no model judgment" + "read-only, never spends tokens"
- [ ] Windows path support (%USERPROFILE% variants for all three adapters)
- [ ] Future adapters: Gemini CLI, Copilot CLI, Amp, Goose, Cursor
- [ ] Write CLAUDE.md v1 + the four project skills (sprite-design, content-pack, adapter-dev,
      wiki-writer)
- [ ] Wiki page skeletons in docs/wiki + CI spoiler check (no special-pool IDs under docs/)
- [ ] Riddle-hint copy for each DNA type
- [ ] Sprite compiler tool (PNG/Aseprite -> palette-indexed JSON) for the 48-64px pipeline
- [ ] Habitat/trinket v1 art list + unlock-condition schema; idle-interaction animation matrix
      (trait x trinket)

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
