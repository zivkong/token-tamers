import { describe, it, expect } from 'vitest';
import { HitRegistry } from '../src/render/hit';
import { handleEvent } from '../src/shell-input';
import type { InputEvent } from '../src/terminal/input';
import type { InputDeps, ShellHost, ShellRuntime } from '../src/shell';
import { makeState } from './fixtures';

/** A mouse press at 1-based (col,row) — the SGR convention the decoder emits. */
function press(x: number, y: number): InputEvent {
  return { type: 'mouse', action: 'press', x, y } as unknown as InputEvent;
}

function deps(hits: HitRegistry): InputDeps {
  return {
    host: { getState: () => makeState() } as unknown as ShellHost,
    hits,
    copy: () => {},
  } as unknown as InputDeps;
}

// Mouse parity: every clickable surface must respond to a click, not just keys.
// The mouse handler re-derives layout from the (test-default 80x24) terminal, so
// content-row clicks land clear of the bottom menu band.
describe('mouse interaction parity', () => {
  it('focuses a Settings field when its row is clicked', () => {
    const hits = new HitRegistry();
    hits.add('settings:field:2', 0, 8, 80, 1);
    const rt = {
      page: 'settings',
      battle: undefined,
      settings: { selected: 0 },
      ui: {},
    } as unknown as ShellRuntime;
    handleEvent(rt, press(3, 9), deps(hits)); // cx=2, cy=8 → inside the field region
    expect((rt as unknown as { settings: { selected: number } }).settings.selected).toBe(2);
  });

  it('selects a battle opponent when its picker row is clicked', () => {
    const hits = new HitRegistry();
    hits.add('battle:pick:1', 0, 6, 80, 1);
    const rt = {
      page: 'battle',
      battle: undefined,
      ui: { battle: { selected: 0, scroll: 0 } },
    } as unknown as ShellRuntime;
    handleEvent(rt, press(3, 7), deps(hits)); // cx=2, cy=6
    expect((rt as unknown as { ui: { battle: { selected: number } } }).ui.battle.selected).toBe(1);
  });
});
