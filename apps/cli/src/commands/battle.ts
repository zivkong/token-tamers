/**
 * `tt battle [code]` — battle the live pet against an Archive record or a pasted
 * DNA code. Interactive (a TTY) opens the Battle page; non-interactive (a pipe,
 * or `--text`) prints a deterministic text summary.
 *
 * Battle is read-only (invariants 1 & 3): it decodes a DNA snapshot and simulates
 * combat without ever mutating the pet, its grade, or the Dex. Both sides must
 * have reached the Evolved readiness gate.
 */

import {
  bestSpeciesRecords,
  combatantFromDecoded,
  decodeDna,
  isBattleReady,
  sameSpecies,
  simulateBattle,
  type BattleResult,
  type Combatant,
  type ContentPack,
  type GameState,
} from '@token-tamers/core';
import { contentPackV1 } from '@token-tamers/content';
import { hpAt, opponentCombatant, playerCombatant, type BattleView } from '@token-tamers/tui';
import { catchUp } from '../services/catchup';
import { launchShell } from './shell';

type Out = (s: string) => void;

export interface BattleOptions {
  /** A pasted DNA code, or undefined to use the best Archive record. */
  code?: string;
  /** Force the text summary even on a TTY. */
  text: boolean;
  noColor: boolean;
}

/** Resolve the opponent combatant, printing the reason and returning undefined on failure. */
function resolveOpponent(
  pack: ContentPack,
  state: GameState,
  code: string | undefined,
  out: Out,
): Combatant | undefined {
  if (code) {
    const decoded = decodeDna(code);
    if (!decoded.sigValid) {
      out('Note: that DNA code failed its integrity check — battling the recovered fields.\n');
    }
    // A pasted code is ANOTHER player — a same-species mirror match is allowed here.
    const name = pack.species.find((s) => s.num === decoded.speciesNum)?.name ?? '???';
    const opp = combatantFromDecoded(decoded, name);
    if (!isBattleReady(opp)) {
      out('That code is sealed — its pet has not reached the Evolved stage.\n');
      return undefined;
    }
    return opp;
  }
  // No code ⇒ a SELF opponent (your own Archive). A mirror match (same species as
  // the live pet) is forbidden — pick your best battle-ready record of a DIFFERENT species.
  const best = bestSpeciesRecords(state.dexRecords).find(
    (s) => isBattleReady(s) && !sameSpecies(state.pet, s),
  );
  if (!best) {
    out(
      'No battle-ready opponent of a different species — paste a friend’s DNA code (`tt battle <code>`) or raise another species to Evolved.\n',
    );
    return undefined;
  }
  return opponentCombatant(pack, best);
}

/** Final HP for a side once the whole timeline has played out. */
function finalHp(view: BattleView, side: 'a' | 'b'): number {
  return hpAt({ ...view, cursor: view.result.timeline.length }, side);
}

/** A compact, deterministic text summary of a resolved battle. */
function renderSummary(left: Combatant, right: Combatant, result: BattleResult): string {
  const view: BattleView = { left, right, result, cursor: result.timeline.length, playing: false };
  const turns = result.timeline.length ? result.timeline[result.timeline.length - 1]!.turn + 1 : 0;
  const blows = result.timeline.filter((e) => e.kind !== 'faint').length;
  const banner =
    result.winner === 'draw'
      ? '⚖  Draw'
      : `★  ${(result.winner === 'a' ? left : right).name} wins!`;
  return [
    `⚔  ${left.name} [${left.grade}]  vs  ${right.name} [${right.grade}]`,
    `   ${left.house} House  ·  ${right.house} House`,
    `   ${turns} turns, ${blows} blows`,
    `${banner}   (HP ${finalHp(view, 'a')}/${result.startHp.a}  —  ${finalHp(view, 'b')}/${result.startHp.b})`,
    '',
  ].join('\n');
}

export async function battleCommand(
  opts: BattleOptions,
  out: Out,
  now: () => number = Date.now,
): Promise<void> {
  const caught = await catchUp(now);
  const state = caught.engine.state();
  const pack = contentPackV1;
  const interactive = !opts.text && Boolean(process.stdout.isTTY);

  // On a TTY with no code, open the Battle setup page (paste a code or pick a Dex
  // record) rather than auto-choosing an opponent — the setup screen handles a
  // sealed pet and a missing opponent itself.
  if (interactive && !opts.code) {
    await launchShell(caught, { noColor: opts.noColor, initialPage: 'battle' });
    return;
  }

  if (!isBattleReady(state.pet)) {
    out('Your pet is sealed — battles unlock once it reaches the Evolved stage.\n');
    return;
  }
  const left = playerCombatant(pack, state.pet);
  const right = resolveOpponent(pack, state, opts.code, out);
  if (!right) return;

  const result = simulateBattle(left, right, pack.battle);
  if (interactive) {
    const initialBattle: BattleView = { left, right, result, cursor: 0, playing: true };
    await launchShell(caught, { noColor: opts.noColor, initialPage: 'battle', initialBattle });
    return;
  }
  out(renderSummary(left, right, result));
}
