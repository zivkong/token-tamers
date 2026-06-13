/**
 * Theme + interactive prompts for `tt init`.
 *
 * This module owns the color palette, the low-level paint helpers, the
 * styled/plain decision (`shouldStyle`), and the question strings handed to
 * readline. The larger visual blocks (banner, step headers, summary box) live
 * in `init-render.ts`, which imports the palette helpers from here.
 *
 * All functions are pure string builders — no side effects, no I/O. When
 * `styled` is false every helper returns plain text that reads well in CI.
 */

import type { ColorPreference } from '@token-tamers/core';
import { fgSgr, hexToRgb, type ColorMode } from '@token-tamers/tui';

// ---------------------------------------------------------------------------
// Palette (identity / cosmetics only — never affects stats)
// ---------------------------------------------------------------------------

/** Hex tints per House — cosmetic identity, never scoring. */
export const HOUSE_TINTS = {
  aether: '#a78bfa', // Violet / Aether — WIS house
  cipher: '#60a5fa', // Blue / Cipher — PWR house
  flux: '#34d399', // Emerald / Flux — SPD house
  forge: '#fb923c', // Amber / Forge — GRT house
  accent: '#f472b6', // Pink — general accent / calibration
  good: '#4ade80', // Green — success
  warn: '#fbbf24', // Gold — warnings
  dim: '#6b7280', // Gray — secondary text
} as const;

const MODE: ColorMode = 'truecolor';
const RESET = '\x1b[0m';

// ---------------------------------------------------------------------------
// Paint helpers
// ---------------------------------------------------------------------------

/** Wrap `text` in a foreground color when styled. */
export function paint(hex: string, text: string, styled: boolean): string {
  if (!styled) return text;
  return `${fgSgr(hexToRgb(hex), MODE)}${text}${RESET}`;
}

/** Bold when styled. */
export function bold(text: string, styled: boolean): string {
  return styled ? `\x1b[1m${text}\x1b[22m` : text;
}

/** Dim secondary text when styled. */
export function dim(text: string, styled: boolean): string {
  return paint(HOUSE_TINTS.dim, text, styled);
}

/**
 * Visible (printable) length of a string, ignoring ANSI SGR escapes. Used by the
 * box renderers so colored content still aligns to the frame.
 */
export function visibleLen(s: string): number {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

// ---------------------------------------------------------------------------
// Styled/plain decision
// ---------------------------------------------------------------------------

/**
 * True when color output is appropriate. Resolved from the color preference
 * (settings.json) — never an environment variable:
 *   'none'         → never style
 *   'auto'         → style only when stdout is a TTY
 *   explicit color → style (the chosen depth is honored downstream)
 */
export function shouldStyle(pref: ColorPreference): boolean {
  if (pref === 'none') return false;
  if (pref === 'auto') return Boolean(process.stdout.isTTY);
  return true;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

/** Format the enable-adapter question. */
export function formatEnableQuestion(displayName: string, styled: boolean): string {
  if (!styled) return `  Enable ${displayName}? [Y/n] `;
  const yn = bold(paint(HOUSE_TINTS.accent, '[Y/n]', styled), styled);
  return `  Enable ${bold(displayName, styled)}? ${yn} `;
}

/** Format the plan-type question with the adapter's defaultPlan highlighted. */
export function formatPlanQuestion(
  defaultPlan: 'subscription' | 'api' | undefined,
  styled: boolean,
): string {
  const def = defaultPlan === 'api' ? 'api' : 'subscription';
  if (!styled) {
    return `  Plan — (s)ubscription or (a)pi? [${def === 'subscription' ? 's' : 'a'}] `;
  }
  const sub =
    def === 'subscription'
      ? bold(paint(HOUSE_TINTS.accent, '(s)ubscription', styled), styled)
      : dim('(s)ubscription', styled);
  const api =
    def === 'api' ? bold(paint(HOUSE_TINTS.accent, '(a)pi', styled), styled) : dim('(a)pi', styled);
  return `  Plan — ${sub} or ${api}? ${dim(def === 'subscription' ? '[s] ' : '[a] ', styled)}`;
}

/** Format the "enter a custom data path" prompt shown when an agent isn't found. */
export function formatPathQuestion(displayName: string, styled: boolean): string {
  if (!styled) return `  Path to ${displayName} data (Enter to skip): `;
  return `  ${dim('↳', styled)} Path to ${bold(displayName, styled)} data ${dim('(Enter to skip)', styled)}: `;
}

/** Format the color-preference question, highlighting the current choice. */
export function formatColorQuestion(current: ColorPreference, styled: boolean): string {
  if (!styled) {
    return `  Color — (a)uto (t)ruecolor (2)56 (8)-color (n)one? [${current}] `;
  }
  const opts = '(a)uto (t)ruecolor (2)56 (8)-color (n)one';
  return `  Color — ${opts}? ${dim(`[${current}]`, styled)} `;
}

/** Map a raw color answer to a ColorPreference; unknown/empty keeps `current`. */
export function parseColorChoice(raw: string, current: ColorPreference): ColorPreference {
  switch (raw.trim().toLowerCase()[0]) {
    case 'a':
      return 'auto';
    case 't':
      return 'truecolor';
    case '2':
      return '256';
    case '8':
      return '8';
    case 'n':
      return 'none';
    default:
      return current;
  }
}
