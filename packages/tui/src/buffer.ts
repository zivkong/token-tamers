/**
 * Cell frame buffer with double-buffered diff flushing.
 *
 * A `FrameBuffer` keeps a front (currently displayed) and back (being drawn)
 * grid of cells. `flush()` diffs back vs front and emits the minimal ANSI to
 * turn the screen into the back buffer: only changed cells, coalesced into
 * runs that share fg/bg so SGR sequences aren't repeated per character.
 */

import { bgSgr, cursorTo, fgSgr, sgrReset, type ColorMode, type Rgb, type Writer } from './ansi';

/** A single terminal cell: a character with optional fg/bg color. */
export interface Cell {
  ch: string;
  fg: Rgb | null;
  bg: Rgb | null;
}

export const BLANK_CELL: Cell = { ch: ' ', fg: null, bg: null };

function cellsEqual(a: Cell, b: Cell): boolean {
  if (a.ch !== b.ch) return false;
  if (!colorEq(a.fg, b.fg)) return false;
  if (!colorEq(a.bg, b.bg)) return false;
  return true;
}

function colorEq(a: Rgb | null, b: Rgb | null): boolean {
  if (a === null || b === null) return a === b;
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

export class FrameBuffer {
  readonly cols: number;
  readonly rows: number;
  private front: Cell[];
  private back: Cell[];
  /** True until the first flush — forces a full repaint. */
  private dirtyAll = true;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.front = makeGrid(cols, rows);
    this.back = makeGrid(cols, rows);
  }

  /** Reset the back buffer to blanks (call at the start of each frame). */
  clear(): void {
    for (let i = 0; i < this.back.length; i++) {
      this.back[i] = BLANK_CELL;
    }
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }

  set(x: number, y: number, cell: Cell): void {
    if (!this.inBounds(x, y)) return;
    this.back[y * this.cols + x] = cell;
  }

  get(x: number, y: number): Cell {
    if (!this.inBounds(x, y)) return BLANK_CELL;
    return this.back[y * this.cols + x] ?? BLANK_CELL;
  }

  /** Draw a string starting at (x,y) with the given colors. Clips to width. */
  text(x: number, y: number, s: string, fg: Rgb | null = null, bg: Rgb | null = null): void {
    const chars = [...s];
    for (let i = 0; i < chars.length; i++) {
      this.set(x + i, y, { ch: chars[i] ?? ' ', fg, bg });
    }
  }

  /** Fill a rectangle with a single cell. */
  fillRect(x: number, y: number, w: number, h: number, cell: Cell): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        this.set(xx, yy, cell);
      }
    }
  }

  /**
   * Diff back vs front and write the minimal ANSI to `writer`. Returns the
   * exact string written (also useful for tests). After flushing, back becomes
   * the new front.
   */
  flush(writer: Writer): string {
    const out: string[] = [];
    const mode = writer.color;
    for (let y = 0; y < this.rows; y++) {
      let x = 0;
      while (x < this.cols) {
        const idx = y * this.cols + x;
        const back = this.back[idx] ?? BLANK_CELL;
        const front = this.front[idx] ?? BLANK_CELL;
        if (!this.dirtyAll && cellsEqual(back, front)) {
          x++;
          continue;
        }
        // Start a run of changed cells. Coalesce contiguous changed cells
        // and emit a single move + SGR per color change inside the run.
        const runStart = x;
        const runCells: Cell[] = [];
        while (x < this.cols) {
          const i = y * this.cols + x;
          const b = this.back[i] ?? BLANK_CELL;
          const f = this.front[i] ?? BLANK_CELL;
          if (!this.dirtyAll && cellsEqual(b, f)) break;
          runCells.push(b);
          x++;
        }
        out.push(emitRun(runStart, y, runCells, mode));
      }
    }
    // Swap: back becomes front, then copy front into back so callers can keep
    // mutating back next frame from a clean clone.
    const flushed = out.join('');
    this.front = this.back;
    this.back = this.front.slice();
    this.dirtyAll = false;
    writer.write(flushed);
    return flushed;
  }

  /** Force the next flush to repaint every cell. */
  invalidate(): void {
    this.dirtyAll = true;
  }
}

function makeGrid(cols: number, rows: number): Cell[] {
  const g: Cell[] = new Array(cols * rows);
  for (let i = 0; i < g.length; i++) g[i] = BLANK_CELL;
  return g;
}

/** Emit ANSI for a run of cells starting at 0-based (x,y). */
function emitRun(x: number, y: number, cells: Cell[], mode: ColorMode): string {
  let s = cursorTo(x + 1, y + 1);
  let curFg: Rgb | null | undefined = undefined;
  let curBg: Rgb | null | undefined = undefined;
  for (const cell of cells) {
    if (!colorEqLoose(curFg, cell.fg) || !colorEqLoose(curBg, cell.bg)) {
      // Reset then re-apply so a previous color doesn't bleed into a null.
      s += sgrReset();
      if (cell.fg) s += fgSgr(cell.fg, mode);
      if (cell.bg) s += bgSgr(cell.bg, mode);
      curFg = cell.fg;
      curBg = cell.bg;
    }
    s += cell.ch;
  }
  s += sgrReset();
  return s;
}

function colorEqLoose(a: Rgb | null | undefined, b: Rgb | null | undefined): boolean {
  if (a === undefined || b === undefined) return false;
  return colorEq(a, b);
}
