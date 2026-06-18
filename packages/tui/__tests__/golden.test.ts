import { describe, it, expect } from 'vitest';
import { encodeDna, simulateBattle, type Combatant, type DexSnapshot } from '@token-tamers/core';
import { renderFrameToString } from '../src/render/frame';
import type { FrameInput } from '../src/render/frame';
import type { BattleView, ShellInfo, SettingsState } from '../src/pages/types';
import { makePack, makePet, makeState } from './fixtures';

/** A deterministic foreign "wisp" snapshot + its shareable DNA code (same species as the pet). */
const FOREIGN_WISP: DexSnapshot = {
  speciesId: 'wisp',
  stage: 'evolved',
  grade: 'A',
  stats: { pwr: 60, spd: 70, wis: 55, grt: 55 },
  house: 'aether',
  traits: [],
  pattern: null,
  rhythmVariant: null,
  mutations: [],
  generation: 2,
  contentVersion: 1,
  recordedAt: 7000,
  reason: 'molt',
};
const FOREIGN_WISP_CODE = encodeDna(FOREIGN_WISP, { speciesNum: 1 });

/** A deterministic, fully-played battle for the arena golden frames. */
function makeBattleView(): BattleView {
  const left: Combatant = {
    speciesNum: 1,
    speciesId: 'wisp',
    name: 'Wisp',
    house: 'aether',
    grade: 'A',
    stage: 'evolved',
    stats: { pwr: 60, spd: 70, wis: 55, grt: 55 },
    traits: ['sprinter'],
  };
  const right: Combatant = {
    speciesNum: 2,
    speciesId: 'ember',
    name: 'Ember',
    house: 'forge',
    grade: 'B',
    stage: 'evolved',
    stats: { pwr: 65, spd: 50, wis: 50, grt: 75 },
    traits: ['marathoner'],
  };
  const result = simulateBattle(left, right, makePack().battle);
  return { left, right, result, cursor: 0, playing: false };
}

/** A deterministic ShellInfo for the Settings golden frame. */
const TEST_INFO: ShellInfo = {
  version: '0.1.0',
  runtime: 'node v22.11.0',
  fps: 30,
  dataDir: '~/.tokentamers',
};

/**
 * A deterministic editable Settings state: update mode 'notify', the pet-global
 * subscription cycle anchored to claude-code, with the Anchor field focused
 * (index 2 — shown because the policy is subscription and >1 adapter is configured).
 */
const TEST_SETTINGS: SettingsState = {
  updateMode: 'notify',
  cyclePolicy: 'subscription',
  anchorAdapter: 'claude-code',
  adapters: [{ provider: 'claude-code' }, { provider: 'codex' }],
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
    // The Aether sky, its House tabs, the owned Wisp star, and the Mote anchor.
    expect(out).toContain('Aether');
    expect(out).toContain('Wisp');
    expect(out).toContain('Mote');
    expect(out).toMatchSnapshot();
  });

  it('renders a locked star with the "?" focus tile', () => {
    // Forge sky: index 0 is the Mote, index 1 is Ember — which has a record but is
    // not owned, so it reads as undiscovered. Select it to show the "?" tile.
    const out = renderFrameToString(
      100,
      30,
      input({ page: 'dex', ui: { selected: 1, scroll: 0, house: 3 } }),
    );
    expect(out).toContain('Forge');
    expect(out).toContain('???');
    expect(out).toContain('Undiscovered');
    expect(out).toMatchSnapshot();
  });

  it('renders an empty House sky', () => {
    const out = renderFrameToString(
      100,
      30,
      input({ page: 'dex', ui: { selected: 0, scroll: 0, house: 1 } }),
    );
    expect(out).toContain('No stars in this sky yet.');
    expect(out).toMatchSnapshot();
  });

  it('renders the dex without a focus rail on a narrow terminal', () => {
    const out = renderFrameToString(50, 30, input({ page: 'dex' }));
    expect(out).toContain('Aether');
    expect(out).toMatchSnapshot();
  });

  it('renders the archive page', () => {
    const out = renderFrameToString(100, 30, input({ page: 'archive' }));
    expect(out).toMatchSnapshot();
  });

  it('renders the dex detail page for a species record', () => {
    const out = renderFrameToString(
      100,
      30,
      input({ page: 'dex-detail', ui: { selected: 0, scroll: 0, speciesId: 'ember' } }),
    );
    // Name, readiness banner, the shareable DNA code, and the graft tier all show.
    expect(out).toContain('Ember');
    expect(out).toContain('Battle-ready');
    expect(out).toContain('TTX1-');
    expect(out).toContain('Graft small');
    expect(out).toMatchSnapshot();
  });

  it('auto-selects a battle-ready Dex fighter when the live pet is sealed', () => {
    // Default fixture: a sealed (sprite-stage) live pet, but a battle-ready Ember
    // record — so the YOU portrait fields Ember instead of showing the sealed block.
    const out = renderFrameToString(100, 30, input({ page: 'battle' }));
    expect(out).toContain('YOU');
    expect(out).toContain('OPPONENT');
    expect(out).toContain('VS'); // the VS character-select splash
    expect(out).toContain('Ember');
    expect(out).not.toContain('Sealed');
    expect(out).toContain('Paste code'); // the opponent source tabs
    expect(out).toContain('From Dex');
    // No opponent is selected (only Ember exists, the fighter's own species), so the
    // opponent portrait is the "?" tile with this hint under it.
    expect(out).toContain('? choose opponent');
    expect(out).toMatchSnapshot();
  });

  it('renders the fighter selector when more than one fighter is battle-ready', () => {
    // An Evolved live Wisp + the battle-ready Ember record → two candidates, so the
    // bottom "your roster" list appears with the live pet tagged.
    const state = makeState({ pet: makePet({ stage: 'evolved' }) });
    const out = renderFrameToString(
      100,
      30,
      input({
        page: 'battle',
        state,
        ui: { selected: 0, scroll: 0, focus: 'fighter', input: '', fighterSel: 0 },
      }),
    );
    expect(out).toContain('YOUR ROSTER'); // the roster divider label renders ALL-CAPS
    expect(out).toContain('· you'); // the live pet is tagged
    expect(out).toMatchSnapshot();
  });

  it('renders the battle setup previewing the selected Dex record', () => {
    const state = makeState({ pet: makePet({ stage: 'evolved' }) });
    const out = renderFrameToString(
      100,
      30,
      input({ page: 'battle', state, ui: { selected: 0, scroll: 0, focus: 'list', input: '' } }),
    );
    expect(out).toContain('Ember');
    expect(out).toMatchSnapshot();
  });

  it('renders the battle setup previewing a pasted DNA code (same species allowed)', () => {
    const state = makeState({ pet: makePet({ stage: 'evolved' }) });
    const out = renderFrameToString(
      100,
      30,
      input({
        page: 'battle',
        state,
        ui: { selected: 0, scroll: 0, focus: 'input', input: FOREIGN_WISP_CODE },
      }),
    );
    // A foreign wisp code battling your own wisp — a same-species mirror is allowed
    // for a pasted code (it's another player), unlike picking your own Dex record.
    expect(out).toContain('Wisp');
    expect(out).toMatchSnapshot();
  });

  it('renders the battle arena at the start of playback', () => {
    const view = makeBattleView();
    const out = renderFrameToString(100, 30, input({ page: 'battle', battle: view }));
    expect(out).toContain('Wisp');
    expect(out).toContain('Ember');
    expect(out).toContain('HP');
    expect(out).toMatchSnapshot();
  });

  it('renders the battle arena at the end with a winner banner', () => {
    const view = makeBattleView();
    const played: BattleView = { ...view, cursor: view.result.timeline.length };
    const out = renderFrameToString(100, 30, input({ page: 'battle', battle: played }));
    expect(out).toMatch(/wins!|Draw/);
    expect(out).toMatchSnapshot();
  });

  it('renders the settings page with the editable global cycle + anchor', () => {
    const out = renderFrameToString(
      100,
      30,
      input({ page: 'settings', info: TEST_INFO, settings: TEST_SETTINGS }),
    );
    expect(out).toContain('⚙ Settings');
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
          // The open window's food has lifted the C→B forecast above its 25% base.
          nextGrade: { from: 'C', to: 'B', chance: 0.33, capped: false },
        },
      }),
    );
    expect(out).toContain('Food');
    expect(out).toContain('/ 200M');
    expect(out).toContain('molt');
    // The Odds row shows the live, food-boosted current→next forecast.
    expect(out).toContain('Odds');
    expect(out).toContain('33%');
    // Completion is per-page now, so the pet page carries no completion meter.
    expect(out).not.toContain('Progress');
    expect(out).toMatchSnapshot();
  });

  it('renders the Odds row apex state at the S-grade cap', () => {
    const out = renderFrameToString(
      100,
      30,
      input({
        page: 'pet',
        live: {
          windowTokens: 0,
          windowEssence: 0,
          baselineEssence: 0,
          windowsObserved: 0,
          nextGrade: null,
        },
      }),
    );
    expect(out).toContain('apex');
    expect(out).not.toContain('rolls at next molt');
    expect(out).toMatchSnapshot();
  });

  it('renders the Odds row with the A→S cap marked', () => {
    const out = renderFrameToString(
      100,
      30,
      input({
        page: 'pet',
        live: {
          windowTokens: 200_000_000,
          windowEssence: 200_000_000,
          baselineEssence: 24_300,
          windowsObserved: 12,
          nextGrade: { from: 'A', to: 'S', chance: 0.06, capped: true },
        },
      }),
    );
    expect(out).toContain('A');
    expect(out).toContain('6%');
    expect(out).toContain('(capped)');
    expect(out).toMatchSnapshot();
  });

  it('renders the pet page update ticker when an update is available', () => {
    const out = renderFrameToString(
      100,
      30,
      input({
        page: 'pet',
        info: { ...TEST_INFO, updateMode: 'notify', updateAvailable: 'v0.6.0' },
      }),
    );
    // The scrolling ribbon announces the version and points at `tt update`.
    expect(out).toContain('Update available');
    expect(out).toContain('v0.6.0');
    expect(out).toContain('tt update');
    // Golden the full frame so ticker row placement / overrun can't regress silently.
    expect(out).toMatchSnapshot();
  });

  it('adapts the ticker wording for auto mode (restart to apply)', () => {
    const out = renderFrameToString(
      100,
      30,
      input({
        page: 'pet',
        info: { ...TEST_INFO, updateMode: 'auto', updateAvailable: 'v0.6.0' },
      }),
    );
    expect(out).toContain('restart tt to apply');
    expect(out).toMatchSnapshot();
  });

  it('shows no ticker on the pet page when no update is available', () => {
    const out = renderFrameToString(100, 30, input({ page: 'pet', info: TEST_INFO }));
    expect(out).not.toContain('Update available');
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

describe('golden frames — horizontal dock (200x16, no-color)', () => {
  it('renders the pet page side-by-side: 4:3 canvas, chrome column, menu rail', () => {
    const out = renderFrameToString(200, 16, input({ page: 'pet' }));
    // The chrome column carries the identity + live vitals beside the canvas.
    expect(out).toContain('Wisp');
    expect(out).toContain('VITALS');
    expect(out).toContain('Food');
    expect(out).toContain('Odds');
    // The nav menu is present as the right-hand rail.
    expect(out).toContain('Pet');
    expect(out).toContain('Quit');
    expect(out).toMatchSnapshot();
  });

  it('renders the pet page food/odds readout in the horizontal chrome column', () => {
    const out = renderFrameToString(
      200,
      16,
      input({
        page: 'pet',
        live: {
          windowTokens: 84_200_000,
          windowEssence: 90_000_000,
          baselineEssence: 24_300,
          windowsObserved: 6,
          nextGrade: { from: 'C', to: 'B', chance: 0.33, capped: false },
        },
      }),
    );
    expect(out).toContain('/ 200M');
    expect(out).toContain('33%');
    expect(out).toMatchSnapshot();
  });

  it('renders a full-screen page (Dex) into the dock content region with the menu rail', () => {
    const out = renderFrameToString(200, 16, input({ page: 'dex' }));
    expect(out).toContain('Dex');
    expect(out).toContain('Aether');
    expect(out).toContain('Quit'); // the rail still carries nav
    expect(out).toMatchSnapshot();
  });

  it('renders a gradeshift flash along the bottom of the dock content', () => {
    const out = renderFrameToString(
      200,
      16,
      input({ page: 'pet', flash: '✦ Grade up! C → B (35%)' }),
    );
    expect(out).toContain('Grade up');
    expect(out).toMatchSnapshot();
  });
});

describe('golden frames — narrow / floor sizes (regression guards)', () => {
  it('battle arena fits the 90x14 horizontal dock without bleeding into the menu rail', () => {
    const out = renderFrameToString(90, 14, input({ page: 'battle', battle: makeBattleView() }));
    // Both combatants + full HP readouts render, and the rail nav survives intact.
    expect(out).toContain('Wisp');
    expect(out).toContain('Ember');
    expect(out).toContain('Quit');
    expect(out).toMatchSnapshot();
  });

  it('battle arena fits the 80x24 vertical minimum without an edge clip', () => {
    const out = renderFrameToString(80, 24, input({ page: 'battle', battle: makeBattleView() }));
    expect(out).toContain('Wisp');
    expect(out).toContain('Ember');
    expect(out).toMatchSnapshot();
  });

  it('dex focus rail stays clear of the footer at the 90x14 horizontal dock', () => {
    const out = renderFrameToString(90, 14, input({ page: 'dex' }));
    expect(out).toContain('Dex');
    expect(out).toContain('Quit');
    expect(out).toMatchSnapshot();
  });

  it('pet + archive render at the 72x12 horizontal floor without overflow', () => {
    const pet = renderFrameToString(72, 12, input({ page: 'pet' }));
    expect(pet).toContain('Quit');
    expect(pet).toMatchSnapshot();
    const archive = renderFrameToString(72, 12, input({ page: 'archive' }));
    expect(archive).toContain('Quit');
    expect(archive).toMatchSnapshot();
  });

  it('clips the dex focus-rail hint to the rail (no bleed into the menu) at 120x20', () => {
    const out = renderFrameToString(
      120,
      20,
      input({ page: 'dex', ui: { selected: 1, scroll: 0, house: 3 } }),
    );
    expect(out).toContain('Undiscovered'); // hint present (clipped, not overflowing)
    expect(out).toContain('Quit'); // the menu rail is intact, not corrupted
    expect(out).toMatchSnapshot();
  });

  it('dex-detail suppresses cards just below the card-width floor (86x16 = 66 cols)', () => {
    const out = renderFrameToString(
      86,
      16,
      input({ page: 'dex-detail', ui: { selected: 0, scroll: 0, speciesId: 'ember' } }),
    );
    expect(out).toContain('Ember');
    expect(out).not.toContain('TTX'); // no DNA card → no graft bleed into the rail
    expect(out).toContain('Quit');
    expect(out).toMatchSnapshot();
  });

  it('cites the horizontal floor when a wide-but-too-short dock is rejected', () => {
    const out = renderFrameToString(71, 16, input({ page: 'pet' }));
    expect(out).toContain('too small');
    expect(out).toContain('72x12');
  });

  it('dex-detail shows a record + DNA code on a wide-but-short dock (200x16)', () => {
    // The page's purpose — read/copy the DNA — must survive a common bottom dock;
    // the sprite shrinks so at least the best record card fits.
    const out = renderFrameToString(
      200,
      16,
      input({ page: 'dex-detail', ui: { selected: 0, scroll: 0, speciesId: 'ember' } }),
    );
    expect(out).toContain('Ember');
    expect(out).toContain('RECORDS');
    expect(out).toContain('TTX'); // the shareable DNA code is visible
    expect(out).toMatchSnapshot();
  });

  it('dex-detail suppresses records (no rail bleed) on a narrow-tall dock (72x17)', () => {
    const out = renderFrameToString(
      72,
      17,
      input({ page: 'dex-detail', ui: { selected: 0, scroll: 0, speciesId: 'ember' } }),
    );
    expect(out).toContain('Ember');
    expect(out).toContain('Battle-ready');
    // Too narrow for a card → no RECORDS section and no DNA code bleeding right.
    expect(out).not.toContain('RECORDS');
    expect(out).not.toContain('TTX');
    expect(out).toMatchSnapshot();
  });

  it('settings keeps editable fields above the footer at the 72x12 floor (live state)', () => {
    const out = renderFrameToString(
      72,
      12,
      input({ page: 'settings', info: TEST_INFO, settings: TEST_SETTINGS }),
    );
    expect(out).toContain('Settings');
    // The Anchor field would land on the footer row — it must be suppressed, not
    // drawn (and not register a hit) there.
    expect(out).not.toContain('Anchor');
    expect(out).toMatchSnapshot();
  });

  it('battle keeps full HP + no log past the footer at the 72x12 floor', () => {
    const out = renderFrameToString(72, 12, input({ page: 'battle', battle: makeBattleView() }));
    // Full HP denominators present (not clipped to "/29" / "/31").
    expect(out).toContain('/295');
    expect(out).toContain('/315');
    expect(out).toContain('Quit');
    expect(out).toMatchSnapshot();
  });

  it('battle shows full HP at the sprite-threshold width (78x13)', () => {
    const out = renderFrameToString(78, 13, input({ page: 'battle', battle: makeBattleView() }));
    expect(out).toContain('/295');
    expect(out).toContain('/315');
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
