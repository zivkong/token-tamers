# Token Tamers — project memory

A fully idle, fully offline terminal virtual pet raised by the developer's real AI
coding-agent usage. Full design reference: `docs/design/` (the contract for everything, extracted in
full from the v1.0.3 design baseline).

## Architecture map

```
[adapters] ──normalized UsageEvent──▶ [core engine] ──GameState/effects──▶ [tui shell]
 (claude-code, …)                      cycle policies, evolution,           diff renderer,
 read local logs only                  grades, achievements                 sub-cell sprites
                                            │
                                       ~/.tokentamers/ (config.json, state.json)
[content] ──ContentPack JSON──▶ engine + tui (species, traits, sprites, achievements)
[apps/cli] wires all of it into the `tt` binary (tsup single-file bundle)
```

Key contracts live in `packages/core/src/types.ts`.

## Non-negotiable invariants (CI-enforced)

1. **Read-only observer** — never call an AI API, never spend user tokens/quota.
2. **Zero network code — one sanctioned exception.** The game never touches the
   network. Network code may appear ONLY in the opt-in updater's single file,
   `apps/cli/src/services/updater/net.ts` (off by default, outbound-read-only to
   GitHub Releases, sends nothing — see `docs/design/auto-update.md`). Two gates
   enforce containment: `check-zero-network.sh` (no network elsewhere) +
   `check-updater-isolation.sh` (that file is the ONLY one); ESLint allowlists
   `node:https` there alone. Never add network code outside that file.
3. **No model judgment** — model IDs map to Houses (identity/cosmetics) via
   `models.json`; they must NEVER affect stats, grades, rarity, or speed. (House
   selection also takes a per-install `UserConfig.salt` + content `houseBias` so a
   single-model shop spreads across Houses — see the Houses entry below — but that
   is purely cosmetic too, feeding only `pet.house`, never mechanics.)
   Grade odds normalize to the player's own per-adapter baseline (the activity
   modifier stays model- AND volume-blind). The ONE sanctioned exception is the
   **capped vitality bonus**: a separate, additive, hard-capped grade-roll bonus
   from the session's raw token volume (full at `VITALITY_FULL_TOKENS` = 200M,
   max `+VITALITY_MAX_BONUS` = 0.15) — never model-dependent, never able to
   dominate base odds (see `evolution-grades-lineage.md` §12). A second capped,
   **grade**-based (never model-based) bonus is the DNA **graft potency**
   (`GRAFT_POTENCY`: C = 0 … S hard-capped at +0.08 on both the grade-up chance and
   the stat boost) and the **battle/graft readiness gate** (a snapshot is
   battle/graft-eligible only once its `stage` ≥ Evolved — `BATTLE_READY_STAGE`,
   `isBattleReady`). Both are derived from grade/stage (identity), never model id.
4. **Import boundaries** — `core` imports nothing (not even `node:*`); `tui`/`adapters`
   import `core` only, never each other; ESLint enforces.
5. **Deterministic core** — no `Date.now()`/`new Date()`/`Math.random()` in
   `packages/core/src`; use event timestamps + the seeded RNG. Same state + same
   events + same clock ⇒ identical results, forever.
6. **Additive-only registries** — never remove/renumber species, trait, achievement,
   habitat, or trinket ids. Unknown ids = dormant genes, render as "???".
7. **Hashes parse forever** — DNA/hash codecs are versioned; old codes stay valid.
   The DNA **encoder** is shipped (`packages/core/src/dna/`): an opaque, license-key
   token `TTX<v>-XXXX-…` (whitened high-entropy body + FNV integrity tag + reserved
   extension area), deterministic so the Dex renders it live and battles/replays
   reproduce. Registry tables are append-only and a golden test locks the byte layout;
   `decodeDna` never rejects newer schemas/unknown ids — it recovers known fields and
   marks the rest dormant. (It's obfuscation, not encryption — shared codes carry no secret.)
8. **Zero runtime dependencies** — devDependencies only; the `tt` bundle is self-contained.
9. **Content as data** — never hardcode species/model/trait specifics in engine code.
10. **Spoiler rule** — fusion-pool contents exist only under `packages/content/content/`;
    docs/wiki may hint, never reveal. `scripts/check-spoilers.sh` enforces.
11. **Never weaken a test to pass a PR.** Tests encode design-doc contracts.
12. **Supply-chain rules** — GitHub Actions pinned to full commit SHAs only
    (`scripts/check-workflow-pins.sh`); dependency lifecycle scripts blocked except
    the `allowBuilds` allowlist; `minimumReleaseAge: 1440` (1-day cooldown) stays;
    runtime deps stay at zero (`scripts/check-runtime-deps.sh`); never echo untrusted
    GitHub event data (`github.event.*`, `github.head_ref`) into workflow `run:` blocks.

## Commands

- `pnpm install` · `pnpm check` (typecheck+lint+format+test+build)
- `pnpm test` / `pnpm test:watch` · `pnpm lint` · `pnpm typecheck` · `pnpm build`
- Dev from source (no build, `tsx`): `pnpm dev [args]` · hot reload: `pnpm dev:watch`
  (e.g. `pnpm dev status`). Built bundle: `pnpm build` then `node apps/cli/dist/tt.js`
- Zero-network / updater-isolation / spoiler gates: `pnpm check:network` ·
  `pnpm check:updater` · `pnpm check:spoilers`

## Code structure (KISS / DRY / SOLID — mechanically enforced)

ESLint ceilings (error, never lint-disable around them — split responsibilities
instead): complexity ≤ 20, max-depth ≤ 4, max-params ≤ 5 (group into an options
object), max-lines ≤ 400 (excl. tests), no-duplicate-imports. Duplication: jscpd
advisory via `pnpm check:dup`. Folders are by responsibility, max one level deep,
thin barrel `index.ts` per folder; each package's PUBLIC API is its `src/index.ts`
— internal moves must keep its export surface identical.

- `packages/core/src/` — `types.ts` (cross-package contracts, never move) ·
  `helpers/` (rng) · `cycle/` (windows, static, dynamic) · `evaluation/`
  (signals, traits, modifier) · `engine/` (state, houses, branches, grades,
  rebirth, achievements, baseline, completion, constants, `maturity` incl. the
  readiness gate, `snapshot`/`dex-records` for the per-species record store,
  `graft` potency, index) · `dna/` (the shipped hash codec: codec, payload,
  append-only registry) · `battle/` (the pure battle engine: `simulate`, `wheel`,
  `procs`, `combatant`, `seed` — consumes `ContentPack.battle` read-only)
- `packages/tui/src/` — `terminal/` (ansi, input) · `render/` (buffer, sprite,
  layout, hit, frame, menu) · `components/` (shared UI: divider, meter — one
  standardized look) · `pages/` (incl. `dex-detail` — the per-species record view —
  and `battle` — the split-pane battle playback + opponent picker)
  · `helpers/` (status, lookup) · `shell.ts` + `shell-io.ts` (stdio/terminal wiring)
- `packages/adapters/src/` — `index.ts` (contracts + registry) · `helpers/`
  (jsonl incremental reading, shared by future adapters) · `<provider>/`
  (index = detect/scan, parse = record→UsageEvent)
- `packages/content/src/` — `index.ts` (pack assembly) · `validate.ts` ·
  `models.ts`; JSON under `content/` (ONE additive tree + `registry-freeze.json`,
  never versioned folders — the manifest's `season` number is the content era); `tools/`
- `apps/cli/src/` — `main.ts` (thin entry — tsup entry point, do not move) ·
  `helpers/` (args) · `stores/` (atomic, config, state, checkpoints) ·
  `services/` (catchup, shell-host) · `commands/` (one file per command)

## Conventions

- **TUI-first (player-facing primacy).** The interactive shell (`tt` with no args) is the
  PRIMARY surface — most players live in the TUI, not the command line. Every player-facing
  feature MUST be fully usable inside the TUI shell; NEVER ship a feature as CLI-only. A `tt
<verb>` subcommand is a secondary, scriptable convenience that mirrors a TUI flow — not a
  substitute for it. When you add a feature, wire its TUI page/entry point in the SAME change
  as the engine/CLI, with golden-frame coverage; if a capability can't yet land in the TUI
  (e.g. it needs text entry the shell lacks), say so explicitly and treat the TUI gap as
  unfinished work, not "done". (e.g. Battle is its own top-level shell page — pick a fighter (live
  pet or a battle-ready Dex record) vs. a pasted DNA code or an own-Dex pick — not only via `tt
  battle`.)
- TypeScript strict, ESM only, Node ≥ 20; moduleResolution Bundler (no `.js` import suffixes).
- **Filenames are kebab-case** (`scripts/check-kebab-case.sh` gates commits/CI).
  Only exceptions: conventional root files (README.md, LICENSE, SECURITY.md,
  CONTRIBUTING.md, CLAUDE.md, CODEOWNERS), SKILL.md (skill format),
  pull_request_template.md (GitHub-required), `__tests__`/`__snapshots__` dirs.
- All tests live in each project's root-level `__tests__/` folder (same level as
  `src/`, incl. fixtures and snapshots) — never inside `src/`.
- Renderer tests are golden frames (string-buffer snapshots); adapter tests use
  fixtures of real (anonymized) logs; engine tests assert determinism properties.
- **Seasons vs schema (front-end vs back-end):** the player-facing content era is the
  **Season** — the pack manifest's `season` number (starts at 0; renamed/renumbered from the
  old `revision`). It's the ONLY content-era number shown to players (Settings shows
  "Season N"; Dex/Archive completion is scoped to the current Season's `dexTotal`). All
  version numbers — `SCHEMA_VERSION` (save format), the pack's `schemaVersion` (JSON shape),
  and the DNA `content_min`/`contentVersion` hash floor — are **backend technical only and
  must never surface in the UI**. Keep those numbers in code/skills, not in player-facing copy.
- Game-state schema changes need a `schemaVersion` bump + migration in the cli store.
  Current `SCHEMA_VERSION` = 4. v3 added `state.dexRecords` (per-species top-3 snapshot
  store; cli back-fills from `archive`, auto-repairs corrupt saves —
  `apps/cli/src/stores/migrate-dex-records.ts`). v4 moved the cycle clock from
  per-adapter to a single pet-global `UserConfig.cycle` (CycleConfig); the cli config
  store (`apps/cli/src/stores/config.ts`) migrates old configs forward — synthesizes
  `cycle` from the legacy per-adapter `plan`/`cyclePolicy`/`weekAnchor` and slims each
  adapter to `{ provider, paths }`.
- User data: `~/.tokentamers/config.json` (UserConfig) + `state.json` (GameState) +
  `settings.json` (SettingsFile: `color` + `subcell` sprite-density + per-adapter `adapterRoots`)
  - `usage.json` (UsageSnapshot: captured `five_hour`/`seven_day` `resets_at`, see cycle rule).
    The `subcell` knob (`auto`|`octant`|`sextant`|`half`, default `auto`) picks the sub-cell render
    mode; `auto` resolves to the universally-safe `half` (block elements every terminal renders).
    octant/sextant are **explicit opt-in** — a cursor-width probe CANNOT detect font glyph coverage
    (the cursor advances by the Unicode width table, not glyph presence, so an octant measures 1
    column whether the terminal draws it or a width-1 tofu box, e.g. macOS Terminal.app), and there's
    no env-free capability query. **Zero env config:**
    the project reads nothing from `process.env` — the data dir is fixed at `~/.tokentamers`
    and all knobs live in `settings.json` (the cli reads it and threads values down; adapters
    get scan roots via `detect(roots)`, core/adapters never touch `process.env`). Tests
    redirect the data dir with `setDataDirForTesting`, not an env var.
- Canonical cycle rule: molts (5-h window close) are the evolution checkpoints (egg→sprite
  fast-hatches ~10 min after first usage); weekly rebirth never evolves the pet —
  it archives and re-eggs it. The weekly anchor never sits in the future
  (`effectiveWeekAnchor` slides its phase back), and its phase is the player's REAL
  subscription reset when captured: `tt statusline` records Claude Code's
  `rate_limits.*.resets_at` (stdin-only; persisted to no Claude file) into `usage.json`,
  which catch-up feeds as `weekAnchor`. `Engine.reconcile(now)` fires a one-time catch-up
  rebirth for a save that slipped past a boundary while a future anchor had rebirth frozen
  (idempotent; outside the deterministic `advanceTo`). Capture is opt-in & zero-network;
  with no statusline the engine falls back to inference. See `lifecycle-and-cycles.md`.
- Releases: tag `v*` → GitHub Actions builds binaries + GitHub Release.
- Git hooks (husky, auto-installed): pre-commit = lint-staged + fast invariant
  gates; commit-msg = Conventional Commits check — `<type>(<scope>)?: <description>`
  with type ∈ feat/fix/docs/chore/refactor/test/perf/build/ci/style/revert,
  lowercase description, no trailing period, header ≤ 72, body wrap 100;
  pre-push = full `pnpm check` + all gates. Never bypass with `--no-verify`.

## Design quick reference (full detail: docs/design/ + the skills below)

- **Pillars:** fully idle (zero required interaction — `tt init` is the only one,
  ever) · no model judgment · horizontal evolution (equal stat budgets) · version
  agnostic (hashes outlive versions) · provider agnostic · social by DNA codes ·
  fully local/zero internet (the GAME never networks; the only exception is the
  opt-in, off-by-default updater — see invariant 2) · completionist North Star (100% = Dex + achievements +
  habitats + trinkets; meter weighting 40/40/10/10) — scoped to the current **Season** so 100%
  is always reachable now.
- **Seasons:** the player-facing content cadence (the manifest's `season`, NOT a version
  number). Each Season bumps `season` and raises `dexTotal` to its own obtainable roster, so
  100% is always reachable now. Backend version numbers (schema/hash floor) stay out of
  player-facing copy. Roadmap:
  - **Season 0 — "Genesis" (current):** five House lines, 56 species, `season: 0`,
    `dexTotal: 56`. Shipped MVP **+ the Battle system (DONE, M2.2)** — pure `simulateBattle` in
    `packages/core/src/battle/`, the House wheel/proc ruleset as `ContentPack.battle` data,
    `tt battle [code]`, the top-level Battle TUI page (pick a fighter — live pet or a battle-ready
    Dex record — vs. a pasted DNA code or an own-Dex pick — `pages/battle-setup.ts`), grade
    stat-floor (`GRADE_STAT_FLOOR`, battle-only). Also DONE: **the unlockables/equip loop** — the
    **Loot** page (`pages/unlockables.ts`, habitats + trinkets, equip/unequip via
    `Engine.setSelectedHabitat`/`setSelectedTrinkets`) and the **Feats** page
    (`pages/achievements.ts`, earned shown, locked masked `???` + the description as a how-to hint),
    which **replaced the removed Archive page** end-to-end (no `tt archive`, no Archive TUI page —
    the engine `state.archive` mirror stays for back-compat). NO DNA apply/graft and NO leagues in
    Season 0.
  - **Season 1 — "Crossbreed" (next):** the **entire DNA grafting + fusion system** —
    `tt dna export`/`apply`, the graft engine (`GRAFT_POTENCY`, trait-splice, grade carry,
    S-spliced marker, one-per-life) AND the fusion content it produces (hybrid sub-lines, fusion
    pools, fusion Apex, Chimera-class, cutscenes/cosmetics). Bumps `season` 0 → 1.
  - **Season 2 — "Coliseum" (planned):** Leagues + standings, Drifter DNA, Codex adapter.
  - **Season 3 — "Tempest" (planned):** weather/live-ops + the full collections build-out
    (~120 achievements, full habitat/trinket sets). Long-term cross-Season vision ~112 Dex entries.
  - **"Atelier" (ongoing track):** art pipeline, hand-crafted sprites, future adapters, perf.
  - (S2/S3/Atelier names are provisional. Full deliverable lists: `docs/design/roadmap-retention-backlog.md` §18.)
- **Cycle:** molt = 5-h session-window close (the evolution/trait/mutation/grade
  moment; eggs fast-hatch ~10 min after first usage); rebirth = week boundary
  (archive + new egg, never evolves). ONE pet-global clock (`UserConfig.cycle`,
  never per adapter), chosen once at `tt init`: **subscription** (windows inferred
  from usage gaps in a chosen anchor adapter) vs **static** (fixed tiles from the
  week anchor). Adapters are pure data sources (`{provider, paths}`) — API and
  subscription usage within one adapter are undifferentiated essence (invariant 3).
- **Stages:** egg(Mote) → sprite → rookie → evolved → prime → apex; branch by
  rhythm / trait class / consistency / arc — all data-driven (`evolvesTo`).
  **Maturity-paced (~5-day climb):** a stage evolves only after accruing its
  `STAGE_MATURITY` molts (sprite 1, rookie 2, evolved 3, prime 4) AND clearing any
  `STAGE_GATE` (prime→apex needs grade ≥ B) — not one stage per molt. Tracked by
  `pet.stageMolts` (deterministic; SCHEMA_VERSION 2, cli migrates). The Pet page's
  "Grow" vitals row names the CURRENT stage + counts down to the next molt
  (`Evolved · 4h 59m 12s`, fill via `growthProgress`); the next FORM/branch stays hidden
  (amended evolution-mystery rule). At Apex it becomes the "Reborn Now" button —
  `Engine.rebornNow` forces an early rebirth (player action, no RNG, weekly clock
  unchanged), warn-then-confirm when grade ≠ S. Molt/rebirth countdowns come from
  `nextMoltCloseAt`/`nextRebirthAt` (pure forecasts) via `live.secsTo*`. See
  `engine/maturity.ts`, `cycle/index.ts`.
- **Houses (identity ONLY; mixed-provenance, NOT provider brands):** each House blends
  makers by theme, never all-Western/all-anything. Aether `claude-*`+`minimax*` WIS ·
  Cipher `gpt-*`/`o*`+`glm*`+`mimo*` PWR · Flux `gemini-*`+`qwen*`+`kimi*` SPD · Forge
  `llama*`/`mistral*`+`deepseek*` GRT · Wild = unmapped → The Bloom (plants, neutral; still a
  dormant gene that awakens to a mapped House later). Matching is
  case-insensitive; popular families only (rest stay Wild); model→House is freely
  re-balanced content data (NOT in `registry-freeze.json` — only ids are additive-only).
  The maker→House grouping never affects stats/grades/speed (invariant 3). Full map:
  `models.json` + `docs/design/evolution-grades-lineage.md` §Houses.
  **Per-install House spread (cosmetic):** at hatch the essence-winning House is "home";
  with probability `ContentPack.houseBias` (default 0.5) the pet keeps home, else the
  per-install `UserConfig.salt` deterministically picks another species-bearing House — so a
  whole org on ONE model doesn't all share a House. Pure fn of the salt (does NOT consume the
  molt RNG → existing pets' rolls unchanged, invariant 5); salt absent ⇒ legacy pure-model
  House. `biasedHouse`/`housesWithSpecies` in `engine/houses.ts`; salt minted at `tt init`.
- **Creature Kingdoms (sprite identity layer; cosmetic shape ONLY):** each House's species
  are a real creature family — Aether=Sky Court (flying), Cipher=Crag Beasts (ground predator),
  Flux=Tide Runners (aquatic), Forge=Iron Brood (robots), Wild=The Bloom (plants, green tint).
  All five lines SHIPPED (56 base species). Body-plan + signature motif carried across a line
  (lineage continuity); never affects mechanics
  (invariant 3). **Species size law (octant art direction v2, 2026-06-16):** square px egg 16 ·
  sprite 20 · rookie 24 · evolved 28 · prime 32 · apex 36 (even, height ÷4; apex 36 = renderer
  safe max; habitats 128×96 (4:3), trinkets 28×28); enforced by the content-pack test. Each
  species also declares a cosmetic per-species `accent` hex (a SECONDARY color, palette indices
  16–18; never affects mechanics — invariant 3). Bible:
  `docs/design/visuals-habitats-achievements.md` §13 + the `create-sprites` skill.
- **Grades:** C→B 25%, B→A 10%, A→S 3% base; activity modifier ×0.5–2.0 (model- and
  volume-blind); A→S cap ~6%; monotonic, no pity; odds always shown in UI (the pet
  page's **Odds** row = the live current→next forecast via `core.gradeOdds`). Plus a
  capped vitality bonus (+0.15 max at 200M session tokens) — the only volume input.
- **Rebirth:** stat carry-over 30% +10%/tier (cap 70%); new egg starts at C.
- **Dex records (unified source of truth):** `state.dexRecords` keeps each species'
  **top-3 DISTINCT lives** (ranked grade-desc, then stat-total), captured at every molt
  close, evolution, and rebirth (`engine/snapshot.ts` + `dex-records.ts`). One entry PER
  LIFE: `(speciesId, generation)` is the life-at-a-tier id, so repeated molt captures of the
  same species in one life collapse to that life's best peak (`rankBestPerLife`) — never 3
  near-duplicates from one life.
  `bestSpeciesRecords` derives best-per-species from `top[0]` (used by the Battle opponent
  picker); the legacy rebirth `archive` array is still written as a back-compat mirror (read by
  the grade/house achievements). The Archive page/`tt archive` were removed — its hall-of-fame
  role is covered by the Dex detail records. The **Dex is a per-House constellation** (`pages/dex.ts`
  - `pages/dex-sky.ts`): each House's evolution tree is a sky of glow-dot stars (owned
    glow in their best grade incl. the live pet's; unseen are dim `?` points), with a focus
    rail showing the selected star's real sprite or a square `?` tile (slate when locked, an
    ornate gold legend tile for reserved special slots — dormant in Season 0). The **Dex detail
    page** (`pages/dex-detail.ts`) is the drill-in: sprite, a battle/graft-readiness banner, and
    each record's stats + **DNA code** + graft tier.
- **DNA codes / battle-graft readiness:** `encodeDna`/`decodeDna` produce a shareable
  opaque `TTX<v>-XXXX-…` license-key token per snapshot. The codec is shipped; the code is
  display/share-only today (the Dex detail page shows it). **Battle (Season 0)** consumes a
  decoded code/snapshot read-only — you can `tt battle` your own archive records or a pasted
  foreign code, no apply needed. **DNA apply/grafting/fusion is Season 1** (the whole system).
  A snapshot is battle-eligible AND graft-eligible only once `stage` ≥ Evolved (the readiness
  gate). **Self-mirror rule:** you can't battle/graft your OWN pet against your OWN record of the
  **same species** (`sameSpecies` in `battle/`); a same-species match is allowed only vs ANOTHER
  player (a pasted foreign code, decoded `speciesId` empty), and any DIFFERENT species (yours or
  foreign) is always allowed. Graft potency scales with the DONOR's grade (C = 0 … S = small hard
  cap) — a documented forward spec (`dna-hash-battles.md` §9) + the pure `graftPotency` helper (Season-1 engine).
- **Scope (Season-mapped; M-ids = engineering milestones):**
  - **Season 0 — "Genesis":** **shipped** = Claude Code + OpenCode adapters, all five house
    lines (Aether/Cipher/Flux/Forge/Wild-Bloom, 56 species), shell with Pet/Dex/Loot/Feats/Settings
    (the **Loot** + **Feats** pages replaced the removed Archive page), the per-species Dex record
    store + detail view, the DNA **encoder** (M2.1, codec only), the **Battle** system (M2.2 —
    `core/src/battle/`, `ContentPack.battle`, `tt battle`, Battle page), and the
    **unlockables/equip loop** (Loot/Feats pages, the content-free subset of M2.5). Season 0 is now
    feature-complete.
  - **Season 1 — "Crossbreed":** the entire **DNA apply + grafting + fusion** system (M2.3) +
    the hybrid/fusion **content** (the "Crossbreed" pack).
  - **Season 2 — "Coliseum":** Leagues/standings + Drifter (M2.6) + Codex adapter (M2.4).
  - **Season 3 — "Tempest":** weather/live-ops (M2.7) + full collections build-out (rest of M2.5).
  - **"Atelier" (ongoing):** M3 = art pipeline, future adapters, polish — alongside every Season.
  - Single source of truth for deliverables: `docs/design/roadmap-retention-backlog.md` §18.

## AI-native development policy (full text: docs/design/architecture.md)

Humans own architecture and contracts; CI owns quality and performance; AI writes
the code. Mechanical countermeasures are already wired (import-boundary lint,
zero-deps gate, determinism tests, golden frames, fixture suites). Process rules:
keep CLAUDE.md + skills current (a stale CLAUDE.md is a project bug); small PRs, one
concern each, invariant checklist in the description; architecture changes require a
`docs/design/` update in the same PR; perf ceiling lives in the architecture — implement
within it.

## Project skills (.claude/skills/) — read the relevant one BEFORE working in its area

- `develop-game-engine` — cycle policies, molts/rebirth, evolution, traits, grade
  rolls, lineage/Archive, determinism rules (packages/core)
- `develop-tui-renderer` — 4:3 canvas law, diff renderer, sub-cell (sextant/octant) compositor, SGR mouse,
  perf budgets, golden-frame testing (packages/tui)
- `develop-adapters` — UsageEvent contract + per-provider quirks: Claude Code
  30-day deletion, Codex cumulative deltas/format generations, OpenCode storage
  tree (packages/adapters)
- `maintain-content-packs` — schemas, additive-only registries, the full evolution
  tree incl. reserved future names, achievements/habitats/trinkets (packages/content)
- `create-sprites` — art direction, palette indirection, grade beauty ladder,
  originality rules (any sprite asset)
- `write-wiki-docs` — docs style, pledges, grade-odds transparency, spoiler policy
  (docs/wiki, README)
- `maintain-updater` — the opt-in auto-updater: the ONE sanctioned network surface,
  off-by-default, trust model, isolation gates (apps/cli/src/services/updater)
