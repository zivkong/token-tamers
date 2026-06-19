/**
 * `tt tamer [name]` — show or set your Tamer handle.
 *
 * No args: print the current handle, worn title, and the titles you've earned.
 * With args: set the handle (sanitized + capped) and persist it to config.json.
 * The handle is the maker's-mark stamped into every DNA code this install breeds.
 * Titles are CHOSEN from earned ones in the TUI Settings page (a pick-list), so
 * the CLI only displays them here.
 */

import { earnedTitles, sanitizeTamerName, TAMER_NAME_MAX } from '@token-tamers/core';
import { contentPackV1 } from '@token-tamers/content';
import { catchUp } from '../services/catchup';
import { saveConfig } from '../stores';

type Out = (s: string) => void;

export async function tamerCommand(
  rest: string[],
  out: Out,
  now: () => number = Date.now,
): Promise<void> {
  const { config, engine } = await catchUp(now);
  const newName = rest.join(' ').trim();
  if (newName) {
    const tamer = sanitizeTamerName(newName, TAMER_NAME_MAX);
    saveConfig({ ...config, tamer });
    out(`Tamer set to ${tamer || '— anonymous'}.\n`);
    return;
  }
  const titles = earnedTitles(engine.state(), contentPackV1);
  out('Tamer\n');
  out(`  handle   ${config.tamer || '— anonymous (set with `tt tamer <name>`)'}\n`);
  out(`  title    ${config.tamerTitle || '— none (choose an earned title in Settings)'}\n`);
  out(`  earned   ${titles.length ? titles.join(', ') : '— none yet'}\n`);
}
