/**
 * Layout math: a TOP-ORIENTED, FULL-WIDTH vertical stack.
 *
 * The frame is a column of full-width sections stacked from the top — no
 * letterbox gutters, no side padding — with a divider rule AND blank padding
 * gaps between sections so they breathe:
 *
 *   ┌───────────────────────────────┐ row 0
 *   │ header band (name / identity)  │  headerRows
 *   ├───────────────────────────────┤  ← divider
 *   │ (gap)                          │
 *   │ game canvas (scene, full width)│  sceneRows   ── canvas region ──┐
 *   │ (gap)                          │                                 │ canvasRows
 *   ├──── VITALS ───────────────────┤  ← labeled divider              │
 *   │ (gap)                          │                                 │
 *   │ stats · food · diet · odds     │  panelRows                      │
 *   ├───────────────────────────────┤  ← divider                      ┘
 *   │ (gap)                          │
 *   │ menu (left-aligned, wraps)     │  menuRows  (menuY)
 *   └───────────────────────────────┘
 *   (any slack falls BELOW the menu — the UI hugs the top)
 *
 * The scene keeps the habitat's native 4:1 cell aspect so a full-width backdrop
 * scales uniformly; it is capped to the rows available above the menu. The pet
 * page sub-divides the content region via `petSections()`.
 */

import { packMenu } from './menu';

/** Minimum supported terminal size. The UI degrades gracefully down to here. */
export const MIN_COLS = 34;
export const MIN_ROWS = 24;

/** Rows the header band occupies at the very top (pet name + identity). */
export const HEADER_ROWS = 2;
/**
 * Rows the vitals panel occupies: stats / gap / food / gap / diet / gap / odds —
 * four content rows interleaved with blank spacers. (Completion lives per-page.)
 */
export const PANEL_ROWS = 7;
/** Blank padding rows used around dividers for spacing between sections. */
export const GAP_ROWS = 1;
/** Divider rules the PET page draws inside the content region (header, VITALS). */
const PET_DIVIDERS = 2;
/**
 * Gap rows inside the content region: after the header divider, before AND after
 * the VITALS divider, and a bottom padding row below the panel (between the Odds
 * row and the global Menu divider). See `petSections`.
 */
const PET_GAPS = 4 * GAP_ROWS;
/** The "── Menu ──" labeled divider row that opens the menu section (all pages). */
export const MENU_DIVIDER_ROWS = 1;
/** Smallest scene height we will draw before the terminal counts as too small. */
export const MIN_SCENE_ROWS = 4;

export interface Layout {
  /** Whole terminal size. */
  termCols: number;
  termRows: number;
  /** Full-width content region (pages render here), top-aligned. */
  canvasX: number;
  canvasY: number;
  canvasCols: number;
  canvasRows: number;
  /** Rows reserved at the top of the canvas region for the header band. */
  headerRows: number;
  /** Rows the pet vitals panel occupies near the bottom of the canvas region. */
  panelRows: number;
  /** Row of the "── Menu ──" labeled divider that opens the menu section. */
  menuDividerY: number;
  /** First row of the menu buttons (just below the menu divider). */
  menuY: number;
  /** Menu band height (number of wrapped rows for the left-aligned flow). */
  menuRows: number;
  /** Back-compat alias for the first menu-button row. */
  menuRow: number;
  /** True if the terminal is below the minimum size. */
  tooSmall: boolean;
}

/**
 * Compute the layout for a terminal of (cols, rows). When too small,
 * `tooSmall` is set and the canvas fields are zeroed; callers show a message.
 */
export function computeLayout(cols: number, rows: number): Layout {
  if (cols < MIN_COLS || rows < MIN_ROWS) {
    const menuRow = Math.max(0, rows - 1);
    return {
      termCols: cols,
      termRows: rows,
      canvasX: 0,
      canvasY: 0,
      canvasCols: 0,
      canvasRows: 0,
      headerRows: 0,
      panelRows: 0,
      menuDividerY: menuRow,
      menuY: menuRow,
      menuRows: 1,
      menuRow,
      tooSmall: true,
    };
  }

  // The left-aligned menu flow wraps to as many rows as the width needs.
  const menuRows = packMenu(cols).rows;

  // Scene height tracks the habitat's native 4:1 cell aspect (96 cols : 24
  // rows) so a full-width backdrop scales uniformly, capped to what fits above
  // the menu after the header band, the vitals panel, the dividers and gaps —
  // plus the "── Menu ──" divider and the menu buttons themselves.
  const fixed = HEADER_ROWS + PANEL_ROWS + PET_DIVIDERS + PET_GAPS;
  // The menu section is a divider + its standard gap-after + the button rows.
  const menuChrome = MENU_DIVIDER_ROWS + GAP_ROWS + menuRows;
  const availForScene = rows - fixed - menuChrome;
  const sceneTarget = Math.round(cols / 4);
  const sceneRows = Math.max(MIN_SCENE_ROWS, Math.min(sceneTarget, availForScene));

  const canvasRows = fixed + sceneRows;

  return {
    termCols: cols,
    termRows: rows,
    canvasX: 0,
    canvasY: 0,
    canvasCols: cols,
    canvasRows,
    headerRows: HEADER_ROWS,
    panelRows: PANEL_ROWS,
    menuDividerY: canvasRows,
    // Buttons sit a divider + a standard gap below the content region.
    menuY: canvasRows + MENU_DIVIDER_ROWS + GAP_ROWS,
    menuRows,
    menuRow: canvasRows + MENU_DIVIDER_ROWS + GAP_ROWS,
    tooSmall: false,
  };
}

/** A full-width band [y, y+rows) of `cols` columns starting at `x`. */
export interface SceneRect {
  x: number;
  y: number;
  cols: number;
  rows: number;
}

/** The pet page's stacked bands + the divider rows that separate them. */
export interface PetSections {
  header: SceneRect;
  scene: SceneRect;
  panel: SceneRect;
  /** Divider rows the pet page draws: [after header, labeled VITALS]. */
  dividerYs: [number, number];
}

/**
 * Carve the pet page's section bands out of the content region. A gap follows the
 * header divider, brackets the VITALS divider on both sides, and a bottom-padding
 * gap sits below the panel (between Odds and the global "── Menu ──" divider). The
 * scene flexes to fill the remaining height. The menu divider is global chrome
 * (drawn by the frame for every page), so it is NOT in `dividerYs`.
 */
export function petSections(l: Layout): PetSections {
  const x = l.canvasX;
  const cols = l.canvasCols;
  const g = GAP_ROWS;
  const sceneRows = l.canvasRows - (l.headerRows + l.panelRows + PET_DIVIDERS + PET_GAPS);

  const headerY = l.canvasY;
  const dHeader = headerY + l.headerRows;
  const sceneY = dHeader + 1 + g;
  const dScene = sceneY + sceneRows + g; // extra gap BEFORE the VITALS divider
  const panelY = dScene + 1 + g;
  // panelY + panelRows + g (bottom padding) == canvasRows == menuDividerY.

  return {
    header: { x, y: headerY, cols, rows: l.headerRows },
    scene: { x, y: sceneY, cols, rows: sceneRows },
    panel: { x, y: panelY, cols, rows: l.panelRows },
    dividerYs: [dHeader, dScene],
  };
}

/** The too-small message lines (caller centers them). */
export function tooSmallMessage(cols: number, rows: number): string[] {
  return [
    'Terminal too small',
    `Need at least ${MIN_COLS}x${MIN_ROWS}`,
    `Current: ${cols}x${rows}`,
  ];
}
