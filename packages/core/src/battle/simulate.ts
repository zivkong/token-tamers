/**
 * The battle engine (design §11) — pure, deterministic, seeded.
 *
 *   outcome = f(combatantA, combatantB, ruleset.version, nonce)
 *
 * Two combatants trade blows in SPD order until one faints (or a turn cap is
 * reached, resolved by remaining HP). Each hit folds the House type-wheel, trait
 * counters, the grade stat-floor (all from {@link effectiveStats}/the ruleset),
 * and a single seeded variance draw into a damage number, and appends a
 * {@link BattleEvent} to a fully replayable timeline. When the ruleset carries
 * `mechanics`, each hit also rolls dodge / crit / parry and the attacker may strike
 * twice — all stat-derived (so grade lifts them) and drawn from the SAME seeded RNG,
 * so a fixed matchup still replays identically; the `nonce` reseeds a rematch.
 * No clock, no `Math.random`, no I/O (invariant 4/5): the same inputs reproduce the
 * same timeline forever.
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
import { chance, createRng, nextFloat, type Rng } from '../helpers/rng';
import { effectiveStats } from './combatant';
import { mechanicChance } from './mechanics';
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

/** The resolved effect of one strike: the log `kind`, damage dealt, and any proc. */
interface Hit {
  kind: BattleEvent['kind'];
  damage: number;
  proc?: BattleEvent['proc'];
}

/**
 * Resolve a single strike's effect WITHOUT touching HP/timeline. Draws from the RNG
 * in a FIXED order so the stream stays reproducible: dodge → (variance) → crit →
 * parry. A dodge short-circuits before the damage draw. Mechanics are skipped wholly
 * when the ruleset has none, so a classic ruleset consumes exactly one (variance) draw.
 */
function resolveHit(ctx: BattleCtx, side: BattleSide, foe: BattleSide): Hit {
  const m = ctx.ruleset.mechanics;
  const atk = ctx.stats[side];
  const def = ctx.stats[foe];
  if (m && chance(ctx.rng, mechanicChance(m.dodge, def.spd - atk.spd))) {
    return { kind: 'dodge', damage: 0 };
  }
  const { multiplier: procMul, procs } = resolveProcs(
    ctx.combatants[side].traits,
    ctx.combatants[foe].traits,
    ctx.ruleset,
  );
  const wheelMul = typeMultiplier(
    ctx.combatants[side].house,
    ctx.combatants[foe].house,
    ctx.ruleset,
  );
  let dmg = computeDamage(atk, def, wheelMul * procMul, ctx.ruleset.variance, ctx.rng);
  let kind: BattleEvent['kind'] = procs.length > 0 ? 'proc' : 'attack';
  if (m) {
    if (chance(ctx.rng, mechanicChance(m.crit, atk.wis))) {
      dmg = Math.max(1, Math.round(dmg * m.crit.multiplier));
      kind = 'crit';
    }
    if (chance(ctx.rng, mechanicChance(m.parry, def.grt))) {
      dmg = Math.max(1, Math.round(dmg * (1 - m.parry.reduction)));
      if (kind !== 'crit') kind = 'parry';
    }
  }
  return procs[0] ? { kind, damage: dmg, proc: procs[0] } : { kind, damage: dmg };
}

/** Apply one resolved hit: mutate HP, push the event (+ a faint marker). Returns fainted. */
function applyHit(ctx: BattleCtx, side: BattleSide, foe: BattleSide, turn: number): boolean {
  const hit = resolveHit(ctx, side, foe);
  ctx.hp[foe] = Math.max(0, ctx.hp[foe] - hit.damage);
  ctx.timeline.push({
    turn,
    actor: side,
    kind: hit.kind,
    damage: hit.damage,
    hpAfter: ctx.hp[foe],
    ...(hit.proc ? { proc: hit.proc } : {}),
  });
  if (ctx.hp[foe] <= 0) {
    ctx.timeline.push({ turn, actor: side, kind: 'faint', damage: 0, hpAfter: 0 });
    return true;
  }
  return false;
}

/**
 * Resolve one combatant's turn: a strike, plus a stat-rolled chance (SPD) at a
 * second strike when the ruleset has mechanics. Returns true if the defender fainted.
 */
function strike(ctx: BattleCtx, side: BattleSide, turn: number): boolean {
  const foe: BattleSide = side === 'a' ? 'b' : 'a';
  if (applyHit(ctx, side, foe, turn)) return true;
  const m = ctx.ruleset.mechanics;
  if (m && chance(ctx.rng, mechanicChance(m.doubleStrike, ctx.stats[side].spd))) {
    return applyHit(ctx, side, foe, turn);
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
 * the math. `nonce` (default 0 = the canonical/shared battle) reseeds a rematch for
 * deterministic variety; see {@link battleSeed}.
 */
export function simulateBattle(
  a: Combatant,
  b: Combatant,
  ruleset: BattleRuleset,
  nonce = 0,
): BattleResult {
  const stats = { a: effectiveStats(a), b: effectiveStats(b) };
  const start = { a: startHp(stats.a), b: startHp(stats.b) };
  const ctx: BattleCtx = {
    combatants: { a, b },
    hp: { ...start },
    stats,
    ruleset,
    rng: createRng(battleSeed(a, b, ruleset.version, nonce)),
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
