import { describe, it, expect } from 'vitest';
import { FrameBuffer } from '../src/render/buffer';
import { drawMarquee } from '../src/components/marquee';

const FG = { r: 255, g: 255, b: 255 };
const BG = { r: 0, g: 0, b: 0 };

/** Read row `y` of the buffer back as a string. */
function row(buf: FrameBuffer, y: number, cols: number): string {
  let s = '';
  for (let x = 0; x < cols; x++) s += buf.get(x, y).ch;
  return s;
}

describe('drawMarquee', () => {
  it('paints the whole row with the ribbon background', () => {
    const buf = new FrameBuffer(20, 1);
    drawMarquee(buf, { x: 0, y: 0, cols: 20, text: 'HI', frame: 0, fg: FG, bg: BG });
    for (let x = 0; x < 20; x++) expect(buf.get(x, 0).bg).toEqual(BG);
  });

  it('shows the message at frame 0 and scrolls it leftward over time', () => {
    const buf = new FrameBuffer(40, 1);
    drawMarquee(buf, { x: 0, y: 0, cols: 40, text: 'UPDATE', frame: 0, fg: FG, bg: BG });
    expect(row(buf, 0, 40).startsWith('UPDATE')).toBe(true);

    // After framesPerStep frames the text has advanced one cell to the left.
    const buf2 = new FrameBuffer(40, 1);
    drawMarquee(buf2, { x: 0, y: 0, cols: 40, text: 'UPDATE', frame: 3, fg: FG, bg: BG });
    expect(row(buf2, 0, 40).startsWith('PDATE')).toBe(true);
  });

  it('is a pure function of the frame counter (deterministic)', () => {
    const a = new FrameBuffer(30, 1);
    const b = new FrameBuffer(30, 1);
    drawMarquee(a, { x: 0, y: 0, cols: 30, text: 'v1.2.3', frame: 17, fg: FG, bg: BG });
    drawMarquee(b, { x: 0, y: 0, cols: 30, text: 'v1.2.3', frame: 17, fg: FG, bg: BG });
    expect(row(a, 0, 30)).toBe(row(b, 0, 30));
  });

  it('loops cleanly — the message re-enters after fully scrolling off', () => {
    const cols = 24;
    const buf = new FrameBuffer(cols, 1);
    // A very large frame still lands within one period (no out-of-range chars).
    drawMarquee(buf, { x: 0, y: 0, cols, text: 'ABC', frame: 99999, fg: FG, bg: BG });
    expect(row(buf, 0, cols).length).toBe(cols);
  });

  it('is a no-op for non-positive widths', () => {
    const buf = new FrameBuffer(10, 1);
    drawMarquee(buf, { x: 0, y: 0, cols: 0, text: 'X', frame: 0, fg: FG, bg: BG });
    expect(row(buf, 0, 10)).toBe(' '.repeat(10));
  });
});
