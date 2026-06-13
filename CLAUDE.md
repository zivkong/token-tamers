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
2. **Zero network code anywhere** — no fetch/telemetry/update checks.
   `scripts/check-zero-network.sh` + ESLint ban network modules.
3. **No model judgment** — model IDs map to Houses (identity/cosmetics) via
   `models.json`; they must NEVER affect stats, grades, rarity, or speed.
   Grade odds normalize to the player's own per-adapter baseline (the activity
   modifier stays model- AND volume-blind). The ONE sanctioned exception is the
   **capped vitality bonus**: a separate, additive, hard-capped grade-roll bonus
   from the session's raw token volume (full at `VITALITY_FULL_TOKENS` = 200M,
   max `+VITALITY_MAX_BONUS` = 0.15) — never model-dependent, never able to
   dominate base odds (see `evolution-grades-lineage.md` §12).
4. **Import boundaries** — `core` imports nothing (not even `node:*`); `tui`/`adapters`
   import `core` only, never each other; ESLint enforces.
5. **Deterministic core** — no `Date.now()`/`new Date()`/`Math.random()` in
   `packages/core/src`; use event timestamps + the seeded RNG. Same state + same
   events + same clock ⇒ identical results, forever.
6. **Additive-only registries** — never remove/renumber species, trait, achievement,
   habitat, or trinket ids. Unknown ids = dormant genes, render as "???".
7. **Hashes parse forever** — DNA/hash codecs are versioned; old codes stay valid.
8. **Zero runtime dependencies** — devDependencies only; the `tt` bundle is self-contained.
9. **Content as data** — never hardcode species/model/trait specifics in engine code.
10. **Spoiler rule** — fusion-pool contents exist only under `packages/content/content/`;
    docs/wiki may hint, never reveal. `scripts/check-spoilers.sh` enforces.
11. **Never weaken a test to pass a PR.** Tests encode design-doc contracts.
12. **Supply-chain rules** — GitHub Actions pinned to full commit SHAs only
    (`scripts/check-workflow-pins.sh`); dependency lifecycle scripts blocked except
    the `allowBuilds` allowlist; `minimumReleaseAge: 4320` (3-day cooldown) stays;
    runtime deps stay at zero (`scripts/check-runtime-deps.sh`); never echo untrusted
    GitHub event data (`github.event.*`, `github.head_ref`) into workflow `run:` blocks.

## Commands

- `pnpm install` · `pnpm check` (typecheck+lint+format+test+build)
- `pnpm test` / `pnpm test:watch` · `pnpm lint` · `pnpm typecheck` · `pnpm build`
- Dev from source (no build, `tsx`): `pnpm dev [args]` · hot reload: `pnpm dev:watch`
  (e.g. `pnpm dev status`). Built bundle: `pnpm build` then `node apps/cli/dist/tt.js`
- Zero-network / spoiler gates: `pnpm check:network` · `pnpm check:spoilers`

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
  rebirth, achievements, baseline, completion, constants, index)
- `packages/tui/src/` — `terminal/` (ansi, input) · `render/` (buffer, sprite,
  layout, hit, frame) · `pages/` · `helpers/` (status, lookup) · `shell.ts`
- `packages/adapters/src/` — `index.ts` (contracts + registry) · `helpers/`
  (jsonl incremental reading, shared by future adapters) · `<provider>/`
  (index = detect/scan, parse = record→UsageEvent)
- `packages/content/src/` — `index.ts` (pack assembly) · `validate.ts` ·
  `models.ts`; JSON under `content/` (ONE additive tree + `registry-freeze.json`,
  never versioned folders — revision number in the pack manifest); `tools/`
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
- Game-state schema changes need a `schemaVersion` bump + migration in the cli store.
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
  fully local/zero internet · completionist North Star (100% = Dex + achievements +
  habitats + trinkets; meter weighting 40/40/10/10).
- **Cycle:** molt = 5-h session-window close (the evolution/trait/mutation/grade
  moment; eggs fast-hatch ~10 min after first usage); rebirth = week boundary
  (archive + new egg, never evolves).
  Dynamic policy (subscriptions, inferred windows) vs static (API/fixed anchor).
- **Stages:** egg(Mote) → sprite → rookie → evolved → prime → apex; branch by
  rhythm / trait class / consistency / arc — all data-driven (`evolvesTo`).
- **Houses (identity ONLY):** Aether `claude-*` WIS · Cipher `gpt-*`/`o*` PWR ·
  Flux `gemini-*` SPD · Forge open-weight GRT · Wild unmatched ("???" dormant gene).
- **Grades:** C→B 25%, B→A 10%, A→S 3% base; activity modifier ×0.5–2.0 (model- and
  volume-blind); A→S cap ~6%; monotonic, no pity; odds always shown in UI. Plus a
  capped vitality bonus (+0.15 max at 200M session tokens) — the only volume input.
- **Rebirth:** stat carry-over 30% +10%/tier (cap 70%); new egg starts at C;
  Archive keeps one strictly-best record per species.
- **Scope:** M1 (shipped) = Claude Code adapter, Aether+Cipher lines, shell with
  Pet/Dex/Archive/Settings. M2 = Codex/OpenCode adapters, Flux/Forge/hybrids, DNA, battles,
  leagues. M3 = seasons, weather events, sprite compiler.

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
  tree incl. reserved M2 names, achievements/habitats/trinkets (packages/content)
- `create-sprites` — art direction, palette indirection, grade beauty ladder,
  originality rules (any sprite asset)
- `write-wiki-docs` — docs style, pledges, grade-odds transparency, spoiler policy
  (docs/wiki, README)
