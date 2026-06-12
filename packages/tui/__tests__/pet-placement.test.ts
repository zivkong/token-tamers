import { describe, it, expect } from 'vitest';
import { petPlacement, CYCLE, type WanderGeometry } from '../src/pages/pet';

const GEO: WanderGeometry = {
  canvasX: 0,
  canvasY: 0,
  canvasCols: 100,
  canvasRows: 30,
  spriteCols: 16,
  spriteRows: 8,
  floorY: 20,
};

describe('petPlacement — egg stays stationary (no jitter)', () => {
  it('keeps a non-mobile pet at one spot, idle, across the whole cycle', () => {
    const frames = Array.from({ length: CYCLE }, (_, f) => petPlacement(f, GEO, false));
    const first = frames[0]!;
    // Centered on the floor.
    const centerX = GEO.canvasX + Math.floor((GEO.canvasCols - GEO.spriteCols) / 2);
    expect(first.px).toBe(centerX);
    expect(first.py).toBe(GEO.floorY - (GEO.spriteRows - 1));
    // Never moves, never hops, never walks/plays — only breathes via idle frames.
    for (const w of frames) {
      expect(w.px).toBe(first.px);
      expect(w.py).toBe(first.py);
      expect(w.anim).toBe('idle');
      expect(w.playing).toBe(false);
    }
  });

  it('a mobile pet still wanders (regression guard the gate is not always-on)', () => {
    const xs = new Set<number>();
    const anims = new Set<string>();
    for (let f = 0; f < CYCLE; f++) {
      const w = petPlacement(f, GEO, true);
      xs.add(w.px);
      anims.add(w.anim);
    }
    // Wandering visits multiple x positions and more than just the idle bank.
    expect(xs.size).toBeGreaterThan(1);
    expect(anims.size).toBeGreaterThan(1);
    expect([...anims]).toContain('walk');
  });

  it('defaults to mobile when the flag is omitted (hatched stages unchanged)', () => {
    const withFlag = petPlacement(50, GEO, true);
    const defaulted = petPlacement(50, GEO);
    expect(defaulted).toEqual(withFlag);
  });
});
