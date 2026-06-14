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
    completion: { overall: 42.5, dex: 30, achievements: 50, habitats: 10, trinkets: 0 },
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

  it('renders the pet page with a real-time food readout (growth)', () => {
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
    expect(out).toContain('Food');
    expect(out).toContain('/ 200M');
    expect(out).toContain('molt');
    // Completion is per-page now, so the pet page carries no completion meter.
    expect(out).not.toContain('Progress');
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

describe('menu + per-page completion', () => {
  it('shows all nav items in the menu on every page', () => {
    const out = renderFrameToString(100, 30, input({ page: 'pet' }));
    expect(out).toContain('Pet');
    expect(out).toContain('Dex');
    expect(out).toContain('Archive');
    expect(out).toContain('Settings');
    expect(out).toContain('Quit');
  });

  it('shows the completion percent on its OWN page, not the pet page', () => {
    const completion = { overall: 50, dex: 12.3, achievements: 0, habitats: 0, trinkets: 0 };
    // Dex page surfaces its own collection percent...
    const dex = renderFrameToString(100, 30, input({ page: 'dex', completion }));
    expect(dex).toContain('12.3%');
    // ...and the pet page no longer carries a completion meter.
    const pet = renderFrameToString(100, 30, input({ page: 'pet', completion }));
    expect(pet).not.toContain('Progress');
    expect(pet).not.toContain('12.3%');
  });
});
