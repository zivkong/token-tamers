# Token Tamers — Technical Architecture & AI-Native Development Policy

Derived from the v1.0.3 design baseline. This document covers design §15 in full and the
AI-Native Development Policy from §17 in full. The repo-layout section of §17 is compressed
to a pointer (CLAUDE.md and CONTRIBUTING.md now own it); the CLAUDE.md/skills/wiki plans from
§17 are noted as implemented (see `.claude/skills/` and `docs/wiki/`).

---

## TUI Shell: Top-Oriented Full-Width Stack, Menu-After-Canvas (design baseline §15, layout rev 1.1)

**Layout law:** the UI is a **top-oriented, full-width vertical stack** — sections stack from
row 0 with **no letterbox gutters and no side padding**, and the menu is a **grid docked
immediately AFTER the canvas**, not at the terminal bottom. Any slack falls below the menu.
All UI is mouse-clickable — menu first and foremost — with full keyboard parity.

> Layout rev 1.1 supersedes the original "centered 4:3 canvas + bottom-docked menu bar". The
> game canvas is now full-bleed (edge-to-edge); the prior centered-canvas/letterbox model is
> retired. The pixel-art _scene aspect_ is preserved by scaling, not by letterboxing.

### Section Stack & Canvas Math

The frame is a column of full-width sections (see `packages/tui/src/render/layout.ts`):

1. **Header band** (top, `headerRows`) — pet name/grade/stage + gen/molt, then identity/traits.
2. **Game canvas** (full width) — the habitat scene scaled to fill edge-to-edge.
3. **Status band** (`statusRows`) — last grade-roll odds + the home habitat.
4. **Menu grid** — placed right after the canvas.

Cells aren't square (~1:2 w:h) and half-blocks give 2 vertical pixels per cell. Habitat
scenes are fixed 96×48 px art (96 cols × 24 cell-rows → a 4:1 cell aspect). The canvas spans
the **full terminal width** and the scene height tracks that 4:1 aspect (`sceneRows ≈
cols/4`), capped to the rows available above the menu, so the backdrop **scales uniformly to
fill the width with no padding and no distortion** (nearest-neighbor, via `drawSprite`'s
`destW`/`destH`). Minimum terminal 64×24. Canvas hosts: pet + habitat + trinkets, cutscenes,
battle view, and full-screen pages (Dex, Archive, Settings) drawn in the same content region.

### Menu Grid Spec

A responsive grid docked immediately after the canvas (never the terminal bottom):

```
[♥ Pet] [☰ Dex] [◆ Archive] [⚙ Settings] [⏻ Quit] [ ███░░░░ 67.4% ]   <- 6 columns (wide)
```

The 5 nav buttons plus the live Completion Meter flow across **6 columns on wide terminals
(≥72 cols), wrapping to 3 columns over 2 rows on narrow ones**. The meter cell shows a mini
bar + `NN.N%`. Click
to switch pages; active page highlighted; hover highlight on mouse-move. The `⚙ Settings`
button opens a board of build/config facts (version, runtime, display, data-dir path, the
keybinding help) plus the shell's one editable surface: per-adapter **plan**
(subscription/api) and **cycle policy** (dynamic/static) toggles — ↑↓ to focus a field, ←→
to change it. Edits persist to `~/.tokentamers/config.json` and apply on the next launch
(cycle policy reshapes molt windows, which must not shift under a running pet). Adding or
removing adapters and editing scan paths stays in `tt init`. Everything else is read-only;
the pet game stays fully idle (pillar one — Settings is optional config, never gameplay).
M1 ships `⚙ Settings` and `⏻ Quit`; the cosmetic/social buttons land in M2.

### Mouse Support Details

Enable SGR mouse reporting (`CSI ?1000;1002;1006 h`) in raw mode; parse
press/release/move/wheel. A **hit-region registry** is rebuilt from the layout tree each
frame, so every interactive element — menu buttons, tabs, Dex rows, achievement cards, deco
slots, scrollbars — is clickable. Wheel scrolls lists; click-drag on the Dex scrolls; click
a Dex entry → detail card; click trinket slot in Deco → picker.

### Keyboard Parity & Fallback

Every click has a hotkey (menu = F1–F8 or number keys, arrows + enter everywhere). If the
terminal lacks mouse reporting (some SSH/older emulators), the game is 100% playable by keys
and shows hotkey hints in the menu labels.

### Idle Purity Preserved

The entire UI remains optional — clicking is for browsing collections and decor; nothing
gameplay-critical ever requires input (pillar 1).

### Slim Notes

Mouse parsing is a few hundred bytes of escape-sequence handling; hit-testing is rectangle
lookup; zero impact on the 30fps budget.

### ASCII Layout Diagram

```
┌────────────────────────────────────────────────┐ row 0
│ Oraclet [B]● evolved              gen 1 · molt 3 │  <- header band  (full width)
│ Marbled pattern  ✦  marathoner · deepdiver       │
├────────────────────────────────────────────────┤
│            habitat · pet · trinkets              │  <- game canvas  (full-bleed,
│        (scene scaled to fill full width)         │      scene scaled to width)
├────────────────────────────────────────────────┤
│ last roll: C→B 38% (succeeded)      ⌂ Beach Cove │  <- status band  (full width)
├────────────────────────────────────────────────┤
│ [♥ Pet 1] [☰ Dex 2] [◆ Archive 3] [⚙ Set 4] … % │  <- menu grid (after canvas)
└────────────────────────────────────────────────┘
                                                       (slack falls below the menu)
```

---

## Stack & Toolchain Decision (design baseline §15)

**Decision: custom slim TUI core on Node — no TUI framework.**

Evaluated (June 2026):

- **Ink v6** — pure Node but ~50MB React overhead, hardcoded fps cap, no built-in mouse. We
  would bypass it for the canvas and hand-roll mouse anyway.
- **OpenTUI** — excellent native-Zig performance, powers OpenCode, but requires Bun or Node
  26.3 experimental FFI + per-platform native binaries. Conflicts with pnpm/Node-LTS and slim
  `npm i -g` distribution.

Our UI is two fixed regions + an in-canvas page system and a bespoke diff renderer — exactly
the part frameworks don't provide. A custom core gives **zero runtime dependencies**
(privacy/trust badge; makes the zero-network CI trivial), no native binaries, works on any
Node LTS over any SSH.

**OpenTUI fallback note:** OpenTUI is the documented fallback if the renderer hits a wall.

### Language & Runtime

- TypeScript 5.x `strict`, ESM only, Node >= 20 LTS (`engines` enforced)
- Zero runtime dependencies target

### Package Manager

- pnpm 9 workspaces (`packageManager` field pinned; corepack)

---

## Workspace Layout (design baseline §15)

```
packages/core         engine, cycle policies, grade rolls, hash codec (pure, deterministic,
                      no I/O)
packages/tui          shell: frame buffer, diff renderer, half-block compositor, SGR mouse
                      parser, hit-region registry, page router
packages/adapters     claude-code / codex / opencode (one entry each)
packages/content      content packs + pack validator types
apps/cli              the `tt` binary wiring everything (daemon, init, commands)
```

> Repo layout ownership: CLAUDE.md and CONTRIBUTING.md own the authoritative layout. The full
> directory tree is in `§17` of the design baseline.

---

## Build, Quality & CI Gates (design baseline §15)

### Build

- **tsup** (esbuild) → single bundled `dist/tt.js` with `bin: { tt }`
- `tsx` for dev runs
- Source maps in releases

### Quality

- **Vitest** — unit + golden-frame renderer tests (render to a string buffer,
  snapshot-compare; TUIs are very testable this way)
- **ESLint** (flat config + typescript-eslint, type-aware rules) + **Prettier** for
  formatting
- `tsc --noEmit` in CI
- ESLint also carries the custom AI-guardrail rules natively:
  - Import-boundary enforcement via `eslint-plugin-import` / `no-restricted-imports` (`core`
    imports nothing; `tui`/`adapters` import core only, never each other)
  - Restricted-syntax rules banning `Date.now()` / `Math.random()` inside `packages/core`

### CI Gates

| Gate                   | Tool                                                                              |
| ---------------------- | --------------------------------------------------------------------------------- |
| Tests                  | Vitest                                                                            |
| Typecheck              | `tsc --noEmit`                                                                    |
| Lint                   | ESLint + Prettier                                                                 |
| Dependency audit       | `npm audit --omit=dev`                                                            |
| Zero-network check     | `scripts/check-zero-network.sh` — grep for network imports, fail on hit           |
| Docs spoiler check     | `scripts/check-spoilers.sh` — no fusion-pool species IDs may appear under `docs/` |
| Performance budgets    | Bench suite with hard gates (see AI-Native Policy below)                          |
| Import-boundary        | ESLint rules as above                                                             |
| Dependency-change gate | Any `package.json` dependency change fails unless linked to an approved issue     |
| Dead-code advisory     | jscpd + knip advisory gates                                                       |

---

## TUI-Core Build Order (design baseline §15)

Build in this order; each step is independently golden-frame testable:

1. ANSI writer + alt-screen / raw-mode lifecycle
2. Cell frame buffer + diff flush
3. Half-block sprite compositor
4. Input decoder (keys, then SGR mouse)
5. Hit-region registry
6. 4:3 layout + page router

---

## Adapter Layer (design baseline §15)

```
[claude-code adapter]──┐
[codex adapter]────────┼──▶ normalized UsageEvent stream ──▶ daemon engine
[opencode adapter]─────┘
```

> Now implemented as `packages/adapters/`. The develop-adapters skill
> (`.claude/skills/develop-adapters/`) is the expert reference for adapter contributors.

### UsageEvent Shape

```typescript
{
  ts: number;             // unix ms
  adapter: string;        // provider key
  model_id: string;       // raw model ID string
  input_tokens: number;
  output_tokens: number;
  cache_read: number;
  cache_write: number;
  reasoning_tokens?: number;
  session_key: string;
  is_subagent: boolean;
  cwd?: string;
  lang_hints?: string[];
}
```

### Per-Adapter Quirk List

Adapters are versioned plugins shipped like content packs (format drift in any provider =
adapter patch, not engine change). Each adapter handles its own quirks:

| Adapter         | Quirks                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **claude-code** | JSONL tail; subagent files (`agent-{uuid}.jsonl`); 30-day auto-deletion → incremental ingest mandatory                                                                     |
| **codex**       | Cumulative `token_count` → delta computation required; 3 format generations (≥0.44, mid, 2025/08); `archived_sessions/` present; sessions/ wins over archive on duplicates |
| **opencode**    | Per-message JSON tree walk; multi-root via settings.json `adapterRoots` (no env); project/global storage split; prune-tolerant ingestion                                   |

Engine consumes only UsageEvents + CyclePolicy events; it is provider-blind.

---

## Daemon / Observer Design (design baseline §15)

- Read-only; never calls any AI API; never spends quota.
- Simulation decoupled from rendering: daemon ticks → local SQLite/JSON store; TUI is a
  stateless subscriber.
- Incremental file watching (mtime/offset bookkeeping per file, like ccusage's scanner).

**MVP note:** the MVP ships a **catch-up-on-launch model** instead of a persistent background
daemon. On each `tt` invocation the adapter scanner catches up from its last stored offset;
the daemon architecture (persistent process + store) is the target design and the code is
structured to support it, but the M1 binary does not install a background process.

**Pending-events store (`~/.tokentamers/pending.json`).** A molt only consumes a 5-h window once
it has _closed_, but file checkpoints advance past every byte read. Usage that lands in a window
still open at catch-up time would therefore be read once, never molted, and lost on the next run
(checkpoints have moved past it). To prevent this the engine exposes `pendingEvents()` — the
ingested events whose containing window has not yet closed — and the CLI persists them to
`pending.json` (atomic write, same store pattern as `state.json`/`checkpoints.json`). Each
catch-up re-feeds `pending.json` alongside the fresh scan before advancing, so open-window usage
survives across invocations and resume-from-snapshot stays equal to a continuous run. The buffer
drains automatically as windows close.

Both machine caches stay bounded: `pending.json` and `checkpoints.json` are written compactly
(no pretty-printing — they are rewritten on every command and scale with usage), and adapters
rebuild their checkpoint file-map from the files actually present on each scan, so entries for
sessions the provider has purged (Claude Code's ~30-day retention, user-pruned OpenCode storage)
drop out instead of accumulating for the lifetime of the install.

---

## Render Modes & CLI Command List (design baseline §15)

### Current commands

| Command               | Description                                        |
| --------------------- | -------------------------------------------------- |
| `tt init`             | One-time interactive wizard                        |
| `tt`                  | The clickable 4:3 shell (all pages live inside it) |
| `tt watch`            | Passive statusline / background watch mode         |
| `tt status`           | Single-line status output                          |
| `tt archive`          | View the Archive (best-per-species records)        |
| `tt dex`              | View the Dex                                       |
| `tt battle`           | Battle view                                        |
| `tt dna export`       | Export a DNA code                                  |
| `tt dna apply <code>` | Apply a DNA code                                   |
| `tt adapters`         | Adapter health check / path listing                |

Statusline one-liner format: `🥚→ <species> [S]★ molt 7 ▓▓▓░`
(The example in the design baseline uses a fusion-pool species name; replaced here with a
placeholder to comply with the spoiler rule — `scripts/check-spoilers.sh` would fail
otherwise.)

### Future commands (post-MVP)

`tt dna drifter` (local Drifter DNA from deterministic calendar seed) ·
`tt league import <codes>` (local Team League standings from pasted hashes) ·
`tt complete` (Completion Meter breakdown) · `tt deco` / `tt deco --auto` (habitat + trinket
selection)

---

## Six Version-Agnostic Rules (design baseline §15)

1. **Content as data** — species / traits / pools / `models.json` / rules live in versioned
   JSON, never hardcoded.
2. **Self-describing hashes** — every hash carries a schema prefix; old clients parse newer
   hashes; unknowns become dormant genes.
3. **Dormant genes** — unknown model IDs (and unknown species) render as silhouette / `???`
   forms until a registry update awakens them.
4. **Versioned deterministic battle engine + ruleset negotiation** — same inputs → same
   battle, forever; replays reproducible across versions.
5. **Additive-only registries** — retired species become "Ancient" (permanent Dex entries,
   still battle-legal); IDs are never reused.
6. **Adapters versioned independently of content and engine** — format drift in any provider
   is an adapter patch, not an engine change.

---

## AI-Native Development Policy (design baseline §17)

### Policy Statement

This project is **built entirely with AI coding agents** (Claude Code first; contributors may
use any AI assistant). That is a feature, not a risk — PROVIDED the feedback loops below
exist. The policy: _humans own architecture and contracts; CI owns quality and performance; AI
writes the code._

> Implementation note: the CLAUDE.md project memory and the four project skills are
> implemented. See `CLAUDE.md` (root), `CONTRIBUTING.md`, and `.claude/skills/` for
> `develop-adapters`, `develop-tui-renderer`, `maintain-content-packs`, `create-sprites`, and
> `write-wiki-docs`. The GitHub wiki source lives in `docs/wiki/`.

### Known AI Failure Modes → Mechanical Countermeasures

| Failure Mode                  | Countermeasure                                                                                                                                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architectural drift**       | Import-boundary lint rules: `core` may import nothing but itself; `tui`/`adapters` may import `core`, never each other. Violations fail CI.                                                                                                           |
| **Dependency creep**          | Zero-runtime-deps policy enforced in CI: any `package.json` dependency change fails unless linked to an approved issue.                                                                                                                               |
| **Silent perf regressions**   | **Performance budgets as failing tests**: bench suite in CI with hard gates — frame flush < 2ms (reference scene), daemon tick budget, RSS ceiling < 40MB, bundle < 1MB (size-limit), cold start budget. Regress a budget = red PR, no debate needed. |
| **Duplication / dead code**   | jscpd + knip advisory gates.                                                                                                                                                                                                                          |
| **Plausible-but-wrong logic** | Determinism property tests (hash round-trip fuzzing; same inputs = same battle; cross-version replay), golden-frame renderer snapshots, adapter fixture suites built from real log samples.                                                           |
| **Test gaming**               | Tests assert contracts/invariants (from this design doc), not current behavior. CLAUDE.md forbids weakening a test to pass a PR.                                                                                                                      |

### Process Rules

These rules live in CLAUDE.md and CONTRIBUTING:

- CLAUDE.md + the four skills are the **primary review layer** — every AI contributor's agent
  reads them before writing code. Keep them current; a stale CLAUDE.md is a project bug.
- **Small PRs, one concern each.** PR template includes the invariant checklist: offline,
  read-only, no-judgment, additive-only, perf budgets, no spoilers.
- **Maintainer reviews boundaries and contracts; CI reviews everything else.** This is what
  makes many parallel AI contributors scalable.
- Performance ceiling lives in the architecture (diff renderer, LUTs, event-driven daemon) —
  contributors implement within a fast design. PRs that change the architecture require a
  design-doc update first.

### CI Gate List (AI-Native Policy Layer)

The following gates enforce the AI-Native policy specifically (in addition to the general CI
gates listed above):

| Gate                   | Enforcement                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Import boundaries      | ESLint `no-restricted-imports` rules; core/tui/adapters isolation                              |
| Zero-network           | `scripts/check-zero-network.sh` — grep for `fetch`/telemetry/network imports                   |
| Docs spoiler check     | `scripts/check-spoilers.sh` — fusion-pool species IDs must never appear in `docs/`             |
| Performance budgets    | Vitest bench suite — frame flush, RSS, bundle size, cold start (all hard gates)                |
| Dependency-change gate | Any new `dependencies` entry in `package.json` requires an approved issue link                 |
| Determinism tests      | Hash round-trip fuzz, same-inputs-same-battle, cross-version replay                            |
| Invariant tests        | Tests assert design-doc contracts, not current behavior; weakening a test to pass fails review |
| Type safety            | `tsc --noEmit` strict — no `any` escapes; no `Date.now()` / `Math.random()` in `packages/core` |

---

## Redirected Content Notes

- **Fusion-locked special species names** (the contents of the Vigil, Tempest, Prism, and
  Chimera DNA pools): pool contents are internal — see
  `packages/content/content/fusion-pools.json`. This document records only pool _types_
  (Vigil / Tempest / Prism / Chimera), the apply-timing tiers, and the mechanics. The species
  names that appear in design §7 and §9 are deliberately omitted here in compliance with the
  CI spoiler rule enforced by `scripts/check-spoilers.sh`.
- **Repo layout** (§17): compressed to a pointer — CLAUDE.md and CONTRIBUTING.md are the
  authoritative source.
- **CLAUDE.md, project skills, and wiki plans** (§17): noted as implemented; see root
  `CLAUDE.md`, `.claude/skills/`, and `docs/wiki/`.
