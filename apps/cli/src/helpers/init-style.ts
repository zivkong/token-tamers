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

import type { ColorPreference, CyclePolicyKind, UpdateMode } from '@token-tamers/core';
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

/**
 * Format the pet-global cycle question. ONE clock for the pet:
 *   (s)ubscription — 5-h windows inferred from your subscription's session rhythm
 *   st(a)tic       — fixed 5-h windows from an anchor (API / no inherent limits)
 */
export function formatCycleQuestion(defaultPolicy: CyclePolicyKind, styled: boolean): string {
  const key = defaultPolicy === 'static' ? 'a' : 's';
  if (!styled) {
    return `  Cycle — (s)ubscription (limit windows) or st(a)tic (fixed/API)? [${key}] `;
  }
  const sub =
    defaultPolicy === 'subscription'
      ? bold(paint(HOUSE_TINTS.accent, '(s)ubscription', styled), styled)
      : dim('(s)ubscription', styled);
  const stat =
    defaultPolicy === 'static'
      ? bold(paint(HOUSE_TINTS.accent, 'st(a)tic', styled), styled)
      : dim('st(a)tic', styled);
  return `  Cycle — ${sub} or ${stat}? ${dim(`[${key}]`, styled)} `;
}

/** Map a raw cycle answer to a policy; an answer starting 'a' = static, else subscription. */
export function parseCycleChoice(raw: string, fallback: CyclePolicyKind): CyclePolicyKind {
  const c = raw.trim().toLowerCase()[0];
  if (c === 'a' || c === 't') return 'static';
  if (c === 's') return 'subscription';
  return fallback;
}

/**
 * Format the anchor question (subscription + multiple adapters): which provider's
 * subscription drives the molt clock. Options are numbered; the default is `[1]`.
 */
export function formatAnchorQuestion(adapterIds: readonly string[], styled: boolean): string {
  const opts = adapterIds.map((id, i) => `(${i + 1}) ${id}`).join('  ');
  if (!styled) return `  Anchor — whose subscription drives the clock? ${opts} [1] `;
  return `  Anchor — ${dim('whose subscription drives the clock?', styled)} ${opts} ${dim('[1]', styled)} `;
}

/** Map a raw anchor answer (1-based index) to an adapter id; out-of-range = first. */
export function parseAnchorChoice(raw: string, adapterIds: readonly string[]): string {
  const n = Number.parseInt(raw.trim(), 10);
  if (Number.isInteger(n) && n >= 1 && n <= adapterIds.length) return adapterIds[n - 1]!;
  return adapterIds[0]!;
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

/**
 * The update-mode question. Leads with the offline pledge so the player knows the
 * default keeps the game fully offline; opting in is an explicit choice.
 */
export function formatUpdateQuestion(current: UpdateMode, styled: boolean): string {
  const opts = '(o)ff (n)otify (a)uto';
  if (!styled) {
    return `  Updates — off keeps the game fully offline. ${opts}? [${current}] `;
  }
  return `  Updates — ${dim('off keeps the game fully offline.', styled)} ${opts}? ${dim(`[${current}]`, styled)} `;
}

/** Map a raw update answer to an UpdateMode; unknown/empty keeps `current`. */
export function parseUpdateChoice(raw: string, current: UpdateMode): UpdateMode {
  switch (raw.trim().toLowerCase()[0]) {
    case 'o':
      return 'off';
    case 'n':
      return 'notify';
    case 'a':
      return 'auto';
    default:
      return current;
  }
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
