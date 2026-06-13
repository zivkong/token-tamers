import { describe, it, expect } from 'vitest';
import { buildPalette, drawSprite, indexToChar, resolveIndex } from '../src/render/sprite';
import { FrameBuffer } from '../src/render/buffer';
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
    drawSprite(buf, TEST_SPRITE, pal, { x: 0, y: 0, frame: 0, mode: 'truecolor' });
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
    drawSprite(buf, sprite, pal, { x: 0, y: 0, frame: 0, mode: 'truecolor' });
    // Cell (0,0) is fully transparent -> the '#' underneath survives.
    expect(buf.get(0, 0).ch).toBe('#');
    // Cell (1,0) is opaque -> upper-half block, colored.
    expect(buf.get(1, 0).ch).not.toBe(' ');
    expect(buf.get(1, 0).fg).not.toBeNull();
  });
});

describe('animation cadence honors sprite.fps', () => {
  // A 2-cell-wide, 1-cell-tall sprite whose two frames swap which cell is
  // opaque, so we can detect exactly which frame is being drawn.
  const blinker = {
    id: 'blinker',
    width: 2,
    height: 2,
    fps: 4, // advance once every 30/4 = 7.5 render frames
    frames: [
      [
        [2, 0],
        [2, 0],
      ], // frame 0: left cell opaque
      [
        [0, 2],
        [0, 2],
      ], // frame 1: right cell opaque
    ],
  };

  const opaqueLeft = (frame: number): boolean => {
    const buf = new FrameBuffer(2, 1);
    buf.clear();
    drawSprite(buf, blinker, buildPalette('#8a7cff', 'C'), {
      x: 0,
      y: 0,
      frame,
      mode: 'truecolor',
    });
    return buf.get(0, 0).fg !== null;
  };

  it('holds a frame steady across the whole fps window (no per-render jitter)', () => {
    // render frames 0..7 all fall in tick 0 -> frame 0 stays drawn the whole time.
    for (let f = 0; f <= 7; f++) expect(opaqueLeft(f)).toBe(true);
  });

  it('advances the bank only when the fps tick rolls over', () => {
    expect(opaqueLeft(0)).toBe(true); // tick 0 -> frame 0
    expect(opaqueLeft(8)).toBe(false); // tick 1 -> frame 1
    expect(opaqueLeft(15)).toBe(true); // tick 2 -> frame 0 again
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
    drawSprite(buf, TEST_SPRITE, pal, { x: 0, y: 0, frame: 0, mode: 'none' });
    const center = buf.get(1, 0);
    expect(center.fg).toBeNull();
    expect(center.bg).toBeNull();
    // ASCII ramp glyph, not a half block.
    expect(center.ch.codePointAt(0)).not.toBe(0x2580);
  });
});
