import { describe, it, expect } from 'vitest';
import { computeLayout, MIN_COLS, MIN_ROWS } from '../src/render/layout';

describe('computeLayout', () => {
  it('flags too-small terminals', () => {
    const l = computeLayout(MIN_COLS - 1, MIN_ROWS);
    expect(l.tooSmall).toBe(true);
    const l2 = computeLayout(MIN_COLS, MIN_ROWS - 1);
    expect(l2.tooSmall).toBe(true);
  });

  it('produces a canvas above a 1-row menu', () => {
    const l = computeLayout(100, 30);
    expect(l.tooSmall).toBe(false);
    expect(l.menuRow).toBe(29);
    expect(l.canvasY + l.canvasRows).toBeLessThanOrEqual(l.menuRow);
  });

  it('keeps a roughly 8:3 canvas aspect', () => {
    const l = computeLayout(160, 50);
    const aspect = l.canvasCols / l.canvasRows;
    expect(aspect).toBeGreaterThan(2.4);
    expect(aspect).toBeLessThan(3.2);
  });

  it('centers the canvas with letterbox gutters', () => {
    const l = computeLayout(120, 40);
    const rightGutter = l.termCols - (l.canvasX + l.canvasCols);
    expect(Math.abs(l.canvasX - rightGutter)).toBeLessThanOrEqual(1);
  });

  it('fits within the available area in both dimensions', () => {
    for (const [c, r] of [
      [64, 24],
      [80, 24],
      [200, 60],
      [100, 30],
    ] as const) {
      const l = computeLayout(c, r);
      expect(l.canvasCols).toBeLessThanOrEqual(c);
      expect(l.canvasRows).toBeLessThanOrEqual(r - 1);
    }
  });
});
