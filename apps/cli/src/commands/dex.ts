/**
 * `tt dex` — text Dex listing.
 */

import { contentPackV1 } from '@token-tamers/content';
import { catchUp } from '../services/catchup';

type Out = (s: string) => void;

const pack = contentPackV1;

export async function dexCommand(out: Out, now: () => number = Date.now): Promise<void> {
  const { engine } = await catchUp(now);
  const state = engine.state();
  const owned = new Set(state.dexOwned);
  out(`Dex — ${owned.size}/${pack.dexTotal} discovered\n`);
  const byNum = [...pack.species].sort((a, b) => a.num - b.num);
  for (const sp of byNum) {
    const mark = owned.has(sp.id) ? '*' : ' ';
    const num = String(sp.num).padStart(3, '0');
    const name = owned.has(sp.id) ? sp.name : '???';
    out(`  ${mark} #${num} ${name}\n`);
  }
}
