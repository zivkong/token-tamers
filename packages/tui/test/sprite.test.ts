import { describe, it, expect } from 'vitest';
import { buildPalette, drawSprite, indexToChar, resolveIndex } from '../src/sprite';
import { FrameBuffer } from '../src/buffer';
import { TEST_SPRITE } from './fixtures';

describe('palette beauty ladder', () => {
  it('grows the ramp with grade', () => {
    const c = buildPalette('#8a7cff', 'C');
    const b = buildPalette('#8a7cff', 'B');
    const a = buildPalette('#8a7cff', 'A');
    const s = buildPalette('#8a7cff', 'S');
    expect(c.length).toBeLessThan(b.length);
    expect(b.length).toBeLessThan(a.length);
    // S and A both offer 16 slots.
    expect(a.length).toBe(16);
    expect(s.length).toBe(16);
  });

  it('reserves index 0 as transparent', () => {
    const pal = buildPalette('#8a7cff', 'A');
    expect(pal[0]).toBeNull();
    expect(resolveIndex(pal, 0)).toBeNull();
  });

  it('animates the S-grade ramp across frames', () => {
    const f0 = buildPalette('#8a7cff', 'S', 0);
    const f3 = buildPalette('#8a7cff', 'S', 3);
    expect(JSON.stringify(f0)).not.toBe(JSON.stringify(f3));
  });
});

describe('half-block compositor', () => {
  it('pairs rows into upper-half-block cells', () => {
    const buf = new FrameBuffer(8, 4);
    buf.clear();
    const pal = buildPalette('#8a7cff', 'C');
    drawSprite(buf, TEST_SPRITE, 0, 0, pal, { frame: 0, mode: 'truecolor' });
    // The sprite center pixels are opaque, so the center cell is a half block.
    const center = buf.get(1, 0);
    expect(center.ch.codePointAt(0)).toBe(0x2580); // '▀' upper-half block
    expect(center.fg).not.toBeNull();
  });

  it('skips cells where both stacked pixels are transparent', () => {
    const buf = new FrameBuffer(8, 4);
    // Pre-fill so we can detect "left untouched".
    buf.clear();
    buf.set(0, 0, { ch: '#', fg: null, bg: null });
    const pal = buildPalette('#8a7cff', 'C');
    // A sprite whose first column is fully transparent (top+bottom both 0).
    const sprite = {
      id: 's',
      width: 2,
      height: 2,
      fps: 1,
      frames: [
        [
          [0, 2],
          [0, 2],
        ],
      ],
    };
    drawSprite(buf, sprite, 0, 0, pal, { frame: 0, mode: 'truecolor' });
    // Cell (0,0) is fully transparent -> the '#' underneath survives.
    expect(buf.get(0, 0).ch).toBe('#');
    // Cell (1,0) is opaque -> upper-half block, colored.
    expect(buf.get(1, 0).ch).not.toBe(' ');
    expect(buf.get(1, 0).fg).not.toBeNull();
  });
});

describe('--no-color degradation', () => {
  it('maps palette index to an ASCII ramp glyph', () => {
    expect(indexToChar(0, 16)).toBe(' ');
    const low = indexToChar(2, 16);
    const high = indexToChar(15, 16);
    expect(low).not.toBe(' ');
    expect('@%#'.includes(high)).toBe(true);
  });

  it('renders sprites without color in none mode', () => {
    const buf = new FrameBuffer(8, 4);
    buf.clear();
    const pal = buildPalette('#8a7cff', 'C');
    drawSprite(buf, TEST_SPRITE, 0, 0, pal, { frame: 0, mode: 'none' });
    const center = buf.get(1, 0);
    expect(center.fg).toBeNull();
    expect(center.bg).toBeNull();
    // ASCII ramp glyph, not a half block.
    expect(center.ch.codePointAt(0)).not.toBe(0x2580);
  });
});
