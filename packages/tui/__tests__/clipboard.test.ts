import { describe, it, expect } from 'vitest';
import { FrameBuffer } from '../src/render/buffer';
import { HitRegistry } from '../src/render/hit';
import { renderFrame, type FrameInput } from '../src/render/frame';
import { osc52 } from '../src/terminal/ansi';
import { makePack, makeState } from './fixtures';

describe('osc52 clipboard sequence', () => {
  it('wraps base64 of the text in an OSC 52 set-clipboard sequence', () => {
    const seq = osc52('TTX1-ABCD');
    expect(seq.startsWith('\x1b]52;c;')).toBe(true);
    expect(seq.endsWith('\x07')).toBe(true);
    // Body is standard base64 of the text (matches Node's Buffer encoding).
    expect(seq).toContain(Buffer.from('TTX1-ABCD').toString('base64'));
  });

  it('pads correctly for any input length (no network, pure)', () => {
    expect(osc52('A')).toContain(Buffer.from('A').toString('base64'));
    expect(osc52('AB')).toContain(Buffer.from('AB').toString('base64'));
    expect(osc52('ABC')).toContain(Buffer.from('ABC').toString('base64'));
  });
});

describe('dex-detail DNA code is clickable to copy', () => {
  function input(): FrameInput {
    return {
      page: 'dex-detail',
      state: makeState(),
      pack: makePack(),
      mode: 'none',
      frame: 0,
      ui: { selected: 0, scroll: 0, speciesId: 'ember' },
      completion: { overall: 0, dex: 0, achievements: 0, habitats: 0, trinkets: 0 },
      flash: null,
    };
  }

  it('registers a copy: hit region carrying the compact DNA code', () => {
    const buf = new FrameBuffer(100, 30);
    const hits = new HitRegistry();
    renderFrame(buf, hits, input());

    const copyRegions = hits.list().filter((r) => r.id.startsWith('copy:'));
    expect(copyRegions.length).toBeGreaterThan(0);
    const code = copyRegions[0]!.id.slice('copy:'.length);
    expect(code.startsWith('TTX')).toBe(true);
    // Compact form: only the structural dash after the version remains.
    expect(code.split('-').length).toBe(2);
  });
});
