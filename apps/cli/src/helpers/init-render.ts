/**
 * Visual blocks for `tt init` — banner, step headers, adapter status rows, the
 * hatch summary box, and the closing notes. Pure string builders that import the
 * palette + paint helpers from `init-style.ts`. Styled output uses box-drawing
 * and House-tinted accents; plain output (CI / `color: none`) degrades to text
 * that still carries every phrase the tests and a human reader rely on.
 */

import { HOUSE_TINTS, bold, dim, paint, visibleLen } from './init-style';

const GOOD = HOUSE_TINTS.good;
const ACCENT = HOUSE_TINTS.accent;
/** Wordmark gradient — cycles the House tints across the letters. */
const GRADIENT = [HOUSE_TINTS.aether, HOUSE_TINTS.cipher, HOUSE_TINTS.flux, HOUSE_TINTS.forge];
/** Circled step numerals for the section headers. */
const STEP_GLYPHS = ['❶', '❷', '❸', '❹', '❺'];

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Per-adapter accent tint (cosmetic identity only). */
function adapterTint(adapterId: string): string {
  if (adapterId === 'claude-code') return HOUSE_TINTS.aether;
  if (adapterId === 'opencode') return HOUSE_TINTS.forge;
  if (adapterId === 'codex') return HOUSE_TINTS.cipher;
  return HOUSE_TINTS.accent;
}

// ---------------------------------------------------------------------------
// Box renderer (right-aligned frame; ANSI-width-aware)
// ---------------------------------------------------------------------------

/** Draw a rounded box around `lines`, indented two cells. Styled use only. */
function renderBox(title: string, lines: string[]): string {
  const widths = lines.map(visibleLen);
  const contentW = Math.max(title ? visibleLen(title) + 4 : 0, ...widths, 1);
  const dash = (n: number): string => '─'.repeat(Math.max(0, n));
  const top = title
    ? `╭─ ${title} ${dash(contentW + 2 - (visibleLen(title) + 3))}╮`
    : `╭${dash(contentW + 2)}╮`;
  const bottom = `╰${dash(contentW + 2)}╯`;
  const body = lines.map((l) => `│ ${l}${' '.repeat(contentW - visibleLen(l))} │`);
  return [top, ...body, bottom].map((r) => `  ${r}`).join('\n') + '\n';
}

function gradient(text: string, styled: boolean): string {
  if (!styled) return text;
  let out = '';
  let i = 0;
  for (const ch of text) {
    if (ch === ' ') {
      out += ' ';
      continue;
    }
    out += paint(GRADIENT[i % GRADIENT.length] ?? ACCENT, ch, true);
    i += 1;
  }
  return bold(out, true);
}

// ---------------------------------------------------------------------------
// Banner + step headers
// ---------------------------------------------------------------------------

export function renderBanner(styled: boolean): string {
  if (!styled) return 'Token Tamers — setup\n\n';
  return (
    '\n' +
    renderBox('', [
      gradient('T O K E N   T A M E R S', styled),
      dim('a monster raised by your real coding-agent usage', styled),
    ]) +
    '\n'
  );
}

export function renderStepHeader(
  step: number,
  total: number,
  title: string,
  styled: boolean,
): string {
  if (!styled) return `\n[${step}/${total}] ${title}\n`;
  const glyph = paint(ACCENT, STEP_GLYPHS[step - 1] ?? String(step), styled);
  const rule = dim('─'.repeat(Math.max(3, 46 - title.length)), styled);
  return `\n  ${glyph} ${bold(title, styled)}  ${rule}\n`;
}

// ---------------------------------------------------------------------------
// Adapter status rows
// ---------------------------------------------------------------------------

export function renderAdapterFound(
  displayName: string,
  paths: string[],
  adapterId: string,
  styled: boolean,
): string {
  if (!styled) return `- ${displayName}: detected at ${paths.join(', ')}\n`;
  const mark = paint(GOOD, '✓', styled);
  const name = bold(paint(adapterTint(adapterId), displayName, styled), styled);
  return `  ${mark} ${name}  ${dim(paths.join(', '), styled)}\n`;
}

export function renderAdapterMissing(displayName: string, styled: boolean): string {
  if (!styled) return `- ${displayName}: not detected.\n`;
  return `  ${dim('○', styled)} ${dim(`${displayName}: not detected`, styled)}\n`;
}

export function renderCustomPathSet(paths: string[], styled: boolean): string {
  if (!styled) return `  using ${paths.join(', ')}\n`;
  return `  ${paint(GOOD, '✓', styled)} ${dim(`using ${paths.join(', ')}`, styled)}\n`;
}

export function renderAdapterSkipped(styled: boolean): string {
  if (!styled) return '  skipped.\n';
  return `  ${dim('→ skipped', styled)}\n`;
}

export function renderAdapterEnabled(plan: string, styled: boolean): string {
  if (!styled) return `  enabled (${plan}).\n`;
  return `  ${paint(HOUSE_TINTS.aether, '●', styled)} ${dim(`enabled · ${plan}`, styled)}\n`;
}

// ---------------------------------------------------------------------------
// Display step
// ---------------------------------------------------------------------------

export function renderColorChoice(pref: string, changed: boolean, styled: boolean): string {
  if (!styled) {
    return changed ? `  Color set to ${pref} (applies next launch).\n` : `  Color: ${pref}.\n`;
  }
  if (changed) {
    return `  ${paint(GOOD, '✓', styled)} ${dim(`color → ${pref}  (applies next launch)`, styled)}\n`;
  }
  return `  ${dim(`color · ${pref}`, styled)}\n`;
}

// ---------------------------------------------------------------------------
// Re-run / no-adapters / next steps
// ---------------------------------------------------------------------------

export function renderRerunMessage(styled: boolean): string {
  if (!styled) return '\nConfiguration updated. Your pet and progress are unchanged.\n';
  return `\n  ${paint(GOOD, '✓', styled)} ${bold('Configuration updated.', styled)} ${dim('Your pet and progress are unchanged.', styled)}\n`;
}

export function renderRerunBackfill(
  provider: string,
  eventCount: number,
  windowsObserved: number,
  styled: boolean,
): string {
  if (!styled) {
    return (
      `Backfilled ${plural(eventCount, 'usage event')} for ${provider}; ` +
      `baseline seeded from ${plural(windowsObserved, 'closed session window')}.\n`
    );
  }
  const stats = dim(
    `${plural(eventCount, 'event')}, ${plural(windowsObserved, 'baseline window')}`,
    styled,
  );
  return `  ${paint(GOOD, '✓', styled)} Backfilled ${bold(provider, styled)} — ${stats}.\n`;
}

export function renderNextStepsLine(styled: boolean): string {
  if (!styled) return 'Run `tt` to open the shell, or `tt status` for a quick look.\n';
  const a = paint(HOUSE_TINTS.aether, '`tt`', styled);
  const b = paint(HOUSE_TINTS.aether, '`tt status`', styled);
  return `  ${dim('→', styled)} Run ${a} to open the shell, or ${b} for a quick look.\n`;
}

export function renderNoAdapters(styled: boolean): string {
  if (!styled) {
    return '\nNo adapters enabled. Nothing to do — re-run `tt init` once an agent is installed.\n';
  }
  return (
    `\n  ${paint(HOUSE_TINTS.warn, '⚠', styled)} No adapters enabled.\n` +
    `  ${dim('Nothing to do — re-run `tt init` once an agent is installed.', styled)}\n`
  );
}

export function renderWarnings(warnings: string[], styled: boolean): string {
  if (warnings.length === 0) return '';
  if (!styled) return '\nNotes:\n' + warnings.map((w) => `! ${w}\n`).join('');
  const icon = paint(HOUSE_TINTS.warn, '⚠', styled);
  return '\n' + warnings.map((w) => `  ${icon} ${dim(w, styled)}\n`).join('');
}

// ---------------------------------------------------------------------------
// Hatch summary
// ---------------------------------------------------------------------------

const EGG_PLAIN = ['  .--.', '  ( oo )', '  (    )', "  '--'"];
const EGG_STYLED = ['  ╭───╮', '  │ ◍ │', '  │   │', '  ╰───╯'];

function renderEggArt(styled: boolean): string {
  const lines = styled ? EGG_STYLED : EGG_PLAIN;
  if (!styled) return lines.join('\n') + '\n';
  return (
    lines.map((l, i) => paint(i === 0 || i === 3 ? ACCENT : '#e879f9', l, styled)).join('\n') + '\n'
  );
}

export interface SummaryInput {
  eventCount: number;
  windowsObserved: number;
  /** Tilde-collapsed data dir, e.g. '~/.tokentamers'. */
  dataDir: string;
}

export function renderFirstInitSummary(input: SummaryInput, styled: boolean): string {
  const { eventCount, windowsObserved, dataDir } = input;
  if (!styled) {
    let text = '\nYour Calibration Egg has been placed.\n';
    text +=
      'It is warming up to your coding rhythm — the first week is calibration, then it hatches.\n';
    text += `Backfilled ${plural(eventCount, 'usage event')}.\n`;
    if (windowsObserved > 0) {
      text += `Established a baseline from ${plural(windowsObserved, 'closed session window')}.\n`;
    }
    text += `Files live in ${dataDir} (config.json · settings.json · state.json).\n`;
    return text;
  }

  const baseline =
    windowsObserved > 0
      ? `${bold(String(windowsObserved), styled)} ${dim('windows', styled)} ${paint(GOOD, '✓', styled)}`
      : dim('calibrating — no closed windows yet', styled);
  const rows = [
    `${dim('pet      ', styled)} ${paint(ACCENT, 'Calibration Egg', styled)} ${dim('· gen 1', styled)}`,
    `${dim('events   ', styled)} ${bold(String(eventCount), styled)} ${dim('backfilled', styled)}`,
    `${dim('baseline ', styled)} ${baseline}`,
    `${dim('store    ', styled)} ${dim(dataDir, styled)} ${dim('· config · settings · state', styled)}`,
  ];
  return '\n' + renderEggArt(styled) + renderBox('hatched', rows);
}
