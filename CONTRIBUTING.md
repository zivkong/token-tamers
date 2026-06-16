<div align="center">

# 🛠️ Contributing to Token Tamers

### Welcome, Tamer-of-code. Let's raise something great together.

</div>

Thanks for taming with us! 🐲 Token Tamers is **AI-native open source** — it's built entirely
with AI coding agents (Claude Code first; bring any assistant you like). That works because
the guardrails are **mechanical**, not vibes:

> **Humans own architecture & contracts · CI owns quality · AI writes the code.**

So you don't have to memorize a rulebook — the rails catch you. Make small, focused changes,
let the gates run, and you'll be fine. This page walks you the whole way: **clone → run from
source → make a change → open a PR.** Two minutes of reading saves you a red CI run.

> 💡 Using Claude Code? Your agent automatically reads [`CLAUDE.md`](CLAUDE.md) and the project
> skills under [`.claude/skills/`](.claude/skills/). Skim `CLAUDE.md` once yourself too — it's
> the source of truth for every invariant below.

---

## 🚀 Quick start (clone → running in &lt; 2 minutes)

**Prereqs:** **Node ≥ 20** and **pnpm** (via Corepack — nothing else to install).

```sh
# 1. Get pnpm (ships with Node, just turn it on)
corepack enable

# 2. Clone & install
git clone https://github.com/zivkong/token-tamers.git
cd token-tamers
pnpm install            # also installs the git hooks that keep your PRs green

# 3. Prove it's healthy
pnpm check              # typecheck · lint · format · test · build — the full CI gate
```

If `pnpm check` is green, you're ready to build something. 🎉

---

## 🔥 Local development

The whole app runs **straight from TypeScript source** — no build step, no per-package
compile. Get your one-time pet set up, then start the hot-reloading shell:

```sh
pnpm dev init           # one-time setup (writes to ~/.tokentamers)
pnpm dev:watch          # run the shell from source with hot reload — press 4 for Settings
```

Your everyday toolbox:

| Command           | What it does                                                                          |
| ----------------- | ------------------------------------------------------------------------------------- |
| `pnpm dev`        | Run `tt` straight from TypeScript source via `tsx` — no build step                    |
| `pnpm dev:watch`  | Same, with **hot reload**: restarts on any source edit, in any workspace package      |
| `pnpm dev <args>` | Forward a command/flag, e.g. `pnpm dev status`, `pnpm dev init`, `pnpm dev --version` |
| `pnpm test`       | Run the Vitest suite once                                                             |
| `pnpm test:watch` | Run the test suite in watch mode while you work                                       |
| `pnpm build`      | Bundle the standalone binary → run it with `node apps/cli/dist/tt.js`                 |
| `pnpm check`      | The full gate CI runs: typecheck · lint · format · test · build                       |

A few things worth knowing before you dive in:

- **No per-package build.** Every workspace package exports its `src/index.ts`, so `tsx`
  resolves the whole app from source — edits anywhere under `packages/*/src` or `apps/cli/src`
  are picked up on the next `dev:watch` restart.
- **Bare `pnpm dev` opens the interactive shell**, which needs a one-time `pnpm dev init`
  first. The TUI takes over the terminal; `q` or `Ctrl-C` exits, and `dev:watch` re-launches
  it after each save.
- **Config lives in files, never environment variables.** Token Tamers reads **zero** config
  from `process.env`. Preferences go in `~/.tokentamers/settings.json` (hand-editable): `color`
  (`auto` · `truecolor` · `256` · `8` · `none`) and `adapterRoots` — override where each adapter
  scans, e.g. point `claude-code` at a fixture dir. The data dir itself is fixed at
  `~/.tokentamers`; **dev shares your real store**, so inspect and commit with that in mind.
- **Tests redirect the data dir** with `setDataDirForTesting`, not an env var — keep it that way.

---

## 🗺️ Repository layout

```
packages/core      engine: cycle policies, evolution, grades, achievements (PURE, deterministic)
packages/tui       shell: frame buffer, diff renderer, half-block sprites, mouse, pages
packages/adapters  provider adapters (claude-code, opencode; codex planned)
packages/content   content packs (species, traits, sprites, achievements) — data, not code
apps/cli           the `tt` binary wiring everything together
docs/wiki          player & contributor wiki
docs/design        the design contract — change architecture here, in the same PR
```

Inside each package, folders are organized **by responsibility** (e.g. `helpers/`, `stores/`,
`services/`, `commands/`, `terminal/`, `render/`, `engine/`) — see the **Code structure**
section of [`CLAUDE.md`](CLAUDE.md). KISS / SRP ceilings are enforced by ESLint (complexity ≤ 20,
nesting ≤ 4, params ≤ 5, file length ≤ 400 lines), and duplication is watched by `pnpm check:dup`
(jscpd). If a rule trips, **split the module by responsibility — never add a lint-disable.**

**Filenames are kebab-case** (enforced by `scripts/check-kebab-case.sh` in hooks and CI; the
only exceptions are conventional root files like `README.md`, GitHub-required names, and
`__tests__` / `__snapshots__` dirs).

### 📚 Working in a specific area? Read its skill first.

Each package has a deep-dive skill under [`.claude/skills/`](.claude/skills/) — read the
relevant one **before** you start:

| You're touching…     | Read this skill          |
| -------------------- | ------------------------ |
| `packages/core`      | `develop-game-engine`    |
| `packages/tui`       | `develop-tui-renderer`   |
| `packages/adapters`  | `develop-adapters`       |
| `packages/content`   | `maintain-content-packs` |
| any sprite asset     | `create-sprites`         |
| docs / wiki / README | `write-wiki-docs`        |
| the auto-updater     | `maintain-updater`       |

---

## 🚧 The non-negotiable invariants

These are the soul of the project — every PR is checked against them by ESLint, CI scripts, and
review. They're not bureaucracy; they're the **promises we make to players** (see the three
pledges in the [README](README.md)). The good news: the gates tell you immediately when you trip
one.

1. **Read-only observer.** The game never calls an AI API and never spends user quota.
2. **Zero network code.** No fetch, no telemetry, no update checks — anywhere except the one
   audited, opt-in updater file. `scripts/check-zero-network.sh` + `check-updater-isolation.sh`
   fail CI on violation.
3. **No model judgment.** Model choice may influence species identity / cosmetics only — never
   stats, grades, rarity, or progression speed.
4. **Import boundaries.** `core` imports nothing (not even `node:*`); `tui` and `adapters`
   import only `core`, never each other. Enforced by ESLint.
5. **Deterministic core.** No `Date.now()`, `new Date()`, or `Math.random()` in `packages/core` —
   time and randomness enter as data. Enforced by ESLint.
6. **Additive-only registries.** Never remove or renumber a species / trait / achievement id.
   Retired content goes dormant ("???"), it never disappears. Enforced by the registry-freeze
   test (`packages/content/content/registry-freeze.json`).
7. **Zero runtime dependencies.** The `tt` bundle is self-contained — devDependencies only.
   Adding a production dependency requires a linked, approved issue first.
8. **No spoilers in docs.** Fusion-pool contents live only under `packages/content/` — the wiki
   hints, it never reveals. `scripts/check-spoilers.sh` fails CI on violation.
9. **Don't weaken tests to pass a PR.** Tests assert design-doc contracts, not current behavior.

---

## 🧪 Testing conventions

Every change ships with tests. The patterns by package:

- **Location:** all tests live in each project's root-level `__tests__/` folder (same level as
  `src/`) as `*.test.ts`, run with **Vitest** (`pnpm test`). Fixtures and snapshots live inside
  `__tests__/` too — never inside `src/`.
- 🖼️ **Renderer → golden frames.** Render to a string buffer and snapshot it. Update intentional
  changes with Vitest's snapshot update; never hand-edit a snapshot to make red go green.
- 🔌 **Adapters → fixtures.** Anonymized real log samples under
  `packages/adapters/__tests__/fixtures/`.
- ⚙️ **Engine → determinism.** Same saved state + same events + same clock ⇒ identical results.

---

## 🧬 Content packs (species, sprites, achievements…)

Content is **data, not code**. Species, traits, models, achievements, habitats, trinkets and
sprites live in ONE additive JSON tree under `packages/content/content/` (no versioned folders —
ids are immutable instead). Every id ever shipped is recorded in `content/registry-freeze.json`;
new content must be added there **in the same PR**, and removing / renumbering anything fails the
freeze test. Sprites are **palette-indexed grids** (never RGB); grade and House select colors at
render time. Read the `maintain-content-packs` and `create-sprites` skills before you start.

---

## 🔐 Supply-chain security

See [SECURITY.md](SECURITY.md) for the full picture. The rules you'll hit day to day:

- **Dependency lifecycle scripts are blocked.** Only the `allowBuilds` allowlist in
  `pnpm-workspace.yaml` may run install scripts. Never broaden it in a feature PR.
- **1-day release cooldown.** pnpm refuses package versions younger than 24h
  (`minimumReleaseAge`). If an install fails on a brand-new version, **wait** — that delay is a
  supply-chain worm defense, not a bug.
- **GitHub Actions must be pinned to full commit SHAs** with a `# vX.Y.Z` comment.
  `scripts/check-workflow-pins.sh` fails CI on any mutable tag.
- **Dev-dependency changes** get extra scrutiny (CODEOWNERS + dependency review + Dependabot
  cooldown). Don't bundle them into unrelated PRs.

---

## ✍️ Commits &amp; git hooks (husky)

Hooks install automatically on `pnpm install` (via the `prepare` script) and gate every commit
and push — so red CI almost never surprises you:

- 🪝 **pre-commit** — `lint-staged` (Prettier + ESLint `--fix` on staged files only) plus the
  fast invariant gates (zero-network, runtime-deps, workflow-pins, spoilers). Takes seconds.
- 🪝 **commit-msg** — enforces the commit format below (`scripts/check-commit-msg.mjs`).
- 🪝 **pre-push** — the full `pnpm check` plus all invariant gates. If this is red, CI would be
  red too.

**Never bypass with `--no-verify`** — it's for genuine emergencies on your own fork only, and
the PR will fail CI anyway.

**Commit message format — [Conventional Commits](https://www.conventionalcommits.org/):**

```
<type>(<scope>)?: <description>

[optional body, wrapped at 100 chars]

[optional footers, e.g. BREAKING CHANGE: …]
```

- **Types:** `feat` `fix` `docs` `chore` `refactor` `test` `perf` `build` `ci` `style` `revert`.
  Append `!` for breaking changes (`feat(core)!: …`).
- **Scope** (optional): lowercase kebab-case — typically the package or area: `core`, `tui`,
  `adapters`, `content`, `cli`, `deps`, `hooks`, `wiki`.
- **Description:** imperative mood, lowercase start, no trailing period; whole header ≤ 72 chars.
  Example: `feat(core): add static cycle-policy DST handling`.
- **Body:** separated by a blank line, wrapped at 100 chars (URLs and `Key: value` trailers
  exempt). Merge / revert / fixup subjects are exempt (git generates them).

---

## 🎯 Opening a pull request

The home stretch. Keep it small and the review is fast:

1. **One concern per PR.** Small, focused diffs get merged; sprawling ones stall.
2. **Run `pnpm check` locally before pushing.** (The pre-push hook does it too, but catching it
   early is faster.)
3. **Architecture changes need a `docs/design/` update in the same PR** — package boundaries,
   engine event flow, renderer design. Contracts and code move together.
4. **TUI-first:** every player-facing feature must be usable inside the `tt` shell, with
   golden-frame coverage — not CLI-only. A `tt <verb>` subcommand mirrors a TUI flow; it never
   substitutes for one.
5. **Drop the invariant checklist in your description:**

   ```
   offline ✓   read-only ✓   no-model-judgment ✓   additive-only ✓   no-spoilers ✓
   ```

That's it — open the PR and a maintainer will take it from there. 🚀

---

## 🏷️ Releases (maintainers)

Maintainers release by tagging: `git tag v0.x.y && git push --tags`. GitHub Actions builds
standalone binaries for Linux (x64/arm64), macOS (x64/arm64) and Windows (x64), plus a portable
`tt.js`, and attaches them with checksums to a GitHub Release.

---

## 📜 License

MIT — by contributing you agree your contributions are licensed under it.

<div align="center">

**Now go raise something legendary.** 🐲✨

</div>
