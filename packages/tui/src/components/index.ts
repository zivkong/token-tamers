/**
 * Shared UI components — the standardized building blocks every page reuses
 * (section dividers, meters/bars). Keeping them here means one definition, one
 * look: e.g. every divider is a `─` rule with an ALL-CAPS BOLD label and a gap
 * after it; every bar fills then shows an empty track.
 */

export { drawDivider, DIVIDER_LINE, DIVIDER_LABEL, type DividerOptions } from './divider';
export { drawMarquee, type MarqueeOptions } from './marquee';
export {
  drawPageHeader,
  drawPageFooter,
  pageFooterY,
  pageBodyBottom,
  PAGE_HEADER_ROWS,
  PAGE_FOOTER_ROWS,
  PAGE_TITLE,
  PAGE_DIM,
  type PageHeaderOptions,
} from './page';
export {
  drawMeter,
  drawSegmentedMeter,
  drawCompletionHeader,
  BAR_EMPTY,
  BAR_FULL,
  BAR_TRACK,
  type CompletionHeader,
  type MeterSegment,
} from './meter';
