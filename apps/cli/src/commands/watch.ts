/**
 * `tt watch` — a slim live loop. Prints the status line every few seconds; no
 * alt screen, no raw mode. Ctrl-C (SIGINT) exits cleanly. Returns a stop fn
 * (used by tests to cancel the interval).
 */

import { contentPackV1 } from '@token-tamers/content';
import type { Engine } from '@token-tamers/core';
import { renderStatusLine } from '@token-tamers/tui';
import { catchUp } from '../services/catchup';

type Out = (s: string) => void;

const pack = contentPackV1;

export function watchCommand(
  out: Out,
  now: () => number = Date.now,
  intervalMs = 3000,
): { stop: () => void } {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      const { engine }: { engine: Engine } = await catchUp(now);
      out(`\r${renderStatusLine(engine.state(), pack)}`);
    } catch {
      out('\rrun `tt init` first');
    }
    if (!stopped) timer = setTimeout(() => void tick(), intervalMs);
  };

  void tick();

  const stop = (): void => {
    stopped = true;
    if (timer) clearTimeout(timer);
    out('\n');
  };

  const onSig = (): void => {
    stop();
    process.exit(0);
  };
  process.once('SIGINT', onSig);

  return { stop };
}
