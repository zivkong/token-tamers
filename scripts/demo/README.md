# Demo capture (README assets)

The README GIFs/stills are **real renderer footage** of a glossy showcase pet
(S-grade apex Aurelion, full Dex, everything unlocked).

## Why not vhs?

The sprites use Unicode-16 **octant** sub-cell glyphs (`subcell: octant`). vhs
renders through headless xterm.js, which has no octant glyphs, so the canvas comes
out garbled. **Ghostty** synthesizes those glyphs internally, so captures must come
from a real Ghostty window.

## How it's done

1. `apps/cli/demo-shell.ts` runs the interactive shell from an in-memory showcase
   state, redirected to a throwaway `/tmp` data dir so the real `~/.tokentamers`
   is never touched:

   ```sh
   NODE_NO_WARNINGS=1 pnpm --filter token-tamers exec tsx demo-shell.ts [page]
   ```

2. Open it in a **new Ghostty window** (`Cmd+N`, not a tab) so the capture window
   is separate from your session, then drive it with AppleScript + capture with
   the macOS screen tools (Accessibility + Screen Recording permission required):
   - **Stills** — `screencapture -x -o -R<x,y,w,h> out.png` (titlebar cropped via
     the y-offset).
   - **GIFs** — `ffmpeg -f avfoundation -i "<screen>:none" -t <s> -vf crop=…` then
     a `palettegen`/`paletteuse` pass to GIF.
   - **Orientation** — resize the window so `cols/rows ≥ 4.2` for the horizontal
     hero (canvas left, menu rail right); a taller window stays vertical for the
     Dex/tour pages (see `HORIZONTAL_RATIO` in `packages/tui/src/render/layout.ts`).

The exact device index and crop rectangle are display-specific (these were shot on
a 1920×1080 logical display), so re-running on another machine needs those numbers
re-derived — this is a manual art pass, not a CI step.
