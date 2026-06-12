/**
 * Aether line sprite designs (House: Aether — wispy/cloud, WIS-leaning).
 *
 * REDESIGN — tiny-art pass. Sizes are 1/3 of the old placeholders:
 *   mote 10×10 · wisp 12×12 · aetherling 14×14 · murmur 14×14
 *   oraclet 16×16 · cirrux 16×16 · nimbusk 16×16
 *   seraphix 18×18 · thoughtwarden 18×18 · halcyore 18×18
 *   aurelion 20×20 · mindspire 20×20
 *
 * At these sizes gradients are noise — we commit to FLAT TONES:
 *   outline=1, shadow=3, body=7, light=11, rim=13, glint=15
 * At most a 2-3 px dither seam where tones meet; everything else is flat.
 *
 * Every species has ALL animation banks:
 *   idle 2f (breath bob / blink), walk 2f (side-stride, faces RIGHT),
 *   jump 2f (crouch, air-stretch), play 2f (reach/bounce toward toy).
 *
 * Determinism: seeded LCG (hashStr(id)) — no Math.random / Date.now.
 */

import type { SpriteDef } from '@token-tamers/core';
import {
  PixelCanvas,
  buildSprite,
  fillEllipse,
  fillRect,
  fillPolygon,
  strokeEllipse,
  bezier,
  mirrorX,
  outline,
  bobFrame,
  shiftFrame,
  framesFromDeltas,
  OUTLINE,
  RIM_LO,
  GLINT,
} from '../sprite-lib';

// Flat tone palette — the shared vocabulary for all Aether creatures.
const SHADOW = 3; // darkest body / undershadow
const BODY = 7; // mid body tone
const LIGHT = 11; // lit surface
const RIM = RIM_LO; // 13 — rim highlight

// ---------------------------------------------------------------------------
// Mote (10×10) — dormant egg-orb, one sleepy half-open eye, faint swirl mark
// ---------------------------------------------------------------------------

export function buildMote(): SpriteDef {
  const W = 10;
  const H = 10;
  const cx = 5;
  const cy = 5;

  const base = PixelCanvas.create(W, H);

  // Egg-orb: fill a tight circle with flat body tone
  fillEllipse(base, cx, cy, 4, 4, BODY);
  // Shadow crescent bottom-right
  fillEllipse(base, cx + 1, cy + 1, 3, 3, SHADOW);
  // Light cap top-left
  fillEllipse(base, cx - 1, cy - 1, 2, 2, LIGHT);
  // Restore full body for the orb interior (shadow/light are accents, not wipe)
  // Re-paint: use a layering approach — shadow only at bottom fringe
  // Repaint with correct approach: body base, then accent marks
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= 16) {
        // inside the orb
        if (dy >= 2 && dx >= 0) {
          base.set(x, y, SHADOW); // shadow bottom-right quarter
        } else if (dy <= -1 && dx <= 0) {
          base.set(x, y, LIGHT); // light top-left quarter
        } else {
          base.set(x, y, BODY);
        }
      }
    }
  }

  // Sleepy half-open eye: a horizontal line in the upper-center
  // Eye crack: 3 px wide, 2 rows — top row is dark, bottom is transparent (lid)
  base.set(cx - 1, cy - 1, OUTLINE);
  base.set(cx, cy - 1, OUTLINE);
  base.set(cx + 1, cy - 1, OUTLINE);
  // Glint in the eye — 1px
  base.set(cx - 1, cy - 2, GLINT);

  // Swirl mark — a 3-dot arc, subtle (uses shadow tone)
  base.set(cx + 2, cy + 1, SHADOW - 1);
  base.set(cx + 3, cy, SHADOW - 1);
  base.set(cx + 2, cy - 1, SHADOW - 1);

  outline(base);

  // Idle f2: tiny bob (shift up 1 px)
  const f2 = bobFrame(base, -1);

  // Walk: 2f — gentle drift left/right lean
  const walk = framesFromDeltas(base, [
    // f0: contact — lean left (shift slightly left)
    (f) => {
      // shift whole orb 1px right to simulate side-stride
      const shifted = shiftFrame(base, 1, 0);
      for (let y = 0; y < H; y++) {
        const row = shifted.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
    // f1: push off — lean right
    (f) => {
      const shifted = shiftFrame(base, -1, 0);
      for (let y = 0; y < H; y++) {
        const row = shifted.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  // Jump: 2f — crouch (compressed), air-stretch (elongated)
  const jump = framesFromDeltas(base, [
    // f0: crouch — squish down 1px
    (f) => {
      const squish = shiftFrame(base, 0, 1);
      for (let y = 0; y < H; y++) {
        const row = squish.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
    // f1: air — bob up 2px
    (f) => {
      const air = bobFrame(base, -2);
      for (let y = 0; y < H; y++) {
        const row = air.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  // Play: 2f — tiny bounce toward toy
  const play = framesFromDeltas(base, [
    // f0: reach — shift toward toy (right) + glint flash
    (f) => {
      const reached = shiftFrame(base, 1, -1);
      for (let y = 0; y < H; y++) {
        const row = reached.grid[y];
        if (row) f.grid[y] = [...row];
      }
      f.set(cx + 2, cy - 2, GLINT);
    },
    // f1: bounce back
    (f) => {
      const back = bobFrame(base, 1);
      for (let y = 0; y < H; y++) {
        const row = back.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  return {
    ...buildSprite('sprite-mote', [base, f2], 4),
    walk,
    jump,
    play,
  };
}

// ---------------------------------------------------------------------------
// Wisp (12×12) — candle-flame imp; teardrop body, flame tip, huge curious eyes
// ---------------------------------------------------------------------------

export function buildWisp(): SpriteDef {
  const W = 12;
  const H = 12;
  const cx = 6;

  const base = PixelCanvas.create(W, H);

  // Teardrop body: wide base, narrows to flame tip at top
  // Base fat section (bottom half)
  fillEllipse(base, cx, 8, 4, 3, BODY);
  // Mid torso
  fillEllipse(base, cx, 5, 3, 3, BODY);
  // Flame neck narrow
  fillEllipse(base, cx, 3, 2, 2, BODY);
  // Flame tip — single pixel at top
  base.set(cx, 1, LIGHT);

  // Shadow on lower-right
  base.set(cx + 2, 8, SHADOW);
  base.set(cx + 3, 7, SHADOW);
  base.set(cx + 2, 7, SHADOW);
  base.set(cx + 1, 9, SHADOW);

  // Light on upper-left body
  base.set(cx - 2, 5, LIGHT);
  base.set(cx - 1, 4, LIGHT);
  base.set(cx - 2, 4, LIGHT);

  // Rim on lit edge (top-left)
  base.set(cx - 2, 3, RIM);
  base.set(cx - 1, 2, RIM);

  // Flame tip light
  base.set(cx, 2, LIGHT);

  outline(base);

  // Huge curious eyes — placed on the mid body (2px each)
  // Left eye: placed after outline so they sit on top
  base.set(cx - 2, 5, OUTLINE);
  base.set(cx - 1, 5, OUTLINE);
  base.set(cx - 2, 6, OUTLINE);
  base.set(cx - 2, 4, GLINT); // glint

  // Right eye (symmetric)
  base.set(cx + 2, 5, OUTLINE);
  base.set(cx + 1, 5, OUTLINE);
  base.set(cx + 2, 6, OUTLINE);
  base.set(cx + 2, 4, GLINT);

  // Flame-tip signature: a tiny orange glow (GLINT index shimmers)
  base.set(cx, 1, GLINT);

  // Idle f2: blink — collapse eyes to closed line
  const f2 = base.clone();
  f2.set(cx - 2, 5, BODY);
  f2.set(cx - 1, 5, OUTLINE); // closed eye line left
  f2.set(cx - 2, 6, BODY);
  f2.set(cx - 2, 4, BODY);
  f2.set(cx + 2, 5, BODY);
  f2.set(cx + 1, 5, OUTLINE); // closed eye line right
  f2.set(cx + 2, 6, BODY);
  f2.set(cx + 2, 4, BODY);

  // Walk: 2f — drift lean, faces RIGHT
  const walk = framesFromDeltas(base, [
    // f0: stride — slight right lean (base = contact)
    (_f) => {
      // base is contact pose, already faces right (default)
    },
    // f1: off-stride — bob up 1 + slight left lean for stride rhythm
    (f) => {
      const bob = bobFrame(base, -1);
      for (let y = 0; y < H; y++) {
        const row = bob.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  // Jump: crouch then air-stretch
  const jump = framesFromDeltas(base, [
    // f0: crouch — squash down, shift body +1
    (f) => {
      const sq = shiftFrame(base, 0, 1);
      for (let y = 0; y < H; y++) {
        const row = sq.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
    // f1: air-stretch — bob up -2
    (f) => {
      const air = bobFrame(base, -2);
      for (let y = 0; y < H; y++) {
        const row = air.grid[y];
        if (row) f.grid[y] = [...row];
      }
      // flame tip extends 1 more px when stretched
      f.set(cx, 0, GLINT);
    },
  ]);

  // Play: reach/bounce
  const play = framesFromDeltas(base, [
    // f0: reach right
    (f) => {
      const r = shiftFrame(base, 1, -1);
      for (let y = 0; y < H; y++) {
        const row = r.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
    // f1: bounce back
    (f) => {
      const b = bobFrame(base, 1);
      for (let y = 0; y < H; y++) {
        const row = b.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  return {
    ...buildSprite('sprite-wisp', [base, f2], 4),
    walk,
    jump,
    play,
  };
}

// ---------------------------------------------------------------------------
// Aetherling (14×14) — chubby cloud puppy; stubby arms, curl antenna, goofy grin
// ---------------------------------------------------------------------------

export function buildAetherling(): SpriteDef {
  const W = 14;
  const H = 14;
  const cx = 7;

  const base = PixelCanvas.create(W, H);

  // Chubby round body
  fillEllipse(base, cx, 9, 5, 4, BODY);
  // Big round head merging into body
  fillEllipse(base, cx, 5, 5, 4, BODY);
  // Body-head connector
  fillRect(base, cx - 3, 7, cx + 3, 8, BODY);

  // Shadow on bottom
  base.set(cx - 2, 11, SHADOW);
  base.set(cx - 1, 12, SHADOW);
  base.set(cx, 12, SHADOW);
  base.set(cx + 1, 12, SHADOW);
  base.set(cx + 2, 11, SHADOW);
  base.set(cx + 3, 10, SHADOW);
  base.set(cx - 3, 10, SHADOW);

  // Light on top-left
  base.set(cx - 3, 4, LIGHT);
  base.set(cx - 2, 3, LIGHT);
  base.set(cx - 1, 3, LIGHT);
  base.set(cx - 3, 5, LIGHT);

  // Rim
  base.set(cx - 4, 4, RIM);
  base.set(cx - 4, 5, RIM);

  // Left stubby arm — 2px nub at side
  base.set(cx - 5, 8, BODY);
  base.set(cx - 6, 8, BODY);
  base.set(cx - 6, 9, BODY);

  // Right stubby arm (symmetric)
  base.set(cx + 5, 8, BODY);
  base.set(cx + 6, 8, BODY);
  base.set(cx + 6, 9, BODY);

  // Curl antenna — single bezier from crown, curves right then back
  bezier(base, cx, 2, cx + 2, -1, cx + 3, 1, OUTLINE, 1, 1);

  outline(base);

  // Eyes — 2px each, dark + glint, set after outline
  // Left eye
  base.set(cx - 2, 4, OUTLINE);
  base.set(cx - 1, 4, OUTLINE);
  base.set(cx - 2, 5, OUTLINE);
  base.set(cx - 2, 3, GLINT);

  // Right eye
  base.set(cx + 2, 4, OUTLINE);
  base.set(cx + 1, 4, OUTLINE);
  base.set(cx + 2, 5, OUTLINE);
  base.set(cx + 2, 3, GLINT);

  // Goofy grin — 3px wide curved smile
  base.set(cx - 2, 7, OUTLINE);
  base.set(cx - 1, 8, OUTLINE);
  base.set(cx, 8, OUTLINE);
  base.set(cx + 1, 8, OUTLINE);
  base.set(cx + 2, 7, OUTLINE);

  // Antenna tip glint
  base.set(cx + 3, 0, GLINT);

  // Idle f2: breath bob up 1
  const f2 = bobFrame(base, -1);

  // Walk: stride — arms pump
  const walk = framesFromDeltas(base, [
    // f0: contact — left arm forward (raised), right back
    (f) => {
      // clear left arm and raise it
      f.set(cx - 5, 8, 0);
      f.set(cx - 6, 8, 0);
      f.set(cx - 6, 9, 0);
      f.set(cx - 5, 7, BODY); // arm raised 1px
      f.set(cx - 6, 7, BODY);
      // body bob up 1
      const bob = bobFrame(base, -1);
      for (let y = 0; y < 6; y++) {
        const row = bob.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
    // f1: mid-stride — opposite side
    (f) => {
      f.set(cx + 5, 8, 0);
      f.set(cx + 6, 8, 0);
      f.set(cx + 6, 9, 0);
      f.set(cx + 5, 7, BODY);
      f.set(cx + 6, 7, BODY);
    },
  ]);

  // Jump: crouch then air
  const jump = framesFromDeltas(base, [
    (f) => {
      const sq = shiftFrame(base, 0, 1);
      for (let y = 0; y < H; y++) {
        const row = sq.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
    (f) => {
      const air = bobFrame(base, -2);
      for (let y = 0; y < H; y++) {
        const row = air.grid[y];
        if (row) f.grid[y] = [...row];
      }
      f.set(cx + 3, 0, GLINT); // antenna tip stretches
    },
  ]);

  // Play: reach + bounce
  const play = framesFromDeltas(base, [
    (f) => {
      // lean forward right + raise right arm higher
      const r = shiftFrame(base, 1, -1);
      for (let y = 0; y < H; y++) {
        const row = r.grid[y];
        if (row) f.grid[y] = [...row];
      }
      f.set(cx + 7, 7, BODY); // arm reaches forward
    },
    (f) => {
      const b = bobFrame(base, 1);
      for (let y = 0; y < H; y++) {
        const row = b.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  return {
    ...buildSprite('sprite-aetherling', [base, f2], 4),
    walk,
    jump,
    play,
  };
}

// ---------------------------------------------------------------------------
// Murmur (14×14) — hooded whisper; no face except glowing eyes, trailing ribbon
// ---------------------------------------------------------------------------

export function buildMurmur(): SpriteDef {
  const W = 14;
  const H = 14;
  const cx = 7;

  const base = PixelCanvas.create(W, H);

  // Robe body — tall trapezoid, wide at bottom
  fillPolygon(
    base,
    [
      [cx - 5, 5] as [number, number],
      [cx + 5, 5] as [number, number],
      [cx + 6, 12] as [number, number],
      [cx - 6, 12] as [number, number],
    ],
    BODY,
  );

  // Hood — rounded top peak
  fillEllipse(base, cx, 4, 4, 3, BODY);
  // Hood peak spike (the hood tip)
  base.set(cx, 1, BODY);
  base.set(cx, 2, BODY);
  base.set(cx - 1, 2, BODY);
  base.set(cx + 1, 2, BODY);

  // Shadow inside hood / lower robe
  base.set(cx - 4, 10, SHADOW);
  base.set(cx - 5, 9, SHADOW);
  base.set(cx - 5, 8, SHADOW);
  base.set(cx - 5, 7, SHADOW);
  base.set(cx + 4, 10, SHADOW);
  base.set(cx + 5, 9, SHADOW);
  base.set(cx + 5, 8, SHADOW);
  base.set(cx + 5, 7, SHADOW);
  base.set(cx - 4, 11, SHADOW);
  base.set(cx + 4, 11, SHADOW);
  // Deep shadow inside hood (where face would be)
  fillRect(base, cx - 2, 3, cx + 2, 5, SHADOW);

  // Light on hood crown
  base.set(cx, 2, LIGHT);
  base.set(cx - 1, 3, LIGHT);

  // Rim edge on lit hood top
  base.set(cx - 3, 3, RIM);
  base.set(cx - 2, 2, RIM);

  // Trailing ribbon hem — 2 short tails at bottom corners
  bezier(base, cx - 5, 11, cx - 6, 13, cx - 4, 14, BODY, 1, 1);
  bezier(base, cx + 5, 11, cx + 6, 13, cx + 4, 14, BODY, 1, 1);

  outline(base);

  // Eyes: only thing visible — 2 glowing dots in the hood shadow (no pupils, just glints)
  base.set(cx - 2, 4, GLINT);
  base.set(cx + 2, 4, GLINT);

  // Idle f2: bob — ribbon sways
  const f2 = bobFrame(base, -1);
  // ribbon tip shifts
  f2.set(cx - 4, 14, BODY);
  f2.set(cx + 4, 14, BODY);
  f2.set(cx - 5, 13, BODY);
  f2.set(cx + 5, 13, BODY);

  // Walk: glide drift (murmur floats)
  const walk = framesFromDeltas(base, [
    (_f) => {
      // base = contact — slight right lean
    },
    (f) => {
      // slight up-float + ribbon swirl
      const bob = bobFrame(base, -1);
      for (let y = 0; y < H; y++) {
        const row = bob.grid[y];
        if (row) f.grid[y] = [...row];
      }
      f.set(cx - 4, 12, BODY); // ribbon trails up
      f.set(cx + 4, 12, BODY);
    },
  ]);

  // Jump
  const jump = framesFromDeltas(base, [
    (f) => {
      const sq = shiftFrame(base, 0, 1);
      for (let y = 0; y < H; y++) {
        const row = sq.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
    (f) => {
      const air = bobFrame(base, -2);
      for (let y = 0; y < H; y++) {
        const row = air.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  // Play: eyes glow brighter + lean
  const play = framesFromDeltas(base, [
    (f) => {
      const r = shiftFrame(base, 1, 0);
      for (let y = 0; y < H; y++) {
        const row = r.grid[y];
        if (row) f.grid[y] = [...row];
      }
      // extra glow pixels around eyes
      f.set(cx + 3, 4, GLINT);
      f.set(cx + 2, 3, GLINT);
    },
    (f) => {
      const b = bobFrame(base, 1);
      for (let y = 0; y < H; y++) {
        const row = b.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  return {
    ...buildSprite('sprite-murmur', [base, f2], 4),
    walk,
    jump,
    play,
  };
}

// ---------------------------------------------------------------------------
// Oraclet (16×16) — floating eye-sage; ONE big calm eye, thin orbit ring, tiny hands
// ---------------------------------------------------------------------------

export function buildOraclet(): SpriteDef {
  const W = 16;
  const H = 16;
  const cx = 8;
  const cy = 7;

  const base = PixelCanvas.create(W, H);

  // Main orb body
  fillEllipse(base, cx, cy, 5, 5, BODY);
  // Shadow lower half
  for (let y = cy; y <= cy + 5; y++) {
    for (let x = cx - 5; x <= cx + 5; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + (dy * dy * 25) / 25 <= 25 && dy >= 1) {
        if (dx > 1 || dy > 2) base.set(x, y, SHADOW);
      }
    }
  }
  // Light top-left
  base.set(cx - 3, cy - 3, LIGHT);
  base.set(cx - 2, cy - 3, LIGHT);
  base.set(cx - 3, cy - 2, LIGHT);
  base.set(cx - 4, cy - 1, LIGHT);

  // Rim
  base.set(cx - 4, cy - 2, RIM);
  base.set(cx - 5, cy - 1, RIM);
  base.set(cx - 5, cy, RIM);

  // Thin orbit ring — stroke ellipse slightly tilted (wider X, shorter Y)
  strokeEllipse(base, cx, cy + 2, 7, 2, 5);

  // Tiny hands — 2 dots at bottom sides
  base.set(cx - 6, cy + 4, BODY);
  base.set(cx - 7, cy + 5, BODY);
  base.set(cx + 6, cy + 4, BODY);
  base.set(cx + 7, cy + 5, BODY);

  outline(base);

  // THE EYE: one large calm eye centered on the orb
  // Outer iris ring
  fillEllipse(base, cx, cy, 3, 3, SHADOW);
  // Mid iris
  fillEllipse(base, cx, cy, 2, 2, 4);
  // Pupil core
  base.set(cx, cy, OUTLINE);
  base.set(cx - 1, cy, OUTLINE);
  // Upper eyelid arc
  base.set(cx - 2, cy - 2, OUTLINE);
  base.set(cx - 1, cy - 3, OUTLINE);
  base.set(cx, cy - 3, OUTLINE);
  base.set(cx + 1, cy - 3, OUTLINE);
  base.set(cx + 2, cy - 2, OUTLINE);
  // Lower lid (calmer, less curved)
  base.set(cx - 2, cy + 2, OUTLINE);
  base.set(cx + 2, cy + 2, OUTLINE);
  // Catch-light: single bright glint top-left of pupil
  base.set(cx - 1, cy - 1, GLINT);
  // Ring gems
  base.set(cx - 7, cy + 2, GLINT);
  base.set(cx + 7, cy + 2, GLINT);

  // Idle f2: ring rotation — shift ring glints
  const f2 = base.clone();
  f2.set(cx - 7, cy + 2, 5);
  f2.set(cx + 7, cy + 2, 5);
  f2.set(cx - 6, cy - 1, GLINT);
  f2.set(cx + 6, cy - 1, GLINT);
  // Bob up 1
  const f2bob = bobFrame(f2, -1);
  // Copy back
  for (let y = 0; y < H; y++) {
    const row = f2bob.grid[y];
    if (row) f2.grid[y] = [...row];
  }

  // Walk
  const walk = framesFromDeltas(base, [
    (_f) => {},
    (f) => {
      const bob = bobFrame(base, -1);
      for (let y = 0; y < H; y++) {
        const row = bob.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  // Jump
  const jump = framesFromDeltas(base, [
    (f) => {
      const sq = shiftFrame(base, 0, 1);
      for (let y = 0; y < H; y++) {
        const row = sq.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
    (f) => {
      const air = bobFrame(base, -2);
      for (let y = 0; y < H; y++) {
        const row = air.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  // Play
  const play = framesFromDeltas(base, [
    (f) => {
      const r = shiftFrame(base, 1, -1);
      for (let y = 0; y < H; y++) {
        const row = r.grid[y];
        if (row) f.grid[y] = [...row];
      }
      // tiny hands reach out
      f.set(cx + 8, cy + 3, BODY);
    },
    (f) => {
      const b = bobFrame(base, 1);
      for (let y = 0; y < H; y++) {
        const row = b.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  return {
    ...buildSprite('sprite-oraclet', [base, f2], 3),
    walk,
    jump,
    play,
  };
}

// ---------------------------------------------------------------------------
// Cirrux (16×16) — noodle cloud-dragon in S-pose; fin ears, whisker pair
// ---------------------------------------------------------------------------

export function buildCirrux(): SpriteDef {
  const W = 16;
  const H = 16;

  const base = PixelCanvas.create(W, H);

  // S-curve noodle body: 3 segments forming an S
  // Head (top-right)
  fillEllipse(base, 11, 3, 3, 2, BODY);
  // Neck (sweeps left-down)
  fillEllipse(base, 9, 5, 2, 2, BODY);
  fillEllipse(base, 7, 7, 2, 2, BODY);
  // Mid-body (center, sweeps right)
  fillEllipse(base, 8, 9, 3, 2, BODY);
  fillEllipse(base, 9, 11, 2, 2, BODY);
  // Tail (sweeps left-down)
  fillEllipse(base, 7, 13, 2, 2, BODY);
  base.set(6, 14, BODY);
  base.set(5, 15, BODY);

  // Shadow on inner S-curve concave sides
  base.set(10, 6, SHADOW);
  base.set(9, 7, SHADOW);
  base.set(8, 8, SHADOW);
  base.set(9, 10, SHADOW);
  base.set(8, 12, SHADOW);

  // Light on convex outer edges
  base.set(12, 2, LIGHT);
  base.set(13, 3, LIGHT);
  base.set(7, 6, LIGHT);
  base.set(6, 8, LIGHT);
  base.set(11, 10, LIGHT);
  base.set(10, 12, LIGHT);

  // Rim
  base.set(13, 2, RIM);
  base.set(14, 3, RIM);

  // Fin ears on head — two small triangular fins
  base.set(10, 1, BODY);
  base.set(9, 1, BODY);
  base.set(9, 2, BODY); // left fin
  base.set(12, 1, BODY);
  base.set(13, 2, BODY); // right fin

  // Whisker pair — 2 thin lines from snout
  base.set(14, 3, OUTLINE);
  base.set(15, 2, OUTLINE); // top whisker
  base.set(15, 4, OUTLINE); // bottom whisker
  base.set(14, 5, OUTLINE);

  // Rim highlights on lit convex edges (placed last so fins/whiskers don't
  // clobber them) — keeps the signature lit-edge pop on the body.
  base.set(12, 2, RIM); // crown of the head
  base.set(6, 7, RIM); // outer neck bend
  base.set(11, 9, RIM); // outer mid-body bend

  outline(base);

  // Eye on head — small 2px eye
  base.set(11, 3, OUTLINE);
  base.set(12, 3, OUTLINE);
  base.set(11, 2, GLINT);

  // Idle f2: gentle S-wave — shift tail 1px
  const f2 = base.clone();
  f2.set(6, 14, 0);
  f2.set(5, 15, 0);
  f2.set(7, 14, BODY);
  f2.set(6, 15, BODY);
  // bob up 1
  const f2b = bobFrame(f2, -1);
  for (let y = 0; y < H; y++) {
    const row = f2b.grid[y];
    if (row) f2.grid[y] = [...row];
  }

  // Walk: serpentine drift — body undulates
  const walk = framesFromDeltas(base, [
    (_f) => {},
    (f) => {
      // shift mid-body right 1 to simulate undulation
      f.set(10, 9, BODY);
      f.set(7, 9, 0);
    },
  ]);

  // Jump
  const jump = framesFromDeltas(base, [
    (f) => {
      const sq = shiftFrame(base, 0, 1);
      for (let y = 0; y < H; y++) {
        const row = sq.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
    (f) => {
      const air = bobFrame(base, -2);
      for (let y = 0; y < H; y++) {
        const row = air.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  // Play
  const play = framesFromDeltas(base, [
    (f) => {
      // head lunges forward (shift head right)
      f.set(15, 3, BODY);
      f.set(15, 4, BODY);
      f.set(16, 3, BODY); // clipped safely
    },
    (f) => {
      const b = bobFrame(base, 1);
      for (let y = 0; y < H; y++) {
        const row = b.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  return {
    ...buildSprite('sprite-cirrux', [base, f2], 4),
    walk,
    jump,
    play,
  };
}

// ---------------------------------------------------------------------------
// Nimbusk (16×16) — grumpy storm bison; heavy brow, vapor tusks, hunched mass
// ---------------------------------------------------------------------------

export function buildNimbusk(): SpriteDef {
  const W = 16;
  const H = 16;
  const cx = 8;

  const base = PixelCanvas.create(W, H);

  // Heavy hunched bison mass — low wide body
  fillEllipse(base, cx, 11, 6, 4, BODY);
  // Hump — extra mass on the back (top-left)
  fillEllipse(base, cx - 2, 8, 5, 4, BODY);
  // Wide brutish head, low and forward
  fillEllipse(base, cx + 1, 7, 5, 3, BODY);
  // Heavy brow ridge — a flat bar across forehead
  fillRect(base, cx - 2, 4, cx + 5, 6, BODY);
  base.set(cx - 3, 5, BODY);
  base.set(cx + 6, 5, BODY);

  // Shadow — deep shadow under hump, bottom of body
  base.set(cx - 5, 10, SHADOW);
  base.set(cx - 5, 11, SHADOW);
  base.set(cx - 4, 12, SHADOW);
  base.set(cx - 3, 13, SHADOW);
  base.set(cx + 3, 13, SHADOW);
  base.set(cx + 4, 12, SHADOW);
  base.set(cx + 5, 11, SHADOW);
  base.set(cx, 13, SHADOW);
  base.set(cx + 1, 13, SHADOW);
  // Under brow shadow
  fillRect(base, cx - 1, 6, cx + 4, 7, SHADOW);

  // Light on hump top
  base.set(cx - 3, 6, LIGHT);
  base.set(cx - 2, 5, LIGHT);
  base.set(cx - 1, 5, LIGHT);
  base.set(cx - 4, 7, LIGHT);

  // Rim
  base.set(cx - 4, 6, RIM);
  base.set(cx - 5, 7, RIM);

  // Vapor tusks — left and right, jut down from jaw corners
  bezier(base, cx - 1, 9, cx - 4, 11, cx - 5, 13, LIGHT, 1, 1);
  bezier(base, cx + 3, 9, cx + 6, 11, cx + 7, 13, LIGHT, 1, 1);

  // Short stubby legs (4 dots)
  base.set(cx - 3, 14, BODY);
  base.set(cx - 2, 14, BODY);
  base.set(cx + 2, 14, BODY);
  base.set(cx + 3, 14, BODY);
  base.set(cx - 3, 15, SHADOW);
  base.set(cx - 2, 15, SHADOW);
  base.set(cx + 2, 15, SHADOW);
  base.set(cx + 3, 15, SHADOW);

  outline(base);

  // Eyes: fierce, small, deep under the brow — dark barely visible
  base.set(cx - 1, 6, OUTLINE);
  base.set(cx, 6, OUTLINE);
  base.set(cx + 3, 6, OUTLINE);
  base.set(cx + 4, 6, OUTLINE);
  // tiny angry glint
  base.set(cx - 1, 5, GLINT);
  base.set(cx + 4, 5, GLINT);

  // Idle f2: heavy stomp bob down 1
  const f2 = bobFrame(base, 1);

  // Walk: hunched stride
  const walk = framesFromDeltas(base, [
    (_f) => {},
    (f) => {
      // legs alternate: shift front leg forward
      f.set(cx + 4, 14, 0);
      f.set(cx + 4, 15, 0);
      f.set(cx + 5, 14, BODY);
      f.set(cx + 5, 15, SHADOW);
      const bob = bobFrame(base, 1);
      for (let y = 12; y < H; y++) {
        const row = bob.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  // Jump
  const jump = framesFromDeltas(base, [
    (f) => {
      // crouch: sink down 1
      const sq = shiftFrame(base, 0, 1);
      for (let y = 0; y < H; y++) {
        const row = sq.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
    (f) => {
      const air = bobFrame(base, -1);
      for (let y = 0; y < H; y++) {
        const row = air.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  // Play
  const play = framesFromDeltas(base, [
    (f) => {
      // butt nudge: shift right 1 + stomp
      const r = shiftFrame(base, 1, 0);
      for (let y = 0; y < H; y++) {
        const row = r.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
    (f) => {
      const b = bobFrame(base, 1);
      for (let y = 0; y < H; y++) {
        const row = b.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  return {
    ...buildSprite('sprite-nimbusk', [base, f2], 3),
    walk,
    jump,
    play,
  };
}

// ---------------------------------------------------------------------------
// Seraphix (18×18) — elegant fox-bird; two swept wings, halo shard above head
// ---------------------------------------------------------------------------

export function buildSeraphix(): SpriteDef {
  const W = 18;
  const H = 18;
  const cx = 9;

  const base = PixelCanvas.create(W, H);

  // Slender body — tall narrow ellipse
  fillEllipse(base, cx, 12, 3, 5, BODY);
  // Sleek head — slightly right-of-center (alert fox pose)
  fillEllipse(base, cx + 1, 7, 3, 3, BODY);
  // Pointed fox muzzle
  base.set(cx + 3, 8, BODY);
  base.set(cx + 4, 9, BODY);
  base.set(cx + 3, 9, BODY);

  // Shadow on body right
  base.set(cx + 2, 11, SHADOW);
  base.set(cx + 3, 12, SHADOW);
  base.set(cx + 2, 13, SHADOW);
  base.set(cx + 1, 14, SHADOW);
  base.set(cx + 2, 9, SHADOW);

  // Light on body left
  base.set(cx - 2, 10, LIGHT);
  base.set(cx - 2, 11, LIGHT);
  base.set(cx - 2, 12, LIGHT);
  base.set(cx - 1, 8, LIGHT);

  // Rim
  base.set(cx - 3, 10, RIM);
  base.set(cx - 3, 11, RIM);
  base.set(cx - 3, 12, RIM);

  // Left wing — swept back elegantly (left side, wide arc)
  bezier(base, cx - 2, 10, cx - 8, 6, cx - 10, 11, BODY, 2, 1);
  bezier(base, cx - 2, 11, cx - 7, 8, cx - 9, 13, BODY, 2, 1);
  bezier(base, cx - 2, 12, cx - 6, 10, cx - 7, 15, 5, 1, 1);

  // Right wing — sweeps the other way (shorter, layered)
  bezier(base, cx + 2, 10, cx + 8, 6, cx + 10, 11, BODY, 2, 1);
  bezier(base, cx + 2, 11, cx + 7, 8, cx + 9, 13, BODY, 2, 1);

  outline(base);

  // Fox-bird eye — almond shape on head
  base.set(cx + 2, 6, OUTLINE);
  base.set(cx + 3, 7, OUTLINE);
  base.set(cx + 2, 7, OUTLINE);
  base.set(cx + 2, 5, GLINT);

  // Ear tip (top of fox-ish head)
  base.set(cx - 1, 4, BODY);
  base.set(cx, 4, BODY);
  base.set(cx, 3, BODY);
  outline(base); // re-outline the ear tips
  base.set(cx, 3, OUTLINE);

  // Halo shard above head — thin vertical shard of light
  base.set(cx, 1, LIGHT);
  base.set(cx, 2, LIGHT);
  base.set(cx - 1, 2, GLINT);
  base.set(cx + 1, 2, GLINT);
  base.set(cx, 1, GLINT);

  // Tail plume (fox tail, downward)
  bezier(base, cx + 2, 15, cx + 5, 17, cx + 3, 19, 5, 2, 1);
  base.set(cx + 3, 17, GLINT);

  // Idle f2: wings flutter slightly up
  const f2 = base.clone();
  // shift wing top pixels up 1
  f2.set(cx - 9, 10, BODY);
  f2.set(cx - 9, 11, 0);
  f2.set(cx + 9, 10, BODY);
  f2.set(cx + 9, 11, 0);

  // Walk: wings pump
  const walk = framesFromDeltas(base, [
    (_f) => {},
    (f) => {
      // wings tuck slightly — wing tips move down 1
      f.set(cx - 9, 13, BODY);
      f.set(cx - 9, 12, 0);
      f.set(cx + 9, 13, BODY);
      f.set(cx + 9, 12, 0);
      const bob = bobFrame(base, -1);
      for (let y = 0; y < 5; y++) {
        const row = bob.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  // Jump
  const jump = framesFromDeltas(base, [
    (f) => {
      const sq = shiftFrame(base, 0, 1);
      for (let y = 0; y < H; y++) {
        const row = sq.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
    (f) => {
      const air = bobFrame(base, -2);
      for (let y = 0; y < H; y++) {
        const row = air.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  // Play
  const play = framesFromDeltas(base, [
    (f) => {
      const r = shiftFrame(base, 1, -1);
      for (let y = 0; y < H; y++) {
        const row = r.grid[y];
        if (row) f.grid[y] = [...row];
      }
      f.set(cx + 2, 1, GLINT); // halo flare
    },
    (f) => {
      const b = bobFrame(base, 1);
      for (let y = 0; y < H; y++) {
        const row = b.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  return {
    ...buildSprite('sprite-seraphix', [base, f2], 4),
    walk,
    jump,
    play,
  };
}

// ---------------------------------------------------------------------------
// Thoughtwarden (18×18) — small stone knight; gem core in chest, stiff cape
// ---------------------------------------------------------------------------

export function buildThoughtwarden(): SpriteDef {
  const W = 18;
  const H = 18;
  const cx = 9;

  const base = PixelCanvas.create(W, H);

  // Armored body — boxy rectangle torso
  fillRect(base, cx - 4, 8, cx + 4, 15, BODY);
  // Shoulder pauldrons (wider at top)
  fillRect(base, cx - 5, 8, cx + 5, 10, BODY);
  // Helmet — boxy top
  fillRect(base, cx - 3, 3, cx + 3, 8, BODY);
  // Helmet peak/crest
  fillPolygon(
    base,
    [
      [cx - 1, 1] as [number, number],
      [cx + 1, 1] as [number, number],
      [cx + 3, 3] as [number, number],
      [cx - 3, 3] as [number, number],
    ],
    BODY,
  );

  // Shadow on right side
  fillRect(base, cx + 2, 8, cx + 4, 15, SHADOW);
  base.set(cx + 3, 7, SHADOW);
  base.set(cx + 4, 8, SHADOW);
  base.set(cx + 5, 8, SHADOW);
  base.set(cx + 5, 9, SHADOW);
  base.set(cx + 5, 10, SHADOW);
  base.set(cx + 3, 3, SHADOW);
  base.set(cx + 3, 4, SHADOW);
  base.set(cx + 2, 3, SHADOW);

  // Light on left
  fillRect(base, cx - 4, 8, cx - 2, 12, LIGHT);
  base.set(cx - 3, 4, LIGHT);
  base.set(cx - 3, 5, LIGHT);
  base.set(cx - 4, 8, LIGHT);
  base.set(cx - 5, 9, LIGHT);

  // Rim
  base.set(cx - 5, 8, RIM);
  base.set(cx - 5, 9, RIM);
  base.set(cx - 5, 10, RIM);
  base.set(cx - 4, 7, RIM);

  // Stiff cape — behind the body, extends down and slightly wider
  base.set(cx - 6, 9, 5);
  base.set(cx - 6, 10, 5);
  base.set(cx - 6, 11, 5);
  base.set(cx - 6, 12, 5);
  base.set(cx - 6, 13, 5);
  base.set(cx - 7, 10, 5);
  base.set(cx - 7, 11, 5);
  base.set(cx - 7, 12, 5);
  base.set(cx + 6, 9, 5);
  base.set(cx + 6, 10, 5);
  base.set(cx + 6, 11, 5);
  base.set(cx + 6, 12, 5);
  base.set(cx + 6, 13, 5);
  base.set(cx + 7, 10, 5);
  base.set(cx + 7, 11, 5);
  base.set(cx + 7, 12, 5);

  // Visor slit — eye line
  fillRect(base, cx - 2, 5, cx + 2, 6, SHADOW);
  base.set(cx - 1, 5, OUTLINE);
  base.set(cx, 5, OUTLINE);
  base.set(cx + 1, 5, OUTLINE);

  outline(base);

  // Glowing gem core in chest — diamond shape, bright center
  base.set(cx, 11, GLINT);
  base.set(cx - 1, 11, LIGHT);
  base.set(cx + 1, 11, LIGHT);
  base.set(cx, 10, LIGHT);
  base.set(cx, 12, LIGHT);
  base.set(cx - 1, 12, SHADOW);
  base.set(cx + 1, 12, SHADOW);
  base.set(cx - 1, 10, SHADOW);
  base.set(cx + 1, 10, SHADOW);
  // Gem glow outline
  base.set(cx, 9, GLINT);
  base.set(cx, 13, GLINT);
  base.set(cx - 2, 11, GLINT);
  base.set(cx + 2, 11, GLINT);

  // Visor glint
  base.set(cx - 1, 5, GLINT);

  // Idle f2: gem pulse — shift glint pixels
  const f2 = base.clone();
  f2.set(cx - 1, 9, GLINT);
  f2.set(cx + 1, 9, GLINT);
  f2.set(cx - 1, 13, GLINT);
  f2.set(cx + 1, 13, GLINT);

  // Walk: stiff march
  const walk = framesFromDeltas(base, [
    (_f) => {},
    (f) => {
      // stiff bob + slightly shift body right (march step)
      const bob = bobFrame(base, -1);
      for (let y = 0; y < H; y++) {
        const row = bob.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  // Jump
  const jump = framesFromDeltas(base, [
    (f) => {
      const sq = shiftFrame(base, 0, 1);
      for (let y = 0; y < H; y++) {
        const row = sq.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
    (f) => {
      const air = bobFrame(base, -2);
      for (let y = 0; y < H; y++) {
        const row = air.grid[y];
        if (row) f.grid[y] = [...row];
      }
      // gem flares during jump
      f.set(cx, 9, GLINT);
      f.set(cx, 13, GLINT);
    },
  ]);

  // Play
  const play = framesFromDeltas(base, [
    (f) => {
      const r = shiftFrame(base, 1, 0);
      for (let y = 0; y < H; y++) {
        const row = r.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
    (f) => {
      const b = bobFrame(base, 1);
      for (let y = 0; y < H; y++) {
        const row = b.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  return {
    ...buildSprite('sprite-thoughtwarden', [base, f2], 3),
    walk,
    jump,
    play,
  };
}

// ---------------------------------------------------------------------------
// Halcyore (18×18) — serene crane; long neck curve, single tail plume, calm eyes
// ---------------------------------------------------------------------------

export function buildHalcyore(): SpriteDef {
  const W = 18;
  const H = 18;
  const cx = 9;

  const base = PixelCanvas.create(W, H);

  // Plump body — upright oval, lower in frame to leave room for long neck
  fillEllipse(base, cx, 14, 4, 3, BODY);
  // Breast (puffed forward)
  fillEllipse(base, cx + 1, 12, 3, 2, BODY);

  // Long graceful neck — S-curve: starts center, curves right, then back to center
  // Lower neck (curves right of body center)
  base.set(cx + 1, 10, BODY);
  base.set(cx + 2, 9, BODY);
  base.set(cx + 3, 8, BODY);
  // Upper neck (curves back left toward head)
  base.set(cx + 3, 7, BODY);
  base.set(cx + 2, 6, BODY);
  base.set(cx + 1, 5, BODY);

  // Head — small neat round head at top of neck
  fillEllipse(base, cx + 1, 4, 2, 2, BODY);

  // Pointed beak — horizontal, facing right
  base.set(cx + 3, 4, BODY);
  base.set(cx + 4, 4, BODY);
  base.set(cx + 5, 5, BODY);

  // Shadow on body right / bottom
  base.set(cx + 3, 12, SHADOW);
  base.set(cx + 4, 13, SHADOW);
  base.set(cx + 3, 14, SHADOW);
  base.set(cx + 2, 15, SHADOW);
  base.set(cx - 1, 15, SHADOW);
  base.set(cx, 16, SHADOW);
  base.set(cx + 1, 16, SHADOW);

  // Light on breast / neck left
  base.set(cx - 1, 10, LIGHT);
  base.set(cx, 10, LIGHT);
  base.set(cx - 2, 11, LIGHT);
  base.set(cx - 2, 12, LIGHT);
  base.set(cx + 1, 6, LIGHT);

  // Rim
  base.set(cx - 3, 11, RIM);
  base.set(cx - 3, 12, RIM);
  base.set(cx - 3, 13, RIM);

  // Single tail plume — single elegant line sweeping left and down
  bezier(base, cx - 3, 14, cx - 7, 15, cx - 8, 17, BODY, 2, 1);
  base.set(cx - 8, 17, LIGHT);
  base.set(cx - 9, 17, GLINT);

  // Legs — thin stalk legs with small feet
  base.set(cx - 1, 16, SHADOW);
  base.set(cx + 1, 16, SHADOW);
  base.set(cx - 1, 17, SHADOW);
  base.set(cx + 1, 17, SHADOW);
  // Feet
  base.set(cx - 2, 17, SHADOW);
  base.set(cx, 17, SHADOW);
  base.set(cx + 2, 17, SHADOW);

  outline(base);

  // Closed calm eye — a single horizontal line (serene, not a circle)
  base.set(cx + 2, 3, OUTLINE);
  base.set(cx + 3, 3, OUTLINE); // simple closed eye: one line
  base.set(cx + 2, 2, GLINT); // brow gleam

  // Idle f2: breathe bob up 1
  const f2 = bobFrame(base, -1);

  // Walk: graceful stride — neck sways
  const walk = framesFromDeltas(base, [
    (_f) => {},
    (f) => {
      // neck shifts slightly right, body bobs down 1
      f.set(cx + 3, 7, BODY);
      f.set(cx + 2, 7, 0);
      const bob = bobFrame(base, 1);
      for (let y = 8; y < H; y++) {
        const row = bob.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  // Jump
  const jump = framesFromDeltas(base, [
    (f) => {
      const sq = shiftFrame(base, 0, 1);
      for (let y = 0; y < H; y++) {
        const row = sq.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
    (f) => {
      const air = bobFrame(base, -2);
      for (let y = 0; y < H; y++) {
        const row = air.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  // Play
  const play = framesFromDeltas(base, [
    (f) => {
      // lean forward to toy — head dips down
      f.set(cx + 2, 6, 0);
      f.set(cx + 2, 5, BODY);
      f.set(cx + 3, 5, BODY);
      f.set(cx + 4, 6, BODY);
      f.set(cx + 4, 5, BODY);
    },
    (f) => {
      const b = bobFrame(base, 1);
      for (let y = 0; y < H; y++) {
        const row = b.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  return {
    ...buildSprite('sprite-halcyore', [base, f2], 4),
    walk,
    jump,
    play,
  };
}

// ---------------------------------------------------------------------------
// Aurelion (20×20) — THE STAR: lion cub of light; bold 5-spike mane, proud chest,
//   star mark on brow, tiny determined frown. ITERATED 5+ times.
// ---------------------------------------------------------------------------

export function buildAurelion(): SpriteDef {
  const W = 20;
  const H = 20;
  const cx = 10;

  const base = PixelCanvas.create(W, H);

  // ── BODY: seated proud cub pose ──────────────────────────────────────────
  // Haunches — wide low seat
  fillEllipse(base, cx, 16, 6, 3, BODY);
  // Torso — upright, proud
  fillEllipse(base, cx, 13, 5, 4, BODY);
  // Chest (puffed forward and light)
  fillEllipse(base, cx, 11, 4, 3, LIGHT);
  // Neck connector
  fillEllipse(base, cx, 9, 3, 2, BODY);

  // ── HEAD: bold round head ─────────────────────────────────────────────────
  fillEllipse(base, cx, 6, 4, 4, BODY);
  // Cheeks (wide face) — left half only, will mirror
  base.set(cx - 4, 7, BODY);
  base.set(cx - 5, 7, BODY);
  base.set(cx - 5, 6, BODY);
  base.set(cx - 4, 5, BODY);
  // Muzzle — flat lower face
  fillEllipse(base, cx, 8, 2, 2, LIGHT);

  mirrorX(base);

  // ── MANE: 5 BOLD spikes radiating from head — each spike is a clear pointed shape ──
  // Spike 1: top center — tall sharp spike
  fillPolygon(
    base,
    [[cx - 1, 3] as [number, number], [cx + 1, 3] as [number, number], [cx, 0] as [number, number]],
    BODY,
  );

  // Spike 2: upper-left (45°) — diagonal spike
  fillPolygon(
    base,
    [
      [cx - 3, 4] as [number, number],
      [cx - 2, 3] as [number, number],
      [cx - 6, 1] as [number, number],
      [cx - 7, 2] as [number, number],
    ],
    BODY,
  );

  // Spike 3: left — horizontal spike
  fillPolygon(
    base,
    [
      [cx - 5, 5] as [number, number],
      [cx - 5, 7] as [number, number],
      [cx - 9, 6] as [number, number],
    ],
    BODY,
  );

  // Spike 4: lower-left
  fillPolygon(
    base,
    [
      [cx - 4, 8] as [number, number],
      [cx - 3, 9] as [number, number],
      [cx - 7, 11] as [number, number],
      [cx - 8, 10] as [number, number],
    ],
    BODY,
  );

  // Spike 2R: upper-right
  fillPolygon(
    base,
    [
      [cx + 3, 4] as [number, number],
      [cx + 2, 3] as [number, number],
      [cx + 6, 1] as [number, number],
      [cx + 7, 2] as [number, number],
    ],
    BODY,
  );

  // Spike 3R: right
  fillPolygon(
    base,
    [
      [cx + 5, 5] as [number, number],
      [cx + 5, 7] as [number, number],
      [cx + 9, 6] as [number, number],
    ],
    BODY,
  );

  // Spike 4R: lower-right
  fillPolygon(
    base,
    [
      [cx + 4, 8] as [number, number],
      [cx + 3, 9] as [number, number],
      [cx + 7, 11] as [number, number],
      [cx + 8, 10] as [number, number],
    ],
    BODY,
  );

  // Inner mane ring (between body and spike roots) — slightly different tone
  for (let y = 3; y <= 10; y++) {
    for (let x = cx - 8; x <= cx + 8; x++) {
      const dx = x - cx;
      const dy = y - 6;
      const r2 = dx * dx + dy * dy;
      if (r2 >= 9 && r2 <= 30 && base.get(x, y) === 0) {
        base.set(x, y, 5);
      }
    }
  }

  // ── SHADOW / LIGHT on body ───────────────────────────────────────────────
  // Shadow on lower body/haunches
  base.set(cx - 3, 17, SHADOW);
  base.set(cx - 2, 18, SHADOW);
  base.set(cx + 2, 18, SHADOW);
  base.set(cx + 3, 17, SHADOW);
  base.set(cx + 4, 16, SHADOW);
  base.set(cx - 4, 16, SHADOW);
  base.set(cx + 5, 15, SHADOW);
  base.set(cx - 5, 15, SHADOW);

  // Light on chest (already set LIGHT above but reinforce top)
  base.set(cx - 1, 9, LIGHT);
  base.set(cx + 1, 9, LIGHT);

  // Mane spike tips — lighter (rim light on spike extremities)
  base.set(cx, 0, LIGHT);
  base.set(cx - 6, 1, LIGHT);
  base.set(cx + 6, 1, LIGHT);
  base.set(cx - 9, 6, RIM);
  base.set(cx + 9, 6, RIM);
  base.set(cx - 7, 11, RIM);
  base.set(cx + 7, 11, RIM);

  // Rim on body left edge
  base.set(cx - 5, 11, RIM);
  base.set(cx - 5, 12, RIM);
  base.set(cx - 5, 13, RIM);

  // ── FRONT PAWS ───────────────────────────────────────────────────────────
  base.set(cx - 3, 18, BODY);
  base.set(cx - 2, 18, BODY);
  base.set(cx - 3, 19, SHADOW);
  base.set(cx - 2, 19, SHADOW);
  base.set(cx + 3, 18, BODY);
  base.set(cx + 2, 18, BODY);
  base.set(cx + 3, 19, SHADOW);
  base.set(cx + 2, 19, SHADOW);

  outline(base);

  // ── FACE DETAILS ─────────────────────────────────────────────────────────
  // Eyes: bold 2x2 dark blocks with a white spark — must read at 1x.
  // Left eye
  base.set(cx - 3, 5, OUTLINE);
  base.set(cx - 2, 5, OUTLINE);
  base.set(cx - 3, 6, OUTLINE);
  base.set(cx - 2, 6, OUTLINE);
  base.set(cx - 2, 5, GLINT); // spark inside, top-inner
  // Right eye
  base.set(cx + 3, 5, OUTLINE);
  base.set(cx + 2, 5, OUTLINE);
  base.set(cx + 3, 6, OUTLINE);
  base.set(cx + 2, 6, OUTLINE);
  base.set(cx + 2, 5, GLINT);
  // Determined brow shadow above each eye
  base.set(cx - 3, 4, SHADOW);
  base.set(cx - 2, 4, SHADOW);
  base.set(cx + 3, 4, SHADOW);
  base.set(cx + 2, 4, SHADOW);

  // Tiny determined FROWN — 3 px, dropped a row clear of the nose
  base.set(cx - 1, 9, OUTLINE);
  base.set(cx, 9, OUTLINE);
  base.set(cx + 1, 9, OUTLINE);

  // Nose — small dark triangle at muzzle center
  base.set(cx - 1, 7, OUTLINE);
  base.set(cx, 7, OUTLINE);
  base.set(cx + 1, 7, OUTLINE);

  // STAR MARK on brow — stable LIGHT tone (GLINT animates and can vanish)
  base.set(cx, 2, LIGHT);
  base.set(cx, 3, LIGHT);
  base.set(cx - 1, 3, LIGHT);
  base.set(cx + 1, 3, LIGHT);
  base.set(cx, 4, LIGHT);
  base.set(cx, 4, GLINT);
  base.set(cx, 2, GLINT);

  // Mane glints — spike tips shimmer
  base.set(cx, 0, GLINT);
  base.set(cx - 6, 1, GLINT);
  base.set(cx + 6, 1, GLINT);
  base.set(cx - 9, 6, GLINT);
  base.set(cx + 9, 6, GLINT);

  // ── IDLE ANIMATION ────────────────────────────────────────────────────────
  // f2: proud breath — chest rises, star mark pulses
  const f2 = base.clone();
  // Chest up 1px (just light area)
  f2.set(cx - 1, 8, LIGHT);
  f2.set(cx + 1, 8, LIGHT);
  f2.set(cx, 8, LIGHT);
  // Mane shimmer — alternate spike glints
  f2.set(cx - 8, 10, GLINT);
  f2.set(cx + 8, 10, GLINT);
  f2.set(cx - 7, 11, 5);
  f2.set(cx + 7, 11, 5);

  // ── WALK: proud stride, faces RIGHT ───────────────────────────────────────
  const walk = framesFromDeltas(base, [
    // f0: left paw forward
    (f) => {
      // shift haunches down 1 + left paw raised
      f.set(cx - 3, 17, BODY);
      f.set(cx - 3, 18, 0);
      f.set(cx - 2, 17, BODY);
      f.set(cx - 2, 18, 0);
    },
    // f1: right paw forward
    (f) => {
      f.set(cx + 3, 17, BODY);
      f.set(cx + 3, 18, 0);
      f.set(cx + 2, 17, BODY);
      f.set(cx + 2, 18, 0);
      const bob = bobFrame(base, -1);
      for (let y = 0; y < 12; y++) {
        const row = bob.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  // ── JUMP ──────────────────────────────────────────────────────────────────
  const jump = framesFromDeltas(base, [
    // f0: crouch — body sinks, paws tuck
    (f) => {
      const sq = shiftFrame(base, 0, 1);
      for (let y = 0; y < H; y++) {
        const row = sq.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
    // f1: air-stretch — body rises, all mane spikes flare
    (f) => {
      const air = bobFrame(base, -2);
      for (let y = 0; y < H; y++) {
        const row = air.grid[y];
        if (row) f.grid[y] = [...row];
      }
      // all spike tips flare
      f.set(cx - 6, 1, GLINT);
      f.set(cx + 6, 1, GLINT);
    },
  ]);

  // ── PLAY ──────────────────────────────────────────────────────────────────
  const play = framesFromDeltas(base, [
    // f0: reach + bat paw forward
    (f) => {
      const r = shiftFrame(base, 1, -1);
      for (let y = 0; y < H; y++) {
        const row = r.grid[y];
        if (row) f.grid[y] = [...row];
      }
      // leading paw reaches
      f.set(cx + 5, 18, BODY);
      f.set(cx + 6, 17, BODY);
    },
    // f1: bounce back with mane shimmer
    (f) => {
      const b = bobFrame(base, 1);
      for (let y = 0; y < H; y++) {
        const row = b.grid[y];
        if (row) f.grid[y] = [...row];
      }
      f.set(cx, 1, GLINT);
    },
  ]);

  return {
    ...buildSprite('sprite-aurelion', [base, f2], 3),
    walk,
    jump,
    play,
  };
}

// ---------------------------------------------------------------------------
// Mindspire (20×20) — crystal jellyfish; faceted dome bell, 3 shard tendrils, inner glow
// ---------------------------------------------------------------------------

export function buildMindspire(): SpriteDef {
  const W = 20;
  const H = 20;
  const cx = 10;

  const base = PixelCanvas.create(W, H);

  // ── BELL: dome-shaped crystal bell — half-ellipse (rounded top, flat bottom) ──
  // Fill entire dome first with body tone
  for (let y = 2; y <= 10; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx;
      const dy = y - 9; // center below midline so it's a half-dome
      // Wider top, narrower as we go down — use ellipse equation (rx=8, ry=8)
      // but only upper half (y <= 9)
      if ((dx * dx) / 64 + (dy * dy) / 64 <= 1 || y <= 9) {
        // dome outline: wide at top (y=2 spans ±7), narrowing at bottom (y=9 spans ±0)
        const halfW = Math.round(7 * Math.sqrt(Math.max(0, 1 - ((y - 9) * (y - 9)) / 49)));
        if (Math.abs(dx) <= halfW && y <= 9) {
          base.set(x, y, BODY);
        }
      }
    }
  }
  // Flat bottom skirt of bell
  fillRect(base, cx - 5, 9, cx + 5, 10, BODY);
  fillRect(base, cx - 4, 11, cx + 4, 11, BODY);

  // Facet shading: left half shadow, right half light, center strip bright
  // Left quarter shadow
  for (let y = 2; y <= 11; y++) {
    for (let x = 0; x < cx - 1; x++) {
      if (base.get(x, y) > 0) base.set(x, y, SHADOW);
    }
  }
  // Right quarter light
  for (let y = 2; y <= 11; y++) {
    for (let x = cx + 2; x < W; x++) {
      if (base.get(x, y) > 0) base.set(x, y, LIGHT);
    }
  }
  // Center vertical stripe — brighter (inner glow shows through)
  for (let y = 2; y <= 9; y++) {
    if (base.get(cx - 1, y) > 0) base.set(cx - 1, y, BODY);
    if (base.get(cx, y) > 0) base.set(cx, y, 11);
    if (base.get(cx + 1, y) > 0) base.set(cx + 1, y, BODY);
  }

  // Rim on lit dome top-left edge
  base.set(cx - 5, 3, RIM);
  base.set(cx - 6, 4, RIM);
  base.set(cx - 6, 5, RIM);
  base.set(cx - 6, 6, RIM);
  base.set(cx - 5, 2, RIM);

  // ── INNER GLOW: bright nucleus at bell center ─────────────────────────────
  base.set(cx, 6, GLINT);
  base.set(cx - 1, 6, GLINT);
  base.set(cx + 1, 6, 11);
  base.set(cx, 5, 11);

  // ── TENDRILS: three shard tendrils hanging from bell skirt ────────────────
  // Left tendril — diagonal left
  base.set(cx - 3, 12, 5);
  base.set(cx - 4, 13, 5);
  base.set(cx - 5, 14, 5);
  base.set(cx - 5, 15, LIGHT);
  base.set(cx - 5, 16, GLINT); // tip sparkle

  // Center tendril — straight down, longer
  base.set(cx, 12, 5);
  base.set(cx, 13, 5);
  base.set(cx, 14, 5);
  base.set(cx, 15, LIGHT);
  base.set(cx, 16, GLINT);

  // Right tendril — diagonal right
  base.set(cx + 3, 12, 5);
  base.set(cx + 4, 13, 5);
  base.set(cx + 5, 14, 5);
  base.set(cx + 5, 15, LIGHT);
  base.set(cx + 5, 16, GLINT);

  outline(base);

  // Facet divider lines — vertical seam in dome
  // Left seam (where shadow meets center)
  for (let y = 3; y <= 9; y++) {
    if (base.get(cx - 2, y) > 0 && base.get(cx - 1, y) > 0) base.set(cx - 2, y, OUTLINE);
  }
  // Right seam (where center meets light)
  for (let y = 3; y <= 9; y++) {
    if (base.get(cx + 2, y) > 0 && base.get(cx + 1, y) > 0) base.set(cx + 2, y, 9);
  }

  // Extra glow glints
  base.set(cx + 1, 5, GLINT);
  base.set(cx - 1, 7, GLINT);

  // Idle f2: float bob + tendrils sway gently
  const f2 = base.clone();
  f2.set(cx - 5, 16, 0);
  f2.set(cx - 4, 16, GLINT); // left tip shifts
  f2.set(cx + 5, 16, 0);
  f2.set(cx + 6, 16, GLINT); // right tip shifts
  f2.set(cx, 6, 11); // inner glow pulses
  f2.set(cx - 1, 6, 11);
  // Bob up 1
  const f2b = bobFrame(f2, -1);
  for (let y = 0; y < H; y++) {
    const row = f2b.grid[y];
    if (row) f2.grid[y] = [...row];
  }

  // Walk: drift — tendrils trail behind
  const walk = framesFromDeltas(base, [
    (_f) => {},
    (f) => {
      // tendrils shift right (trailing effect when moving right)
      f.set(cx - 3, 12, 0);
      f.set(cx - 2, 12, 5);
      const bob = bobFrame(base, -1);
      for (let y = 0; y < 4; y++) {
        const row = bob.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  // Jump
  const jump = framesFromDeltas(base, [
    (f) => {
      const sq = shiftFrame(base, 0, 1);
      for (let y = 0; y < H; y++) {
        const row = sq.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
    (f) => {
      const air = bobFrame(base, -2);
      for (let y = 0; y < H; y++) {
        const row = air.grid[y];
        if (row) f.grid[y] = [...row];
      }
      f.set(cx, 3, GLINT);
      f.set(cx - 1, 3, GLINT);
      f.set(cx + 1, 3, GLINT);
    },
  ]);

  // Play
  const play = framesFromDeltas(base, [
    (f) => {
      const r = shiftFrame(base, 1, -1);
      for (let y = 0; y < H; y++) {
        const row = r.grid[y];
        if (row) f.grid[y] = [...row];
      }
      f.set(cx + 7, 15, LIGHT);
      f.set(cx + 7, 16, GLINT);
    },
    (f) => {
      const b = bobFrame(base, 1);
      for (let y = 0; y < H; y++) {
        const row = b.grid[y];
        if (row) f.grid[y] = [...row];
      }
    },
  ]);

  return {
    ...buildSprite('sprite-mindspire', [base, f2], 3),
    walk,
    jump,
    play,
  };
}

// ---------------------------------------------------------------------------
// Export — all Aether-line sprites
// ---------------------------------------------------------------------------

/** All Aether-line sprites (egg + species). */
export const aetherSprites: SpriteDef[] = [
  buildMote(),
  buildWisp(),
  buildAetherling(),
  buildMurmur(),
  buildOraclet(),
  buildCirrux(),
  buildNimbusk(),
  buildSeraphix(),
  buildThoughtwarden(),
  buildHalcyore(),
  buildAurelion(),
  buildMindspire(),
];
