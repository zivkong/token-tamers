# Contributing to Token Tamers

Thanks for taming with us! This project is **AI-native**: it is built entirely with AI
coding agents (Claude Code first — contributors may use any assistant). That works
because the guardrails are mechanical: humans own architecture and contracts, CI owns
quality, AI writes the code. Please read this page and `CLAUDE.md` before opening a PR —
if you use Claude Code, your agent reads `CLAUDE.md` and the project skills automatically.

## Dev setup

```sh
corepack enable            # provides pnpm (version pinned in package.json)
git clone https://github.com/zivkong/token-tamers.git
cd token-tamers
pnpm install
pnpm check                 # typecheck + lint + format + tests + build
node apps/cli/dist/tt.js   # run your build
```

Requirements: Node ≥ 20, pnpm (via corepack). No other tooling.

## Repository layout

```
packages/core      engine: cycle policies, evolution, grades, achievements (PURE, deterministic)
packages/tui       shell: frame buffer, diff renderer, half-block sprites, mouse, pages
packages/adapters  provider adapters (claude-code; codex/opencode planned)
packages/content   versioned content packs (species, traits, sprites, achievements)
apps/cli           the `tt` binary wiring everything together
docs/wiki          player & contributor wiki (synced to the GitHub wiki)
```

## Non-negotiable invariants

Every PR is checked against these — by ESLint rules, CI scripts, and review:

1. **Read-only observer.** The game never calls an AI API and never spends user quota.
2. **Zero network code.** No fetch, no telemetry, no update checks — anywhere.
   `scripts/check-zero-network.sh` fails CI on violation.
3. **No model judgment.** Model choice may influence species identity/cosmetics only —
   never stats, grades, rarity, or progression speed.
4. **Import boundaries.** `core` imports nothing (not even `node:*`); `tui` and
   `adapters` import only `core`; never each other. Enforced by ESLint.
5. **Deterministic core.** No `Date.now()`, `new Date()`, or `Math.random()` in
   `packages/core` — time and randomness enter as data. Enforced by ESLint.
6. **Additive-only registries.** Never remove or renumber a species/trait/achievement id.
   Retired content becomes "Ancient", it never disappears.
7. **Zero runtime dependencies.** Adding a production dependency requires a linked,
   approved issue first.
8. **No spoilers in docs.** Fusion-pool contents live only under `packages/content/` —
   the wiki hints, it never reveals. `scripts/check-spoilers.sh` fails CI on violation.
9. **Don't weaken tests to pass a PR.** Tests assert design-doc contracts, not current
   behavior.

## Supply-chain security

See [SECURITY.md](SECURITY.md) for the full picture. The rules contributors hit daily:

- **Dependency lifecycle scripts are blocked.** Only `esbuild` may run install scripts
  (`allowBuilds` in `pnpm-workspace.yaml`). Never broaden that list in a feature PR.
- **3-day release cooldown.** pnpm refuses package versions younger than 3 days
  (`minimumReleaseAge`). If an install fails on a brand-new version, wait — that delay
  is a worm defense, not a bug.
- **GitHub Actions must be pinned to full commit SHAs** with a `# vX.Y.Z` comment.
  `scripts/check-workflow-pins.sh` fails CI on any mutable tag.
- **Dev-dependency changes** get extra scrutiny (CODEOWNERS + dependency review +
  Dependabot cooldown). Don't bundle them into unrelated PRs.

## Pull requests

- Small PRs, one concern each.
- Run `pnpm check` locally before pushing.
- PRs that change architecture (package boundaries, engine event flow, renderer design)
  require a design-doc update in the same PR.
- Include the invariant checklist in your description: offline ✓ read-only ✓
  no-model-judgment ✓ additive-only ✓ no spoilers ✓.

## Testing conventions

- Unit tests live next to source (`*.test.ts`) and run with Vitest (`pnpm test`).
- The renderer is tested with **golden frames**: render to a string buffer and snapshot.
- Adapters are tested with **fixtures**: anonymized real log samples under
  `packages/adapters/test/fixtures/`.
- Engine tests assert determinism: same saved state + same events + same clock ⇒
  identical results.

## Content packs

Content is data, not code. Species, traits, models, achievements, habitats, trinkets and
sprites live in versioned JSON under `packages/content/content/v1/`. Sprites are
palette-indexed grids (never RGB); grade and House select colors at render time. See the
`content-pack` and `sprite-design` skills under `.claude/skills/` for the full rules.

## Releases

Maintainers release by tagging: `git tag v0.x.y && git push --tags`. GitHub Actions
builds standalone binaries for Linux (x64/arm64), macOS (x64/arm64) and Windows (x64),
plus a portable `tt.js`, and attaches them with checksums to a GitHub Release.

## License

MIT — by contributing you agree your contributions are licensed under it.
