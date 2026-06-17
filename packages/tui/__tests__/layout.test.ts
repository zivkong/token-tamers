import { describe, it, expect } from 'vitest';
import {
  computeLayout,
  petSections,
  pickOrientation,
  fit43,
  GAP_ROWS,
  MIN_COLS,
  MIN_ROWS,
  HORIZONTAL_MIN_COLS,
  HORIZONTAL_MIN_ROWS,
  CANVAS_CELL_W,
  CANVAS_CELL_H,
  type SceneRect,
} from '../src/render/layout';
import { MENU_BTN_H, menuBandRows, packMenu } from '../src/render/menu';

/** On-screen aspect of a cell box (cells are ~1:2 w:h). */
function visualAspect(r: SceneRect): number {
  return (r.cols * 1) / (r.rows * 2);
}

describe('pickOrientation', () => {
  it('keeps common terminals vertical, flips wide-and-short docks horizontal', () => {
    // Standard / large terminals stay vertical.
    expect(pickOrientation(80, 24)).toBe('vertical');
    expect(pickOrientation(120, 40)).toBe('vertical');
    expect(pickOrientation(200, 50)).toBe('vertical'); // maximized-wide → still vertical
    // Genuinely wide-and-short docks flip horizontal.
    expect(pickOrientation(200, 16)).toBe('horizontal');
    expect(pickOrientation(120, 20)).toBe('horizontal');
  });

  it('keeps the previous orientation inside the dead-band (no flicker)', () => {
    // 160x40 = 4.0 sits between VERTICAL_RATIO (3.6) and HORIZONTAL_RATIO (4.2).
    expect(pickOrientation(160, 40, 'horizontal')).toBe('horizontal');
    expect(pickOrientation(160, 40, 'vertical')).toBe('vertical');
    // With no prior, the band defaults to vertical (preserve the classic stack).
    expect(pickOrientation(160, 40)).toBe('vertical');
  });
});

describe('fit43', () => {
  it('returns a centered, true 4:3 (8:3-cell) box that never exceeds the band', () => {
    // Tall band → width-bound, letterboxed top/bottom.
    const tall = fit43({ x: 0, y: 0, cols: 40, rows: 60 });
    expect(tall.cols).toBe(40);
    expect(tall.rows).toBe(Math.round((40 * CANVAS_CELL_H) / CANVAS_CELL_W));
    expect(tall.rows).toBeLessThanOrEqual(60);
    expect(visualAspect(tall)).toBeCloseTo(4 / 3, 1);

    // Wide band → height-bound, gutters left/right.
    const wide = fit43({ x: 0, y: 0, cols: 200, rows: 18 });
    expect(wide.rows).toBe(18);
    expect(wide.cols).toBeLessThanOrEqual(200);
    expect(wide.cols).toBe(Math.min(200, Math.floor((18 * CANVAS_CELL_W) / CANVAS_CELL_H)));
    expect(visualAspect(wide)).toBeCloseTo(4 / 3, 1);
    // Centered within the band.
    expect(wide.x).toBe(Math.floor((200 - wide.cols) / 2));
  });
});

describe('computeLayout — too small', () => {
  it('flags vertical terminals below the vertical minimum (34x24)', () => {
    expect(MIN_COLS).toBe(34);
    expect(computeLayout(MIN_COLS - 1, MIN_ROWS).tooSmall).toBe(true);
    expect(computeLayout(MIN_COLS, MIN_ROWS - 1).tooSmall).toBe(true);
    expect(computeLayout(MIN_COLS, MIN_ROWS).tooSmall).toBe(false);
  });

  it('accepts a SHORT wide dock (too short for vertical) as a valid horizontal layout', () => {
    // 200x16 is far below MIN_ROWS=24, but it is a valid bottom dock.
    const dock = computeLayout(200, 16);
    expect(dock.tooSmall).toBe(false);
    expect(dock.orientation).toBe('horizontal');
    // Below the horizontal floor it is genuinely too small.
    expect(computeLayout(HORIZONTAL_MIN_COLS - 1, 16).tooSmall).toBe(true);
    expect(computeLayout(200, HORIZONTAL_MIN_ROWS - 1).tooSmall).toBe(true);
  });
});

describe('computeLayout — vertical (stacked)', () => {
  it('is top-oriented and full-width (no gutters around the content region)', () => {
    const l = computeLayout(120, 40);
    expect(l.orientation).toBe('vertical');
    expect(l.canvasX).toBe(0);
    expect(l.canvasY).toBe(0);
    expect(l.canvasCols).toBe(120);
    expect(l.menuRail).toBe(false);
  });

  it('docks the menu (its own labeled section) right after the canvas', () => {
    const l = computeLayout(80, 24);
    expect(l.orientation).toBe('vertical');
    expect(l.menuDividerY).toBe(l.canvasY + l.canvasRows);
    expect(l.menuY).toBe(l.menuDividerY + 1 + GAP_ROWS);
    expect(l.menuRow).toBe(l.menuY);
    expect(l.menuY + l.menuRows).toBeLessThanOrEqual(l.termRows);
  });

  it('distributes equal-width menu buttons across the width, wrapping when narrow', () => {
    const wide = packMenu(120);
    expect(wide.rows).toBe(1);
    expect(wide.buttons[0]?.x).toBe(1);
    expect(new Set(wide.buttons.map((b) => b.w)).size).toBe(1);
    const last = wide.buttons[wide.buttons.length - 1]!;
    expect(last.x + last.w).toBe(120 - 1);
    const lwide = computeLayout(120, 40);
    expect(lwide.menuBtnH).toBe(MENU_BTN_H);
    expect(lwide.menuRows).toBe(menuBandRows(wide.rows, lwide.menuBtnH));

    const narrow = packMenu(34);
    expect(narrow.rows).toBeGreaterThan(1);
    expect(new Set(narrow.buttons.map((b) => b.w)).size).toBe(1);
    const lnar = computeLayout(34, 24);
    expect(lnar.menuRows).toBe(menuBandRows(narrow.rows, lnar.menuBtnH));
  });

  it('renders the scene as a true 4:3 box (8:3 cell aspect)', () => {
    const l = computeLayout(80, 60); // tall enough that the scene is not height-capped
    const { scene } = petSections(l);
    expect(visualAspect(scene)).toBeCloseTo(4 / 3, 1);
  });

  it('stacks header, scene, vitals with gaps, and a bottom-padded panel', () => {
    const l = computeLayout(100, 30);
    expect(l.headerRows).toBeGreaterThanOrEqual(1);
    expect(l.panelRows).toBeGreaterThanOrEqual(1);
    const s = petSections(l);
    expect(s.header.y).toBe(l.canvasY);
    // Two horizontal rules (header divider + labeled VITALS), no separator.
    expect(s.rules).toHaveLength(2);
    expect(s.rules[1]?.label).toBe('VITALS');
    expect(s.separator).toBeUndefined();
    expect(s.rules[0]?.y).toBe(s.header.y + s.header.rows);
    // The panel is bottom-padded one gap above the menu divider.
    expect(s.panel.y + s.panel.rows + GAP_ROWS).toBe(l.menuDividerY);
    expect(s.scene.rows).toBeGreaterThan(0);
    expect(s.panel.rows).toBe(l.panelRows);
  });

  it('fits the whole stack within the terminal at the supported sizes', () => {
    for (const [c, r] of [
      [34, 24],
      [48, 24],
      [80, 24],
      [100, 30],
      [160, 50],
    ] as const) {
      const l = computeLayout(c, r);
      expect(l.tooSmall).toBe(false);
      expect(l.orientation).toBe('vertical');
      expect(l.canvasCols).toBe(c);
      expect(l.menuY + l.menuRows).toBeLessThanOrEqual(r);
      expect(petSections(l).scene.rows).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('computeLayout — horizontal (side-by-side dock)', () => {
  it('puts the canvas left, a menu rail right, full height', () => {
    const l = computeLayout(200, 16);
    expect(l.orientation).toBe('horizontal');
    expect(l.menuRail).toBe(true);
    expect(l.canvasX).toBe(0);
    expect(l.canvasRows).toBe(16);
    // The menu rail sits to the right of the content, inside the terminal.
    expect(l.menuRect.x).toBeGreaterThan(l.canvasCols);
    expect(l.menuRect.x + l.menuRect.cols).toBeLessThanOrEqual(l.termCols);
    // The vertical separator is between the content and the rail.
    expect(l.menuDividerX).toBeGreaterThanOrEqual(l.canvasCols);
    expect(l.menuDividerX).toBeLessThan(l.menuRect.x);
  });

  it('places the pet header/vitals beside the 4:3 canvas with a separator', () => {
    const l = computeLayout(200, 16);
    const s = petSections(l);
    // Canvas is a true 4:3 box on the left.
    expect(visualAspect(s.scene)).toBeCloseTo(4 / 3, 1);
    expect(s.scene.x).toBeLessThan(s.header.x); // header is in the chrome column, right of canvas
    // Header and panel share the chrome column (same x), stacked.
    expect(s.panel.x).toBe(s.header.x);
    expect(s.panel.y).toBeGreaterThan(s.header.y);
    // One labeled VITALS rule + a vertical separator between canvas and chrome.
    expect(s.rules).toHaveLength(1);
    expect(s.rules[0]?.label).toBe('VITALS');
    expect(s.separator).toBeDefined();
    expect(s.separator?.x).toBeLessThanOrEqual(s.header.x);
    // Everything stays left of the menu rail.
    expect(s.header.x + s.header.cols).toBeLessThanOrEqual(l.canvasCols);
  });

  it('stacks the menu buttons one-per-row in the rail', () => {
    const l = computeLayout(200, 16);
    const packed = packMenu(l.menuRect.cols);
    expect(packed.rows).toBe(packed.buttons.length); // every button on its own row
  });

  it('fits the chrome stack AND the menu rail within HORIZONTAL_MIN_ROWS', () => {
    // Guard: horizontalLayout relies on the row floor being >= both the chrome
    // bottom (header + gaps + VITALS rule + panel) and the rail bottom. If a
    // future HEADER_ROWS/PANEL_ROWS bump breaks that, this fails at the floor
    // instead of silently drawing off-canvas.
    const l = computeLayout(120, HORIZONTAL_MIN_ROWS);
    expect(l.tooSmall).toBe(false);
    expect(l.orientation).toBe('horizontal');
    const s = petSections(l);
    expect(s.panel.y + s.panel.rows).toBeLessThanOrEqual(HORIZONTAL_MIN_ROWS);
    for (const r of s.rules) expect(r.y).toBeLessThan(HORIZONTAL_MIN_ROWS);
    expect(l.menuRect.y + l.menuRect.rows).toBeLessThanOrEqual(HORIZONTAL_MIN_ROWS);
  });
});
