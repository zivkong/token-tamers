/**
 * ANSI terminal control: a single Writer through which all terminal output
 * flows, plus SGR color encoding with graceful degradation.
 *
 * All writes go through one `Writer` so golden-frame tests can capture output
 * to a string instead of a real TTY.
 */

export type ColorMode = 'truecolor' | '256' | '8' | 'none';

/** An RGB triple, each channel 0..255. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const ESC = '';
const CSI = `${ESC}[`;

const OSC = `${ESC}]`;
const BEL = '\x07';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Minimal base64 for ASCII text (DNA codes are ASCII) — no Buffer/btoa dependency. */
function base64Ascii(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 3) {
    const a = text.charCodeAt(i) & 0xff;
    const has1 = i + 1 < text.length;
    const has2 = i + 2 < text.length;
    const b = has1 ? text.charCodeAt(i + 1) & 0xff : 0;
    const c = has2 ? text.charCodeAt(i + 2) & 0xff : 0;
    out += B64[a >> 2]! + B64[((a & 3) << 4) | (b >> 4)]!;
    out += has1 ? B64[((b & 15) << 2) | (c >> 6)]! : '=';
    out += has2 ? B64[c & 63]! : '=';
  }
  return out;
}

/**
 * The OSC 52 "set clipboard" sequence for `text` (selection 'c' = system
 * clipboard). A local terminal control sequence — works over SSH, makes ZERO
 * network calls, and adds no dependency (invariants 1 & 2). Terminals that don't
 * support OSC 52 simply ignore it.
 */
export function osc52(text: string): string {
  return `${OSC}52;c;${base64Ascii(text)}${BEL}`;
}

/** A sink that terminal control sequences are written to. */
export interface OutputSink {
  write(s: string): void;
}

/** Captures all writes into a string; used by tests and frame renderers. */
export class StringSink implements OutputSink {
  private chunks: string[] = [];
  write(s: string): void {
    this.chunks.push(s);
  }
  toString(): string {
    return this.chunks.join('');
  }
  clear(): void {
    this.chunks = [];
  }
}

/**
 * The single writer all terminal output passes through. Holds terminal-mode
 * state (alt screen, raw mode, cursor, mouse) so it can restore on exit.
 */
export class Writer {
  readonly sink: OutputSink;
  readonly color: ColorMode;
  private altScreen = false;
  private cursorHidden = false;
  private mouseOn = false;

  constructor(sink: OutputSink, color: ColorMode = 'truecolor') {
    this.sink = sink;
    this.color = color;
  }

  write(s: string): void {
    this.sink.write(s);
  }

  /** Copy `text` to the terminal's system clipboard via OSC 52 (offline, no deps). */
  copyToClipboard(text: string): void {
    this.write(osc52(text));
  }

  enterAltScreen(): void {
    if (this.altScreen) return;
    this.write(`${CSI}?1049h`);
    this.altScreen = true;
  }

  leaveAltScreen(): void {
    if (!this.altScreen) return;
    this.write(`${CSI}?1049l`);
    this.altScreen = false;
  }

  hideCursor(): void {
    if (this.cursorHidden) return;
    this.write(`${CSI}?25l`);
    this.cursorHidden = true;
  }

  showCursor(): void {
    if (!this.cursorHidden) return;
    this.write(`${CSI}?25h`);
    this.cursorHidden = false;
  }

  /** Enable SGR (1006) mouse reporting: button (1000), drag (1002). */
  enableMouse(): void {
    if (this.mouseOn) return;
    this.write(`${CSI}?1000h${CSI}?1002h${CSI}?1006h`);
    this.mouseOn = true;
  }

  disableMouse(): void {
    if (!this.mouseOn) return;
    this.write(`${CSI}?1000l${CSI}?1002l${CSI}?1006l`);
    this.mouseOn = false;
  }

  clearScreen(): void {
    this.write(`${CSI}2J`);
  }

  /** Move cursor to 1-based (col, row). */
  moveTo(col: number, row: number): void {
    this.write(cursorTo(col, row));
  }

  resetSgr(): void {
    this.write(sgrReset());
  }

  /** Restore the terminal to a usable state. Safe to call multiple times. */
  restore(): void {
    this.resetSgr();
    this.showCursor();
    this.disableMouse();
    this.leaveAltScreen();
  }
}

/** Move-to escape for a 1-based (col, row). */
export function cursorTo(col: number, row: number): string {
  return `${CSI}${row};${col}H`;
}

export function sgrReset(): string {
  return `${CSI}0m`;
}

/** Bold (increased-intensity) SGR; a no-op in monochrome mode. */
export function boldSgr(mode: ColorMode): string {
  return mode === 'none' ? '' : `${CSI}1m`;
}

// ---------------------------------------------------------------------------
// Color encoding with degradation
// ---------------------------------------------------------------------------

function clamp255(n: number): number {
  if (n < 0) return 0;
  if (n > 255) return 255;
  return Math.round(n);
}

/** Map an RGB triple to the nearest xterm-256 palette index. */
export function rgbTo256(rgb: Rgb): number {
  const { r, g, b } = rgb;
  // Grayscale ramp check: if channels close, prefer the 24-step gray ramp.
  if (Math.abs(r - g) < 8 && Math.abs(g - b) < 8 && Math.abs(r - b) < 8) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return 232 + Math.round(((r - 8) / 247) * 23);
  }
  const ri = Math.round((clamp255(r) / 255) * 5);
  const gi = Math.round((clamp255(g) / 255) * 5);
  const bi = Math.round((clamp255(b) / 255) * 5);
  return 16 + 36 * ri + 6 * gi + bi;
}

/** Map an RGB triple to the nearest of the 8 basic ANSI colors (0..7). */
export function rgbTo8(rgb: Rgb): number {
  const r = rgb.r > 127 ? 1 : 0;
  const g = rgb.g > 127 ? 1 : 0;
  const b = rgb.b > 127 ? 1 : 0;
  return r * 1 + g * 2 + b * 4;
}

/** Foreground SGR for an RGB color under the writer's color mode. */
export function fgSgr(rgb: Rgb, mode: ColorMode): string {
  switch (mode) {
    case 'truecolor':
      return `${CSI}38;2;${clamp255(rgb.r)};${clamp255(rgb.g)};${clamp255(rgb.b)}m`;
    case '256':
      return `${CSI}38;5;${rgbTo256(rgb)}m`;
    case '8':
      return `${CSI}${30 + rgbTo8(rgb)}m`;
    case 'none':
      return '';
  }
}

/** Background SGR for an RGB color under the writer's color mode. */
export function bgSgr(rgb: Rgb, mode: ColorMode): string {
  switch (mode) {
    case 'truecolor':
      return `${CSI}48;2;${clamp255(rgb.r)};${clamp255(rgb.g)};${clamp255(rgb.b)}m`;
    case '256':
      return `${CSI}48;5;${rgbTo256(rgb)}m`;
    case '8':
      return `${CSI}${40 + rgbTo8(rgb)}m`;
    case 'none':
      return '';
  }
}

/** Parse a hex tint ('#rrggbb' or 'rrggbb' or '#rgb') into an Rgb. */
export function hexToRgb(hex: string): Rgb {
  let h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/** Mix two colors by t in [0,1] (0 = a, 1 = b). */
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return {
    r: a.r + (b.r - a.r) * u,
    g: a.g + (b.g - a.g) * u,
    b: a.b + (b.b - a.b) * u,
  };
}

export { CSI, ESC };
