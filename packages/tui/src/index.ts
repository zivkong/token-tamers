/**
 * @token-tamers/tui — the terminal shell.
 *
 * Public surface: the `runShell` entrypoint (kept signature-compatible with the
 * cli) plus the rendering primitives `tt watch`/`tt status` reuse.
 */

// Core shell contract + loop.
export {
  runShell,
  type ShellHost,
  type ShellOptions,
  type InputSource,
  FRAME_MS,
  ADVANCE_MS,
} from './shell';

// Pure frame rendering helpers.
export {
  renderFrame,
  renderFrameToString,
  MENU_ITEMS,
  type FrameInput,
  type MenuItem,
} from './render';

// Status one-liners (tt watch / tt status).
export { renderStatusLine, renderGradeOddsLine, progressBar } from './status';

// ANSI / color.
export {
  Writer,
  StringSink,
  type OutputSink,
  type ColorMode,
  type Rgb,
  fgSgr,
  bgSgr,
  rgbTo256,
  rgbTo8,
  hexToRgb,
  mix,
  cursorTo,
  sgrReset,
} from './ansi';

// Frame buffer.
export { FrameBuffer, BLANK_CELL, type Cell } from './buffer';

// Sprite compositor.
export {
  buildPalette,
  drawSprite,
  resolveIndex,
  indexToChar,
  auraOverlay,
  GRADE_BADGE,
  AURA_GLYPHS,
  type Palette,
  type DrawOptions,
} from './sprite';

// Input decoding.
export {
  decode,
  type InputEvent,
  type KeyEvent,
  type MouseEvent,
  type KeyName,
  type MouseAction,
} from './input';

// Hit regions.
export { HitRegistry, type HitRegion } from './hit';

// Layout.
export {
  computeLayout,
  tooSmallMessage,
  MIN_COLS,
  MIN_ROWS,
  MENU_ROWS,
  type Layout,
} from './layout';

// Pages.
export { renderPetPage } from './pages/pet';
export { renderDexPage, buildDexRows, clampScroll, type DexRow } from './pages/dex';
export { renderArchivePage } from './pages/archive';
export type { PageId, PageUiState, RenderContext } from './pages/types';

// Pack lookups (used by render + cli wiring).
export { findSpecies, findSprite, habitatSpriteId, houseTint } from './lookup';
