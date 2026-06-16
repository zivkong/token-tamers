import { describe, it, expect } from 'vitest';
import {
  parseAnchorChoice,
  parseColorChoice,
  parseCycleChoice,
  parseUpdateChoice,
  visibleLen,
} from '../src/helpers/init-style';
import {
  renderBanner,
  renderFirstInitSummary,
  renderUpdateChoice,
} from '../src/helpers/init-render';

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

describe('parseUpdateChoice', () => {
  it('maps the first letter of an answer to an UpdateMode', () => {
    expect(parseUpdateChoice('o', 'auto')).toBe('off');
    expect(parseUpdateChoice('notify', 'off')).toBe('notify');
    expect(parseUpdateChoice('auto', 'off')).toBe('auto');
  });

  it('keeps the current value on an empty or unknown answer (off stays the default)', () => {
    expect(parseUpdateChoice('', 'off')).toBe('off');
    expect(parseUpdateChoice('   ', 'notify')).toBe('notify');
    expect(parseUpdateChoice('zzz', 'off')).toBe('off');
  });
});

describe('parseCycleChoice', () => {
  it('maps the single-key shortcuts (s = subscription, a = static)', () => {
    expect(parseCycleChoice('s', 'static')).toBe('subscription');
    expect(parseCycleChoice('a', 'subscription')).toBe('static');
  });

  it('matches the full word so typing it never lands on the opposite policy', () => {
    // Regression: 'static' starts with 's' but must NOT resolve to subscription.
    expect(parseCycleChoice('static', 'subscription')).toBe('static');
    expect(parseCycleChoice('Static', 'subscription')).toBe('static');
    expect(parseCycleChoice('subscription', 'static')).toBe('subscription');
  });

  it('keeps the fallback on an empty or unknown answer', () => {
    expect(parseCycleChoice('', 'subscription')).toBe('subscription');
    expect(parseCycleChoice('   ', 'static')).toBe('static');
    expect(parseCycleChoice('zzz', 'static')).toBe('static');
  });
});

describe('parseAnchorChoice', () => {
  const ids = ['claude-code', 'opencode', 'codex'];

  it('maps a 1-based index to the matching adapter id', () => {
    expect(parseAnchorChoice('1', ids)).toBe('claude-code');
    expect(parseAnchorChoice('2', ids)).toBe('opencode');
    expect(parseAnchorChoice('3', ids)).toBe('codex');
  });

  it('falls back to the first adapter on out-of-range / non-numeric / empty input', () => {
    expect(parseAnchorChoice('0', ids)).toBe('claude-code');
    expect(parseAnchorChoice('4', ids)).toBe('claude-code');
    expect(parseAnchorChoice('x', ids)).toBe('claude-code');
    expect(parseAnchorChoice('', ids)).toBe('claude-code');
  });
});

describe('renderUpdateChoice (plain)', () => {
  it('notes the change and the apply-on-next-launch timing when the mode changes', () => {
    const out = renderUpdateChoice('auto', true, false);
    expect(out).toContain('auto');
    expect(out).toContain('next launch');
  });

  it('reports the unchanged mode without a change marker', () => {
    expect(renderUpdateChoice('off', false, false)).toContain('off');
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
