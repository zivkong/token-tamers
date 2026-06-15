/**
 * `tt archive` — text Archive (best-record) listing.
 */

import { bestSpeciesRecords } from '@token-tamers/core';
import { contentPackV1 } from '@token-tamers/content';
import { findSpecies } from '@token-tamers/tui';
import { catchUp } from '../services/catchup';

type Out = (s: string) => void;

const pack = contentPackV1;

export async function archiveCommand(out: Out, now: () => number = Date.now): Promise<void> {
  const { engine } = await catchUp(now);
  const state = engine.state();
  // Best record per species, derived from the unified Dex record store.
  const records = bestSpeciesRecords(state.dexRecords);
  if (records.length === 0) {
    out('Archive is empty — no past lives recorded yet.\n');
    return;
  }
  out(`Archive — ${records.length} record${records.length === 1 ? '' : 's'}\n`);
  for (const rec of records) {
    const sp = findSpecies(pack, rec.speciesId);
    const name = sp?.name ?? '???';
    out(
      `  gen ${rec.generation}  ${name} [${rec.grade}]  ` +
        `pwr ${rec.stats.pwr} spd ${rec.stats.spd} wis ${rec.stats.wis} grt ${rec.stats.grt}\n`,
    );
  }
}
