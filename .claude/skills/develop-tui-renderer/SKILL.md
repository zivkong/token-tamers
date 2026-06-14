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
  stack from row 0 with **no letterbox gutters, no side padding**; the menu is a **left-aligned
  button flow docked immediately AFTER the canvas** (wraps rows as needed), not at the terminal
  bottom. Slack falls below it. **Min terminal 34×24** (`MIN_COLS=34`); layouts degrade with
  compact bars/labels and a wrapping menu. (Supersedes the old centered-4:3 + bottom-bar model.)
- Section order (pet page): **header** (`headerRows=3`: name / identity / stats) → _divider+gap_ →
  **game canvas** → _gap + labeled `VITALS` divider + gap_ → **vitals panel** (`panelRows=4`: food /
  diet / grow / odds on consecutive rows) → _bottom-padding gap_ → **labeled `── Menu ──` divider** → **menu**.
  `petSections(layout)` carves the bands and the pet's TWO dividers (header, VITALS) with gaps
  around them plus a bottom-padding gap below the panel; the **`── Menu ──` divider is GLOBAL
  chrome** drawn by the frame at `layout.menuDividerY` on every page (so the menu is its own
  named section everywhere). Menu buttons start at `layout.menuY` (= `menuDividerY + 1`).
  `components/divider.ts` draws rules. `canvasX=0`, `canvasCols=termCols`.
- **Standard full-screen page scaffold** (`components/page.ts`): every non-Pet page (Dex,
  Archive, Settings) shares ONE chrome so they never drift apart — `drawPageHeader(ctx, {icon,
title, completion?})` draws a left-aligned `icon Title` (Title-Case), an optional right-aligned
  completion bar, and the standard `drawDivider` beneath, returning the first body row
  (`canvasY + PAGE_HEADER_ROWS`, = 3); `drawPageFooter(ctx, text)` draws a left status line on the
  bottom canvas row. Pages render only their BODY between. Do NOT hand-roll page headers/titles, and
  NEVER draw a nav legend on a page — the global `── Menu ──` buttons are the only navigation (a
  per-page key legend is a duplicate). The Pet page is the sole exception (it's the game canvas; see
  `petSections`). The shell's list hit-test reads `DEX_LIST_OFFSET = PAGE_HEADER_ROWS` and
  `ARCHIVE_LIST_OFFSET = PAGE_HEADER_ROWS + 1` (Archive's column header is the first body row), so
  changing the header height updates all three in lockstep.
- **Completion is per-page, not global** (`components/meter.ts` → `drawCompletionHeader`, surfaced
  via `drawPageHeader`'s `completion`): Dex shows `completion.dex`, Archive shows
  `records/dexTotal`, top-right. The full `CompletionBreakdown` flows `ShellHost.completion()` →
  `RenderContext.completion`. Settings has no completion (nothing to track); the pet page has NO
  completion meter.
- **Evolution-mystery rule (amended):** the pet screen must NOT show the stage word, molt count,
  the next form, or "N to next evolution" — _what_ it becomes and _when_ stays a surprise. The ONE
  permitted cue is the **"Grow" vitals row**: an abstract maturation meter (fill + a single word —
  `maturing`/`cresting`/`fully grown`/`incubating`) driven by `core.growthProgress(state)`, which
  is deliberately spoiler-free (fill frac + flags only, never stage/count/next-form). It shows
  _that_ the pet is progressing, nothing more. Stage/molt still drive the engine and show in
  achievements/Archive; keep the `calibrating` cue (data readiness, not evolution).
- **Grade display:** on the pet header, grade is the name's styling — the whole name is drawn
  **bold (`buf.textBold`) in `GRADE_ACCENT[grade]`** with a trailing `GRADE_BADGE` symbol; no
  `[B]` text. Bold is a `Cell.bold` attribute (a no-op in `--no-color`/`none` mode).
- **Two disjoint color maps — keep them apart:** `GRADE_ACCENT` (render/sprite.ts) is the RARITY
  ladder (C grey · B green · A violet · S gold) — it ALONE signals value. `HOUSE_ACCENT`
  (helpers/lookup.ts) is the canonical per-House identity color (Aether cyan · Cipher red · Flux
  rose · Forge orange · Wild slate) — a NEUTRAL categorical palette, equal-weight so no House looks
  superior (invariant #3), deliberately sharing NO color with the grade ladder. ALL House coloring
  goes through `houseTint(house)` (hex, for `buildPalette`) / `houseColor(house)` (Rgb) — never
  per-gene `models.json` tints (those mirror `HOUSE_ACCENT` for content honesty but the UI ignores
  them). New House-colored UI must use these helpers, and new colors must not collide with grades.
- **Header band** (`drawHeaderBand` in `pages/pet.ts`, `HEADER_ROWS=3` on `HEADER_BG`) — the
  pet's IDENTITY card: row 0 name+grade (left) / habitat (right), row 1 pattern · traits, row 2 the
  **Stats** readout (`icon LABEL: value` for PWR/SPD/WIS/GRT, spread space-between across the full
  width, NO bar — a fixed equal budget, House-tinted icons). Stats live HERE (who the pet IS), kept
  apart from the live VITALS panel; drawn via `pet-vitals.ts`'s exported `drawStatsRow(ctx, rect, y,
bg)` so it renders on the band background.
- **Vitals panel** (`pages/pet-vitals.ts`) — 4 LIVE rows: **Food** (REAL-TIME growth: open-window
  tokens fill toward `VITALITY_FULL_TOKENS`=200M, SINGLE-tinted, `+N% molt` = real `vitalityBonus`
  preview; token counts only), **Diet** (the
  ALWAYS-FULL House-share bar — composition not progress — + a House-name legend), **Grow** (the
  ABSTRACT maturation cue: `drawMeter` filled to `growthProgress(state).frac` in a neutral teal
  `GROWTH_FILL` — off BOTH the grade and House ladders — + one state word, NEVER stage/count/next
  form; deterministic from state so it needs no `ctx.live`. 4-char label "Grow" to clear the bar
  gutter), **Odds** (the
  LIVE current→next grade forecast only: `from → to NN%`, grade-tinted via `GRADE_ACCENT`, ` (capped)`
  at the A→S ceiling, `S ★ apex` at the top). Food, Diet and Grow share ONE bar geometry (`barGeom`) so
  they line up at every width; the Food/Grow bars use `drawMeter` (single tint), the Diet bar
  `drawSegmentedMeter` at 100% fill (House tints). The Odds number comes from `ctx.live.nextGrade`
  (the host's `gradeOdds(state, pending)` — core owns the math, shared with the engine's roll), and
  falls back to the published base odds (`gradeOdds(state)`) when there's no live readout so golden
  frames stay deterministic. `LiveStats` flows `ShellHost.liveStats()` → `FrameInput.live` →
  `RenderContext.live`; the cli derives it from the open window (`engine.pendingEvents()`), the
  `eventTokens`/`eventEssence` helpers, the baselines, and `gradeOdds`. Undefined in golden tests →
  Food shows an empty/awaiting state and Odds shows the base-odds fallback (frames stay
  deterministic). Completion is per-page (NOT in this panel).
- Cells are ~1:2 w:h; half-blocks give 2 vertical px/cell. Habitat scenes are 96×48 px
  (96 cols × 24 rows → 4:1 cell aspect). The canvas is full width and `sceneRows ≈ cols/4`
  (capped to fit), so the backdrop **scales uniformly to fill the width** via `drawSprite`'s
  `destW`/`destH` (nearest-neighbor) — no padding, no distortion. The **pet + trinkets scale
  by the same `scene.cols / HABITAT_COLS` factor** so they stay proportionate at any width
  (`sceneScale` in pet.ts; pass scaled dims into the wander geometry AND `drawSprite`).
  Minimum terminal 34×24.
- Canvas hosts: pet + habitat + trinkets, cutscenes, battle view, and full-screen pages
  (Dex, Archive, Settings, Achievements) inside the same content region.
- Menu flow (`render/menu.ts` → `packMenu(cols)`, shared by `layout` for `menuRows`+`menuBtnH`,
  `frame` to draw, and `shell` to hit-test): a labeled `── Menu ──` divider (frame, `menuDividerY`)
  then the 5 nav buttons (Pet/Dex/Archive/Settings/Quit) as real BUTTONS — one uniform width
  (`menuButtonWidth()` = widest text + interior padding) and one uniform HEIGHT (`MENU_BTN_H`=1 — a
  single row keeps the label CENTERED on both axes; even heights bottom-bias the text, so the button
  shape comes from the filled `MENU_BTN_BG` block + interior padding, active = `MENU_ACTIVE_BG`, not
  extra rows), the LABEL centered in the button and the hotkey RIGHT-aligned to the `MENU_PAD_X`
  edge; buttons are distributed SPACE-BETWEEN across the full width (first flush-left,
  last flush-right; a lone column is centered). `packMenu` returns x + wrap-`row`; HEIGHT is applied
  by the caller via `menuButtonY(row, btnH)`/`menuBandRows(rows, btnH)` (height-aware so a taller
  `MENU_BTN_H` would still work) and `computeLayout` only ever shrinks `menuBtnH` to fit a short
  terminal, never below 1. On narrow widths the grid wraps with
  columns aligned across rows (partial last row fills the leftmost columns). All three consumers
  read `packMenu` + `layout.menuBtnH`, so sizing/draw/hit-test stay in lockstep. The completion
  meter is NOT in the menu (it's shown per-page — Dex/Archive). Adding a page = extend the `PageId`
  union, push a `MENU_ITEMS` entry (icon + hotkey), add a `freshUi` slot, a `handleKey` case, and a
  `renderFrame` switch arm — keep all five in lockstep.
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
`hit.ts`, `layout.ts` (`computeLayout`/`petSections`), `menu.ts` (`packMenu` left-aligned
flow), `frame.ts` (frame + menu draw), `shell.ts` (runShell loop), `status.ts` (one-liners),
`pages/` (pet, pet-vitals, dex/archive/settings), `lookup.ts` (pack helpers). Shared UI lives
under `components/`: `divider.ts` (`drawDivider` — ALL-CAPS BOLD label, rule, gap-after);
`page.ts` (the standard full-screen page scaffold — `drawPageHeader`/`drawPageFooter`/
`PAGE_HEADER_ROWS`, used by Dex/Archive/Settings); and `meter.ts` — the ONE progress bar:
`drawMeter` (filled `█` + a clearly-visible `▒` track), `drawSegmentedMeter` (filled portion split
into colored slices, e.g. the diet-tinted food), and `drawCompletionHeader`. Reuse these — don't
hand-roll rules/bars/headers.

## Settings page: `ShellInfo` (static) + `SettingsState` (editable)

The Settings page mixes **read-only facts** with the shell's **only editable surface** — the
opt-in **update mode** and per-adapter `plan` / `cycle` toggles. Two contracts, two
responsibilities:

- **`ShellInfo`** — static facts (version, runtime, fps, dataDir). The page must stay
  deterministic for golden frames, so it NEVER reads the wall clock, `process.*`, or the
  filesystem itself. The cli composes these once and passes `runShell({ info })`; the
  shell threads it into `RenderContext.info` (optional — undefined in tests, where the
  page falls back to `—`). The app version is the single `apps/cli/src/version.ts` const
  (kept in sync with package.json), re-exported from `main.ts`. Rule for any future info
  page: derive process/fs facts in the cli, pass them in — never reach for them in `tui`.
- **`SettingsState`** — a live working copy of `updateMode` + the adapter configs plus
  `selected` (a flat field index: **index 0 = update mode**, then two fields per adapter, so
  `settingsFieldCount = 1 + adapters*2`, always ≥ 1). The page renders it and a hit region per
  field but owns NO mutation. The shell drives editing: ↑↓ move `selected` (`moveSelection`),
  ←→ cycle the focused value (`cycleSelectedField` in `pages/settings.ts`). On each change the
  shell persists to the RIGHT store by field: the update-mode field (`isUpdateFieldSelected`)
  → `options.onUpdateModeChange(mode)` → settings.json; adapter fields →
  `options.onAdaptersChange(adapters)` → config.json. Edits apply on the **next launch**, never
  mid-session — cycle policy reshapes molt windows, which must not shift under a running pet; the
  update mode is read at launch too. The update toggle only WRITES the mode string — it never
  imports the updater network surface (the isolation gate holds; off stays the default).
  Adding/removing adapters and editing scan paths stays in `tt init` (needs detection + text
  input). The pet game itself stays fully idle: Settings is optional config, never gameplay.
