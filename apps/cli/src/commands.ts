/**
 * One-shot text commands: status, dex, archive, complete, adapters, watch.
 *
 * These are deliberately plain-text (reusing tui status helpers where they
 * exist) so they work in pipes, statuslines, and CI. Each loads + catches the
 * pet up before printing.
 */

import { adapters as allAdapters } from '@token-tamers/adapters';
import { contentPackV1 } from '@token-tamers/content';
import type { Engine, GameState } from '@token-tamers/core';
import { renderStatusLine, renderGradeOddsLine, findSpecies } from '@token-tamers/tui';
import { catchUp } from './catchup';

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

export async function archiveCommand(out: Out, now: () => number = Date.now): Promise<void> {
  const { engine } = await catchUp(now);
  const state = engine.state();
  if (state.archive.length === 0) {
    out('Archive is empty — no past lives recorded yet.\n');
    return;
  }
  out(`Archive — ${state.archive.length} record${state.archive.length === 1 ? '' : 's'}\n`);
  for (const rec of state.archive) {
    const sp = findSpecies(pack, rec.speciesId);
    const name = sp?.name ?? '???';
    out(
      `  gen ${rec.generation}  ${name} [${rec.grade}]  ` +
        `pwr ${rec.stats.pwr} spd ${rec.stats.spd} wis ${rec.stats.wis} grt ${rec.stats.grt}\n`,
    );
  }
}

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

export async function adaptersCommand(out: Out): Promise<void> {
  out('Adapters\n');
  for (const adapter of allAdapters) {
    const detection = await adapter.detect();
    const mark = detection.installed ? 'ok' : '--';
    out(`  [${mark}] ${adapter.displayName} (${adapter.id})\n`);
    if (detection.paths.length > 0) out(`        paths: ${detection.paths.join(', ')}\n`);
    for (const w of detection.warnings) out(`        ! ${w}\n`);
  }
}

/**
 * `tt watch` — a slim live loop. Prints the status line every few seconds; no
 * alt screen, no raw mode. Ctrl-C (SIGINT) exits cleanly. Returns a stop fn
 * (used by tests to cancel the interval).
 */
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
