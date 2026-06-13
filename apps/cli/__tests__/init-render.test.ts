import { describe, it, expect } from 'vitest';
import { parseColorChoice, visibleLen } from '../src/helpers/init-style';
import { renderBanner, renderFirstInitSummary } from '../src/helpers/init-render';

describe('parseColorChoice', () => {
  it('maps the first letter/digit of an answer to a ColorPreference', () => {
    expect(parseColorChoice('a', 'none')).toBe('auto');
    expect(parseColorChoice('true', 'none')).toBe('truecolor');
    expect(parseColorChoice('256', 'auto')).toBe('256');
    expect(parseColorChoice('8', 'auto')).toBe('8');
    expect(parseColorChoice('none', 'auto')).toBe('none');
  });

  it('keeps the current value on an empty or unknown answer', () => {
    expect(parseColorChoice('', 'truecolor')).toBe('truecolor');
    expect(parseColorChoice('   ', '256')).toBe('256');
    expect(parseColorChoice('zzz', 'auto')).toBe('auto');
  });
});

describe('renderFirstInitSummary (plain)', () => {
  const summary = (windows: number) =>
    renderFirstInitSummary(
      { eventCount: 128, windowsObserved: windows, dataDir: '~/.tokentamers' },
      false,
    );

  it('keeps the phrases the wizard and tests rely on', () => {
    const out = summary(6);
    expect(out).toContain('Calibration Egg');
    expect(out).toContain('Established a baseline from 6 closed session windows');
    expect(out).toContain('~/.tokentamers');
  });

  it('omits the baseline line when no windows closed', () => {
    expect(summary(0)).not.toContain('Established a baseline');
  });
});

/** Pull the box rows (border + content) out of a styled block. */
function boxRows(block: string): string[] {
  return block.split('\n').filter((l) => /[╭│╰]/.test(l));
}

describe('styled box alignment (ANSI-width-aware)', () => {
  it('renders the banner box with a uniform visible width', () => {
    const rows = boxRows(renderBanner(true));
    const widths = rows.map((r) => visibleLen(r));
    expect(new Set(widths).size).toBe(1);
  });

  it('renders the summary box with a uniform visible width', () => {
    const block = renderFirstInitSummary(
      { eventCount: 128, windowsObserved: 6, dataDir: '~/.tokentamers' },
      true,
    );
    // The egg art (~7 cols) also matches [╭│╰]; keep only the wide framed box.
    const rows = boxRows(block).filter((r) => visibleLen(r) > 15);
    expect(rows.length).toBeGreaterThanOrEqual(6);
    const widths = rows.map((r) => visibleLen(r));
    expect(new Set(widths).size).toBe(1);
  });
});
