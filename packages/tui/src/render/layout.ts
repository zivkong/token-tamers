/**
 * Layout math: a TOP-ORIENTED, FULL-WIDTH vertical stack.
 *
 * The frame is a column of full-width sections stacked from the top — no
 * letterbox gutters, no side padding:
 *
 *   ┌───────────────────────────────┐ row 0
 *   │ header band (title / identity) │  headerRows
 *   ├───────────────────────────────┤
 *   │ game canvas (scene, full width)│  sceneRows  ── canvas region ──┐
 *   ├───────────────────────────────┤                                │ canvasRows
 *   │ status band (last roll / home) │  statusRows ───────────────────┘
 *   ├───────────────────────────────┤ menuY
 *   │ menu grid (6 cols → 3 on narrow)│ menuRows
 *   └───────────────────────────────┘
 *   (any slack falls BELOW the menu — the UI hugs the top)
 *
 * The scene keeps the habitat's native 4:1 cell aspect (96×24 px-grid → 96:24
 * cells) so a backdrop scaled to fill the full width stays undistorted; it is
 * capped to the rows available above the menu. Pages render into the canvas
 * region [canvasY, canvasY+canvasRows); the pet page sub-divides it into the
 * header / scene / status bands via `headerRows`/`statusRows`.
 */

export const MIN_COLS = 64;
export const MIN_ROWS = 24;

/** Rows the header band occupies at the very top (pet title + identity). */
export const HEADER_ROWS = 2;
/** Rows the status band occupies at the bottom of the canvas region. */
export const STATUS_ROWS = 1;
/** Smallest scene height we will draw before the terminal counts as too small. */
export const MIN_SCENE_ROWS = 8;
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
  /** Rows reserved at the top of the canvas region for section headers. */
  headerRows: number;
  /** Rows reserved at the bottom of the canvas region for the status line. */
  statusRows: number;
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
      statusRows: 0,
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
  // the menu after the header + status bands.
  const chrome = HEADER_ROWS + STATUS_ROWS + menuRows;
  const availForScene = rows - chrome;
  const sceneTarget = Math.round(cols / 4);
  const sceneRows = Math.max(MIN_SCENE_ROWS, Math.min(sceneTarget, availForScene));

  const canvasRows = HEADER_ROWS + sceneRows + STATUS_ROWS;
  const menuY = canvasRows;

  return {
    termCols: cols,
    termRows: rows,
    canvasX: 0,
    canvasY: 0,
    canvasCols: cols,
    canvasRows,
    headerRows: HEADER_ROWS,
    statusRows: STATUS_ROWS,
    menuY,
    menuRows,
    menuCols,
    menuRow: menuY,
    tooSmall: false,
  };
}

/** The scene sub-region (game canvas proper) within the content region. */
export interface SceneRect {
  x: number;
  y: number;
  cols: number;
  rows: number;
}

/** Carve the scene rect (between the header and status bands) from a layout. */
export function sceneRect(layout: Layout): SceneRect {
  return {
    x: layout.canvasX,
    y: layout.canvasY + layout.headerRows,
    cols: layout.canvasCols,
    rows: layout.canvasRows - layout.headerRows - layout.statusRows,
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
