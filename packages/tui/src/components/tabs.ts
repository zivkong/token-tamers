/**
 * Shared category-tab strip — the centered `‹ A  B  C ›` selector used by the
 * Dex (House skies), Loot (Habitats/Trinkets), and Feats (Feat categories) pages
 * so they all navigate the same way. ONE definition, one look: the active tab is
 * bold in `activeColor`, the rest dim, flanked by ‹ › carets and a click region
 * per visible tab (`<hitPrefix>:<i>`). Keyboard ←→ still reaches every tab even
 * when a fixed-width bar runs past a sub-min canvas (off-screen tabs get no hit).
 *
 * Pure given (labels, active, rect) — golden-frame stable.
 */

import type { Rgb } from '../terminal/ansi';
import type { RenderContext } from '../pages/types';

/** Dim tone for inactive tabs + the ‹ › carets. */
const TAB_DIM: Rgb = { r: 110, g: 116, b: 138 };

/** Blank columns between adjacent tab labels (so they don't run together). */
const TAB_GAP = 3;

export interface TabStripOptions {
  labels: string[];
  /** Active tab index (already clamped by the caller). */
  active: number;
  /** Color of the active label (e.g. a House hue, or the page accent). */
  activeColor: Rgb;
  /** Hit-region id prefix; each visible tab registers `<hitPrefix>:<i>`. */
  hitPrefix: string;
}

/** Draw the centered, clickable tab selector strip at row `y`. */
export function drawTabStrip(ctx: RenderContext, y: number, opts: TabStripOptions): void {
  const { buf, hits, layout } = ctx;
  const { labels, active, activeColor, hitPrefix } = opts;
  // Width: '‹ ' + labels joined by TAB_GAP spaces + ' ›'.
  const labelsWidth = labels.reduce((w, l) => w + l.length, 0) + TAB_GAP * (labels.length - 1);
  const width = 2 + labelsWidth + 2;
  let x = layout.canvasX + Math.max(1, Math.floor((layout.canvasCols - width) / 2));
  buf.text(x, y, '‹', TAB_DIM, null);
  x += 2;
  const tabsRight = layout.canvasX + layout.canvasCols;
  labels.forEach((label, i) => {
    if (i === active) buf.textBold(x, y, label, activeColor, null);
    else buf.text(x, y, label, TAB_DIM, null);
    // Skip a tab that ran off the canvas (the fixed-width bar on a sub-min width)
    // so no dead/misroutable hit lands off-screen.
    if (x + label.length <= tabsRight) hits.add(`${hitPrefix}:${i}`, x, y, label.length, 1);
    // A wider gap between labels; a single space before the closing '›'.
    x += label.length + (i < labels.length - 1 ? TAB_GAP : 1);
  });
  buf.text(x, y, '›', TAB_DIM, null);
}
