/**
 * stdin decoder: turns raw terminal byte sequences into typed input events.
 *
 * Handles plain keys (letters, digits, enter, q, ctrl-c), arrow/function keys
 * (CSI sequences), and SGR-encoded mouse events (CSI < b ; x ; y M/m) including
 * press, release, wheel, and motion.
 */

export type KeyName =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'enter'
  | 'escape'
  | 'tab'
  | 'backspace'
  | 'space'
  | 'ctrl-c'
  | `f${number}`
  | string; // single printable char for the rest

export interface KeyEvent {
  type: 'key';
  name: KeyName;
  /** For printable keys, the raw character. */
  ch?: string;
}

export type MouseAction = 'press' | 'release' | 'move' | 'wheel-up' | 'wheel-down';

export interface MouseEvent {
  type: 'mouse';
  action: MouseAction;
  /** 1-based terminal column and row (as reported by SGR mouse). */
  x: number;
  y: number;
  /** Raw button code from the SGR report. */
  button: number;
}

export type InputEvent = KeyEvent | MouseEvent;

const ESC = '\x1b';
const CTRL_C = '\x03';
const DEL = '\x7f';

/**
 * Decode one raw chunk of stdin bytes into zero or more input events. The
 * decoder consumes whole escape sequences within a chunk; terminals deliver
 * escape sequences in a single read in practice, which keeps this simple and
 * test-friendly.
 */
export function decode(input: string): InputEvent[] {
  const events: InputEvent[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i] ?? '';

    if (ch === CTRL_C) {
      events.push({ type: 'key', name: 'ctrl-c' });
      i++;
      continue;
    }

    if (ch === ESC) {
      const rest = input.slice(i);
      const parsed = parseEscape(rest);
      if (parsed) {
        events.push(...parsed.events);
        i += parsed.consumed;
        continue;
      }
      // Lone ESC.
      events.push({ type: 'key', name: 'escape' });
      i++;
      continue;
    }

    events.push(simpleKey(ch));
    i++;
  }
  return events;
}

function simpleKey(ch: string): KeyEvent {
  switch (ch) {
    case '\r':
    case '\n':
      return { type: 'key', name: 'enter' };
    case '\t':
      return { type: 'key', name: 'tab' };
    case DEL:
    case '\b':
      return { type: 'key', name: 'backspace' };
    case ' ':
      return { type: 'key', name: 'space', ch: ' ' };
    default:
      return { type: 'key', name: ch, ch };
  }
}

interface EscapeParse {
  events: InputEvent[];
  consumed: number;
}

function parseEscape(s: string): EscapeParse | null {
  // s starts with ESC.
  if (s.length < 2) return null;
  const second = s[1];

  // CSI: ESC [
  if (second === '[') {
    // SGR mouse: ESC [ < b ; x ; y (M|m)
    if (s[2] === '<') {
      return parseSgrMouse(s);
    }
    return parseCsi(s);
  }

  // SS3 (ESC O ...) used by some terminals for F1-F4 / arrows.
  if (second === 'O') {
    return parseSs3(s);
  }

  return null;
}

function parseCsi(s: string): EscapeParse | null {
  // ESC [ <params> <final-byte>
  let i = 2;
  let params = '';
  while (i < s.length) {
    const c = s[i] ?? '';
    if ((c >= '0' && c <= '9') || c === ';') {
      params += c;
      i++;
      continue;
    }
    break;
  }
  const final = s[i];
  if (final === undefined) return null;
  const consumed = i + 1;

  switch (final) {
    case 'A':
      return { events: [{ type: 'key', name: 'up' }], consumed };
    case 'B':
      return { events: [{ type: 'key', name: 'down' }], consumed };
    case 'C':
      return { events: [{ type: 'key', name: 'right' }], consumed };
    case 'D':
      return { events: [{ type: 'key', name: 'left' }], consumed };
    case '~': {
      const code = parseInt(params, 10);
      const fn = TILDE_FKEYS[code];
      if (fn) return { events: [{ type: 'key', name: fn }], consumed };
      return { events: [], consumed };
    }
    default:
      return { events: [], consumed };
  }
}

const TILDE_FKEYS: Record<number, KeyName> = {
  15: 'f5',
  17: 'f6',
  18: 'f7',
  19: 'f8',
  20: 'f9',
  21: 'f10',
  23: 'f11',
  24: 'f12',
};

function parseSs3(s: string): EscapeParse | null {
  const c = s[2];
  if (c === undefined) return null;
  const consumed = 3;
  switch (c) {
    case 'A':
      return { events: [{ type: 'key', name: 'up' }], consumed };
    case 'B':
      return { events: [{ type: 'key', name: 'down' }], consumed };
    case 'C':
      return { events: [{ type: 'key', name: 'right' }], consumed };
    case 'D':
      return { events: [{ type: 'key', name: 'left' }], consumed };
    case 'P':
      return { events: [{ type: 'key', name: 'f1' }], consumed };
    case 'Q':
      return { events: [{ type: 'key', name: 'f2' }], consumed };
    case 'R':
      return { events: [{ type: 'key', name: 'f3' }], consumed };
    case 'S':
      return { events: [{ type: 'key', name: 'f4' }], consumed };
    default:
      return { events: [], consumed };
  }
}

/** Parse an SGR mouse sequence: ESC [ < b ; x ; y (M|m). */
function parseSgrMouse(s: string): EscapeParse | null {
  // s[0..2] === ESC [ <
  let i = 3;
  let buf = '';
  while (i < s.length && s[i] !== 'M' && s[i] !== 'm') {
    buf += s[i];
    i++;
  }
  const final = s[i];
  if (final === undefined) return null;
  const consumed = i + 1;
  const parts = buf.split(';');
  if (parts.length !== 3) return { events: [], consumed };
  const b = parseInt(parts[0] ?? '', 10);
  const x = parseInt(parts[1] ?? '', 10);
  const y = parseInt(parts[2] ?? '', 10);
  if (Number.isNaN(b) || Number.isNaN(x) || Number.isNaN(y)) {
    return { events: [], consumed };
  }
  const action = mouseAction(b, final === 'M');
  return { events: [{ type: 'mouse', action, x, y, button: b }], consumed };
}

function mouseAction(b: number, isPress: boolean): MouseAction {
  // Wheel events: bit 6 (64) set.
  if (b & 64) {
    return (b & 0x01) === 0 ? 'wheel-up' : 'wheel-down';
  }
  // Motion events: bit 5 (32) set.
  if (b & 32) {
    return 'move';
  }
  return isPress ? 'press' : 'release';
}
