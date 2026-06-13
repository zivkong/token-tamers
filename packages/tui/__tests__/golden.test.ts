import { describe, it, expect } from 'vitest';
import { renderFrameToString } from '../src/render/frame';
import type { FrameInput } from '../src/render/frame';
import type { ShellInfo, SettingsState } from '../src/pages/types';
import { makePack, makeState } from './fixtures';

/** A deterministic ShellInfo for the Settings golden frame. */
const TEST_INFO: ShellInfo = {
  version: '0.1.0',
  runtime: 'node v22.11.0',
  fps: 30,
  dataDir: '~/.tokentamers',
};

/** A deterministic editable adapter state, second adapter's plan focused. */
const TEST_SETTINGS: SettingsState = {
  adapters: [
    { provider: 'claude-code', plan: 'subscription', policy: 'dynamic' },
    { provider: 'codex', plan: 'api', policy: 'static' },
  ],
  selected: 2,
};

function input(over: Partial<FrameInput>): FrameInput {
  return {
    page: 'pet',
    state: makeState(),
    pack: makePack(),
    mode: 'none',
    frame: 0,
    ui: { selected: 0, scroll: 0 },
    completionPct: 42.5,
    flash: null,
    ...over,
  };
}

describe('golden frames (100x30, no-color)', () => {
  it('renders the pet page', () => {
    const out = renderFrameToString(100, 30, input({ page: 'pet' }));
    expect(out).toMatchSnapshot();
  });

  it('renders the dex page', () => {
    const out = renderFrameToString(100, 30, input({ page: 'dex' }));
    expect(out).toMatchSnapshot();
  });

  it('renders the archive page', () => {
    const out = renderFrameToString(100, 30, input({ page: 'archive' }));
    expect(out).toMatchSnapshot();
  });

  it('renders the settings page with editable adapters', () => {
    const out = renderFrameToString(
      100,
      30,
      input({ page: 'settings', info: TEST_INFO, settings: TEST_SETTINGS }),
    );
    expect(out).toContain('SETTINGS');
    expect(out).toContain('v0.1.0');
    expect(out).toContain('claude-code');
    expect(out).toContain('codex');
    expect(out).toContain('subscription');
    expect(out).toContain('change');
    expect(out).not.toContain('zero network');
    expect(out).toMatchSnapshot();
  });

  it('renders the pet page with a real-time charge readout (FOMO)', () => {
    const out = renderFrameToString(
      100,
      30,
      input({
        page: 'pet',
        live: {
          windowTokens: 84_200_000,
          windowEssence: 90_000_000,
          baselineEssence: 24_300,
          windowsObserved: 6,
        },
      }),
    );
    expect(out).toContain('Charge');
    expect(out).toContain('/ 200M');
    expect(out).toContain('molt');
    expect(out).toContain('Progress'); // completion meter moved into VITALS
    expect(out).toMatchSnapshot();
  });

  it('renders a gradeshift flash banner', () => {
    const out = renderFrameToString(
      100,
      30,
      input({ page: 'pet', flash: '✦ Grade up! C → B (35%)' }),
    );
    expect(out).toContain('Grade up');
    expect(out).toMatchSnapshot();
  });

  it('renders the too-small message', () => {
    const out = renderFrameToString(40, 12, input({ page: 'pet' }));
    expect(out).toContain('too small');
    expect(out).toMatchSnapshot();
  });
});

describe('menu + completion meter', () => {
  it('shows all nav items in the menu and the completion percent in VITALS', () => {
    const out = renderFrameToString(100, 30, input({ page: 'pet', completionPct: 12.3 }));
    expect(out).toContain('Pet');
    expect(out).toContain('Dex');
    expect(out).toContain('Archive');
    expect(out).toContain('Settings');
    expect(out).toContain('Quit');
    // The completion meter now lives in the pet VITALS panel, not the menu.
    expect(out).toContain('Progress');
    expect(out).toContain('12.3%');
  });
});
