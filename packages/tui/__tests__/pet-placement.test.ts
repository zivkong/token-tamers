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

describe('petPlacement — organic, non-repeating wander', () => {
  const leftX = GEO.canvasX + 8; // EDGE_INSET
  const rightX = GEO.canvasX + GEO.canvasCols - 8 - GEO.spriteCols;
  const groundY = GEO.floorY - (GEO.spriteRows - 1);

  it('stays within the wander bounds at all times', () => {
    for (let f = 0; f < 600; f++) {
      const w = petPlacement(f, GEO, true);
      expect(w.px).toBeGreaterThanOrEqual(leftX);
      expect(w.px).toBeLessThanOrEqual(rightX);
    }
  });

  it('moves continuously — never teleports between frames', () => {
    let prev = petPlacement(0, GEO, true).px;
    for (let f = 1; f < 600; f++) {
      const px = petPlacement(f, GEO, true).px;
      // A glide, not a jump: eased strolls cap well under a handful of cells/frame.
      expect(Math.abs(px - prev)).toBeLessThanOrEqual(5);
      prev = px;
    }
  });

  it('only leaves the floor line while hopping', () => {
    for (let f = 0; f < 600; f++) {
      const w = petPlacement(f, GEO, true);
      if (w.anim === 'jump') expect(w.py).toBeLessThanOrEqual(groundY);
      else expect(w.py).toBe(groundY);
    }
  });

  it('does not retrace the same loop (path keeps changing over time)', () => {
    const window = (start: number) =>
      Array.from({ length: CYCLE }, (_, k) => petPlacement(start + k, GEO, true).px).join(',');
    // The old engine repeated every CYCLE frames; the value-noise walk does not.
    expect(window(0)).not.toBe(window(20 * CYCLE));
  });

  it('exercises the full behavior set over a long span', () => {
    const anims = new Set<string>();
    let played = false;
    for (let f = 0; f < 3000; f++) {
      const w = petPlacement(f, GEO, true);
      anims.add(w.anim);
      played ||= w.playing;
    }
    expect([...anims].sort()).toEqual(['idle', 'jump', 'play', 'walk']);
    expect(played).toBe(true);
  });
});
