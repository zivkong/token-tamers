/**
 * `tt status` — one-shot text status of the current pet.
 */

import type { GameState } from '@token-tamers/core';
import { contentPackV1 } from '@token-tamers/content';
import { renderStatusLine, renderGradeOddsLine, findSpecies } from '@token-tamers/tui';
import { catchUp } from '../services/catchup';

type Out = (s: string) => void;

const pack = contentPackV1;

function speciesName(state: GameState): string {
  const sp = findSpecies(pack, state.pet.speciesId);
  return sp?.name ?? '???';
}

export async function statusCommand(out: Out, now: () => number = Date.now): Promise<void> {
  const { engine } = await catchUp(now);
  const state = engine.state();
  out(`${renderStatusLine(state, pack)}\n`);
  out(`${renderGradeOddsLine(state)}\n`);

  const pet = state.pet;
  out(
    `species: ${speciesName(state)}  house: ${pet.house}  stage: ${pet.stage}  ` +
      `grade: ${pet.grade}  gen: ${pet.generation}\n`,
  );
  out(
    `stats: pwr ${pet.stats.pwr} spd ${pet.stats.spd} wis ${pet.stats.wis} grt ${pet.stats.grt}\n`,
  );
  if (pet.traits.length > 0) out(`traits: ${pet.traits.join(', ')}\n`);
  if (pet.pattern) out(`pattern: ${pet.pattern}\n`);
  if (pet.dormant) out('status: dormant (no recent usage)\n');
}
