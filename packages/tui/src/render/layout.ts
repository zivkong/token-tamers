/**
 * Layout math: a RESPONSIVE, ORIENTATION-AWARE stack.
 *
 * The shell adapts to the terminal's shape (rev 1.2):
 *
 *  - VERTICAL (a tall "side pane"): a top-oriented, full-width vertical stack —
 *    header → game canvas → VITALS → menu band — exactly as before. Slack falls
 *    below the menu (the UI hugs the top).
 *
 *  - HORIZONTAL (a wide, short "bottom dock"): two columns — the game canvas on
 *    the LEFT and a chrome column on the RIGHT (the pet's header/stats/vitals),
 *    with the nav menu as a vertical RAIL down the right edge. This frees the
 *    vertical budget the canvas needs to stay 4:3 in a short terminal.
 *
 * The game canvas is a TRUE 4:3 box (`fit43`): a 4:3-pixel habitat looks 4:3 on
 * screen only when its cell box is 8:3 (cells are ~1:2 w:h), so the canvas is
 * letterboxed — centered with gutters inside its band — rather than stretched to
 * fill. This is the one place gutters are allowed (layout law rev 1.2); the rest
 * of the frame stays gutter-free.
 *
 *   VERTICAL                          HORIZONTAL
 *   ┌──────────────────┐ row 0        ┌───────────────┬───┬──────┐
 *   │ header (id/stats)│              │  (gutter)     │ │ │ Menu │
 *   ├──────────────────┤  ← divider   │ ┌───────────┐ │ │ │ ┌──┐ │
 *   │ (gap)            │              │ │  4:3      │ │v│ │ │Pe│ │
 *   │ game canvas 4:3  │              │ │  canvas   │ │r│ │ └──┘ │
 *   │ (gap)            │              │ └───────────┘ │u│ │ ┌──┐ │
 *   ├──── VITALS ──────┤  ← divider   │  (gutter)     │l│ │ │De│ │
 *   │ (gap)            │              ├─ VITALS ──────┤e│ │ └──┘ │
 *   │ food/diet/…      │  panelRows   │ food/diet/…   │ │ │  …   │
 *   ├──────────────────┤  ← divider   └───────────────┴───┴──────┘
 *   │ (gap)            │                canvas │ chrome │ menu rail
 *   │ menu (buttons)   │  menuRows
 *   └──────────────────┘
 */

import { MENU_BTN_H, menuBandRows, menuButtonWidth, packMenu } from './menu';

/** Minimum terminal size for the VERTICAL (stacked) layout. */
export const MIN_COLS = 34;
export const MIN_ROWS = 24;
/**
 * Minimum terminal size for the HORIZONTAL (side-by-side) layout. A bottom dock
 * is the whole reason horizontal exists, and docks are SHORT — so the row floor
 * is far lower than the vertical stack's (the canvas runs beside the chrome, not
 * above it). The column floor is higher: it must fit canvas + chrome + menu rail.
 */
export const HORIZONTAL_MIN_COLS = 72;
export const HORIZONTAL_MIN_ROWS = 12;

/**
 * Rows the header band occupies at the very top (vertical) or top of the chrome
 * column (horizontal): pet name / identity line / stats readout. Stats live with
 * identity (who the pet IS — a fixed equal budget), kept apart from the live
 * VITALS panel.
 */
export const HEADER_ROWS = 3;
/**
 * Rows the vitals panel occupies: food / diet / growth / odds — four live content
 * rows on consecutive lines (no inter-row spacers). Growth is the abstract
 * maturation cue (a filling bar, no stage word / counts / next form — the
 * evolution-mystery rule).
 */
export const PANEL_ROWS = 4;
/** Blank padding rows used around dividers for spacing between sections. */
export const GAP_ROWS = 1;
/** Divider rules the PET page draws inside the content region (header, VITALS). */
const PET_DIVIDERS = 2;
/**
 * Gap rows inside the vertical content region: after the header divider, before
 * AND after the VITALS divider, and a bottom padding row below the panel (between
 * the Odds row and the global Menu divider). See `petSections`.
 */
const PET_GAPS = 4 * GAP_ROWS;
/** The "── Menu ──" labeled divider row that opens the menu section (all pages). */
export const MENU_DIVIDER_ROWS = 1;
/** Smallest scene height we will draw before the terminal counts as too small. */
export const MIN_SCENE_ROWS = 4;

/**
 * A 4:3-PIXEL image looks 4:3 on screen only when its CELL box is 8:3 — terminal
 * cells are ~1:2 (w:h), so width must be 8/3× the height in cells. These drive
 * `fit43` and replace the old (pre-octant) 4:1 target that quietly squished the
 * 4:3 habitat art.
 */
export const CANVAS_CELL_W = 8;
export const CANVAS_CELL_H = 3;

/**
 * Orientation is picked from the terminal's cols:rows ratio. Because cells are
 * ~1:2, a *visually* square view is `cols ≈ 2·rows`; common terminals (80×24 =
 * 3.33, 120×40 = 3.0, even a maximized 200×50 = 4.0) stay VERTICAL, and only
 * genuinely wide-AND-short docks (a bottom panel: 200×18 = 11, 120×20 = 6) flip
 * HORIZONTAL. The gap between the two thresholds is a dead-band: inside it the
 * previous orientation is kept so a terminal hovering at the boundary doesn't
 * flicker mid-resize (with no prior, the band defaults to vertical). Tunable —
 * these are the only orientation knobs.
 */
export const HORIZONTAL_RATIO = 4.2;
export const VERTICAL_RATIO = 3.6;

export type Orientation = 'vertical' | 'horizontal';

/** A full-width band [y, y+rows) of `cols` columns starting at `x`. */
export interface SceneRect {
  x: number;
  y: number;
  cols: number;
  rows: number;
}

export interface Layout {
  /** Whole terminal size. */
  termCols: number;
  termRows: number;
  /** Chosen layout orientation (see `pickOrientation`). */
  orientation: Orientation;
  /** Content region (pages render here): full-width top band (vertical) or the
   *  left column (horizontal), top-aligned. */
  canvasX: number;
  canvasY: number;
  canvasCols: number;
  canvasRows: number;
  /** Rows the header band occupies. */
  headerRows: number;
  /** Rows the pet vitals panel occupies. */
  panelRows: number;
  /** True when the menu is a vertical rail on the right (horizontal layout). */
  menuRail: boolean;
  /** The menu BUTTON area (buttons packed within `menuRect.cols`, drawn at its
   *  origin). Vertical: a full-width band below the content; horizontal: a rail. */
  menuRect: SceneRect;
  /**
   * Vertical: row of the "── Menu ──" labeled divider above the band.
   * Horizontal: row of the rail's "Menu" label at the top of the rail.
   */
  menuDividerY: number;
  /** Horizontal only: column of the vertical rule separating chrome from the rail. */
  menuDividerX: number;
  /** First row of the menu buttons (= `menuRect.y`). */
  menuY: number;
  /** Menu band height in CELLS (= `menuRect.rows`). */
  menuRows: number;
  /** Per-button height in cells. */
  menuBtnH: number;
  /** Back-compat alias for the first menu-button row. */
  menuRow: number;
  /** True if the terminal is below the minimum size. */
  tooSmall: boolean;
}

/**
 * Pick the layout orientation from the terminal ratio, keeping `prev` inside the
 * dead-band to avoid flicker. With no prior orientation, ambiguous sizes default
 * to vertical (preserving the classic stacked layout for common terminals).
 */
export function pickOrientation(cols: number, rows: number, prev?: Orientation): Orientation {
  const ratio = cols / Math.max(1, rows);
  if (ratio >= HORIZONTAL_RATIO) return 'horizontal';
  if (ratio <= VERTICAL_RATIO) return 'vertical';
  return prev ?? 'vertical';
}

/**
 * The largest centered 4:3 (8:3-cell) box that fits inside `band`. The box is
 * width-bound in tall bands (full width, letterboxed top/bottom) and height-bound
 * in wide bands (full height, gutters left/right), then centered — never stretched.
 */
export function fit43(band: SceneRect): SceneRect {
  const byHeight = Math.floor((band.rows * CANVAS_CELL_W) / CANVAS_CELL_H);
  const cols = Math.max(1, Math.min(band.cols, byHeight));
  const rows = Math.max(1, Math.min(band.rows, Math.round((cols * CANVAS_CELL_H) / CANVAS_CELL_W)));
  const x = band.x + Math.max(0, Math.floor((band.cols - cols) / 2));
  const y = band.y + Math.max(0, Math.floor((band.rows - rows) / 2));
  return { x, y, cols, rows };
}

/** Width of the menu rail (one button column plus a 1-col inset each side). Kept
 *  independent of MENU_X (0 for the edge-to-edge bottom bar) so the horizontal
 *  content width is unchanged. */
function railCols(): number {
  return menuButtonWidth() + 2;
}

function tooSmallLayout(cols: number, rows: number, orientation: Orientation): Layout {
  const menuRow = Math.max(0, rows - 1);
  return {
    termCols: cols,
    termRows: rows,
    orientation,
    canvasX: 0,
    canvasY: 0,
    canvasCols: 0,
    canvasRows: 0,
    headerRows: 0,
    panelRows: 0,
    menuRail: false,
    menuRect: { x: 0, y: menuRow, cols, rows: 1 },
    menuDividerY: menuRow,
    menuDividerX: 0,
    menuY: menuRow,
    menuRows: 1,
    menuBtnH: 1,
    menuRow,
    tooSmall: true,
  };
}

/**
 * Compute the layout for a terminal of (cols, rows). `prev` is the previous
 * orientation, used only to resolve the dead-band (see `pickOrientation`). When
 * too small, `tooSmall` is set and the canvas fields are zeroed.
 */
export function computeLayout(cols: number, rows: number, prev?: Orientation): Layout {
  // Orientation is chosen FIRST, then checked against its own minimums — a short
  // wide dock is valid for horizontal even though it is too short for vertical.
  if (pickOrientation(cols, rows, prev) === 'horizontal') {
    if (cols < HORIZONTAL_MIN_COLS || rows < HORIZONTAL_MIN_ROWS)
      return tooSmallLayout(cols, rows, 'horizontal');
    return horizontalLayout(cols, rows);
  }
  if (cols < MIN_COLS || rows < MIN_ROWS) return tooSmallLayout(cols, rows, 'vertical');
  return verticalLayout(cols, rows);
}

// ---------------------------------------------------------------------------
// Vertical layout — the classic top-oriented, full-width stack.
// ---------------------------------------------------------------------------

function verticalLayout(cols: number, rows: number): Layout {
  // The menu wraps to as many rows as the width needs; the button HEIGHT then
  // shrinks from MENU_BTN_H down to 1 — the tallest that still leaves room for a
  // minimum scene, so a short terminal shrinks the buttons instead of overflowing.
  const wrapRows = packMenu(cols).rows;
  const fixed = HEADER_ROWS + PANEL_ROWS + PET_DIVIDERS + PET_GAPS;
  let menuBtnH = 1;
  for (let h = MENU_BTN_H; h >= 1; h--) {
    const chrome = MENU_DIVIDER_ROWS + GAP_ROWS + menuBandRows(wrapRows, h);
    if (fixed + MIN_SCENE_ROWS + chrome <= rows) {
      menuBtnH = h;
      break;
    }
  }
  const menuRows = menuBandRows(wrapRows, menuBtnH);

  // Scene height: the full-width 4:3 box wants `cols * 3/8` rows, capped to what
  // fits above the menu after the header band, the vitals panel, the dividers and
  // gaps — plus the "── Menu ──" divider and the buttons. When capped, the scene
  // box narrows (centered, with side gutters) in `petSections` to keep 4:3.
  const menuChrome = MENU_DIVIDER_ROWS + GAP_ROWS + menuRows;
  const availForScene = rows - fixed - menuChrome;
  const sceneTarget = Math.round((cols * CANVAS_CELL_H) / CANVAS_CELL_W);
  const sceneRows = Math.max(MIN_SCENE_ROWS, Math.min(sceneTarget, availForScene));

  const canvasRows = fixed + sceneRows;
  const menuY = canvasRows + MENU_DIVIDER_ROWS + GAP_ROWS;

  return {
    termCols: cols,
    termRows: rows,
    orientation: 'vertical',
    canvasX: 0,
    canvasY: 0,
    canvasCols: cols,
    canvasRows,
    headerRows: HEADER_ROWS,
    panelRows: PANEL_ROWS,
    menuRail: false,
    menuRect: { x: 0, y: menuY, cols, rows: menuRows },
    menuDividerY: canvasRows,
    menuDividerX: 0,
    menuY,
    menuRows,
    menuBtnH,
    menuRow: menuY,
    tooSmall: false,
  };
}

// ---------------------------------------------------------------------------
// Horizontal layout — canvas left, chrome column + menu rail on the right.
// ---------------------------------------------------------------------------

/** Rail-label row + a blank gap before the first button. */
const RAIL_LABEL_ROWS = MENU_DIVIDER_ROWS + GAP_ROWS;

function horizontalLayout(cols: number, rows: number): Layout {
  // Rightmost: a fixed-width menu rail, preceded by a vertical rule + a gap col.
  const rail = railCols();
  const railX = cols - rail;
  const menuDividerX = railX - 2; // vertical rule column; gap col at +1
  const contentCols = menuDividerX;

  // The rail stacks the buttons one per row (its width fits a single column).
  const wrapRows = packMenu(rail).rows;
  // Shrink the button height (3 → 1) until the whole rail fits the dock's rows;
  // a 1-tall button drops its border (drawn only at h ≥ 3).
  let menuBtnH = 1;
  for (let h = MENU_BTN_H; h >= 1; h--) {
    if (RAIL_LABEL_ROWS + menuBandRows(wrapRows, h) <= rows) {
      menuBtnH = h;
      break;
    }
  }
  const menuRows = menuBandRows(wrapRows, menuBtnH);

  return {
    termCols: cols,
    termRows: rows,
    orientation: 'horizontal',
    canvasX: 0,
    canvasY: 0,
    canvasCols: contentCols,
    canvasRows: rows,
    headerRows: HEADER_ROWS,
    panelRows: PANEL_ROWS,
    menuRail: true,
    menuRect: { x: railX, y: RAIL_LABEL_ROWS, cols: rail, rows: menuRows },
    menuDividerY: 0,
    menuDividerX,
    menuY: RAIL_LABEL_ROWS,
    menuRows,
    menuBtnH,
    menuRow: RAIL_LABEL_ROWS,
    tooSmall: false,
  };
}

// ---------------------------------------------------------------------------
// Pet page section bands.
// ---------------------------------------------------------------------------

/** A horizontal rule the pet page draws (a `drawDivider` call). */
export interface PetRule {
  y: number;
  x: number;
  width: number;
  label?: string;
}

/** The pet page's stacked bands + the rules/separator that frame them. */
export interface PetSections {
  header: SceneRect;
  scene: SceneRect;
  panel: SceneRect;
  /** Horizontal rules to draw (header divider + labeled VITALS divider). */
  rules: PetRule[];
  /** Vertical separator between canvas and chrome (horizontal layout only). */
  separator?: { x: number; y: number; height: number };
}

/**
 * Carve the pet page's section bands out of the content region. In VERTICAL the
 * bands stack (header → 4:3 scene → VITALS → panel) with gaps and two rules. In
 * HORIZONTAL the scene takes the left of the content column (4:3, letterboxed)
 * and the header + vitals stack in a chrome sub-column to its right, joined by a
 * vertical separator. The global "── Menu ──" / rail is frame chrome, not here.
 */
export function petSections(l: Layout): PetSections {
  return l.orientation === 'horizontal' ? horizontalSections(l) : verticalSections(l);
}

function verticalSections(l: Layout): PetSections {
  const x = l.canvasX;
  const cols = l.canvasCols;
  const g = GAP_ROWS;
  const sceneRows = l.canvasRows - (l.headerRows + l.panelRows + PET_DIVIDERS + PET_GAPS);

  const headerY = l.canvasY;
  const dHeader = headerY + l.headerRows;
  const sceneBandY = dHeader + 1 + g;
  const dScene = sceneBandY + sceneRows + g; // extra gap BEFORE the VITALS divider
  const panelY = dScene + 1 + g;
  // panelY + panelRows + g (bottom padding) == canvasRows == menuDividerY.

  // The scene is a true 4:3 box centered in its full-width band (side gutters
  // appear only when the band is height-capped on a short terminal).
  const scene = fit43({ x, y: sceneBandY, cols, rows: sceneRows });

  return {
    header: { x, y: headerY, cols, rows: l.headerRows },
    scene,
    panel: { x, y: panelY, cols, rows: l.panelRows },
    rules: [
      { y: dHeader, x, width: cols },
      { y: dScene, x, width: cols, label: 'VITALS' },
    ],
  };
}

/** Minimum width the chrome sub-column needs to render stats/vitals legibly. */
const MIN_CHROME_COLS = 24;
/** Minimum width the canvas sub-column keeps so the 4:3 box stays meaningful. */
const MIN_CANVAS_COLS = 24;

function horizontalSections(l: Layout): PetSections {
  const g = GAP_ROWS;
  // Split the content column into [canvas | separator+gap | chrome]. The chrome
  // takes ~38% (clamped) so stats/vitals stay legible; the canvas takes the rest.
  const split = 2; // vertical rule column + a gap column
  const chromeCols = Math.max(
    MIN_CHROME_COLS,
    Math.min(Math.round((l.canvasCols - split) * 0.38), l.canvasCols - split - MIN_CANVAS_COLS),
  );
  const canvasCols = l.canvasCols - split - chromeCols;
  const chromeX = l.canvasCols - chromeCols;
  const sepX = canvasCols; // vertical rule between canvas and chrome

  // Canvas: 4:3 box centered in the tall left column (letterboxed top/bottom).
  const scene = fit43({ x: l.canvasX, y: l.canvasY, cols: canvasCols, rows: l.canvasRows });

  // Chrome column: header (stats) at top, a labeled VITALS rule, then the panel.
  const headerY = l.canvasY;
  const dVitals = headerY + l.headerRows + g;
  const panelY = dVitals + 1 + g;

  return {
    header: { x: chromeX, y: headerY, cols: chromeCols, rows: l.headerRows },
    scene,
    panel: { x: chromeX, y: panelY, cols: chromeCols, rows: l.panelRows },
    rules: [{ y: dVitals, x: chromeX, width: chromeCols, label: 'VITALS' }],
    separator: { x: sepX, y: l.canvasY, height: l.canvasRows },
  };
}

/**
 * The too-small message lines (caller centers them). Cites the floor for the
 * orientation the terminal was REJECTED under — a wide-but-too-short dock is a
 * failed horizontal layout, so quoting the 34×24 vertical floor would mislead.
 */
export function tooSmallMessage(cols: number, rows: number, orientation?: Orientation): string[] {
  const [minC, minR] =
    orientation === 'horizontal'
      ? [HORIZONTAL_MIN_COLS, HORIZONTAL_MIN_ROWS]
      : [MIN_COLS, MIN_ROWS];
  return ['Terminal too small', `Need at least ${minC}x${minR}`, `Current: ${cols}x${rows}`];
}
