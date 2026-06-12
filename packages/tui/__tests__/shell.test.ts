import { describe, it, expect } from 'vitest';
import { runShell, type InputSource, type ShellHost } from '../src/shell';
import { StringSink } from '../src/terminal/ansi';
import type { InputEvent } from '../src/terminal/input';
import { makePack, makeState } from './fixtures';
import type { GameEffect } from '@token-tamers/core';

function makeHost(effectsByCall: GameEffect[][] = []): ShellHost & { calls: number } {
  let calls = 0;
  return {
    pack: makePack(),
    getState: () => makeState(),
    advance(_now: number): GameEffect[] {
      const e = effectsByCall[calls] ?? [];
      calls++;
      return e;
    },
    completion: () => ({ overall: 50 }),
    get calls() {
      return calls;
    },
  };
}

/** A manual input source the test can push events into. */
function manualInput(): InputSource & { push: (ev: InputEvent) => void } {
  let cb: ((ev: InputEvent) => void) | null = null;
  return {
    onEvent(fn) {
      cb = fn;
      return () => {
        cb = null;
      };
    },
    push(ev) {
      cb?.(ev);
    },
  };
}

/** A clock that ticks a fixed amount each read. */
function steppedClock(stepMs: number): () => number {
  let t = 0;
  return () => {
    const cur = t;
    t += stepMs;
    return cur;
  };
}

describe('runShell loop', () => {
  it('renders frames and advances the sim, then quits on maxFrames', async () => {
    const sink = new StringSink();
    const host = makeHost();
    await runShell({
      host,
      color: 'none',
      now: steppedClock(600), // each read jumps 600ms so the sim advances fast
      out: sink,
      input: manualInput(),
      size: () => ({ cols: 100, rows: 30 }),
      manageTerminal: false,
      maxFrames: 8,
    });
    // Something was rendered.
    expect(sink.toString().length).toBeGreaterThan(0);
    // Sim advanced at least once (>=1s of stepped time elapsed).
    expect(host.calls).toBeGreaterThanOrEqual(1);
  });

  it('quits when the q key is pressed', async () => {
    const input = manualInput();
    const host = makeHost();
    // Push 'q' shortly after start.
    setTimeout(() => input.push({ type: 'key', name: 'q' }), 5);
    const sink = new StringSink();
    await runShell({
      host,
      color: 'none',
      now: steppedClock(40),
      out: sink,
      input,
      size: () => ({ cols: 100, rows: 30 }),
      manageTerminal: false,
      // No maxFrames: relies on the q to terminate.
    });
    expect(sink.toString().length).toBeGreaterThan(0);
  });

  it('switches pages on hotkeys', async () => {
    const input = manualInput();
    const host = makeHost();
    const sink = new StringSink();
    // runShell registers its listener synchronously before its first await,
    // so we can push the hotkey right after starting it.
    const done = runShell({
      host,
      color: 'none',
      now: steppedClock(40),
      out: sink,
      input,
      size: () => ({ cols: 100, rows: 30 }),
      manageTerminal: false,
      maxFrames: 3,
    });
    input.push({ type: 'key', name: '2' }); // dex
    await done;
    // The dex header should appear in the captured output.
    expect(sink.toString()).toContain('☰ Dex');
  });
});
