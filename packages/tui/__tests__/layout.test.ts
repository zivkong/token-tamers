import { describe, it, expect } from 'vitest';
import {
  computeLayout,
  petSections,
  GAP_ROWS,
  MIN_COLS,
  MIN_ROWS,
  MENU_GRID_BREAKPOINT,
} from '../src/render/layout';

describe('computeLayout', () => {
  it('flags too-small terminals', () => {
    const l = computeLayout(MIN_COLS - 1, MIN_ROWS);
    expect(l.tooSmall).toBe(true);
    const l2 = computeLayout(MIN_COLS, MIN_ROWS - 1);
    expect(l2.tooSmall).toBe(true);
  });

  it('is top-oriented and full-width (no gutters, no padding)', () => {
    const l = computeLayout(120, 40);
    expect(l.tooSmall).toBe(false);
    expect(l.canvasX).toBe(0);
    expect(l.canvasY).toBe(0);
    expect(l.canvasCols).toBe(120);
  });

  it('docks the menu immediately after the canvas, not at the bottom', () => {
    const l = computeLayout(100, 30);
    expect(l.menuY).toBe(l.canvasY + l.canvasRows);
    expect(l.menuRow).toBe(l.menuY);
    // The whole stack fits, with any slack falling BELOW the menu.
    expect(l.menuY + l.menuRows).toBeLessThanOrEqual(l.termRows);
  });

  it('lays the menu out as a 6-column grid, wrapping to 3 on narrow widths', () => {
    const wide = computeLayout(MENU_GRID_BREAKPOINT + 8, 30);
    expect(wide.menuCols).toBe(6);
    expect(wide.menuRows).toBe(1);

    const narrow = computeLayout(MENU_GRID_BREAKPOINT - 1, 30);
    expect(narrow.menuCols).toBe(3);
    expect(narrow.menuRows).toBe(2);
  });

  it('keeps the scene near the habitat 4:1 cell aspect', () => {
    const l = computeLayout(160, 60);
    const { scene } = petSections(l);
    const aspect = scene.cols / scene.rows;
    expect(aspect).toBeGreaterThan(3.4);
    expect(aspect).toBeLessThan(4.6);
  });

  it('stacks header, scene, and vitals panel with a divider + gap between them', () => {
    const l = computeLayout(100, 30);
    expect(l.headerRows).toBeGreaterThanOrEqual(1);
    expect(l.panelRows).toBeGreaterThanOrEqual(1);
    const s = petSections(l);
    // Each section is followed by a divider then a blank padding gap, so the
    // next section starts `1 + GAP_ROWS` below the divider.
    expect(s.header.y).toBe(l.canvasY);
    expect(s.dividerYs[0]).toBe(s.header.y + s.header.rows);
    expect(s.scene.y).toBe(s.dividerYs[0] + 1 + GAP_ROWS);
    expect(s.dividerYs[1]).toBe(s.scene.y + s.scene.rows);
    expect(s.panel.y).toBe(s.dividerYs[1] + 1 + GAP_ROWS);
    expect(s.dividerYs[2]).toBe(s.panel.y + s.panel.rows);
    expect(s.dividerYs[2]).toBe(l.menuY - 1 - GAP_ROWS);
    expect(s.scene.rows).toBeGreaterThan(0);
    expect(s.panel.rows).toBe(l.panelRows);
  });

  it('fits the whole stack within the terminal in both dimensions', () => {
    for (const [c, r] of [
      [64, 24],
      [80, 24],
      [200, 60],
      [100, 30],
    ] as const) {
      const l = computeLayout(c, r);
      expect(l.canvasCols).toBe(c);
      expect(l.menuY + l.menuRows).toBeLessThanOrEqual(r);
    }
  });
});
