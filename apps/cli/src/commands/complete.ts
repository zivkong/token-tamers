/**
 * `tt complete` — completion meter breakdown.
 */

import { catchUp } from '../services/catchup';

type Out = (s: string) => void;

export async function completeCommand(out: Out, now: () => number = Date.now): Promise<void> {
  const { engine } = await catchUp(now);
  const c = engine.completion();
  const line = (label: string, pct: number) => `  ${label.padEnd(12)} ${Math.round(pct)}%\n`;
  out('Completion\n');
  out(line('overall', c.overall));
  out(line('dex', c.dex));
  out(line('achievements', c.achievements));
  out(line('habitats', c.habitats));
  out(line('trinkets', c.trinkets));
}
