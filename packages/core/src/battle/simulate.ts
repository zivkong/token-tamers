/**
 * The battle engine (design §11) — pure, deterministic, seeded.
 *
 *   outcome = f(combatantA, combatantB, ruleset.version)
 *
 * Two combatants trade blows in SPD order until one faints (or a turn cap is
 * reached, resolved by remaining HP). Each hit folds the House type-wheel, trait
 * counters, the grade stat-floor (all from {@link effectiveStats}/the ruleset),
 * and a single seeded variance draw into a damage number, and appends a
 * {@link BattleEvent} to a fully replayable timeline. No clock, no `Math.random`,
 * no I/O (invariant 4/5): the same inputs reproduce the same timeline forever.
 *
 * The engine reads ONLY identity/stat fields (House, grade, stats, traits) — never
 * a model id or token volume (invariant 3). It mutates nothing it is given.
 */

import type {
  BattleEvent,
  BattleResult,
  BattleRuleset,
  BattleSide,
  Combatant,
  Stats,
} from '../types';
import { createRng, nextFloat, type Rng } from '../helpers/rng';
import { effectiveStats } from './combatant';
import { battleSeed } from './seed';
import { resolveProcs } from './procs';
import { typeMultiplier } from './wheel';

/** Hard cap on turns so a low-variance stalemate still terminates deterministically. */
const MAX_TURNS = 300;

/** Starting HP from effective stats — grit-weighted, so a tank outlasts a glass cannon. */
function startHp(s: Stats): number {
  return Math.round(s.grt * 2 + s.pwr + s.spd + s.wis);
}

/** Per-hit damage: offense (pwr + a little spd) × wheel × procs × variance, less grit/wis mitigation. */
function computeDamage(atk: Stats, def: Stats, mult: number, variance: number, rng: Rng): number {
  const offense = atk.pwr + atk.spd * 0.25;
  const mitigation = def.grt * 0.35 + def.wis * 0.15;
  const roll = 1 - variance + nextFloat(rng) * 2 * variance;
  return Math.max(1, Math.round(offense * mult * roll - mitigation));
}

/** The mutable per-battle context threaded through the turn loop. */
interface BattleCtx {
  combatants: { a: Combatant; b: Combatant };
  hp: { a: number; b: number };
  stats: { a: Stats; b: Stats };
  ruleset: BattleRuleset;
  rng: Rng;
  timeline: BattleEvent[];
}

/** Resolve one combatant's strike; push the event(s) and return true if the defender fainted. */
function strike(ctx: BattleCtx, side: BattleSide, turn: number): boolean {
  const foe: BattleSide = side === 'a' ? 'b' : 'a';
  const atk = ctx.combatants[side];
  const def = ctx.combatants[foe];
  const { multiplier: procMul, procs } = resolveProcs(atk.traits, def.traits, ctx.ruleset);
  const wheelMul = typeMultiplier(atk.house, def.house, ctx.ruleset);
  const dmg = computeDamage(
    ctx.stats[side],
    ctx.stats[foe],
    wheelMul * procMul,
    ctx.ruleset.variance,
    ctx.rng,
  );
  ctx.hp[foe] = Math.max(0, ctx.hp[foe] - dmg);
  ctx.timeline.push({
    turn,
    actor: side,
    kind: procs.length > 0 ? 'proc' : 'attack',
    damage: dmg,
    hpAfter: ctx.hp[foe],
    ...(procs[0] ? { proc: procs[0] } : {}),
  });
  if (ctx.hp[foe] <= 0) {
    ctx.timeline.push({ turn, actor: side, kind: 'faint', damage: 0, hpAfter: 0 });
    return true;
  }
  return false;
}

/** Decide the winner once the loop ends (a faint, or the turn cap by remaining HP). */
function decideWinner(hp: { a: number; b: number }): BattleSide | 'draw' {
  if (hp.a <= 0 && hp.b <= 0) return 'draw';
  if (hp.b <= 0) return 'a';
  if (hp.a <= 0) return 'b';
  if (hp.a === hp.b) return 'draw';
  return hp.a > hp.b ? 'a' : 'b';
}

/**
 * Simulate a battle between combatant `a` and combatant `b` under `ruleset`.
 * Returns the outcome plus the full replayable event timeline. Pure: callers are
 * responsible for the Evolved readiness gate (see `isBattleReady`) — this is just
 * the math.
 */
export function simulateBattle(a: Combatant, b: Combatant, ruleset: BattleRuleset): BattleResult {
  const stats = { a: effectiveStats(a), b: effectiveStats(b) };
  const start = { a: startHp(stats.a), b: startHp(stats.b) };
  const ctx: BattleCtx = {
    combatants: { a, b },
    hp: { ...start },
    stats,
    ruleset,
    rng: createRng(battleSeed(a, b, ruleset.version)),
    timeline: [],
  };
  // Faster combatant strikes first; ties go to side A (deterministic).
  const order: BattleSide[] = stats.a.spd >= stats.b.spd ? ['a', 'b'] : ['b', 'a'];

  let turn = 0;
  while (ctx.hp.a > 0 && ctx.hp.b > 0 && turn < MAX_TURNS) {
    for (const side of order) {
      if (ctx.hp.a <= 0 || ctx.hp.b <= 0) break;
      if (strike(ctx, side, turn)) break;
    }
    turn++;
  }

  return {
    version: ruleset.version,
    winner: decideWinner(ctx.hp),
    startHp: start,
    timeline: ctx.timeline,
  };
}
