/**
 * Default stdio/terminal wiring for the shell loop: the real stdout sink, the
 * terminal size probe, alt-screen/raw-mode setup, and the stdin event source.
 * Split out of shell.ts so the loop file stays focused on the simulation/render
 * cadence; tests inject their own fakes and never touch this module.
 */

import { Writer, type OutputSink } from './terminal/ansi';
import { decode, type InputEvent } from './terminal/input';
import type { InputSource } from './shell';

export function stdoutSink(): OutputSink {
  return {
    write(s: string): void {
      process.stdout.write(s);
    },
  };
}

export function defaultSize(): { cols: number; rows: number } {
  return {
    cols: process.stdout.columns ?? 80,
    rows: process.stdout.rows ?? 24,
  };
}

export function defaultSizeSafe(): { cols: number; rows: number } {
  try {
    return defaultSize();
  } catch {
    return { cols: 80, rows: 24 };
  }
}

export function enterTerminal(writer: Writer): () => void {
  writer.enterAltScreen();
  writer.hideCursor();
  writer.enableMouse();
  writer.clearScreen();
  const stdin = process.stdin;
  if (stdin.isTTY && typeof stdin.setRawMode === 'function') {
    stdin.setRawMode(true);
  }
  const onSig = () => {
    writer.restore();
    process.exit(0);
  };
  process.once('SIGINT', onSig);
  process.once('SIGTERM', onSig);
  return () => {
    if (stdin.isTTY && typeof stdin.setRawMode === 'function') {
      stdin.setRawMode(false);
    }
    process.removeListener('SIGINT', onSig);
    process.removeListener('SIGTERM', onSig);
  };
}

export function stdinSource(): InputSource {
  let listener: ((ev: InputEvent) => void) | null = null;
  const onData = (chunk: Buffer | string) => {
    if (!listener) return;
    const events = decode(chunk.toString('utf8'));
    for (const ev of events) listener(ev);
  };
  return {
    onEvent(cb) {
      listener = cb;
      return () => {
        if (listener === cb) listener = null;
      };
    },
    start() {
      process.stdin.resume();
      process.stdin.on('data', onData);
    },
    stop() {
      process.stdin.removeListener('data', onData);
      process.stdin.pause();
    },
  };
}

export function nullSource(): InputSource {
  return {
    onEvent() {
      return () => {};
    },
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
