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
export { renderFrame, renderFrameToString, type FrameInput } from './render/frame';

// Menu model + left-aligned flow packing.
export { packMenu, buttonText, MENU_ITEMS, type MenuItem, type MenuButton } from './render/menu';

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
  osc52,
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
  GAP_ROWS,
  type Layout,
  type SceneRect,
  type PetSections,
} from './render/layout';

// Pages.
export { renderPetPage } from './pages/pet';
export { renderDexPage, buildDexRows, clampScroll, type DexRow } from './pages/dex';
export { renderArchivePage } from './pages/archive';
export { renderSettingsPage } from './pages/settings';
export {
  renderBattlePage,
  playerCombatant,
  opponentCombatant,
  hpAt,
  BATTLE_STEP_FRAMES,
} from './pages/battle';
export type {
  PageId,
  PageUiState,
  BattleView,
  RenderContext,
  ShellInfo,
  AdapterInfo,
  SettingsState,
  LiveStats,
  CompletionBreakdown,
} from './pages/types';

// Pack lookups (used by render + cli wiring).
export { findSpecies, findSprite, habitatSpriteId, houseTint } from './helpers/lookup';
