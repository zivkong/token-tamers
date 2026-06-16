# Token Tamers — project memory

A fully idle, fully offline terminal virtual pet raised by the developer's real AI
coding-agent usage. Full design reference: `docs/design/` (the contract for everything, extracted in
full from the v1.0.3 design baseline).

## Architecture map

```
[adapters] ──normalized UsageEvent──▶ [core engine] ──GameState/effects──▶ [tui shell]
 (claude-code, …)                      cycle policies, evolution,           diff renderer,
 read local logs only                  grades, achievements                 half-block sprites
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
   `models.json`; they must NEVER affect stats, grades, rarity, or speed.
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
  append-only registry)
- `packages/tui/src/` — `terminal/` (ansi, input) · `render/` (buffer, sprite,
  layout, hit, frame, menu) · `components/` (shared UI: divider, meter — one
  standardized look) · `pages/` (incl. `dex-detail` — the per-species record view)
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
  `settings.json` (SettingsFile: `color` + per-adapter `adapterRoots`). **Zero env config:**
  the project reads nothing from `process.env` — the data dir is fixed at `~/.tokentamers`
  and all knobs live in `settings.json` (the cli reads it and threads values down; adapters
  get scan roots via `detect(roots)`, core/adapters never touch `process.env`). Tests
  redirect the data dir with `setDataDirForTesting`, not an env var.
- Canonical cycle rule: molts (5-h window close) are the evolution checkpoints (egg→sprite
  fast-hatches ~10 min after first usage); weekly rebirth never evolves the pet —
  it archives and re-eggs it.
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
  number). **Season 0 — "Genesis"** is the launch content (five House lines, 56 species,
  `season: 0`, `dexTotal: 56`). Each later Season is a quarterly additive pack that bumps
  `season` and raises `dexTotal` to its obtainable roster. **Season 1 — "Crossbreed"** (future,
  M2.7) opens the first hybrid line + DNA fusion pools. The long-term cross-Season vision is
  ~112 Dex entries. Backend version numbers (schema/hash floor) stay out of player-facing copy.
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
  abstract "Grow" vitals row surfaces it via `growthProgress` WITHOUT leaking
  stage/count/next-form (evolution-mystery rule). See `engine/maturity.ts`.
- **Houses (identity ONLY; mixed-provenance, NOT provider brands):** each House blends
  makers by theme, never all-Western/all-anything. Aether `claude-*`+`minimax*` WIS ·
  Cipher `gpt-*`/`o*`+`glm*`+`mimo*` PWR · Flux `gemini-*`+`qwen*`+`kimi*` SPD · Forge
  `llama*`/`mistral*`+`deepseek*` GRT · Wild = unmapped → The Bloom (plants, neutral; still a
  dormant gene that awakens to a mapped House later). Matching is
  case-insensitive; popular families only (rest stay Wild); model→House is freely
  re-balanced content data (NOT in `registry-freeze.json` — only ids are additive-only).
  The maker→House grouping never affects stats/grades/speed (invariant 3). Full map:
  `models.json` + `docs/design/evolution-grades-lineage.md` §Houses.
- **Creature Kingdoms (sprite identity layer; cosmetic shape ONLY):** each House's species
  are a real creature family — Aether=Sky Court (flying), Cipher=Crag Beasts (ground predator),
  Flux=Tide Runners (aquatic), Forge=Iron Brood (robots), Wild=The Bloom (plants, green tint).
  All five lines SHIPPED (56 base species). Body-plan + signature motif carried across a line
  (lineage continuity); never affects mechanics
  (invariant 3). **Species size law (2026-06-15, higher-res):** square px egg 12 · sprite 16 ·
  rookie 20 · evolved 24 · prime 28 · apex 32 (apex = renderer safe max; habitats 96×48,
  trinkets 20×20); enforced by the content-pack test. Bible:
  `docs/design/visuals-habitats-achievements.md` §13 + the `create-sprites` skill.
- **Grades:** C→B 25%, B→A 10%, A→S 3% base; activity modifier ×0.5–2.0 (model- and
  volume-blind); A→S cap ~6%; monotonic, no pity; odds always shown in UI (the pet
  page's **Odds** row = the live current→next forecast via `core.gradeOdds`). Plus a
  capped vitality bonus (+0.15 max at 200M session tokens) — the only volume input.
- **Rebirth:** stat carry-over 30% +10%/tier (cap 70%); new egg starts at C.
- **Dex records (unified source of truth):** `state.dexRecords` keeps each species'
  **top-3** snapshots (ranked grade-desc, then stat-total), captured at every molt
  close, evolution, and rebirth (`engine/snapshot.ts` + `dex-records.ts`). The
  Archive view derives best-per-species from `top[0]` (`bestSpeciesRecords`); the
  legacy rebirth `archive` array is still written as a back-compat mirror (read by
  the grade/house achievements). The Dex list colors each row by its highest
  recorded grade (incl. the live pet's current grade); the **Dex detail page**
  (`pages/dex-detail.ts`) shows the sprite, a battle/graft-readiness banner, and
  each record's stats + **DNA code** + graft tier.
- **DNA codes / battle-graft readiness:** `encodeDna`/`decodeDna` produce a shareable
  opaque `TTX<v>-XXXX-…` license-key token per snapshot; battle/fusion (M2.2/M2.3) stay
  future, so the code is display/share-only for now. A snapshot is battle-eligible AND graft-eligible only
  once `stage` ≥ Evolved (the readiness gate). Graft potency scales with the DONOR's
  grade (C = 0 … S = small hard cap) — a documented forward spec
  (`dna-hash-battles.md` §9) + the pure `graftPotency` helper.
- **Scope:** M1 (shipped) = Claude Code + OpenCode adapters, all five house lines
  (Aether/Cipher/Flux/Forge/Wild-Bloom, 56 species), shell with
  Pet/Dex/Archive/Settings, the per-species Dex record store + detail view, and the
  DNA **encoder** (M2.1 pulled forward — codec only; battle/fusion still future).
  M2.2–M2.7 = battle engine, DNA apply/fusion (grafting), Codex adapter,
  collections/deco, leagues/drifter, weather/seasons. M3 = art pipeline, future
  adapters, polish.

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
- `develop-tui-renderer` — 4:3 canvas law, diff renderer, half-blocks, SGR mouse,
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
