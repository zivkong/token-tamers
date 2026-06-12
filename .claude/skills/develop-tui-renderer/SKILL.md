---
name: develop-tui-renderer
description: TUI shell and renderer rules for Token Tamers — 4:3 canvas layout, diff renderer, half-block compositor, SGR mouse, performance budgets, golden-frame testing. Use when working under packages/tui.
---

# Develop the TUI shell & renderer (packages/tui)

Source of truth: `token-tamers-design.md` §13 (rendering), §15 (shell). Custom slim
TUI core — NO framework (Ink/OpenTUI rejected by design; OpenTUI is the documented
fallback if the renderer hits a wall). Zero runtime dependencies; works on any Node
LTS over any SSH. tui imports `@token-tamers/core` only — never adapters or content.

## Layout law

- The game renders in a **4:3 game canvas** with the **menu bar OUTSIDE the canvas,
  docked at the bottom**. Cells are ~1:2 w:h and half-blocks give 2 vertical px per
  cell, so a 4:3 visual canvas uses a cols:rows grid of ~8:3 (128×48 → 128×96 px).
  Minimum terminal 64×24; letterbox the remainder with habitat-tinted gutters.
- Canvas hosts: pet + habitat + trinkets, cutscenes, battle view, and full-screen
  pages (Dex, Archive, Achievements) inside the same frame.
- Bottom menu (1–2 rows): clickable buttons + live Completion Meter on the right;
  active page highlighted.
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
(compositor+palette ladder), `input.ts` (key/mouse decode), `hit.ts`, `layout.ts`,
`render.ts` (frame+menu), `shell.ts` (runShell loop), `status.ts` (one-liners),
`pages/` (pet/dex/archive), `lookup.ts` (pack helpers).
