import { describe, it, expect } from 'vitest';
import { computeLayout, petSections, GAP_ROWS, MIN_COLS, MIN_ROWS } from '../src/render/layout';
import { packMenu } from '../src/render/menu';

describe('computeLayout', () => {
  it('flags too-small terminals (min 34x24)', () => {
    expect(MIN_COLS).toBe(34);
    const l = computeLayout(MIN_COLS - 1, MIN_ROWS);
    expect(l.tooSmall).toBe(true);
    const l2 = computeLayout(MIN_COLS, MIN_ROWS - 1);
    expect(l2.tooSmall).toBe(true);
    expect(computeLayout(MIN_COLS, MIN_ROWS).tooSmall).toBe(false);
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

  it('lays the menu out as a left-aligned flow that wraps when narrow', () => {
    // Wide: every button fits on one row, starting at the left edge.
    const wide = packMenu(120);
    expect(wide.rows).toBe(1);
    expect(wide.buttons[0]?.x).toBe(1);
    expect(computeLayout(120, 30).menuRows).toBe(1);

    // Narrow (34): the flow wraps to more than one row.
    const narrow = packMenu(34);
    expect(narrow.rows).toBeGreaterThan(1);
    expect(computeLayout(34, 24).menuRows).toBe(narrow.rows);
  });

  it('keeps the scene near the habitat 4:1 cell aspect', () => {
    const l = computeLayout(160, 60);
    const { scene } = petSections(l);
    const aspect = scene.cols / scene.rows;
    expect(aspect).toBeGreaterThan(3.4);
    expect(aspect).toBeLessThan(4.6);
  });

  it('stacks header, scene, vitals with a divider + gaps around each section', () => {
    const l = computeLayout(100, 30);
    expect(l.headerRows).toBeGreaterThanOrEqual(1);
    expect(l.panelRows).toBeGreaterThanOrEqual(1);
    const s = petSections(l);
    expect(s.header.y).toBe(l.canvasY);
    expect(s.dividerYs[0]).toBe(s.header.y + s.header.rows);
    // gap AFTER the header divider.
    expect(s.scene.y).toBe(s.dividerYs[0] + 1 + GAP_ROWS);
    // gap BEFORE the VITALS divider (request #1) AND after it.
    expect(s.dividerYs[1]).toBe(s.scene.y + s.scene.rows + GAP_ROWS);
    expect(s.panel.y).toBe(s.dividerYs[1] + 1 + GAP_ROWS);
    // gap after the final divider, before the menu.
    expect(s.dividerYs[2]).toBe(s.panel.y + s.panel.rows);
    expect(l.menuY).toBe(s.dividerYs[2] + 1 + GAP_ROWS);
    expect(s.scene.rows).toBeGreaterThan(0);
    expect(s.panel.rows).toBe(l.panelRows);
  });

  it('fits the whole stack within the terminal at the supported sizes', () => {
    for (const [c, r] of [
      [34, 24],
      [48, 24],
      [80, 24],
      [200, 60],
      [100, 30],
    ] as const) {
      const l = computeLayout(c, r);
      expect(l.tooSmall).toBe(false);
      expect(l.canvasCols).toBe(c);
      expect(l.menuY + l.menuRows).toBeLessThanOrEqual(r);
      expect(petSections(l).scene.rows).toBeGreaterThanOrEqual(1);
    }
  });
});
