/**
 * Shared "terminal window" SVG renderer for showcase/preview tooling: converts
 * a rendered FrameBuffer into an SVG with macOS-style chrome. Half-block cells
 * ('\u2580') are drawn as two crisp rects; text is run-coalesced per row.
 */
import { FrameBuffer, HitRegistry, renderFrame, type Rgb } from '@token-tamers/tui';
import type { ContentPack, GameState } from '@token-tamers/core';
import type { PageId } from '@token-tamers/tui';

export const CW = 9;
export const CH = 19;
export const PAD = 16;
export const BAR = 34;
export const TERM_BG = '#0e1118';
const FONT =
  "ui-monospace,SFMono-Regular,Menlo,Monaco,'Apple Symbols','Arial Unicode MS',monospace";

const css = (c: Rgb | null, fallback: string): string =>
  c ? `rgb(${c.r},${c.g},${c.b})` : fallback;
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Glyphs missing from magick's fontconfig fallback get lookalikes.
const GLYPH_SUBS: Record<string, string> = {
  '☰': '≡',
  '◆': '♦',
  '⚙': '*',
  '★': '*',
  '✦': '+',
  '⌂': '^',
  '●': 'o',
};

export interface ShellSvgInput {
  page: PageId;
  state: GameState;
  pack: ContentPack;
  frame: number;
  cols: number;
  rows: number;
  completionPct: number;
  flash: string | null;
  selected?: number;
}

export function shellFrameToSvg(input: ShellSvgInput): string {
  const { cols, rows } = input;
  const W = cols * CW + PAD * 2;
  const H = rows * CH + PAD * 2 + BAR;
  const buf = new FrameBuffer(cols, rows);
  const hits = new HitRegistry();
  renderFrame(buf, hits, {
    page: input.page,
    state: input.state,
    pack: input.pack,
    mode: 'truecolor',
    frame: input.frame,
    ui: { selected: input.selected ?? 0, scroll: 0 },
    completionPct: input.completionPct,
    flash: input.flash,
  });

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="${W}" height="${H}" rx="12" fill="#161b26"/>`,
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="11" fill="none" stroke="#2c3445"/>`,
    `<circle cx="22" cy="${BAR / 2}" r="6" fill="#ff5f57"/>`,
    `<circle cx="42" cy="${BAR / 2}" r="6" fill="#febc2e"/>`,
    `<circle cx="62" cy="${BAR / 2}" r="6" fill="#28c840"/>`,
    `<text x="${W / 2}" y="${BAR / 2 + 4}" text-anchor="middle" font-family="${FONT}" font-size="12" fill="#8b93a7">tt — Token Tamers</text>`,
    `<rect x="${PAD - 6}" y="${BAR + PAD - 6}" width="${cols * CW + 12}" height="${rows * CH + 12}" rx="6" fill="${TERM_BG}"/>`,
  ];
  const ox = PAD;
  const oy = BAR + PAD;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = buf.get(x, y);
      const px = ox + x * CW;
      const py = oy + y * CH;
      if (cell.ch === '\u2580') {
        parts.push(
          `<rect x="${px}" y="${py}" width="${CW}" height="${CH / 2}" fill="${css(cell.fg, TERM_BG)}"/>`,
          `<rect x="${px}" y="${py + CH / 2}" width="${CW}" height="${CH / 2}" fill="${css(cell.bg, TERM_BG)}"/>`,
        );
      } else if (cell.bg) {
        parts.push(
          `<rect x="${px}" y="${py}" width="${CW}" height="${CH}" fill="${css(cell.bg, TERM_BG)}"/>`,
        );
      }
    }
  }

  for (let y = 0; y < rows; y++) {
    let start = -1;
    let fg = '';
    let text = '';
    const flush = () => {
      if (start >= 0 && text.trim().length > 0) {
        parts.push(
          `<text x="${ox + start * CW}" y="${oy + y * CH + CH - 5}" font-family="${FONT}" font-size="14" xml:space="preserve" textLength="${text.length * CW}" lengthAdjust="spacingAndGlyphs" fill="${fg}">${esc(text)}</text>`,
        );
      }
      start = -1;
      text = '';
    };
    for (let x = 0; x < cols; x++) {
      const cell = buf.get(x, y);
      if (cell.ch === '\u2580') {
        flush();
        continue;
      }
      const color = css(cell.fg, '#c9d1e3');
      const ch = GLYPH_SUBS[cell.ch] ?? cell.ch;
      if (start >= 0 && color !== fg) flush();
      if (start < 0) {
        start = x;
        fg = color;
      }
      text += ch;
    }
    flush();
  }

  parts.push('</svg>');
  return parts.join('\n');
}
