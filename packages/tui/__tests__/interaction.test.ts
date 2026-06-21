import { describe, it, expect } from 'vitest';
import { HitRegistry } from '../src/render/hit';
import { handleEvent } from '../src/shell-input';
import type { InputEvent } from '../src/terminal/input';
import type { InputDeps, ShellHost, ShellRuntime } from '../src/shell';
import { makeState, makePack, makePet } from './fixtures';

/** A mouse press at 1-based (col,row) — the SGR convention the decoder emits. */
function press(x: number, y: number): InputEvent {
  return { type: 'mouse', action: 'press', x, y } as unknown as InputEvent;
}

/** A key event the way the decoder emits it. */
function key(name: string): InputEvent {
  return { type: 'key', name } as unknown as InputEvent;
}

function deps(hits: HitRegistry, host?: Partial<ShellHost>): InputDeps {
  return {
    host: { getState: () => makeState(), pack: makePack(), ...host } as unknown as ShellHost,
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

  it('wipes the pasted opponent code when the [✕] clear button is clicked', () => {
    const hits = new HitRegistry();
    hits.add('battle:clear', 0, 6, 3, 1);
    const rt = {
      page: 'battle',
      battle: undefined,
      ui: { battle: { selected: 0, scroll: 0, input: 'TTX1-ABCD', focus: 'list' } },
    } as unknown as ShellRuntime;
    handleEvent(rt, press(1, 7), deps(hits)); // cx=0, cy=6
    const ui = (rt as unknown as { ui: { battle: { input: string; focus: string } } }).ui.battle;
    expect(ui.input).toBe('');
    expect(ui.focus).toBe('input');
  });
});

describe('Apex "Reborn Now" confirm modal', () => {
  function apexHost(grade: 'A' | 'S', calls: { n: number }): Partial<ShellHost> {
    return {
      getState: () => makeState({ pet: makePet({ stage: 'apex', grade }) }),
      rebornNow: () => {
        calls.n += 1;
        return [];
      },
    };
  }
  function petRt(): ShellRuntime {
    return {
      page: 'pet',
      frame: 0,
      flash: null,
      flashUntilFrame: 0,
      ui: { pet: { selected: 0, scroll: 0 } },
    } as unknown as ShellRuntime;
  }
  const modalOf = (rt: ShellRuntime) =>
    (rt as unknown as { modal?: { view: { tone: string; lines: string[]; focus: string } } }).modal
      ?.view;

  it('opens a WARNING modal (not an instant rebirth) for a non-S Apex', () => {
    const calls = { n: 0 };
    const rt = petRt();
    handleEvent(rt, key('enter'), deps(new HitRegistry(), apexHost('A', calls)));
    expect(calls.n).toBe(0); // nothing happens until the player confirms
    const m = modalOf(rt);
    expect(m?.tone).toBe('warning');
    expect(m?.focus).toBe('cancel'); // safe default — Enter would cancel
    expect(m?.lines.join(' ')).toContain('roll higher'); // clear grade-roll warning
  });

  it('confirms via the modal (focus → confirm, Enter) and clears it', () => {
    const calls = { n: 0 };
    const rt = petRt();
    const d = deps(new HitRegistry(), apexHost('A', calls));
    handleEvent(rt, key('enter'), d); // open
    handleEvent(rt, key('right'), d); // move focus Cancel → Confirm
    handleEvent(rt, key('enter'), d); // activate Confirm
    expect(calls.n).toBe(1);
    expect(modalOf(rt)).toBeUndefined();
  });

  it("the 'y' shortcut confirms; Esc cancels without reborning", () => {
    const yes = { n: 0 };
    const rtY = petRt();
    const dY = deps(new HitRegistry(), apexHost('A', yes));
    handleEvent(rtY, key('enter'), dY);
    handleEvent(rtY, key('y'), dY);
    expect(yes.n).toBe(1);

    const no = { n: 0 };
    const rtN = petRt();
    const dN = deps(new HitRegistry(), apexHost('A', no));
    handleEvent(rtN, key('enter'), dN);
    handleEvent(rtN, key('escape'), dN);
    expect(no.n).toBe(0);
    expect(modalOf(rtN)).toBeUndefined();
  });

  it('an S Apex still confirms via a modal, but with no grade warning', () => {
    const calls = { n: 0 };
    const rt = petRt();
    handleEvent(rt, key('enter'), deps(new HitRegistry(), apexHost('S', calls)));
    expect(calls.n).toBe(0);
    expect(modalOf(rt)?.tone).toBe('info');
    expect(modalOf(rt)?.lines.join(' ')).not.toContain('roll higher');
  });

  it('opens from a click on the button, then confirms from a click on Confirm', () => {
    const calls = { n: 0 };
    const hits = new HitRegistry();
    hits.add('pet:reborn-now', 0, 6, 20, 1);
    const rt = petRt();
    const d = deps(hits, apexHost('A', calls));
    handleEvent(rt, press(3, 7), d); // cx=2, cy=6 → opens the modal
    expect(calls.n).toBe(0);
    expect(modalOf(rt)).toBeDefined();
    hits.add('modal:confirm', 10, 12, 14, 1); // the rendered Confirm button region
    handleEvent(rt, press(12, 13), d); // cx=11, cy=12 → inside Confirm
    expect(calls.n).toBe(1);
    expect(modalOf(rt)).toBeUndefined();
  });
});

describe('Dex focuses the live pet on navigation', () => {
  it("opens the pet's House sky and selects its star (key 2)", () => {
    // Default fixture pet is Wisp (House aether). Start the Dex parked elsewhere.
    const rt = {
      page: 'pet',
      battle: undefined,
      ui: { dex: { house: 3, selected: 0 } },
    } as unknown as ShellRuntime;
    handleEvent(rt, key('2'), deps(new HitRegistry()));
    const ui = (rt as unknown as { ui: { dex: { house: number; selected: number } } }).ui.dex;
    expect(rt.page).toBe('dex');
    expect(ui.house).toBe(0); // aether
    // nodes sorted tier-asc: [Mote(egg), Wisp(sprite)] → Wisp is index 1.
    expect(ui.selected).toBe(1);
  });
});
