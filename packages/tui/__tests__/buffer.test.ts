import { describe, it, expect } from 'vitest';
import { FrameBuffer } from '../src/render/buffer';
import { StringSink, Writer } from '../src/terminal/ansi';

function makeWriter() {
  const sink = new StringSink();
  return { sink, writer: new Writer(sink, 'truecolor') };
}

// CSI cursor-move matcher, built without an embedded control char so eslint's
// no-control-regex stays happy. Matches '[<row>;<col>H' (the ESC byte is the
// char just before '[' in the real stream; we only count the bracket form).
const MOVE_RE = new RegExp('\\[[0-9]+;[0-9]+H', 'g');

describe('FrameBuffer diff flush', () => {
  it('emits bytes on first flush (full paint)', () => {
    const { sink, writer } = makeWriter();
    const buf = new FrameBuffer(10, 3);
    buf.clear();
    buf.text(0, 0, 'hi');
    const out = buf.flush(writer);
    expect(out.length).toBeGreaterThan(0);
    expect(sink.toString()).toBe(out);
    expect(out).toContain('h');
  });

  it('second flush of an identical frame emits zero bytes', () => {
    const { writer } = makeWriter();
    const buf = new FrameBuffer(20, 5);
    buf.clear();
    buf.text(2, 2, 'stable');
    buf.flush(writer);

    // Redraw the exact same content.
    buf.clear();
    buf.text(2, 2, 'stable');
    const second = buf.flush(writer);
    expect(second).toBe('');
  });

  it('only changed cells are emitted on a partial update', () => {
    const { writer } = makeWriter();
    const buf = new FrameBuffer(20, 2);
    buf.clear();
    buf.text(0, 0, 'aaaaa');
    buf.flush(writer);

    buf.clear();
    buf.text(0, 0, 'aaXaa'); // only index 2 changed
    const out = buf.flush(writer);
    expect(out).toContain('X');
    // Should not repaint the whole row; 'a' runs untouched stay out.
    expect(out.length).toBeLessThan(20);
  });

  it('coalesces a run of same-color changed cells into one move', () => {
    const { writer } = makeWriter();
    const buf = new FrameBuffer(20, 1);
    buf.clear();
    buf.text(3, 0, 'hello', { r: 255, g: 0, b: 0 });
    const out = buf.flush(writer);
    const moves = out.match(MOVE_RE) ?? [];
    expect(moves.length).toBe(1);
  });

  it('emits the bold SGR for bold text in a color mode', () => {
    const { writer } = makeWriter();
    const buf = new FrameBuffer(20, 1);
    buf.clear();
    buf.textBold(0, 0, 'NAME', { r: 74, g: 222, b: 128 });
    const out = buf.flush(writer);
    expect(out).toContain('[1m'); // bold on
    expect(out).toContain('NAME');
  });

  it('omits the bold SGR in monochrome mode', () => {
    const sink = new StringSink();
    const writer = new Writer(sink, 'none');
    const buf = new FrameBuffer(20, 1);
    buf.clear();
    buf.textBold(0, 0, 'NAME', { r: 74, g: 222, b: 128 });
    const out = buf.flush(writer);
    expect(out).not.toContain('[1m');
    expect(out).toContain('NAME');
  });

  it('treats a bold change as a dirty cell on re-flush', () => {
    const { writer } = makeWriter();
    const buf = new FrameBuffer(20, 1);
    buf.clear();
    buf.text(0, 0, 'A', { r: 200, g: 200, b: 200 });
    buf.flush(writer);
    buf.clear();
    buf.textBold(0, 0, 'A', { r: 200, g: 200, b: 200 }); // same char/color, now bold
    const out = buf.flush(writer);
    expect(out).toContain('[1m');
  });
});
