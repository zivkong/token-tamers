/**
 * Shared UI components — the standardized building blocks every page reuses
 * (section dividers, meters/bars). Keeping them here means one definition, one
 * look: e.g. every divider is a `─` rule with an ALL-CAPS BOLD label and a gap
 * after it; every bar fills then shows an empty track.
 */

export { drawDivider, DIVIDER_LINE, DIVIDER_LABEL, type DividerOptions } from './divider';
export { drawMeter, drawCompletionHeader, BAR_EMPTY, type CompletionHeader } from './meter';
