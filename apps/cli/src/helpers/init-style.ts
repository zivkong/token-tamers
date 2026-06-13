/**
 * Presentation helpers for `tt init`.
 *
 * All styled output is gated on `styled === true` (caller checks the color
 * preference + TTY). When `styled` is false every function returns plain text
 * that reads well in CI and tests. The caller (init.ts) writes through the
 * injected `out` sink so tests capture output exactly.
 *
 * No side effects, no I/O — pure string builders.
 */

import type { ColorPreference } from '@token-tamers/core';
import { fgSgr, hexToRgb, sgrReset, type ColorMode } from '@token-tamers/tui';

// ---------------------------------------------------------------------------
// House / accent palette (identity / cosmetics only — never affects stats)
// ---------------------------------------------------------------------------

/** Hex tints per House — cosmetic identity, never scoring. */
export const HOUSE_TINTS = {
  aether: '#a78bfa', // Violet / Aether — WIS house
  cipher: '#60a5fa', // Blue / Cipher — PWR house
  flux: '#34d399', // Emerald / Flux — SPD house
  forge: '#fb923c', // Amber / Forge — GRT house
  accent: '#f472b6', // Pink — general accent / calibration
  warn: '#fbbf24', // Gold — warnings
  dim: '#6b7280', // Gray — secondary text
} as const;

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

const MODE: ColorMode = 'truecolor';

function c(hex: string, text: string, styled: boolean): string {
  if (!styled) return text;
  return `${fgSgr(hexToRgb(hex), MODE)}${text}${sgrReset()}`;
}

function bold(text: string, styled: boolean): string {
  if (!styled) return text;
  return `\x1b[1m${text}\x1b[22m`;
}

function dim(text: string, styled: boolean): string {
  if (!styled) return text;
  return `${fgSgr(hexToRgb(HOUSE_TINTS.dim), MODE)}${text}${sgrReset()}`;
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

const COMPACT_BANNER = 'Token Tamers — setup';

/**
 * Render the header block. In styled mode: a compact one-liner with accent
 * color and a separator rule. Plain mode: just the text.
 */
export function renderBanner(styled: boolean): string {
  if (!styled) {
    return `${COMPACT_BANNER}\n\n`;
  }
  const title = bold(c(HOUSE_TINTS.accent, 'Token Tamers', styled), styled);
  const subtitle = dim('— setup', styled);
  const rule = c(HOUSE_TINTS.dim, '─'.repeat(40), styled);
  return `\n  ${title} ${subtitle}\n  ${rule}\n\n`;
}

// ---------------------------------------------------------------------------
// Egg art (calibration egg motif — 4 lines)
// ---------------------------------------------------------------------------

const EGG_LINES_PLAIN = ['  .~~.  ', ' (    ) ', ' (    ) ', "  `~~'  "];

const EGG_LINES_STYLED = ['  ╭──╮  ', ' │    │ ', ' │    │ ', '  ╰──╯  '];

/**
 * Render the egg art block. The egg is always 4 lines; in styled mode it uses
 * box-drawing characters and a warm accent tint.
 */
export function renderEgg(styled: boolean): string {
  const lines = styled ? EGG_LINES_STYLED : EGG_LINES_PLAIN;
  if (!styled) {
    return lines.join('\n') + '\n';
  }
  return (
    lines
      .map((l, i) => {
        // Top/bottom in accent; middle rows in a slightly dimmer shade.
        const hex = i === 0 || i === 3 ? HOUSE_TINTS.accent : '#e879f9';
        return '  ' + c(hex, l, styled);
      })
      .join('\n') + '\n'
  );
}

// ---------------------------------------------------------------------------
// Adapter detection status marks
// ---------------------------------------------------------------------------

/**
 * One-line status for a detected-but-not-yet-confirmed adapter.
 * mark: ✓ detected / ○ not found
 */
export function renderAdapterFound(displayName: string, paths: string[], styled: boolean): string {
  if (!styled) {
    return `- ${displayName}: detected at ${paths.join(', ')}\n`;
  }
  const mark = c('#4ade80', '✓', styled); // green check
  const name = bold(displayName, styled);
  const loc = dim(`  ${paths.join(', ')}`, styled);
  return `  ${mark} ${name}${loc}\n`;
}

export function renderAdapterMissing(displayName: string, styled: boolean): string {
  if (!styled) {
    return `- ${displayName}: not detected, skipping.\n`;
  }
  const mark = dim('○', styled);
  const name = dim(displayName, styled);
  return `  ${mark} ${name}: not detected\n`;
}

export function renderAdapterSkipped(styled: boolean): string {
  if (!styled) {
    return '  skipped.\n';
  }
  return `  ${dim('→ skipped', styled)}\n`;
}

export function renderAdapterEnabled(plan: string, styled: boolean): string {
  if (!styled) {
    return `  enabled (${plan}).\n`;
  }
  const mark = c(HOUSE_TINTS.aether, '●', styled);
  return `  ${mark} ${dim(`enabled · ${plan}`, styled)}\n`;
}

// ---------------------------------------------------------------------------
// Plan question prompt
// ---------------------------------------------------------------------------

/**
 * Format the plan-type question with the adapter's defaultPlan highlighted.
 * Returns the question string to pass to readline.
 */
export function formatPlanQuestion(
  defaultPlan: 'subscription' | 'api' | undefined,
  styled: boolean,
): string {
  const def = defaultPlan === 'api' ? 'api' : 'subscription';
  if (!styled) {
    const hint = def === 'subscription' ? '[s]' : '[a]';
    return `  Plan type — (s)ubscription or (a)pi? ${hint} `;
  }
  // Highlight the default choice
  const subLabel =
    def === 'subscription'
      ? bold(c(HOUSE_TINTS.accent, '(s)ubscription', styled), styled)
      : dim('(s)ubscription', styled);
  const apiLabel =
    def === 'api' ? bold(c(HOUSE_TINTS.accent, '(a)pi', styled), styled) : dim('(a)pi', styled);
  const defHint = dim(def === 'subscription' ? '[s] ' : '[a] ', styled);
  return `  Plan type — ${subLabel} or ${apiLabel}? ${defHint}`;
}

/** Format the enable-adapter question. */
export function formatEnableQuestion(displayName: string, styled: boolean): string {
  if (!styled) {
    return `  Enable ${displayName}? [Y/n] `;
  }
  const yn = bold(c(HOUSE_TINTS.accent, '[Y/n]', styled), styled);
  return `  Enable ${bold(displayName, styled)}? ${yn} `;
}

// ---------------------------------------------------------------------------
// Re-run message (no first-init path)
// ---------------------------------------------------------------------------

export function renderRerunMessage(styled: boolean): string {
  if (!styled) {
    return '\nConfiguration updated. Your pet and progress are unchanged.\n';
  }
  const mark = c('#4ade80', '✓', styled);
  return `\n  ${mark} ${bold('Configuration updated.', styled)} Your pet and progress are unchanged.\n`;
}

export function renderNextStepsLine(styled: boolean): string {
  if (!styled) {
    return 'Run `tt` to open the shell, or `tt status` for a quick look.\n';
  }
  const cmd1 = c(HOUSE_TINTS.aether, '`tt`', styled);
  const cmd2 = c(HOUSE_TINTS.aether, '`tt status`', styled);
  return `  ${dim('→', styled)} Run ${cmd1} to open the shell, or ${cmd2} for a quick look.\n`;
}

// ---------------------------------------------------------------------------
// No-adapters message
// ---------------------------------------------------------------------------

export function renderNoAdapters(styled: boolean): string {
  if (!styled) {
    return '\nNo adapters enabled. Nothing to do — re-run `tt init` once an agent is installed.\n';
  }
  const warn = c(HOUSE_TINTS.warn, '⚠', styled);
  return (
    `\n  ${warn} No adapters enabled.\n` +
    `  ${dim('Nothing to do — re-run `tt init` once an agent is installed.', styled)}\n`
  );
}

// ---------------------------------------------------------------------------
// First-init summary block
// ---------------------------------------------------------------------------

export function renderFirstInitSummary(
  eventCount: number,
  windowsObserved: number,
  styled: boolean,
): string {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  if (!styled) {
    let text = '\nYour Calibration Egg has been placed.\n';
    text +=
      'It is warming up to your coding rhythm — the first week is calibration, then it hatches.\n';
    text += `Backfilled ${plural(eventCount, 'usage event')}.\n`;
    if (windowsObserved > 0) {
      text += `Established a baseline from ${plural(windowsObserved, 'closed session window')} of history.\n`;
    }
    return text;
  }

  const eggArt = renderEgg(styled);
  const eggLine = c(HOUSE_TINTS.accent, 'Calibration Egg placed.', styled);
  const subtitle = dim('Warming up to your coding rhythm — first week is calibration.', styled);

  let stats = `  ${dim('events backfilled:', styled)} ${bold(String(eventCount), styled)}\n`;
  if (windowsObserved > 0) {
    stats += `  ${dim('baseline windows:', styled)}  ${bold(String(windowsObserved), styled)}\n`;
    stats += `  ${c('#4ade80', '✓', styled)} ${dim('Baseline established.', styled)}\n`;
  } else {
    stats += `  ${c(HOUSE_TINTS.warn, '·', styled)} ${dim('Calibrating — no closed windows yet.', styled)}\n`;
  }

  const rule = dim('─'.repeat(34), styled);
  return (
    `\n${eggArt}` + `  ${rule}\n` + `  ${bold(eggLine, styled)}\n` + `  ${subtitle}\n\n` + stats
  );
}

export function renderRerunBackfill(
  provider: string,
  eventCount: number,
  windowsObserved: number,
  styled: boolean,
): string {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (!styled) {
    return (
      `Backfilled ${plural(eventCount, 'usage event')} for ${provider}; ` +
      `baseline seeded from ${plural(windowsObserved, 'closed session window')}.\n`
    );
  }
  const mark = c('#4ade80', '✓', styled);
  const stats = dim(
    `${plural(eventCount, 'event')}, ${plural(windowsObserved, 'baseline window')}`,
    styled,
  );
  return `  ${mark} Backfilled ${bold(provider, styled)} history — ${stats}.\n`;
}

// ---------------------------------------------------------------------------
// Warnings block
// ---------------------------------------------------------------------------

export function renderWarnings(warnings: string[], styled: boolean): string {
  if (warnings.length === 0) return '';
  if (!styled) {
    return '\nNotes:\n' + warnings.map((w) => `! ${w}\n`).join('');
  }
  const icon = c(HOUSE_TINTS.warn, '⚠', styled);
  return '\n' + warnings.map((w) => `  ${icon} ${dim(w, styled)}\n`).join('');
}

// ---------------------------------------------------------------------------
// TTY detection
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
