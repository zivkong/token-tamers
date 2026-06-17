import { describe, it, expect } from 'vitest';
import { buildPalette, drawSprite, indexToChar, resolveIndex } from '../src/render/sprite';
import { OCTANT_TABLE } from '../src/render/octant-table';
import { FrameBuffer } from '../src/render/buffer';
import { TEST_SPRITE } from './fixtures';

describe('octant glyph table (Unicode 16 BLOCK OCTANT)', () => {
  it('covers all 256 sub-pixel patterns with a non-empty glyph', () => {
    expect(OCTANT_TABLE.length).toBe(256);
    for (let m = 0; m < 256; m++) expect(OCTANT_TABLE[m]!.length).toBeGreaterThan(0);
  });

  it('maps the canonical anchors + reused Block-Element patterns', () => {
    // OCTANT-1478 (positions 1,4,7,8 -> bits 0,3,6,7) = U+1CDB4.
    expect(OCTANT_TABLE[(1 << 0) | (1 << 3) | (1 << 6) | (1 << 7)]!.codePointAt(0)).toBe(0x1cdb4);
    // OCTANT-23578 (positions 2,3,5,7,8 -> bits 1,2,4,6,7) = U+1CDC1.
    expect(OCTANT_TABLE[(1 << 1) | (1 << 2) | (1 << 4) | (1 << 6) | (1 << 7)]!.codePointAt(0)).toBe(
      0x1cdc1,
    );
    expect(OCTANT_TABLE[0]).toBe(' '); // empty -> space
    expect(OCTANT_TABLE[255]!.codePointAt(0)).toBe(0x2588); // full block
    expect(OCTANT_TABLE[15]!.codePointAt(0)).toBe(0x2580); // top half -> upper half block
    expect(OCTANT_TABLE[240]!.codePointAt(0)).toBe(0x2584); // bottom half -> lower half block
    expect(OCTANT_TABLE[85]!.codePointAt(0)).toBe(0x258c); // left col -> left half block
    expect(OCTANT_TABLE[170]!.codePointAt(0)).toBe(0x2590); // right col -> right half block
  });
});

describe('palette beauty ladder', () => {
  it('grows the body ramp with grade (more distinct tones C→S)', () => {
    // The LUT is now a fixed 21-slot layout for every grade (1..15 body ramp,
    // 16..18 per-species accent, 20 cream belly), so grade richness is the count
    // of DISTINCT body tones in indices 1..15, not the array length.
    const distinctBody = (g: 'C' | 'B' | 'A' | 'S'): number =>
      new Set(
        buildPalette('#8a7cff', g)
          .slice(1, 16)
          .map((c) => (c ? JSON.stringify(c) : null)),
      ).size;
    expect(distinctBody('C')).toBeLessThan(distinctBody('B'));
    expect(distinctBody('B')).toBeLessThan(distinctBody('A'));
    expect(distinctBody('A')).toBeGreaterThanOrEqual(12);
    expect(distinctBody('S')).toBeGreaterThanOrEqual(12);
    // Every grade exposes the same 21-slot LUT (so the accent/belly band always resolves).
    expect(buildPalette('#8a7cff', 'C').length).toBe(21);
    expect(buildPalette('#8a7cff', 'S').length).toBe(21);
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

describe('sub-cell compositor', () => {
  it('packs opaque pixels into colored block-glyph cells', () => {
    const buf = new FrameBuffer(8, 4);
    buf.clear();
    const pal = buildPalette('#8a7cff', 'C');
    drawSprite(buf, TEST_SPRITE, pal, { x: 0, y: 0, frame: 0, mode: 'truecolor' });
    // Opaque pixels render as colored block glyphs — Block Elements (U+2580..2590
    // half/quadrant/full) or the Unicode 13 sextants (U+1FB00..1FB3B).
    let drew = false;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 8; x++) {
        const cell = buf.get(x, y);
        if (cell.fg === null) continue;
        const cp = cell.ch.codePointAt(0) ?? 0;
        const isBlock =
          (cp >= 0x2580 && cp <= 0x259f) || // Block Elements (half/quadrant/full)
          (cp >= 0x1fb00 && cp <= 0x1fb3b) || // Unicode 13 sextants
          (cp >= 0x1cd00 && cp <= 0x1cde5); // Unicode 16 block octants
        expect(isBlock).toBe(true);
        drew = true;
      }
    }
    expect(drew).toBe(true);
  });

  it('skips cells where every sub-pixel is transparent', () => {
    const buf = new FrameBuffer(8, 4);
    buf.clear();
    buf.set(0, 0, { ch: '#', fg: null, bg: null });
    const pal = buildPalette('#8a7cff', 'C');
    // 4x3 so the left 2-col cell is FULLY transparent and the right is opaque.
    const sprite = {
      id: 's',
      width: 4,
      height: 3,
      fps: 1,
      frames: [
        [
          [0, 0, 2, 2],
          [0, 0, 2, 2],
          [0, 0, 2, 2],
        ],
      ],
    };
    drawSprite(buf, sprite, pal, { x: 0, y: 0, frame: 0, mode: 'truecolor' });
    // Cell (0,0) is fully transparent -> the '#' underneath survives.
    expect(buf.get(0, 0).ch).toBe('#');
    // Cell (1,0) is opaque -> a colored block glyph.
    expect(buf.get(1, 0).ch).not.toBe(' ');
    expect(buf.get(1, 0).fg).not.toBeNull();
  });
});

describe('animation cadence honors sprite.fps', () => {
  // A 2-cell-wide, 1-cell-tall sprite whose two frames swap which cell is
  // opaque, so we can detect exactly which frame is being drawn.
  const blinker = {
    id: 'blinker',
    width: 4,
    height: 3,
    fps: 4, // advance once every 30/4 = 7.5 render frames
    frames: [
      [
        [2, 2, 0, 0],
        [2, 2, 0, 0],
        [2, 2, 0, 0],
      ], // frame 0: left cell opaque
      [
        [0, 0, 2, 2],
        [0, 0, 2, 2],
        [0, 0, 2, 2],
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
