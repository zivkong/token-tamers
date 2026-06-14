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
 *   │ stats · charge · diet · prog.  │  panelRows                      │
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
 * Rows the vitals panel occupies: stats / gap / charge / gap / diet — three
 * content rows interleaved with blank spacers. (Completion lives per-page now.)
 */
export const PANEL_ROWS = 5;
/** Divider rules drawn between the stacked sections (header|scene|panel|menu). */
export const DIVIDER_ROWS = 3;
/** Blank padding rows used around dividers for spacing between sections. */
export const GAP_ROWS = 1;
/**
 * Total gap rows in the stack: one after each divider (3) plus one BEFORE the
 * VITALS divider (so the canvas and the panel both breathe). See `petSections`.
 */
const TOTAL_GAP_ROWS = 4 * GAP_ROWS;
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
  /** First row of the menu band (immediately after the canvas region). */
  menuY: number;
  /** Menu band height (number of wrapped rows for the left-aligned flow). */
  menuRows: number;
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
      menuRow,
      tooSmall: true,
    };
  }

  // The left-aligned menu flow wraps to as many rows as the width needs.
  const menuRows = packMenu(cols).rows;

  // Scene height tracks the habitat's native 4:1 cell aspect (96 cols : 24
  // rows) so a full-width backdrop scales uniformly, capped to what fits above
  // the menu after the header band, the vitals panel, the dividers and gaps.
  const fixed = HEADER_ROWS + PANEL_ROWS + DIVIDER_ROWS + TOTAL_GAP_ROWS;
  const availForScene = rows - fixed - menuRows;
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
    menuY: canvasRows,
    menuRows,
    menuRow: canvasRows,
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
  /** Divider rows: [after header, labeled (between scene & panel), before menu]. */
  dividerYs: [number, number, number];
}

/**
 * Carve the pet page's section bands out of the content region. Dividers are
 * separated from their neighbours by blank gaps: a gap follows every divider,
 * and an extra gap precedes the VITALS divider so the scene and panel both
 * breathe (request #1). The scene flexes to fill the remaining height.
 */
export function petSections(l: Layout): PetSections {
  const x = l.canvasX;
  const cols = l.canvasCols;
  const g = GAP_ROWS;
  const sceneRows = l.canvasRows - (l.headerRows + l.panelRows + DIVIDER_ROWS + TOTAL_GAP_ROWS);

  const headerY = l.canvasY;
  const dHeader = headerY + l.headerRows;
  const sceneY = dHeader + 1 + g;
  const dScene = sceneY + sceneRows + g; // extra gap BEFORE the VITALS divider
  const panelY = dScene + 1 + g;
  const dPanel = panelY + l.panelRows;

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
