import { describe, it, expect } from 'vitest';
import { progressBar, renderGradeOddsLine, renderStatusLine } from '../src/helpers/status';
import { makePack, makeState, makePet } from './fixtures';

describe('status line', () => {
  it('renders the compact one-liner', () => {
    const line = renderStatusLine(makeState(), makePack());
    expect(line).toContain('Wisp');
    expect(line).toContain('[C]○');
    expect(line).toContain('molt 3');
  });

  it('uses the calibrating word for calibration eggs', () => {
    const state = makeState({ pet: makePet({ calibrating: true }) });
    const line = renderStatusLine(state, makePack());
    expect(line).toContain('calibrating');
  });

  it('uses an explicit progress fraction when provided', () => {
    const line = renderStatusLine(makeState(), makePack(), 1);
    expect(line).toContain('▓▓▓▓');
  });

  it('shows the last grade-roll odds', () => {
    const line = renderGradeOddsLine(makeState());
    expect(line).toContain('C→B');
    expect(line).toContain('35%');
  });
});

describe('progressBar', () => {
  it('clamps and fills proportionally', () => {
    expect(progressBar(0, 4)).toBe('░░░░');
    expect(progressBar(1, 4)).toBe('▓▓▓▓');
    expect(progressBar(0.5, 4)).toBe('▓▓░░');
    expect(progressBar(2, 4)).toBe('▓▓▓▓');
  });
});
