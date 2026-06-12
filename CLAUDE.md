# Token Tamers — project memory

A fully idle, fully offline terminal virtual pet raised by the developer's real AI
coding-agent usage. Full design: `token-tamers-design.md` (the contract for everything).

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
   All power normalizes to the player's own per-adapter baseline.
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

## Commands

- `pnpm install` · `pnpm check` (typecheck+lint+format+test+build)
- `pnpm test` / `pnpm test:watch` · `pnpm lint` · `pnpm typecheck` · `pnpm build`
- Run dev build: `pnpm --filter token-tamers dev` (or `node apps/cli/dist/tt.js`)
- Zero-network / spoiler gates: `pnpm check:network` · `pnpm check:spoilers`

## Conventions

- TypeScript strict, ESM only, Node ≥ 20; moduleResolution Bundler (no `.js` import suffixes).
- Renderer tests are golden frames (string-buffer snapshots); adapter tests use
  fixtures of real (anonymized) logs; engine tests assert determinism properties.
- Game-state schema changes need a `schemaVersion` bump + migration in the cli store.
- User data: `~/.tokentamers/config.json` (UserConfig) + `state.json` (GameState).
- Canonical cycle rule: molts (5-h window close) are the ONLY evolution checkpoints;
  weekly rebirth never evolves the pet — it archives and re-eggs it.
- Releases: tag `v*` → GitHub Actions builds binaries + GitHub Release.

## Project skills (.claude/skills/)

`sprite-design` (art rules), `content-pack` (schemas/additive rules),
`adapter-dev` (UsageEvent contract, provider quirks), `wiki-writer` (docs style +
spoiler policy). Read the relevant skill before working in its area.
