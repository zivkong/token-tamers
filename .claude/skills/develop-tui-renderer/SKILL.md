---
name: develop-tui-renderer
description: TUI shell and renderer rules for Token Tamers — 4:3 canvas layout, diff renderer, half-block compositor, SGR mouse, performance budgets, golden-frame testing. Use when working under packages/tui.
---

# Develop the TUI shell & renderer (packages/tui)

Source of truth: `docs/design/visuals-habitats-achievements.md` (rendering) and
`docs/design/architecture.md` (shell). Custom slim
TUI core — NO framework (Ink/OpenTUI rejected by design; OpenTUI is the documented
fallback if the renderer hits a wall). Zero runtime dependencies; works on any Node
LTS over any SSH. tui imports `@token-tamers/core` only — never adapters or content.

## Layout law (rev 1.1 — top-oriented, full-width)

- The UI is a **top-oriented, full-width vertical stack** (`render/layout.ts`): sections
  stack from row 0 with **no letterbox gutters, no side padding**; the menu is a **grid
  docked immediately AFTER the canvas**, not at the terminal bottom. Slack falls below it.
  (This supersedes the old centered-4:3-canvas + bottom-bar model.)
- Section order (pet page): **header band** (`headerRows`) → _divider+gap_ → **game canvas** →
  _labeled `VITALS` divider+gap_ → **vitals panel** (`panelRows`: stats / gap / feeding / gap /
  diet) → _divider+gap_ → **menu grid**. `petSections(layout)` carves the bands + divider rows;
  every divider is followed by a `GAP_ROWS` blank for spacing. `render/divider.ts` draws rules.
  `canvasX=0`, `canvasCols=termCols`.
- **Evolution-mystery rule:** the pet screen must NOT show the stage word, molt count, or any
  "progress to next evolution" — evolution stays a surprise. Stage/molt still drive the engine
  and show in achievements/Archive; keep the `calibrating` cue (data readiness, not evolution).
- **Grade display:** on the pet header, grade is the name's styling — the whole name is drawn
  **bold (`buf.textBold`) in `GRADE_ACCENT[grade]`** with a trailing `GRADE_BADGE` symbol; no
  `[B]` text. Bold is a `Cell.bold` attribute (a no-op in `--no-color`/`none` mode).
- **Vitals panel** (`pages/pet-vitals.ts`): stat bars from `pet.stats`; the **Feeding row is
  REAL-TIME** from `ctx.live` (`LiveStats`) — open-window tokens vs baseline appetite (ratio
  drives the next molt's odds); diet from `pet.dietGenes` → House tints via `pack.models`. Keep
  grade-roll odds shown (transparency invariant). `LiveStats` flows `ShellHost.liveStats()` →
  shell → `FrameInput.live` → `RenderContext.live`; the cli derives it from
  `engine.pendingEvents()` + `eventEssence` + baselines. Undefined in golden tests → the
  feeding row falls back to a static baseline summary (keeps frames deterministic).
- Cells are ~1:2 w:h; half-blocks give 2 vertical px/cell. Habitat scenes are 96×48 px
  (96 cols × 24 rows → 4:1 cell aspect). The canvas is full width and `sceneRows ≈ cols/4`
  (capped to fit), so the backdrop **scales uniformly to fill the width** via `drawSprite`'s
  `destW`/`destH` (nearest-neighbor) — no padding, no distortion. The **pet + trinkets scale
  by the same `scene.cols / HABITAT_COLS` factor** so they stay proportionate at any width
  (`sceneScale` in pet.ts; pass scaled dims into the wander geometry AND `drawSprite`).
  Minimum terminal 64×24.
- Canvas hosts: pet + habitat + trinkets, cutscenes, battle view, and full-screen pages
  (Dex, Archive, Settings, Achievements) inside the same content region.
- Menu grid (`menuCells(layout)`, shared by the renderer and the shell's mouse hit-testing):
  the 5 nav buttons (Pet/Dex/Archive/Settings/Quit) + the live Completion Meter flow across
  **6 columns (≥72 cols) or 3 columns over 2 rows (narrow)**; active page highlighted.
  Adding a page = extend the `PageId` union, push a `MENU_ITEMS` entry (icon + hotkey), add a
  `freshUi` slot, a `handleKey` case, and a `renderFrame` switch arm — keep all five in lockstep.
- **Keyboard parity is mandatory:** every click has a hotkey; with no mouse
  reporting the game is 100% playable by keys.
- **Idle purity:** the entire UI is optional browsing — nothing gameplay-critical
  ever requires input (pillar 1).

## Rendering technique

- Half-block pixel rendering: `▀` cells, fg = top pixel, bg = bottom pixel.
  (Note: emit `▀` via `String.fromCodePoint(0x2580)` — literal multibyte chars have
  been corrupted in file writes before.)
- Palette indirection: sprite assets carry palette indices; House tint + grade LUT
  resolve RGB at render time (see create-sprites for the beauty ladder).
- Diff renderer: front/back cell buffers; emit ANSI only for changed cells with
  run-coalescing. An identical re-flush must emit ZERO bytes (tested).
- Precomputed LUTs (ramps, shimmer frames, dither patterns) at load — zero per-frame
  color math or allocation. Layered compositing: base sprite / aura+particles / UI
  chrome — only dirty layers re-composite.
- Color degradation: truecolor → 256 → 8 → ASCII (`--no-color`), information never
  disappears.

## Frame loop & performance budgets (CI-gated aspirations)

- **30fps default**, fixed-timestep with accumulator (motion even at any rate).
  Adaptive DOWN if output can't drain (coalesce to 15fps; idle ~10fps event-driven);
  `render.fps: 60` is opt-in config, never the default.
- Budgets: per-frame flush < 2ms (reference scene); CPU ~1–2% foreground, ~0 with no
  viewer; RSS < 40MB; bundle < 1MB. Frame-skip when unfocused. The daemon/engine
  never renders.
- All wall-clock through a single injected `now()` so tests can fake time.

## Input

- Raw mode + alt screen lifecycle with guaranteed terminal restore (also on
  SIGINT/SIGTERM).
- SGR mouse reporting (`CSI ?1000;1002;1006 h`): press/release/move/wheel. A
  hit-region registry is rebuilt from the layout each frame; topmost region wins.
  Edge cases to mind: tmux passthrough, mosh, Windows Terminal.

## Testing: golden frames

Render to a string buffer (fake stdout sink, fixed size like 100×30) and
snapshot-compare. Required coverage: every page, diff-renderer zero-byte re-flush,
layout math, SGR mouse parser cases, color degradation, shell loop with injected
`now()`/IO/maxFrames. Never weaken a golden frame to pass — regenerate only when the
visual change is intended and reviewed.

## Module map (current)

`ansi.ts` (Writer/sinks/SGR), `buffer.ts` (FrameBuffer+diff), `sprite.ts`
(compositor+palette ladder, `destW`/`destH` scaling), `input.ts` (key/mouse decode),
`hit.ts`, `layout.ts` (`computeLayout`/`petSections`/`menuCols`), `divider.ts` (section
rules), `frame.ts` (frame + `menuCells` grid), `shell.ts` (runShell loop), `status.ts`
(one-liners), `pages/` (pet, pet-vitals, dex/archive/settings), `lookup.ts` (pack helpers).

## Settings page: `ShellInfo` (static) + `SettingsState` (editable)

The Settings page mixes **read-only facts** with the shell's **only editable surface**
(per-adapter `plan` and `cycle` toggles). Two contracts, two responsibilities:

- **`ShellInfo`** — static facts (version, runtime, fps, dataDir). The page must stay
  deterministic for golden frames, so it NEVER reads the wall clock, `process.*`, or the
  filesystem itself. The cli composes these once and passes `runShell({ info })`; the
  shell threads it into `RenderContext.info` (optional — undefined in tests, where the
  page falls back to `—`). The app version is the single `apps/cli/src/version.ts` const
  (kept in sync with package.json), re-exported from `main.ts`. Rule for any future info
  page: derive process/fs facts in the cli, pass them in — never reach for them in `tui`.
- **`SettingsState`** — a live working copy of the adapter configs plus `selected` (a flat
  field index, two fields per adapter). The page renders it and a hit region per field but
  owns NO mutation. The shell drives editing: ↑↓ move `selected` (`moveSelection`), ←→
  cycle the focused value (`cycleSelectedField` in `pages/settings.ts`). On each change the
  shell calls `options.onAdaptersChange(adapters)`; the cli persists to config.json. Edits
  apply on the **next launch**, never mid-session — cycle policy reshapes molt windows,
  which must not shift under a running pet. Adding/removing adapters and editing scan paths
  stays in `tt init` (needs detection + text input). The pet game itself stays fully idle:
  Settings is optional config, never gameplay.
