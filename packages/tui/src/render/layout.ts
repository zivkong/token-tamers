/**
 * Layout math: fit the largest 4:3 pixel canvas into the terminal above a
 * one-row bottom menu, with letterbox gutters.
 *
 * Terminal cells are ~1:2 (width:height). With half-blocks we pack 2 vertical
 * pixels per cell, so a pixel-square canvas of aspect 4:3 maps to a cell grid
 * with aspect roughly 8:3 (cols : rows). We pick the largest such cell grid
 * that fits the available area, then center it with gutters.
 */

export const MIN_COLS = 64;
export const MIN_ROWS = 24;

/** Rows reserved at the very bottom for the menu bar. */
export const MENU_ROWS = 1;

/** Cells reserved on every side of the canvas for its stage frame border. */
export const FRAME_MARGIN = 1;

export interface Layout {
  /** Whole terminal size. */
  termCols: number;
  termRows: number;
  /** Canvas (pixel-art region) placement in cells. */
  canvasX: number;
  canvasY: number;
  canvasCols: number;
  canvasRows: number;
  /** The menu row (0-based). */
  menuRow: number;
  /** True if the terminal is below the minimum size. */
  tooSmall: boolean;
}

/**
 * Compute the canvas layout for a terminal of (cols, rows). When too small,
 * `tooSmall` is set and the canvas fields are zeroed; callers show a message.
 */
export function computeLayout(cols: number, rows: number): Layout {
  if (cols < MIN_COLS || rows < MIN_ROWS) {
    return {
      termCols: cols,
      termRows: rows,
      canvasX: 0,
      canvasY: 0,
      canvasCols: 0,
      canvasRows: 0,
      menuRow: Math.max(0, rows - 1),
      tooSmall: true,
    };
  }

  // Reserve the menu row plus a 1-cell margin all around for the stage frame.
  const availCols = cols - FRAME_MARGIN * 2;
  const availRows = rows - MENU_ROWS - FRAME_MARGIN * 2;

  // Target cell aspect cols:rows = 8:3.
  // For each candidate, fit within (availCols, availRows).
  // Maximize area: try matching to width, then to height, take the larger fit.
  const byWidth = fitFromCols(availCols, availRows);
  const byHeight = fitFromRows(availCols, availRows);
  const best =
    byWidth.canvasCols * byWidth.canvasRows >= byHeight.canvasCols * byHeight.canvasRows
      ? byWidth
      : byHeight;

  const canvasCols = best.canvasCols;
  const canvasRows = best.canvasRows;
  const canvasX = FRAME_MARGIN + Math.floor((availCols - canvasCols) / 2);
  const canvasY = FRAME_MARGIN + Math.floor((availRows - canvasRows) / 2);

  return {
    termCols: cols,
    termRows: rows,
    canvasX,
    canvasY,
    canvasCols,
    canvasRows,
    menuRow: rows - 1,
    tooSmall: false,
  };
}

function fitFromCols(
  availCols: number,
  availRows: number,
): { canvasCols: number; canvasRows: number } {
  let canvasCols = availCols;
  let canvasRows = Math.round((canvasCols * 3) / 8);
  if (canvasRows > availRows) {
    canvasRows = availRows;
    canvasCols = Math.round((canvasRows * 8) / 3);
  }
  return { canvasCols, canvasRows };
}

function fitFromRows(
  availCols: number,
  availRows: number,
): { canvasCols: number; canvasRows: number } {
  let canvasRows = availRows;
  let canvasCols = Math.round((canvasRows * 8) / 3);
  if (canvasCols > availCols) {
    canvasCols = availCols;
    canvasRows = Math.round((canvasCols * 3) / 8);
  }
  return { canvasCols, canvasRows };
}

/** The too-small message, centered helper. */
export function tooSmallMessage(cols: number, rows: number): string[] {
  return [
    'Terminal too small',
    `Need at least ${MIN_COLS}x${MIN_ROWS}`,
    `Current: ${cols}x${rows}`,
  ];
}
