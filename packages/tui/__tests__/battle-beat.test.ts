/**
 * Unit tests for the battle playback beat clock + animation math (battle-beat.ts).
 *
 * These assert the PURE properties the arena renderer relies on — beat pacing,
 * speed scaling, HP tweening, the wind-up→reveal banner, and each effect's distinct
 * motion/tag — using hand-built timelines so they never depend on the simulator's
 * internals (and stay deterministic, no RNG/clock).
 */

import { describe, it, expect } from 'vitest';
import type { BattleEvent, BattleResult, Combatant } from '@token-tamers/core';
import type { BattleView } from '../src/pages/types';
import {
  advanceBattlePlayback,
  animHp,
  attackerSide,
  bannerFor,
  beatLen,
  cycleSpeed,
  flinchMag,
  floatTag,
  lungeMag,
  shakeMag,
  speedLabel,
} from '../src/pages/battle-beat';

const fighter = (name: string): Combatant => ({
  speciesNum: 1,
  speciesId: name.toLowerCase(),
  name,
  house: 'aether',
  grade: 'A',
  stage: 'evolved',
  stats: { pwr: 50, spd: 50, wis: 50, grt: 50 },
  traits: [],
});

function view(timeline: BattleEvent[], over: Partial<BattleView> = {}): BattleView {
  const result: BattleResult = {
    version: 1,
    winner: 'a',
    startHp: { a: 100, b: 100 },
    timeline,
  };
  return {
    left: fighter('Aero'),
    right: fighter('Bolt'),
    result,
    cursor: 0,
    playing: true,
    ...over,
  };
}

const hit = (over: Partial<BattleEvent>): BattleEvent => ({
  turn: 0,
  actor: 'a',
  kind: 'attack',
  damage: 10,
  hpAfter: 90,
  ...over,
});

describe('beat clock', () => {
  it('ticks beatFrame each frame, then lands the event (cursor++) when the beat fills', () => {
    const v = view([hit({}), hit({ turn: 1, hpAfter: 80 })]);
    const len = beatLen(v, 0);
    for (let i = 1; i < len; i++) advanceBattlePlayback(v);
    expect(v.cursor).toBe(0); // not yet — still mid-beat
    expect(v.beatFrame).toBe(len - 1);
    advanceBattlePlayback(v); // the frame that fills the beat
    expect(v.cursor).toBe(1);
    expect(v.beatFrame).toBe(0);
  });

  it('stops playing once the final event lands', () => {
    const v = view([hit({})]);
    for (let i = 0; i < beatLen(v, 0) + 2; i++) advanceBattlePlayback(v);
    expect(v.cursor).toBe(1);
    expect(v.playing).toBe(false);
  });

  it('a paused view never advances', () => {
    const v = view([hit({})], { playing: false });
    advanceBattlePlayback(v);
    expect(v.cursor).toBe(0);
    expect(v.beatFrame ?? 0).toBe(0);
  });

  it('speed scales the beat length and a new turn adds a breath', () => {
    const tl = [hit({}), hit({ turn: 1 })];
    const fast = beatLen(view(tl, { speed: 2 }), 0);
    const slow = beatLen(view(tl, { speed: 0.5 }), 0);
    expect(fast).toBeLessThan(beatLen(view(tl), 0));
    expect(slow).toBeGreaterThan(beatLen(view(tl), 0));
    // index 1 opens a new turn → longer than the same kind mid-turn
    expect(beatLen(view(tl), 1)).toBeGreaterThan(beatLen(view([hit({}), hit({})]), 1));
  });

  it('cycleSpeed walks 1× → 2× → 0.5× → 1×', () => {
    const v = view([hit({})]);
    expect(speedLabel(v)).toBe('1×');
    cycleSpeed(v);
    expect(speedLabel(v)).toBe('2×');
    cycleSpeed(v);
    expect(speedLabel(v)).toBe('0.5×');
    cycleSpeed(v);
    expect(speedLabel(v)).toBe('1×');
  });
});

describe('HP tween', () => {
  it('drains the struck side from full toward hpAfter across the beat', () => {
    const v = view([hit({ actor: 'a', damage: 40, hpAfter: 60 })]);
    const len = beatLen(v, 0);
    v.beatFrame = 0;
    expect(animHp(v, 'b')).toBe(100); // wind-up: not yet hit
    v.beatFrame = Math.round(len * 0.6);
    const mid = animHp(v, 'b');
    expect(mid).toBeLessThan(100);
    expect(mid).toBeGreaterThan(60);
    v.beatFrame = len; // settle: fully drained
    expect(animHp(v, 'b')).toBe(60);
    expect(animHp(v, 'a')).toBe(100); // the attacker is untouched
  });
});

describe('banner — wind-up then reveal', () => {
  it('leads with a wind-up, then names the resolved blow at impact', () => {
    const v = view([hit({ damage: 12, hpAfter: 88 })]);
    v.beatFrame = 0;
    expect(bannerFor(v)!.text).toContain('winds up');
    v.beatFrame = beatLen(v, 0); // past impact
    const b = bannerFor(v)!;
    expect(b.text).toContain('Aero');
    expect(b.text).toContain('12');
  });

  it('is null once the fight is over (winner banner takes over)', () => {
    const v = view([hit({})], { cursor: 1 });
    expect(bannerFor(v)).toBeNull();
    expect(attackerSide(v)).toBeNull();
  });
});

describe('per-effect distinctions', () => {
  const atImpact = (e: BattleEvent): BattleView => {
    const v = view([e]);
    v.beatFrame = beatLen(v, 0); // settle frame: effect fully revealed
    return v;
  };

  it('crit: gold tone, shake, deeper lunge, and a damage tag', () => {
    const v = atImpact(hit({ kind: 'crit', damage: 33, hpAfter: 67 }));
    expect(bannerFor(v)!.tone).toBe('crit');
    expect(bannerFor(v)!.text).toContain('CRITICAL');
    expect(floatTag(v, 'b')).toEqual({ text: '-33', tone: 'crit' });
    // crit lunges deeper than a plain attack at the same phase
    const plain = atImpact(hit({}));
    v.beatFrame = Math.round(beatLen(v, 0) * 0.42);
    plain.beatFrame = Math.round(beatLen(plain, 0) * 0.42);
    expect(lungeMag(v)).toBeGreaterThan(lungeMag(plain));
  });

  it('dodge: no damage number, a "miss" tag, and a side-step (no shake)', () => {
    const v = atImpact(hit({ kind: 'dodge', damage: 0, hpAfter: 100 }));
    expect(bannerFor(v)!.tone).toBe('dodge');
    expect(floatTag(v, 'b')!.text).toContain('miss');
    expect(animHp(v, 'b')).toBe(100); // dodged → no HP lost
    expect(shakeMag(v)).toBe(0);
    v.beatFrame = Math.round(beatLen(v, 0) * 0.5); // mid-beat: the side-step is in flight
    expect(flinchMag(v)).toBeGreaterThan(0); // the defender hops aside
  });

  it('parry: steel tone with a reduced hit that still chips HP', () => {
    const v = atImpact(hit({ kind: 'parry', damage: 4, hpAfter: 96 }));
    expect(bannerFor(v)!.tone).toBe('parry');
    expect(floatTag(v, 'b')).toEqual({ text: '-4', tone: 'parry' });
  });

  it('proc: names the trait (double-strike flavor)', () => {
    const v = atImpact(hit({ kind: 'proc', proc: 'sprinter', damage: 18, hpAfter: 82 }));
    expect(bannerFor(v)!.tone).toBe('proc');
    expect(bannerFor(v)!.text).toContain('Sprinter');
  });

  it('faint: red tone, no wind-up lead, and screen-shake on the drop', () => {
    const v = view([hit({ kind: 'faint', damage: 0, hpAfter: 0 })]);
    v.beatFrame = 0; // even at frame 0 a faint shows its own banner (no wind-up)
    expect(bannerFor(v)!.tone).toBe('faint');
    expect(bannerFor(v)!.text).toContain('faints');
    expect(shakeMag(v)).not.toBe(0); // the topple jolts the stage
  });

  it('the floating tag only appears over the STRUCK side, and only past impact', () => {
    const v = view([hit({ actor: 'a', damage: 10, hpAfter: 90 })]);
    v.beatFrame = 0; // wind-up
    expect(floatTag(v, 'b')).toBeNull();
    expect(floatTag(v, 'a')).toBeNull(); // attacker never shows a tag
    v.beatFrame = beatLen(v, 0);
    expect(floatTag(v, 'b')).not.toBeNull(); // the defender does
    expect(floatTag(v, 'a')).toBeNull();
  });
});
