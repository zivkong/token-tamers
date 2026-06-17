import { describe, it, expect } from 'vitest';
import { resolveSubcellMode } from '../src/services/subcell';

describe('resolveSubcellMode', () => {
  it('passes an explicit preference straight through', () => {
    expect(resolveSubcellMode('octant')).toBe('octant');
    expect(resolveSubcellMode('sextant')).toBe('sextant');
    expect(resolveSubcellMode('half')).toBe('half');
  });

  it('auto resolves to the universally-safe half-block', () => {
    // `auto` never auto-selects octant/sextant: a cursor-width probe can't detect
    // font glyph coverage (the cursor advances by the width table, so an octant
    // measures 1 column whether the terminal draws it or a tofu box). Half-block is
    // the only mode guaranteed to render on every terminal (incl. macOS Terminal.app).
    expect(resolveSubcellMode('auto')).toBe('half');
  });
});
