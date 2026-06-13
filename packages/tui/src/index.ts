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
  menuCells,
  MENU_ITEMS,
  type FrameInput,
  type MenuItem,
  type MenuCell,
} from './render/frame';

// Status one-liners (tt watch / tt status).
export { renderStatusLine, renderGradeOddsLine, progressBar } from './helpers/status';

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
} from './terminal/ansi';

// Frame buffer.
export { FrameBuffer, BLANK_CELL, type Cell } from './render/buffer';

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
} from './render/sprite';

// Input decoding.
export {
  decode,
  type InputEvent,
  type KeyEvent,
  type MouseEvent,
  type KeyName,
  type MouseAction,
} from './terminal/input';

// Hit regions.
export { HitRegistry, type HitRegion } from './render/hit';

// Layout.
export {
  computeLayout,
  petSections,
  tooSmallMessage,
  MIN_COLS,
  MIN_ROWS,
  HEADER_ROWS,
  PANEL_ROWS,
  MENU_GRID_BREAKPOINT,
  type Layout,
  type SceneRect,
  type PetSections,
} from './render/layout';

// Pages.
export { renderPetPage } from './pages/pet';
export { renderDexPage, buildDexRows, clampScroll, type DexRow } from './pages/dex';
export { renderArchivePage } from './pages/archive';
export { renderSettingsPage } from './pages/settings';
export type {
  PageId,
  PageUiState,
  RenderContext,
  ShellInfo,
  AdapterInfo,
  SettingsState,
  LiveStats,
} from './pages/types';

// Pack lookups (used by render + cli wiring).
export { findSpecies, findSprite, habitatSpriteId, houseTint } from './helpers/lookup';
