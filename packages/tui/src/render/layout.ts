/**
 * Layout math: a TOP-ORIENTED, FULL-WIDTH vertical stack.
 *
 * The frame is a column of full-width sections stacked from the top — no
 * letterbox gutters, no side padding — with a divider rule between sections:
 *
 *   ┌───────────────────────────────┐ row 0
 *   │ header band (name / identity)  │  headerRows
 *   ├───────────────────────────────┤  ← divider
 *   │ game canvas (scene, full width)│  sceneRows   ── canvas region ──┐
 *   ├──── VITALS ───────────────────┤  ← labeled divider              │ canvasRows
 *   │ stats + token nourishment      │  panelRows                      │
 *   ├───────────────────────────────┤  ← divider ─────────────────────┘
 *   │ menu grid (6 cols → 3 on narrow)│ menuRows  (menuY)
 *   └───────────────────────────────┘
 *   (any slack falls BELOW the menu — the UI hugs the top)
 *
 * The scene keeps the habitat's native 4:1 cell aspect (96×24 px-grid → 96:24
 * cells) so a backdrop scaled to fill the full width stays undistorted; it is
 * capped to the rows available above the menu. Pages render into the canvas
 * region [canvasY, canvasY+canvasRows); the pet page sub-divides it into the
 * header / scene / vitals bands via `petSections()`.
 */

export const MIN_COLS = 64;
export const MIN_ROWS = 24;

/** Rows the header band occupies at the very top (pet name + identity). */
export const HEADER_ROWS = 2;
/**
 * Rows the vitals panel occupies: a stat row, a blank, a feeding row, a blank,
 * and a diet row — the blanks give the panel internal breathing room.
 */
export const PANEL_ROWS = 5;
/** Divider rules drawn between the stacked sections (header|scene|panel|menu). */
export const DIVIDER_ROWS = 3;
/** Blank padding rows that follow each divider, for spacing between sections. */
export const GAP_ROWS = 1;
/** Smallest scene height we will draw before the terminal counts as too small. */
export const MIN_SCENE_ROWS = 6;
/**
 * Width at/above which the menu lays out as a single row of 6 columns; below it
 * the menu wraps to 3 columns over 2 rows.
 */
export const MENU_GRID_BREAKPOINT = 72;

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
  /** First row of the menu band (immediately after the canvas region). */
  menuY: number;
  /** Menu band height (1 when 6 columns fit, else 2). */
  menuRows: number;
  /** Menu grid column count (6 wide, 3 narrow). */
  menuCols: number;
  /** Back-compat alias for the first menu row. */
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
      menuY: menuRow,
      menuRows: 1,
      menuCols: 1,
      menuRow,
      tooSmall: true,
    };
  }

  const menuCols = cols >= MENU_GRID_BREAKPOINT ? 6 : 3;
  const menuRows = menuCols === 6 ? 1 : 2;

  // Scene height tracks the habitat's native 4:1 cell aspect (96 cols : 24
  // rows) so a full-width backdrop scales uniformly, capped to what fits above
  // the menu after the header band, the vitals panel, the section dividers and
  // their padding gaps.
  const chrome = HEADER_ROWS + PANEL_ROWS + DIVIDER_ROWS * (1 + GAP_ROWS) + menuRows;
  const availForScene = rows - chrome;
  const sceneTarget = Math.round(cols / 4);
  const sceneRows = Math.max(MIN_SCENE_ROWS, Math.min(sceneTarget, availForScene));

  const canvasRows = chrome - menuRows + sceneRows;
  const menuY = canvasRows;

  return {
    termCols: cols,
    termRows: rows,
    canvasX: 0,
    canvasY: 0,
    canvasCols: cols,
    canvasRows,
    headerRows: HEADER_ROWS,
    panelRows: PANEL_ROWS,
    menuY,
    menuRows,
    menuCols,
    menuRow: menuY,
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
  /** Divider rows: [after header, labeled (after scene), before menu]. */
  dividerYs: [number, number, number];
}

/**
 * Carve the pet page's section bands out of the content region. The scene flexes
 * to fill whatever is left between the fixed header (top) and vitals panel
 * (bottom); each section is separated by a divider rule FOLLOWED by a blank
 * padding gap, so sections breathe instead of touching.
 */
export function petSections(l: Layout): PetSections {
  const x = l.canvasX;
  const cols = l.canvasCols;
  const sceneRows =
    l.canvasRows - l.headerRows - l.panelRows - DIVIDER_ROWS - DIVIDER_ROWS * GAP_ROWS;

  const headerY = l.canvasY;
  const dHeader = headerY + l.headerRows; // divider, then a gap
  const sceneY = dHeader + 1 + GAP_ROWS;
  const dScene = sceneY + sceneRows; // labeled divider, then a gap
  const panelY = dScene + 1 + GAP_ROWS;
  const dPanel = panelY + l.panelRows; // divider, then a gap, then the menu

  return {
    header: { x, y: headerY, cols, rows: l.headerRows },
    scene: { x, y: sceneY, cols, rows: sceneRows },
    panel: { x, y: panelY, cols, rows: l.panelRows },
    dividerYs: [dHeader, dScene, dPanel],
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
