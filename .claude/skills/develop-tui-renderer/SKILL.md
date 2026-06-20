---
name: develop-tui-renderer
description: TUI shell and renderer rules for Token Tamers — 4:3 canvas layout, diff renderer, sub-cell (sextant/octant) compositor, SGR mouse, performance budgets, golden-frame testing. Use when working under packages/tui.
---

# Develop the TUI shell & renderer (packages/tui)

Source of truth: `docs/design/visuals-habitats-achievements.md` (rendering) and
`docs/design/architecture.md` (shell). Custom slim
TUI core — NO framework (Ink/OpenTUI rejected by design; OpenTUI is the documented
fallback if the renderer hits a wall). Zero runtime dependencies; works on any Node
LTS over any SSH. tui imports `@token-tamers/core` only — never adapters or content.

> **TUI-first (binding).** The interactive shell is the PRIMARY player surface — most
> players use the TUI, not the CLI. Every player-facing feature must be fully usable in the
> shell; a feature is NOT done while it's CLI-only. When a feature lands, add its page (a
> `renderFn(ctx: RenderContext)` in `src/pages/`, dispatched in `render/frame.ts`), an in-shell
> entry point (a hotkey/menu item, or a contextual key on a related page — e.g. Battle is a
> top-level menu page whose setup screen takes a pasted DNA code or an own-Dex pick), and
> golden-frame tests, in the same change as the
> engine/CLI work. Keep per-frame work pure (`f(state, pack, ui, frame)` → buffer) so playback/
> animation stays deterministic and golden-testable; pre-compute anything stochastic (e.g. a
> battle timeline) ONCE outside the renderer and play it back. If the shell lacks a primitive a
> feature needs, call that out as an unfinished TUI gap — don't declare the feature complete on
> the CLI alone. (The shell now has a minimal free-text field — the Battle setup paste field in
> `pages/battle-setup.ts` accumulates printable key events into `ui.battle.input`; reuse that
> pattern rather than reaching for a framework.) See the TUI-first rule in CLAUDE.md.

## Layout law (rev 1.2 — responsive, orientation-aware)

- The shell adapts to the terminal shape (`render/layout.ts` → `pickOrientation`, a pure
  function of cols:rows with a dead-band so a resize across the boundary doesn't flicker;
  golden-frame deterministic). Two orientations:
  - **Vertical** (a tall "side pane"): the rev 1.1 stack — **top-oriented, full-width**, sections
    from row 0 with **no gutters/side-padding**; menu a left-aligned button flow docked AFTER the
    canvas, slack below. `canvasX=0`, `canvasCols=termCols`, `menuRail=false`. **Min 34×24**.
  - **Horizontal** (a wide, short "bottom dock"): **two columns** — game canvas LEFT, chrome
    column (header/stats/vitals) RIGHT, nav menu a vertical **rail** (`menuRail=true`,
    `menuRect`/`menuDividerX`) down the right edge. Content region is the left column
    (`canvasCols < termCols`, `canvasRows = termRows`). **Min 72×12** — docks are short, so the
    row floor is far below vertical's. The pet content column splits ~38% to the chrome with
    hard floors (`MIN_CHROME_COLS`/`MIN_CANVAS_COLS` = 24 each) so neither sub-column collapses;
    `HORIZONTAL_MIN_COLS` is set to keep both above their floors (a layout test guards the row
    floor against the chrome/rail stack heights too).
- The **game canvas is a true 4:3 box** (`fit43`): cells are ~1:2, so a 4:3-pixel habitat reads
  as 4:3 only at an **8:3 cell box** (`rows = cols × 3/8`). `fit43(band)` returns the largest 8:3
  box that fits, **centered with gutters (letterboxed)** — the ONE allowed gutter; never stretch
  to fill. Size sprites/wander against the returned `scene` rect (not the band). Use
  `CANVAS_CELL_W=8`/`CANVAS_CELL_H=3`, NOT the retired `cols/4` (pre-octant 4:1) target.
- The menu is drawn from `layout.menuRect` + `packMenu(menuRect.cols)` (offset to `menuRect.x`)
  in BOTH orientations, so `frame.ts` (draw) and `shell-input.ts` (hit-test) stay in lockstep —
  vertical packs a full-width band, horizontal packs a one-per-row rail. Adding a page is
  unchanged; never hand-roll menu geometry from `termCols`.
- Section order (pet page, VERTICAL): **header** (`headerRows=3`: name / identity / stats) → _divider+gap_ →
  **game canvas** → _gap + labeled `VITALS` divider + gap_ → **vitals panel** (`panelRows=4`: food /
  diet / grow / odds on consecutive rows) → _bottom-padding gap_ → **labeled `── Menu ──` divider** → **menu**.
  `petSections(layout)` carves the bands and returns `rules` (the horizontal dividers to draw —
  header + labeled VITALS in vertical; just VITALS in horizontal) plus an optional `separator`
  (the vertical rule between canvas and chrome, horizontal only). In HORIZONTAL the scene takes
  the left of the content column (4:3, letterboxed) and header+vitals stack in a chrome
  sub-column to its right — same rects, orientation-agnostic page code. The **menu is GLOBAL
  chrome** drawn by the frame (a band below in vertical, a rail on the right in horizontal);
  `components/divider.ts` draws rules (`drawDivider` horizontal, `drawVDivider` vertical).
- **Standard full-screen page scaffold** (`components/page.ts`): every non-Pet page (Dex,
  Loot, Feats, Settings) shares ONE chrome so they never drift apart — `drawPageHeader(ctx, {icon,
title, completion?})` draws a left-aligned `icon Title` (Title-Case), an optional right-aligned
  completion bar, and the standard `drawDivider` beneath, returning the first body row
  (`canvasY + PAGE_HEADER_ROWS`, = 3); `drawPageFooter(ctx, text)` draws a left status line on the
  bottom canvas row. Pages render only their BODY between. Do NOT hand-roll page headers/titles, and
  NEVER draw a nav legend on a page — the global `── Menu ──` buttons are the only navigation (a
  per-page key legend is a duplicate). The Pet page is the sole exception (it's the game canvas; see
  `petSections`). List pages (Loot, Feats) register a hit region per body row themselves
  (`unlock:item:<i>`); list scroll is clamped via the shared `clampScroll` (`components/page.ts`).
- **Completion is per-page, not global** (`components/meter.ts` → `drawCompletionHeader`, surfaced
  via `drawPageHeader`'s `completion`): Dex shows `completion.dex`, Loot shows
  unlocked/total, Feats shows earned/total, top-right. The full `CompletionBreakdown` flows `ShellHost.completion()` →
  `RenderContext.completion`. Settings has no completion (nothing to track); the pet page has NO
  completion meter.
- **Evolution-mystery rule (amended) + two fixed-row lifecycle countdowns:** the **"Grow" row**
  NAMES the current stage (`Mote`/`Sprite`/`Rookie`/`Evolved`/`Prime`/`Apex`) and carries the
  **MOLT (5-h) countdown** (`Evolved · Molt 4h 59m 12s`, live `ctx.live.secsToMolt`/`nextMoltCloseAt`;
  bar fill via `core.growthProgress(state)`). The molt rolls grade too, so the countdown STAYS at
  Apex (the next A→S chance); a maxed Apex-S reads `Apex · max grade`. Golden frames (no `live`) show
  the stage name alone. Mystery now covers ONLY the next FORM/branch — never the target species. The
  **"Odds" row** carries the **REBORN (7-day) countdown** (`C › B 25% · Reborn 6d 23h`,
  `secsToRebirth`/`nextRebirthAt`); at **Apex** it becomes the clickable **`[ Reborn Now · … ]`**
  button → `host.rebornNow()` forces an early rebirth, warn-then-confirm (`ui.rebornArmed` → caution
  `[ Confirm Reborn? ]`) when grade ≠ S, `pet:reborn-now` hit region for mouse parity. The two
  countdowns never swap rows. Keep the `calibrating` cue (data readiness).
- **Grade display:** on the pet header, grade is the name's styling — the whole name is drawn
  **bold (`buf.textBold`) in `GRADE_ACCENT[grade]`** with a trailing `GRADE_BADGE` symbol; no
  `[B]` text. Bold is a `Cell.bold` attribute (a no-op in `--no-color`/`none` mode).
- **Two disjoint color maps — keep them apart:** `GRADE_ACCENT` (render/sprite.ts) is the RARITY
  ladder (C grey · B green · A violet · S gold) — it ALONE signals value. `HOUSE_ACCENT`
  (helpers/lookup.ts) is the canonical per-House identity color (Aether cyan · Cipher red · Flux
  rose · Forge orange · Wild green) — a NEUTRAL categorical palette, equal-weight so no House looks
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
  maturation row: `drawMeter` filled to `growthProgress(state).frac` in a neutral teal `GROWTH_FILL`
  — off BOTH the grade and House ladders — labelled by `growLabel` with the CURRENT stage name
  (`STAGE_LABEL`) + the MOLT countdown `Stage · Molt 4h 59m 12s` (`ctx.live.secsToMolt`), which STAYS
  at Apex for the grade roll, or `Apex · max grade` once Apex-S; the next FORM/branch is never named.
  The bar fill needs no `ctx.live`, so golden frames show the stage name alone), **Odds** (the
  LIVE current→next grade forecast: `from → to NN%`, grade-tinted via `GRADE_ACCENT`, ` (capped)`
  at the A→S ceiling, `S ★ apex` at the top, then INLINE the REBORN affordance after the odds:
  normally a muted `· Reborn <countdown>` (`ctx.live.secsToRebirth`, the deadline for the grade to
  keep rolling; replaced the old `rolls at next molt` hint), but at **Apex** the clickable
  `· [ Reborn Now · … ]` button (`drawRebornButton`, warm `REBORN` accent → `WARN`-tinted
  `[ Confirm Reborn? ]` when `ui.rebornArmed`; `pet:reborn-now` hit region, always shown at Apex
  since the action is always available). The two countdowns sit on FIXED rows and never swap).
  Food, Diet and Grow share ONE bar geometry
  (`barGeom`) so they line up at every width; the Food/Grow bars use `drawMeter` (single tint), the
  Diet bar `drawSegmentedMeter` at 100% fill (House tints). The Odds number comes from
  `ctx.live.nextGrade` (the host's `gradeOdds(state, pending)` — core owns the math, shared with the
  engine's roll), and falls back to the published base odds (`gradeOdds(state)`) when there's no live
  readout so golden frames stay deterministic. `LiveStats` flows `ShellHost.liveStats()` →
  `FrameInput.live` → `RenderContext.live`; the cli derives it from the open window
  (`engine.pendingEvents()`), the `eventTokens`/`eventEssence` helpers, the baselines, `gradeOdds`,
  and the pure `nextMoltCloseAt`/`nextRebirthAt` forecasts (turned into `secsToMolt`/
  `secsToRebirth` against the wall clock). Undefined in golden tests → Food shows an empty/awaiting
  state, the countdowns are omitted, and Odds shows the base-odds fallback (frames stay
  deterministic). Completion is per-page (NOT in this panel).
- Cells are ~1:2 w:h. The **sub-cell compositor** (`render/sprite.ts`) packs each cell at the
  active density — **octant 2×4** (default, 4× half-block, Unicode 16 `render/octant-table.ts`),
  **sextant 2×3** (3×, Unicode 13), **half-block 1×2** (fallback) — quantizing every cell to 2 SGR
  colors + the matching block glyph (partly-transparent cells composite over the backdrop). The
  mode is chosen ONCE per session via `setSubcellMode(name)`: the cli reads the `subcell`
  setting (`auto`|`octant`|`sextant`|`half`) and resolves it (`apps/cli/.../subcell.ts`) —
  explicit modes pass through; **`auto` → the universally-safe `half`**. octant/sextant are
  explicit opt-in because a cursor-width probe CANNOT detect font glyph coverage: the cursor
  advances by the Unicode width table, not glyph presence, so an octant (U+1CD00, assigned +
  narrow) measures 1 column whether the terminal draws it OR a width-1 tofu box (macOS
  Terminal.app does the latter), and there's no env-free capability query. The tui's OWN default
  mode stays octant, so golden frames stay octant (the cli `auto`→`half` only affects runtime). Size sprites with the exported `subcellCols(width)`/`subcellRows(height)`, NOT `ceil(height/2)`.
  Habitat scenes are 128×96 px (4:3). The canvas is the **true 4:3 box** from `fit43` (8:3
  cells, `rows = cols × 3/8`), letterboxed in its band — the backdrop **scales uniformly to
  fill that box** via `drawSprite`'s `destW`/`destH` (nearest-neighbor), never stretched. The
  **pet and trinkets both scale off the `scene.cols / HABITAT_COLS` factor** (`sceneScale` in
  pet.ts; pass scaled dims into the wander geometry AND `drawSprite`) so they stay proportionate
  at any width. Note `sceneScale = scene.cols / 128` folds the px→cell conversion into the
  habitat-width divisor, so an unboosted sprite is only ~`subcellRows(px)/48` of habitat height
  (rookie ~1/8, apex ~3/16) — smaller than the art's px ratio implies. The PET sprite therefore
  takes a flat **`PET_SCALE_BOOST` = 2** (players found the unboosted pet too small): a uniform
  multiplier that restores px-proportionate sizing so the apex reads at ~1/3 of habitat height
  (prime ~1/3, rookie ~1/4) while preserving the per-stage size ladder (egg 16 … apex 36 px).
  Trinkets keep the **unboosted** `scale`, so a toy reads smaller than the creature. Min terminal
  34×24 vertical / 72×12 horizontal.
- Canvas hosts: pet + habitat + trinkets, cutscenes, battle view, and full-screen pages
  (Dex, Loot, Feats, Settings) inside the same content region.
- Menu flow (`render/menu.ts` → `packMenu(cols)`, shared by `layout` for `menuRows`+`menuBtnH`,
  `frame` to draw, and `shell` to hit-test): a labeled `── Menu ──` divider (frame, `menuDividerY`)
  then the 7 nav buttons (Pet/Dex/Loot/Feats/Battle/Settings/Quit) as real BUTTONS — one uniform width
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
  meter is NOT in the menu (it's shown per-page — Dex/Loot/Feats). Adding a page = extend the `PageId`
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
(compositor+palette ladder, `destW`/`destH` scaling), `tiles.ts` (the UI `?` tiles —
locked + ornate-gold legend — drawn through the same sprite pipeline), `input.ts` (key/mouse decode),
`hit.ts`, `layout.ts` (`computeLayout`/`petSections`), `menu.ts` (`packMenu` left-aligned
flow), `frame.ts` (frame + menu draw), `shell.ts` (runShell loop) + `shell-io.ts` (default
stdio/terminal wiring, split out to keep `shell.ts` under the line ceiling), `status.ts`
(one-liners), `pages/` (pet, pet-vitals, **dex** + **dex-sky** (the constellation sky + focus rail),
**dex-detail**, **unlockables** (the Loot page), **achievements** (the Feats page), settings, **battle**), `lookup.ts`
(pack helpers). Shared UI lives
under `components/`: `divider.ts` (`drawDivider` — ALL-CAPS BOLD label, rule, gap-after);
`page.ts` (the standard full-screen page scaffold — `drawPageHeader`/`drawPageFooter`/
`PAGE_HEADER_ROWS`, `clampScroll`, used by Dex/Loot/Feats/Settings); and `meter.ts` — the ONE progress bar:
`drawMeter` (filled `█` + a clearly-visible `▒` track), `drawSegmentedMeter` (filled portion split
into colored slices, e.g. the diet-tinted food), and `drawCompletionHeader`; and `marquee.ts`
(`drawMarquee` — a frame-counter-driven scrolling ticker, golden-frame safe; used by the Pet
page's opt-in update notice). Reuse these — don't hand-roll rules/bars/headers/tickers.

## Dex constellation → detail navigation (single-level drill-in)

The Dex is a **constellation field guide**, NOT a list (`pages/dex.ts` owns the node model + page
scaffold; `pages/dex-sky.ts` draws the sky + focus rail). One House is a "sky" at a time: its
evolution tree drawn as **glow-dot stars** (apex at the top down to the sprite/egg rooted in the
shared Mote), owned species glowing in their best grade (`GRADE_BADGE`/`GRADE_ACCENT`), unseen ones
dim `?` points, joined by faint House-tinted lineage lines (`buildHouseNodes` derives tier + in-House
parents from `evolvesTo`; order is tier-asc then Dex num — deterministic). `ui.dex.house` selects the
sky (`←→` pans, wrapping; clickable House tabs register `dex:house:<i>`), `ui.dex.selected` the star
(`↑↓`; each star registers `dex:star:<idx>`). A **focus rail** (dropped below `RAIL_MIN_COLS` so the
sky takes the full width) renders the selected star's REAL sprite + identity, or a **square `?` tile**
when undiscovered — the plain slate tile, or the ornate gold **legend** tile for a reserved special
slot (wired but dormant in Season 0; honors the spoiler rule). The two color maps stay disjoint:
`GRADE_ACCENT` = the star's rarity glow, `houseColor`/`houseTint` = identity (lines + sprite palette).

The **Dex detail** page (`pages/dex-detail.ts`) is the drill-in: a `PageId` reached by Enter /
clicking an owned star (`openDexDetail` stashes `speciesId` on `ui['dex-detail']`); Esc or any click
on the detail body returns to `'dex'`. It renders the species sprite via `buildPalette(houseTint,
bestGrade, frame)`, a battle/graft-readiness banner (`isBattleReady`), and up to 3 record cards
(stats, captured date, **DNA code** via `encodeDna`, graft tier). Keep both deterministic for golden
frames: positions derive only from species data + the rect (no RNG), dates use `toISOString()` (UTC),
stat columns are fixed-width. New pages need a `frame.ts` switch case + a `freshUi()` entry;
verify/regenerate golden frames.

## Settings page: `ShellInfo` (static) + `SettingsState` (editable)

The Settings page mixes **read-only facts** with the shell's **only editable surface** — the
opt-in **update mode** and the **pet-global cycle clock** (policy + the subscription anchor
adapter). Adapters themselves are read-only here (pure data sources). Two contracts, two
responsibilities:

- **`ShellInfo`** — static facts (version, runtime, fps, dataDir). The page must stay
  deterministic for golden frames, so it NEVER reads the wall clock, `process.*`, or the
  filesystem itself. The cli composes these once and passes `runShell({ info })`; the
  shell threads it into `RenderContext.info` (optional — undefined in tests, where the
  page falls back to `—`). The app version is the single `apps/cli/src/version.ts` const
  (kept in sync with package.json), re-exported from `main.ts`. Rule for any future info
  page: derive process/fs facts in the cli, pass them in — never reach for them in `tui`.
- **`SettingsState`** — a live working copy of `updateMode` + the pet-global cycle clock
  (`cyclePolicy`, `anchorAdapter`) + read-only `adapters`, plus `selected` (a flat field index:
  **0 = update mode, 1 = cycle policy, 2 = anchor adapter**). The anchor field (index 2) appears
  ONLY when `cyclePolicy === 'subscription'` and more than one adapter is configured, so
  `settingsFieldCount` is 2 or 3 (`anchorFieldShown`). The page renders it and a hit region per
  field but owns NO mutation. The shell drives editing: ↑↓ move `selected` (`moveSelection`),
  ←→ cycle the focused value (`cycleSelectedField` in `pages/settings.ts`). On each change the
  shell persists to the RIGHT store by field: the update-mode field (`isUpdateFieldSelected`)
  → `options.onUpdateModeChange(mode)` → settings.json; the cycle fields →
  `options.onCycleChange(policy, anchorAdapter)` → config.json. Edits apply on the **next
  launch**, never mid-session — the cycle reshapes molt windows, which must not shift under a
  running pet; the update mode is read at launch too. The update toggle only WRITES the mode
  string — it never imports the updater network surface (the isolation gate holds; off stays the
  default). Adapters are pure data sources (read-only here); adding/removing them and editing scan
  paths stays in `tt init`. The pet game itself stays fully idle: Settings is optional config.
