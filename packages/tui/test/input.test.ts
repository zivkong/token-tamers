import { describe, it, expect } from 'vitest';
import { decode } from '../src/input';

const ESC = '\x1b';

describe('key decoding', () => {
  it('decodes printable keys and digits', () => {
    expect(decode('q')).toEqual([{ type: 'key', name: 'q', ch: 'q' }]);
    expect(decode('1')).toEqual([{ type: 'key', name: '1', ch: '1' }]);
  });

  it('decodes enter, ctrl-c, space', () => {
    expect(decode('\r')[0]).toMatchObject({ name: 'enter' });
    expect(decode('\x03')[0]).toMatchObject({ name: 'ctrl-c' });
    expect(decode(' ')[0]).toMatchObject({ name: 'space' });
  });

  it('decodes arrow keys (CSI)', () => {
    expect(decode(`${ESC}[A`)[0]).toMatchObject({ name: 'up' });
    expect(decode(`${ESC}[B`)[0]).toMatchObject({ name: 'down' });
    expect(decode(`${ESC}[C`)[0]).toMatchObject({ name: 'right' });
    expect(decode(`${ESC}[D`)[0]).toMatchObject({ name: 'left' });
  });

  it('decodes function keys (SS3 and tilde forms)', () => {
    expect(decode(`${ESC}OP`)[0]).toMatchObject({ name: 'f1' });
    expect(decode(`${ESC}[15~`)[0]).toMatchObject({ name: 'f5' });
    expect(decode(`${ESC}[24~`)[0]).toMatchObject({ name: 'f12' });
  });

  it('handles a multi-event chunk', () => {
    const evs = decode(`1${ESC}[Aq`);
    expect(evs.map((e) => (e.type === 'key' ? e.name : e.type))).toEqual(['1', 'up', 'q']);
  });
});

describe('SGR mouse decoding', () => {
  it('decodes a left-button press', () => {
    const ev = decode(`${ESC}[<0;12;7M`)[0];
    expect(ev).toMatchObject({ type: 'mouse', action: 'press', x: 12, y: 7, button: 0 });
  });

  it('decodes a release', () => {
    const ev = decode(`${ESC}[<0;12;7m`)[0];
    expect(ev).toMatchObject({ type: 'mouse', action: 'release', x: 12, y: 7 });
  });

  it('decodes wheel up and down', () => {
    expect(decode(`${ESC}[<64;5;5M`)[0]).toMatchObject({ action: 'wheel-up' });
    expect(decode(`${ESC}[<65;5;5M`)[0]).toMatchObject({ action: 'wheel-down' });
  });

  it('decodes motion (drag) events', () => {
    const ev = decode(`${ESC}[<32;10;3M`)[0];
    expect(ev).toMatchObject({ action: 'move', x: 10, y: 3 });
  });
});
