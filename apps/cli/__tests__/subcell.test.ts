import { describe, it, expect } from 'vitest';
import { resolveSubcellMode } from '../src/services/subcell';

describe('resolveSubcellMode', () => {
  it('passes a forced preference straight through (no probe)', async () => {
    const never = (): Promise<number | null> => Promise.reject(new Error('should not probe'));
    expect(await resolveSubcellMode('octant', never)).toBe('octant');
    expect(await resolveSubcellMode('sextant', never)).toBe('sextant');
    expect(await resolveSubcellMode('half', never)).toBe('half');
  });

  it('auto picks octant when the octant glyph probes single-width', async () => {
    expect(await resolveSubcellMode('auto', () => Promise.resolve(1))).toBe('octant');
  });

  it('auto steps down to sextant when octant is wide but sextant is single-width', async () => {
    const widths: Record<string, number> = { '\u{1CD00}': 2, '\u{1FB00}': 1 };
    const probe = (g: string): Promise<number | null> => Promise.resolve(widths[g] ?? 2);
    expect(await resolveSubcellMode('auto', probe)).toBe('sextant');
  });

  it('auto falls to half when neither octant nor sextant render single-width', async () => {
    expect(await resolveSubcellMode('auto', () => Promise.resolve(2))).toBe('half');
  });

  it('auto falls back to sextant when the terminal cannot be probed (null)', async () => {
    expect(await resolveSubcellMode('auto', () => Promise.resolve(null))).toBe('sextant');
  });
});
