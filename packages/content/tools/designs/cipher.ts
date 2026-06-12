/**
 * Cipher line sprite designs (House: Cipher — angular/glyph, PWR-leaning).
 *
 * Hard angles, rune marks, one glowing accent per creature. Every pixel is
 * deliberate at these tiny sizes. Tones not gradients: pick 4-5 ramp indices
 * and commit. Flat readable planes beat noise.
 *
 * Sizes (new compact spec, all even):
 *   sprite-stage 12x12  — glyphit
 *   rookie      14x14  — cipherling, bitfang
 *   evolved     16x16  — runeclaw, vectorix, glyphound
 *   prime       18x18  — cryptarch, matrixion, sigilus
 *   apex        20x20  — enigmax, keystrix
 *
 * Animation banks (required for every species):
 *   idle  2f breath/blink
 *   walk  2f side-stride or drift-lean (faces RIGHT — engine flips for left)
 *   jump  2f crouch / stretched-air
 *   play  2f reach/bounce toward toy
 *
 * Tone vocabulary (no large dither fields):
 *   outline 1 | shadow 3-4 | mid 6-7 | light 10-11 | rim 13 | glint 15
 * At most a 2-3 px dither seam where two tones meet. Flat planes first.
 *
 * Determinism: no Math.random / Date.now. LCG seeded on id for scatter.
 */

import type { SpriteDef } from '@token-tamers/core';
import {
  PixelCanvas,
  buildSprite,
  fillRect,
  fillPolygon,
  line,
  px,
  mirrorX,
  outline,
  rimLight,
  bobFrame,
  glyphStamp,
  OUTLINE,
  GLINT,
  RIM_LO,
  RIM_HI,
} from '../sprite-lib';

// ---------------------------------------------------------------------------
// Tone constants — the committed palette for Cipher (flat planes, not blobs)
// ---------------------------------------------------------------------------

/** Darkest body / deep shadow. */
const SH = 3;
/** Shadow-mid — main body fill. */
const MD = 6;
/** Mid-light — secondary surfaces, lighter panels. */
const LT = 10;
/** Bright highlight — lit face. */
const HL = 13;

// ---------------------------------------------------------------------------
// Tiny shared bitmaps for Cipher sigils (3x3 rune marks).
// ---------------------------------------------------------------------------

/** Angular rune cross — 3x3. */
const RUNE3: number[][] = [
  [1, 1, 1],
  [1, 0, 1],
  [1, 1, 1],
];

/** Chevron — 3x2 pointing right. */
const CHEV: number[][] = [
  [1, 0, 1],
  [0, 1, 0],
];

// ---------------------------------------------------------------------------
// sprite-glyphit — 12x12, living rune pebble; one bright sigil eye,
// two stub feet, head tilt right.
// Silhouette: a flat-edged rounded pebble with a single huge eye-glyph.
// Signature: the glowing sigil eye IS the face — 4x4 bright slab, one slit.
// ---------------------------------------------------------------------------

function buildGlyphit(): SpriteDef {
  const W = 12;
  const H = 12;

  // Base canvas — draw once, frames branch from this.
  const make = (): PixelCanvas => {
    const c = PixelCanvas.create(W, H);

    // Body: angular pebble — 10x8 solid block with clipped corners (octagon).
    // Left half only (x 0..5), mirrorX adds right half.
    fillPolygon(
      c,
      [
        [1, 2],
        [5, 2],
        [5, 9],
        [1, 9],
      ],
      MD,
    );
    // Clip top-left corner.
    px(c, 1, 2, 0);
    // Flat top cap.
    fillRect(c, 2, 1, 5, 2, SH);

    mirrorX(c);
    outline(c);
    rimLight(c, 'upper-left');

    // Sigil eye — bright wide slab in upper body, center.
    // Eye socket (dark surround).
    fillRect(c, 3, 3, 8, 5, SH);
    // Iris (bright).
    fillRect(c, 4, 3, 7, 5, LT);
    // Pupil slit.
    fillRect(c, 5, 3, 6, 5, OUTLINE);
    // Glint on pupil.
    px(c, 5, 3, GLINT);

    // Rune mark below eye.
    glyphStamp(c, 4, 6, RUNE3, GLINT);
    // Dither seam: 1px lighter row at rune border.
    px(c, 5, 6, MD);

    // Stub feet.
    px(c, 3, 10, SH);
    px(c, 4, 10, SH);
    px(c, 7, 10, SH);
    px(c, 8, 10, SH);

    return c;
  };

  const base = make();

  // Idle frame 2: blink (eye slit closes to outline row).
  const f2 = base.clone();
  fillRect(f2, 4, 3, 7, 5, SH); // clear iris
  fillRect(f2, 3, 4, 8, 4, OUTLINE); // blink line
  // Rune still glows.
  glyphStamp(f2, 4, 6, RUNE3, GLINT);

  // Walk bank: 2f side-stride lean (facing right — shift feet, tilt body).
  // Walk f0 = neutral stride (base reused).
  // Walk f1 = lean-step right.
  const wf1 = base.clone();
  // Lean: shift top body right 1px (darken left edge, lighten right).
  px(wf1, 1, 2, 0); // remove leftmost top pixel
  px(wf1, 1, 3, 0);
  px(wf1, 10, 2, MD); // extend right
  px(wf1, 10, 3, MD);
  // Advance left foot forward (to right in walk direction).
  px(wf1, 3, 10, 0);
  px(wf1, 9, 10, SH); // right foot back

  // Jump bank: 2f crouch / air-stretch.
  const jcrouch = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jcrouch.set(x, y + 1, idx));

  const jair = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jair.set(x, y - 1, idx));

  // Play bank: 2f reach/bounce toward toy.
  // Reach: tilt head right.
  const preach = base.clone();
  px(preach, 9, 1, MD); // top-right up.
  px(preach, 9, 2, 0); // clear old pixel.

  // Bounce: body down 1px + rune flares.
  const pbouncec = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => pbouncec.set(x, y + 1, idx));
  glyphStamp(pbouncec, 4, 7, RUNE3, RIM_LO);

  return {
    ...buildSprite('sprite-glyphit', [base.grid, f2.grid], 3),
    walk: [base.grid, wf1.grid],
    jump: [jcrouch.grid, jair.grid],
    play: [preach.grid, pbouncec.grid],
  };
}

// ---------------------------------------------------------------------------
// sprite-cipherling — 14x14, zigzag imp; lightning antenna, wide mischief
// grin, 3-finger wave (left hand raised). Faces right.
// Signature: the zigzag lightning antenna is the 5-second-doodle feature.
// ---------------------------------------------------------------------------

function buildCipherling(): SpriteDef {
  const W = 14;
  const H = 14;

  const make = (): PixelCanvas => {
    const c = PixelCanvas.create(W, H);

    // Head: angular hexagon — upper body.
    fillPolygon(
      c,
      [
        [4, 2],
        [9, 2],
        [10, 4],
        [9, 7],
        [4, 7],
        [3, 4],
      ],
      MD,
    );

    // Torso: triangular body below head.
    fillPolygon(
      c,
      [
        [3, 7],
        [10, 7],
        [9, 11],
        [5, 11],
      ],
      SH,
    );

    // Left arm (down at side).
    px(c, 2, 8, SH);
    px(c, 2, 9, SH);
    px(c, 2, 10, SH);
    // Right arm raised (3-finger wave).
    px(c, 11, 7, LT);
    px(c, 11, 8, LT);
    px(c, 12, 6, LT); // three fingers.
    px(c, 12, 7, LT);
    px(c, 11, 5, LT);

    // Legs: two stub legs.
    px(c, 5, 12, SH);
    px(c, 5, 13, SH);
    px(c, 8, 12, SH);
    px(c, 8, 13, SH);

    // Antenna (zigzag lightning — left half, from head top).
    px(c, 6, 1, MD);
    px(c, 7, 0, SH);
    px(c, 8, 1, MD);
    // Zigzag tip (glint node).
    px(c, 8, 0, GLINT);

    outline(c);
    rimLight(c, 'upper-left');

    // Eyes: left eye wide (imp grin = wide set).
    // Left eye: dark + glint.
    px(c, 5, 4, OUTLINE);
    px(c, 5, 5, OUTLINE);
    px(c, 5, 3, GLINT);
    // Right eye.
    px(c, 8, 4, OUTLINE);
    px(c, 8, 5, OUTLINE);
    px(c, 8, 3, GLINT);

    // Mischief grin: wide line from 4 to 9 with upturned corners.
    line(c, 4, 6, 9, 6, OUTLINE);
    px(c, 4, 5, OUTLINE); // left corner up.
    px(c, 9, 5, OUTLINE); // right corner up.

    // Antenna glint re-stamp (outline may overwrite).
    px(c, 8, 0, GLINT);

    return c;
  };

  const base = make();

  // Idle f2: antenna node pulses, bob +1.
  const f2 = bobFrame(base, 1);
  px(f2, 8, 1, GLINT);
  px(f2, 7, 1, RIM_LO);

  // Walk f0: neutral (base). Walk f1: mid-stride lean.
  const wf1 = base.clone();
  // Lean forward (toward right): shift torso top.
  px(wf1, 3, 7, 0); // trim left torso.
  px(wf1, 10, 7, SH); // add right.
  // Swing left arm back.
  px(wf1, 2, 7, SH);
  px(wf1, 2, 8, SH);
  px(wf1, 2, 10, 0);
  // Advance right leg.
  px(wf1, 9, 12, SH);
  px(wf1, 9, 13, SH);
  px(wf1, 5, 13, 0);

  // Jump f0: crouch (shift down 1).
  const jcrouch = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jcrouch.set(x, y + 1, idx));

  // Jump f1: air (shift up 1, arms spread).
  const jair = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jair.set(x, y - 1, idx));
  // Arms spread in air.
  px(jair, 1, 7, LT);
  px(jair, 12, 5, LT);

  // Play f0: reach toward toy (lean right + arm extend).
  const pf0 = base.clone();
  // Extend right arm further.
  px(pf0, 13, 6, LT);
  px(pf0, 13, 7, LT);
  px(pf0, 12, 5, LT);

  // Play f1: bounce back (bob down).
  const pf1 = bobFrame(base, 1);
  px(pf1, 8, 1, GLINT);

  return {
    ...buildSprite('sprite-cipherling', [base.grid, f2.grid], 3),
    walk: [base.grid, wf1.grid],
    jump: [jcrouch.grid, jair.grid],
    play: [pf0.grid, pf1.grid],
  };
}

// ---------------------------------------------------------------------------
// sprite-bitfang — 14x14, cube pup; jaw IS half the body, four square teeth,
// stumpy legs. Faces right (walk direction).
// Signature: oversized square jaw taking up bottom 5 rows of body.
// ---------------------------------------------------------------------------

function buildBitfang(): SpriteDef {
  const W = 14;
  const H = 14;

  const make = (): PixelCanvas => {
    const c = PixelCanvas.create(W, H);

    // Upper head block: rows 1-5 (wide flat head).
    fillRect(c, 2, 1, 11, 5, MD);

    // Ear stubs: left only, mirrorX adds right.
    px(c, 2, 0, SH);
    px(c, 3, 0, SH);

    mirrorX(c);

    // Big square jaw (lower body — rows 5-10, even wider).
    fillRect(c, 1, 5, 12, 10, SH);

    // Four square teeth protruding down from jaw bottom.
    // Tooth 1.
    fillRect(c, 2, 10, 3, 11, LT);
    // Tooth 2.
    fillRect(c, 5, 10, 6, 11, LT);
    // Tooth 3.
    fillRect(c, 7, 10, 8, 11, LT);
    // Tooth 4.
    fillRect(c, 10, 10, 11, 11, LT);
    // Gaps between teeth (transparent).
    for (let y = 10; y <= 11; y++) {
      px(c, 4, y, 0);
      px(c, 9, y, 0);
    }

    // Stumpy legs.
    fillRect(c, 3, 12, 5, 13, SH);
    fillRect(c, 8, 12, 10, 13, SH);

    outline(c);
    rimLight(c, 'upper-left');

    // Eyes: square block eyes, left half.
    fillRect(c, 3, 2, 4, 3, OUTLINE);
    px(c, 3, 2, GLINT);
    // Right eye (mirrored position x = W-1 - x).
    fillRect(c, 9, 2, 10, 3, OUTLINE);
    px(c, 9, 2, GLINT);

    // Circuit marks on jaw.
    px(c, 6, 7, GLINT);
    px(c, 7, 7, GLINT);

    return c;
  };

  const base = make();

  // Idle f2: mouth clamp (jaw row gap animates).
  const f2 = base.clone();
  // Darken jaw seam line.
  line(f2, 1, 5, 12, 5, OUTLINE);

  // Walk f0: base. Walk f1: stomp stride.
  const wf1 = base.clone();
  // Advance right leg forward, pull left back.
  fillRect(wf1, 8, 12, 10, 13, 0);
  fillRect(wf1, 9, 12, 11, 13, SH); // right leg forward.
  fillRect(wf1, 3, 12, 5, 13, 0);
  fillRect(wf1, 2, 12, 4, 13, SH); // left leg back.

  // Jump f0: crouch (body compressed down).
  const jcrouch = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jcrouch.set(x, y + 1, idx));

  // Jump f1: air stretch (body up 1, legs dangle).
  const jair = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jair.set(x, y - 1, idx));

  // Play f0: snap jaw open (teeth gap wider).
  const pf0 = base.clone();
  line(pf0, 1, 10, 12, 10, 0); // open gap.
  fillRect(pf0, 1, 11, 12, 12, SH); // jaw drops.
  px(pf0, 6, 8, GLINT);
  px(pf0, 7, 8, GLINT);

  // Play f1: snap closed, bounce.
  const pf1 = bobFrame(base, 1);

  return {
    ...buildSprite('sprite-bitfang', [base.grid, f2.grid], 3),
    walk: [base.grid, wf1.grid],
    jump: [jcrouch.grid, jair.grid],
    play: [pf0.grid, pf1.grid],
  };
}

// ---------------------------------------------------------------------------
// sprite-runeclaw — 16x16, low pouncing hunter; visor eye-slit across the
// face, two oversized engraved front claws. Profile facing right.
// Signature: wide visor slit + claws wider than the head.
// ---------------------------------------------------------------------------

function buildRuneclaw(): SpriteDef {
  const W = 16;
  const H = 16;

  const make = (): PixelCanvas => {
    const c = PixelCanvas.create(W, H);

    // Sleek body: low horizontal wedge.
    fillPolygon(
      c,
      [
        [4, 6],
        [13, 6],
        [14, 8],
        [14, 11],
        [12, 12],
        [4, 12],
        [2, 11],
        [2, 8],
      ],
      MD,
    );

    // Head: angular wedge on left, pointing right.
    fillPolygon(
      c,
      [
        [2, 4],
        [8, 4],
        [10, 6],
        [8, 8],
        [2, 8],
        [0, 6],
      ],
      LT,
    );

    // Visor eye-slit: dark horizontal bar across head center.
    line(c, 1, 6, 9, 6, OUTLINE);
    // Glowing eye through slit.
    px(c, 4, 6, GLINT);
    px(c, 5, 6, GLINT);

    // Tail: angular upswept spike at right.
    fillPolygon(
      c,
      [
        [13, 6],
        [15, 4],
        [15, 7],
        [14, 8],
      ],
      SH,
    );
    px(c, 15, 4, GLINT);

    // LEFT front claw: oversized, wider than the head. Left of x=2.
    fillPolygon(
      c,
      [
        [0, 9],
        [3, 8],
        [4, 12],
        [2, 14],
        [0, 13],
      ],
      SH,
    );
    // Claw engraving (rune mark).
    px(c, 1, 10, GLINT);
    px(c, 2, 11, GLINT);
    // Claw tip.
    px(c, 0, 14, LT);

    // RIGHT front claw (mirrored position — second claw at right).
    fillPolygon(
      c,
      [
        [11, 8],
        [14, 9],
        [15, 13],
        [13, 14],
        [11, 13],
      ],
      SH,
    );
    px(c, 12, 10, GLINT);
    px(c, 13, 11, GLINT);
    px(c, 14, 14, LT);

    // Hind legs: two stubs.
    fillRect(c, 5, 12, 7, 15, SH);
    fillRect(c, 9, 12, 11, 15, SH);

    outline(c);
    rimLight(c, 'upper-left');

    // Re-stamp glints after outline.
    px(c, 4, 6, GLINT);
    px(c, 5, 6, GLINT);
    px(c, 15, 4, GLINT);
    px(c, 1, 10, GLINT);
    px(c, 2, 11, GLINT);
    px(c, 12, 10, GLINT);
    px(c, 13, 11, GLINT);

    return c;
  };

  const base = make();

  // Idle f2: bob -1 (head raise).
  const f2 = bobFrame(base, -1);

  // Walk f0: base. Walk f1: prowl-stride.
  const wf1 = base.clone();
  // Advance body slightly right.
  px(wf1, 5, 12, 0);
  px(wf1, 6, 12, SH);
  px(wf1, 10, 12, SH);
  px(wf1, 10, 13, SH);
  px(wf1, 5, 15, 0);
  px(wf1, 12, 13, SH);

  // Jump f0: coiled crouch (body squished down).
  const jcrouch = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => {
    if (y < 12) jcrouch.set(x, y + 1, idx);
    else jcrouch.set(x, y, idx);
  });

  // Jump f1: pounce air (body shifts up, claws extend).
  const jair = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jair.set(x, y - 1, idx));
  // Claws extend down in air.
  px(jair, 0, 14, LT);
  px(jair, 14, 14, LT);

  // Play f0: swipe claw (left claw forward).
  const pf0 = base.clone();
  px(pf0, 0, 13, LT);
  px(pf0, 0, 15, LT);
  px(pf0, 1, 15, GLINT);

  // Play f1: bob bounce.
  const pf1 = bobFrame(base, 1);

  return {
    ...buildSprite('sprite-runeclaw', [base.grid, f2.grid], 3),
    walk: [base.grid, wf1.grid],
    jump: [jcrouch.grid, jair.grid],
    play: [pf0.grid, pf1.grid],
  };
}

// ---------------------------------------------------------------------------
// sprite-vectorix — 16x16, dart hawk; chevron head, swept delta wings,
// single keen eye on the wedge-tip. Profile facing right.
// Signature: entire body IS a swept delta chevron — no separated parts.
// ---------------------------------------------------------------------------

function buildVectorix(): SpriteDef {
  const W = 16;
  const H = 16;

  const make = (): PixelCanvas => {
    const c = PixelCanvas.create(W, H);

    // Main body: swept delta — a long horizontal wedge.
    fillPolygon(
      c,
      [
        [0, 7], // tail tip (left)
        [6, 5],
        [15, 7], // head tip (right)
        [6, 9],
      ],
      MD,
    );

    // Top delta wing: swept up-right from body.
    fillPolygon(
      c,
      [
        [4, 5],
        [13, 2],
        [15, 4],
        [10, 6],
      ],
      SH,
    );

    // Bottom delta wing: swept down-right.
    fillPolygon(
      c,
      [
        [4, 9],
        [10, 10],
        [15, 10],
        [13, 12],
      ],
      SH,
    );

    // Chevron head band: 3 stacked chevron lines to mark the head.
    px(c, 13, 6, LT);
    px(c, 14, 7, LT);
    px(c, 13, 8, LT);

    outline(c);
    rimLight(c, 'upper-left');

    // Single keen eye at beak tip (right-most body pixel area).
    px(c, 14, 7, OUTLINE);
    px(c, 13, 6, GLINT); // glint above eye.

    // Chevron body marks (speed lines).
    glyphStamp(c, 5, 6, CHEV, LT);
    glyphStamp(c, 8, 6, CHEV, MD);

    // Tail glint.
    px(c, 0, 7, GLINT);

    return c;
  };

  const base = make();

  // Idle f2: drift lean -1 (bob up).
  const f2 = bobFrame(base, -1);
  px(f2, 0, 6, GLINT);

  // Walk f0: base glide. Walk f1: wing-beat (wings shift).
  const wf1 = base.clone();
  // Top wing rises 1px.
  px(wf1, 13, 1, SH);
  px(wf1, 13, 2, 0);
  px(wf1, 14, 3, SH);
  // Bottom wing lowers 1px.
  px(wf1, 13, 13, SH);
  px(wf1, 13, 12, 0);

  // Jump f0: steep climb (shift body up + wings up).
  const jcrouch = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jcrouch.set(x, y + 1, idx));

  const jair = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jair.set(x, y - 2, idx));
  px(jair, 0, 5, GLINT);

  // Play f0: banking turn (lean into body).
  const pf0 = base.clone();
  // Tilt effect: shift top of body up.
  px(pf0, 14, 6, MD);
  px(pf0, 14, 7, 0);
  px(pf0, 15, 6, LT);

  // Play f1: bob back to level.
  const pf1 = bobFrame(base, 1);

  return {
    ...buildSprite('sprite-vectorix', [base.grid, f2.grid], 4),
    walk: [base.grid, wf1.grid],
    jump: [jcrouch.grid, jair.grid],
    play: [pf0.grid, pf1.grid],
  };
}

// ---------------------------------------------------------------------------
// sprite-glyphound — 16x16, sleek greyhound profile; glowing collar ring,
// circuit line on flank. Profile facing right.
// Signature: the glowing collar node + long lean body in 16 pixels.
// ---------------------------------------------------------------------------

function buildGlyphound(): SpriteDef {
  const W = 16;
  const H = 16;

  const make = (): PixelCanvas => {
    const c = PixelCanvas.create(W, H);

    // Long lean body: narrow horizontal ellipse-ish polygon.
    fillPolygon(
      c,
      [
        [3, 6],
        [13, 5],
        [15, 7],
        [15, 10],
        [13, 11],
        [3, 11],
        [1, 9],
        [1, 7],
      ],
      MD,
    );

    // Head: angular, forward-thrust (right side).
    fillPolygon(
      c,
      [
        [12, 3],
        [15, 5],
        [15, 7],
        [12, 8],
        [10, 6],
        [10, 4],
      ],
      LT,
    );

    // Snout protrusion.
    px(c, 15, 6, LT);

    // Ear: flat spike back.
    fillPolygon(
      c,
      [
        [12, 2],
        [14, 1],
        [15, 3],
        [13, 4],
      ],
      SH,
    );

    // Tail: curved upward at left.
    px(c, 1, 5, SH);
    px(c, 0, 4, SH);
    px(c, 0, 3, MD);
    px(c, 1, 3, MD);
    px(c, 0, 3, GLINT); // tail tip glint.

    // Front legs (right side — facing right).
    fillRect(c, 13, 11, 14, 15, SH);
    px(c, 12, 15, SH); // front paw extends.

    // Back legs (left side).
    fillRect(c, 3, 11, 4, 14, SH);
    px(c, 2, 14, SH); // back paw.
    px(c, 5, 11, SH);
    px(c, 5, 12, SH);

    outline(c);
    rimLight(c, 'upper-left');

    // Eye: single dot + glint.
    px(c, 14, 5, OUTLINE);
    px(c, 14, 4, GLINT);

    // GLOWING COLLAR: bright ring at neck junction (x 10-12, y 6-8).
    px(c, 10, 6, GLINT);
    px(c, 10, 7, RIM_LO);
    px(c, 10, 8, GLINT);
    px(c, 11, 6, RIM_LO);
    px(c, 11, 8, RIM_LO);
    px(c, 12, 7, GLINT);

    // Circuit line on flank: single glint-px line.
    px(c, 6, 7, GLINT);
    px(c, 7, 7, GLINT);
    px(c, 8, 7, GLINT);

    return c;
  };

  const base = make();

  // Idle f2: tail wag (tail tip shifts).
  const f2 = base.clone();
  px(f2, 0, 3, 0);
  px(f2, 0, 2, MD);
  px(f2, 1, 2, MD);
  px(f2, 0, 2, GLINT);

  // Walk f0: base. Walk f1: stride.
  const wf1 = base.clone();
  // Front leg forward.
  fillRect(wf1, 13, 11, 14, 15, 0);
  fillRect(wf1, 14, 11, 15, 15, SH);
  px(wf1, 13, 15, SH);
  // Back leg back.
  fillRect(wf1, 3, 11, 4, 14, 0);
  fillRect(wf1, 2, 11, 3, 14, SH);

  // Jump f0: coiled (body down 1).
  const jcrouch = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jcrouch.set(x, y + 1, idx));

  // Jump f1: stretched air (body up 1, legs dangle).
  const jair = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jair.set(x, y - 1, idx));

  // Play f0: play-bow (front down, rear up).
  const pf0 = base.clone();
  // Front of body dips.
  px(pf0, 14, 9, MD);
  px(pf0, 15, 9, MD);
  px(pf0, 15, 7, 0);
  // Collar glints extra bright.
  px(pf0, 10, 6, RIM_HI);
  px(pf0, 10, 8, RIM_HI);

  // Play f1: bounce up.
  const pf1 = bobFrame(base, -1);

  return {
    ...buildSprite('sprite-glyphound', [base.grid, f2.grid], 3),
    walk: [base.grid, wf1.grid],
    jump: [jcrouch.grid, jair.grid],
    play: [pf0.grid, pf1.grid],
  };
}

// ---------------------------------------------------------------------------
// sprite-cryptarch — 18x18, little key-keeper monk; lock-shaped chest plate,
// one floating key orbiting, sleeves over hands. Upright profile.
// Signature: the floating orbiting key (a separate pixel cluster off the body).
// ---------------------------------------------------------------------------

function buildCryptarch(): SpriteDef {
  const W = 18;
  const H = 18;

  const make = (): PixelCanvas => {
    const c = PixelCanvas.create(W, H);

    // Robe body: wide trapezoid, narrow at top.
    fillPolygon(
      c,
      [
        [5, 9],
        [13, 9],
        [14, 11],
        [15, 16],
        [3, 16],
        [4, 11],
      ],
      MD,
    );

    // Robe layer lines (stacked horizontal dark seams).
    line(c, 5, 11, 13, 11, SH);
    line(c, 4, 13, 14, 13, SH);

    // Head: angular dome.
    fillPolygon(
      c,
      [
        [6, 3],
        [12, 3],
        [13, 5],
        [12, 8],
        [6, 8],
        [5, 5],
      ],
      LT,
    );

    // Hood/cowl: dark cap over head.
    fillRect(c, 6, 2, 12, 4, SH);
    px(c, 9, 1, SH); // hood peak.

    // Visor slit: dark across eye area.
    line(c, 6, 6, 12, 6, OUTLINE);

    // Eyes glowing through visor.
    px(c, 7, 6, GLINT);
    px(c, 11, 6, GLINT);

    // Lock chest plate: rectangular with keyhole.
    fillRect(c, 7, 10, 11, 14, SH);
    px(c, 9, 11, LT); // keyhole circle top.
    px(c, 8, 12, LT);
    px(c, 9, 12, LT);
    px(c, 10, 12, LT);
    px(c, 9, 13, OUTLINE); // keyhole slot.
    px(c, 9, 14, OUTLINE);
    // Lock shackle glint.
    px(c, 8, 10, GLINT);
    px(c, 9, 10, GLINT);
    px(c, 10, 10, GLINT);

    // Sleeves over hands: two fat sleeve ends.
    fillRect(c, 2, 11, 5, 14, SH);
    fillRect(c, 13, 11, 16, 14, SH);

    // FLOATING KEY: orbiting at upper right (separate from body).
    // Key bow (small circle).
    px(c, 15, 3, MD);
    px(c, 16, 3, MD);
    px(c, 15, 4, MD);
    px(c, 16, 4, MD);
    px(c, 15, 3, GLINT); // glint on bow.
    // Key shaft.
    px(c, 16, 5, SH);
    px(c, 16, 6, SH);
    px(c, 16, 7, SH);
    // Key teeth.
    px(c, 15, 6, SH);
    px(c, 15, 7, SH);

    outline(c);
    rimLight(c, 'upper-left');

    // Re-stamp glints.
    px(c, 7, 6, GLINT);
    px(c, 11, 6, GLINT);
    px(c, 8, 10, GLINT);
    px(c, 9, 10, GLINT);
    px(c, 10, 10, GLINT);
    px(c, 15, 3, GLINT);

    return c;
  };

  const base = make();

  // Idle f2: key orbits (moves 1px around arc), bob -1.
  const f2 = bobFrame(base, -1);
  // Move key bow to next orbital position (from upper-right to right).
  px(f2, 15, 3, 0);
  px(f2, 16, 3, 0);
  px(f2, 15, 4, 0);
  px(f2, 16, 4, 0);
  px(f2, 16, 5, 0);
  px(f2, 16, 6, 0);
  px(f2, 16, 7, 0);
  px(f2, 15, 6, 0);
  px(f2, 15, 7, 0);
  // New position: key on right side.
  px(f2, 17, 7, MD);
  px(f2, 17, 8, MD);
  px(f2, 17, 7, GLINT);
  px(f2, 16, 9, SH);
  px(f2, 16, 10, SH);
  px(f2, 16, 11, SH);
  px(f2, 15, 10, SH);
  px(f2, 15, 11, SH);

  // Walk f0: base. Walk f1: robes sway.
  const wf1 = base.clone();
  // Robe hem shifts right slightly.
  px(wf1, 3, 16, 0);
  px(wf1, 16, 16, MD);

  // Jump f0: crouch.
  const jcrouch = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jcrouch.set(x, y + 1, idx));

  // Jump f1: float up.
  const jair = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jair.set(x, y - 1, idx));
  px(jair, 15, 2, GLINT); // key rises with.

  // Play f0: reach sleeve toward toy.
  const pf0 = base.clone();
  // Right sleeve extends.
  px(pf0, 17, 13, SH);
  px(pf0, 17, 12, SH);
  // Lock plate glows.
  px(pf0, 9, 11, RIM_LO);
  px(pf0, 8, 12, RIM_LO);
  px(pf0, 10, 12, RIM_LO);

  // Play f1: bob bounce.
  const pf1 = bobFrame(base, 1);

  return {
    ...buildSprite('sprite-cryptarch', [base.grid, f2.grid], 3),
    walk: [base.grid, wf1.grid],
    jump: [jcrouch.grid, jair.grid],
    play: [pf0.grid, pf1.grid],
  };
}

// ---------------------------------------------------------------------------
// sprite-matrixion — 18x18, lattice golem; open grid torso showing a pulsing
// node heart, squared-off limbs.
// Signature: the chest is literally a grid lattice with a visible pulsing node.
// ---------------------------------------------------------------------------

function buildMatrixion(): SpriteDef {
  const W = 18;
  const H = 18;

  const make = (): PixelCanvas => {
    const c = PixelCanvas.create(W, H);

    // Torso box.
    fillRect(c, 4, 6, 13, 13, MD);

    // Grid lattice over torso (horizontal + vertical lines at intervals).
    // Horizontal grid lines.
    line(c, 4, 8, 13, 8, SH);
    line(c, 4, 11, 13, 11, SH);
    // Vertical grid lines.
    line(c, 7, 6, 7, 13, SH);
    line(c, 10, 6, 10, 13, SH);

    // Grid node intersections.
    px(c, 7, 8, LT);
    px(c, 10, 8, LT);
    px(c, 7, 11, LT);
    px(c, 10, 11, LT);

    // Pulsing node HEART at chest center (3x3 bright plus).
    px(c, 8, 9, LT);
    px(c, 9, 9, LT);
    px(c, 8, 10, LT);
    px(c, 9, 10, LT);
    // Center core glint.
    px(c, 8, 9, GLINT);
    px(c, 9, 10, GLINT);

    // Head: cube with T-visor.
    fillRect(c, 5, 1, 12, 5, LT);
    line(c, 5, 3, 12, 3, OUTLINE); // visor slot.
    // Eyes glow through visor.
    px(c, 6, 3, GLINT);
    px(c, 11, 3, GLINT);

    // Antenna pair.
    px(c, 7, 0, SH);
    px(c, 10, 0, SH);
    px(c, 7, 0, GLINT);
    px(c, 10, 0, GLINT);

    // Shoulder blocks.
    fillRect(c, 1, 6, 4, 9, SH);
    fillRect(c, 14, 6, 17, 9, SH);

    // Arms.
    fillRect(c, 1, 9, 3, 13, MD);
    fillRect(c, 15, 9, 17, 13, MD);

    // Fists.
    fillRect(c, 0, 13, 3, 15, SH);
    fillRect(c, 15, 13, 17, 15, SH);
    // Knuckle nodes.
    px(c, 1, 13, GLINT);
    px(c, 16, 13, GLINT);

    // Legs.
    fillRect(c, 5, 14, 8, 17, SH);
    fillRect(c, 10, 14, 13, 17, SH);

    outline(c);
    rimLight(c, 'upper-left');

    // Re-stamp glints.
    px(c, 8, 9, GLINT);
    px(c, 9, 10, GLINT);
    px(c, 6, 3, GLINT);
    px(c, 11, 3, GLINT);
    px(c, 7, 0, GLINT);
    px(c, 10, 0, GLINT);
    px(c, 1, 13, GLINT);
    px(c, 16, 13, GLINT);

    return c;
  };

  const base = make();

  // Idle f2: node heart pulses (alternate glint positions).
  const f2 = base.clone();
  px(f2, 8, 9, LT);
  px(f2, 9, 10, LT);
  px(f2, 9, 9, GLINT);
  px(f2, 8, 10, GLINT);
  // Grid nodes brighten.
  px(f2, 7, 8, GLINT);
  px(f2, 10, 11, GLINT);

  // Walk f0: base. Walk f1: march stride.
  const wf1 = base.clone();
  // Advance left leg forward.
  fillRect(wf1, 5, 14, 8, 17, 0);
  fillRect(wf1, 4, 14, 7, 17, SH);
  // Pull right leg back.
  fillRect(wf1, 10, 14, 13, 17, 0);
  fillRect(wf1, 11, 14, 14, 17, SH);
  // Swing right fist forward.
  px(wf1, 15, 12, SH);
  px(wf1, 15, 13, SH);

  // Jump f0: crouch.
  const jcrouch = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jcrouch.set(x, y + 1, idx));

  // Jump f1: upward stretch.
  const jair = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jair.set(x, y - 1, idx));

  // Play f0: arms open wide toward toy.
  const pf0 = base.clone();
  // Arms extend.
  px(pf0, 0, 11, MD);
  px(pf0, 17, 11, MD);
  // Heart pulses bright.
  px(pf0, 8, 9, RIM_HI);
  px(pf0, 9, 10, RIM_HI);

  // Play f1: bob.
  const pf1 = bobFrame(base, 1);

  return {
    ...buildSprite('sprite-matrixion', [base.grid, f2.grid], 3),
    walk: [base.grid, wf1.grid],
    jump: [jcrouch.grid, jair.grid],
    play: [pf0.grid, pf1.grid],
  };
}

// ---------------------------------------------------------------------------
// sprite-sigilus — 18x18, floating wax-seal; two concentric ring wards,
// one serene central eye. No limbs — pure disc.
// Signature: two crisp ring-ward loops around the disc face.
// ---------------------------------------------------------------------------

function buildSigilus(): SpriteDef {
  const W = 18;
  const H = 18;

  const make = (): PixelCanvas => {
    const c = PixelCanvas.create(W, H);

    const cx = 9;
    const cy = 9;

    // Outer disc fill.
    // Build disc as polygon (octagon for crispness at this size).
    fillPolygon(
      c,
      [
        [3, 1],
        [14, 1],
        [16, 3],
        [16, 14],
        [14, 16],
        [3, 16],
        [1, 14],
        [1, 3],
      ],
      SH,
    );

    // Mid ring fill (slightly lighter inner disc).
    fillPolygon(
      c,
      [
        [5, 3],
        [12, 3],
        [14, 5],
        [14, 12],
        [12, 14],
        [5, 14],
        [3, 12],
        [3, 5],
      ],
      MD,
    );

    // Inner face plate.
    fillPolygon(
      c,
      [
        [6, 5],
        [11, 5],
        [12, 6],
        [12, 11],
        [11, 12],
        [6, 12],
        [5, 11],
        [5, 6],
      ],
      LT,
    );

    // OUTER RING WARD: bright pixel ring at radius ~7.
    // Using manual cardinal + diagonal positions.
    const outerRing: Array<[number, number]> = [
      [cx, 1],
      [cx, 16], // top/bottom
      [1, cy],
      [16, cy], // left/right
      [2, 3],
      [3, 2], // top-left corners
      [15, 3],
      [14, 2], // top-right
      [2, 14],
      [3, 15], // bottom-left
      [15, 14],
      [14, 15], // bottom-right
    ];
    for (const [rx, ry] of outerRing) {
      if (c.get(rx, ry) > 0) px(c, rx, ry, GLINT);
    }

    // INNER RING WARD: bright ring at radius ~4.
    const innerRing: Array<[number, number]> = [
      [cx, 4],
      [cx, 13],
      [4, cy],
      [13, cy],
      [5, 4],
      [4, 5],
      [13, 4],
      [12, 5],
      [5, 13],
      [4, 12],
      [13, 13],
      [12, 12],
    ];
    for (const [rx, ry] of innerRing) {
      if (c.get(rx, ry) > 0) px(c, rx, ry, RIM_LO);
    }

    outline(c);
    rimLight(c, 'upper-left');

    // SERENE CENTRAL EYE: at disc center.
    // Eye surround (dark oval).
    fillRect(c, 7, 7, 11, 11, OUTLINE);
    // Iris.
    fillRect(c, 8, 8, 10, 10, LT);
    // Pupil.
    px(c, 9, 9, OUTLINE);
    // Glint above pupil.
    px(c, 8, 8, GLINT);

    // Serenity mark (two tiny arch lines above and below eye).
    px(c, 8, 6, OUTLINE);
    px(c, 9, 6, OUTLINE);
    px(c, 10, 6, OUTLINE);
    px(c, 8, 12, OUTLINE);
    px(c, 9, 12, OUTLINE);
    px(c, 10, 12, OUTLINE);

    // Re-stamp ward rings after outline.
    for (const [rx, ry] of outerRing) {
      if (c.get(rx, ry) > 0) px(c, rx, ry, GLINT);
    }
    px(c, 8, 8, GLINT);

    return c;
  };

  const base = make();

  // Idle f2: ward ring rotates (glints shift phase), bob -1.
  const f2 = bobFrame(base, -1);
  // Rotate outer ward glints 22deg (next node).
  px(f2, 9, 1, 0);
  px(f2, 10, 1, GLINT);
  px(f2, 9, 16, 0);
  px(f2, 10, 16, GLINT);
  // Eye stays serene.
  px(f2, 8, 7, GLINT);

  // Walk f0: base (float drift). Walk f1: drift lean right.
  // Disc tilts slightly right (shift content 1px right).
  const wdrift = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => wdrift.set(x + 1, y, idx));

  // Jump f0: disc sinks slightly.
  const jcrouch = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jcrouch.set(x, y + 1, idx));

  // Jump f1: disc floats up.
  const jair = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jair.set(x, y - 2, idx));
  px(jair, 9, 0, GLINT);

  // Play f0: eye opens wide (iris expands), disc tilts.
  const pf0 = base.clone();
  fillRect(pf0, 7, 7, 11, 11, OUTLINE); // clear eye area
  fillRect(pf0, 7, 7, 11, 11, LT); // large iris.
  px(pf0, 9, 9, OUTLINE);
  px(pf0, 7, 7, GLINT);
  px(pf0, 9, 7, GLINT);

  // Play f1: bob back.
  const pf1 = bobFrame(base, 1);

  return {
    ...buildSprite('sprite-sigilus', [base.grid, f2.grid], 3),
    walk: [base.grid, wdrift.grid],
    jump: [jcrouch.grid, jair.grid],
    play: [pf0.grid, pf1.grid],
  };
}

// ---------------------------------------------------------------------------
// sprite-enigmax — 20x20, apex puzzle titan; rotating cube heart in open chest,
// asymmetric horns (one long one broken), heavy fists.
// Iterate 5+ times on this one — it's the apex.
// Signature: open chest cavity showing isometric cube heart + lopsided horns.
// ---------------------------------------------------------------------------

function buildEnigmax(): SpriteDef {
  const W = 20;
  const H = 20;

  // Iteration 1: establish major silhouette.
  // Iteration 2: asymmetric horns, open chest.
  // Iteration 3: heavy fists, leg armor.
  // Iteration 4: cube face shading, face visor.
  // Iteration 5: rim light, glint placement, animation quality.

  const make = (): PixelCanvas => {
    const c = PixelCanvas.create(W, H);

    // BODY: wide armored torso block.
    fillPolygon(
      c,
      [
        [4, 9],
        [16, 9],
        [17, 11],
        [17, 16],
        [15, 17],
        [5, 17],
        [3, 16],
        [3, 11],
      ],
      MD,
    );

    // Open chest cavity (dark inset).
    fillRect(c, 7, 10, 13, 16, SH);

    // CUBE HEART inside chest cavity — isometric small cube.
    // Top face (bright).
    fillPolygon(
      c,
      [
        [9, 11],
        [11, 10],
        [13, 11],
        [11, 12],
      ],
      HL,
    );
    // Left face (shadow).
    fillPolygon(
      c,
      [
        [9, 11],
        [11, 12],
        [11, 15],
        [9, 14],
      ],
      SH,
    );
    // Right face (mid).
    fillPolygon(
      c,
      [
        [11, 12],
        [13, 11],
        [13, 14],
        [11, 15],
      ],
      LT,
    );
    // Cube glints.
    px(c, 11, 10, GLINT); // top apex.
    px(c, 9, 11, GLINT); // left corner.
    px(c, 13, 11, GLINT); // right corner.
    px(c, 11, 15, GLINT); // bottom apex.

    // HEAD: massive angular skull.
    fillPolygon(
      c,
      [
        [5, 3],
        [15, 3],
        [16, 5],
        [16, 8],
        [14, 9],
        [6, 9],
        [4, 8],
        [4, 5],
      ],
      LT,
    );

    // Visor: dark slab across eye area.
    fillRect(c, 5, 5, 15, 7, OUTLINE);
    // Eye glow through visor (two hot slots).
    px(c, 7, 6, GLINT);
    px(c, 8, 6, GLINT);
    px(c, 11, 6, GLINT);
    px(c, 12, 6, GLINT);

    // Jaw plate.
    fillRect(c, 5, 8, 15, 9, SH);
    line(c, 5, 8, 15, 8, OUTLINE);

    // LEFT HORN: tall angular spike (3 segments up-left).
    fillPolygon(
      c,
      [
        [4, 3],
        [6, 0],
        [8, 1],
        [6, 4],
      ],
      LT,
    );
    px(c, 6, 0, GLINT); // horn tip.

    // RIGHT HORN: shorter, forward-angled, broken tip (asymmetric!).
    fillPolygon(
      c,
      [
        [12, 3],
        [14, 1],
        [16, 3],
        [15, 5],
        [13, 4],
      ],
      MD,
    );
    px(c, 14, 0, GLINT); // broken tip.
    // Crack mark on broken horn.
    px(c, 15, 2, OUTLINE);

    // SHOULDER ARMOR: large plates on each side.
    fillRect(c, 0, 9, 4, 13, MD);
    fillRect(c, 16, 9, 19, 13, MD);
    // Shoulder spikes.
    px(c, 0, 8, SH);
    px(c, 1, 7, SH);
    px(c, 19, 8, SH);
    px(c, 18, 7, SH);

    // HEAVY FISTS: large square gauntlets.
    fillRect(c, 0, 13, 4, 17, SH);
    fillRect(c, 16, 13, 19, 17, SH);
    // Knuckle ridges.
    line(c, 0, 14, 3, 14, OUTLINE);
    line(c, 16, 14, 19, 14, OUTLINE);
    px(c, 1, 15, GLINT);
    px(c, 17, 15, GLINT);

    // LEGS: wide armored columns.
    fillRect(c, 5, 17, 8, 19, SH);
    fillRect(c, 12, 17, 15, 19, SH);
    // Boots.
    fillRect(c, 4, 19, 9, 19, MD);
    fillRect(c, 11, 19, 16, 19, MD);

    outline(c);
    rimLight(c, 'upper-left');

    // Re-stamp glints after outline.
    px(c, 11, 10, GLINT);
    px(c, 9, 11, GLINT);
    px(c, 13, 11, GLINT);
    px(c, 11, 15, GLINT);
    px(c, 7, 6, GLINT);
    px(c, 8, 6, GLINT);
    px(c, 11, 6, GLINT);
    px(c, 12, 6, GLINT);
    px(c, 6, 0, GLINT);
    px(c, 14, 0, GLINT);
    px(c, 1, 15, GLINT);
    px(c, 17, 15, GLINT);

    return c;
  };

  const base = make();

  // Idle f2: cube heart "rotates" (swap face brightness), visor glow shifts.
  const f2 = base.clone();
  // Rotate cube faces.
  fillPolygon(
    f2,
    [
      [9, 11],
      [11, 10],
      [13, 11],
      [11, 12],
    ],
    LT,
  ); // top dims.
  fillPolygon(
    f2,
    [
      [9, 11],
      [11, 12],
      [11, 15],
      [9, 14],
    ],
    HL,
  ); // left brightens.
  fillPolygon(
    f2,
    [
      [11, 12],
      [13, 11],
      [13, 14],
      [11, 15],
    ],
    SH,
  ); // right dims.
  px(f2, 9, 13, GLINT); // new bright corner.
  px(f2, 11, 15, GLINT);
  px(f2, 13, 11, GLINT);
  // Visor glow pulses.
  px(f2, 8, 6, RIM_LO);
  px(f2, 11, 6, RIM_LO);

  // Walk f0: base. Walk f1: heavy stomp stride.
  const wf1 = base.clone();
  // Right leg forward.
  fillRect(wf1, 12, 17, 15, 19, 0);
  fillRect(wf1, 13, 17, 16, 19, SH);
  fillRect(wf1, 12, 19, 17, 19, MD);
  // Left leg back.
  fillRect(wf1, 5, 17, 8, 19, 0);
  fillRect(wf1, 4, 17, 7, 19, SH);
  fillRect(wf1, 3, 19, 8, 19, MD);
  // Left fist swings back.
  px(wf1, 0, 12, SH);
  px(wf1, 1, 12, SH);
  // Right fist forward.
  px(wf1, 18, 12, SH);
  px(wf1, 19, 12, SH);

  // Jump f0: crouch (whole body down 1, fists down).
  const jcrouch = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jcrouch.set(x, Math.min(y + 1, H - 1), idx));

  // Jump f1: air stretch (body up 2, fists raised).
  const jair = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jair.set(x, y - 2, idx));
  // Fists raise into air.
  px(jair, 1, 10, SH);
  px(jair, 17, 10, SH);
  px(jair, 6, 0, GLINT); // horn catches light.

  // Play f0: SLAM fists down (arms extend down, cube pulses).
  const pf0 = base.clone();
  fillRect(pf0, 0, 16, 4, 19, SH); // left fist slams down.
  fillRect(pf0, 16, 16, 19, 19, SH); // right fist slams down.
  // Cube heart flares.
  fillPolygon(
    pf0,
    [
      [9, 11],
      [11, 10],
      [13, 11],
      [11, 12],
    ],
    RIM_HI,
  );
  px(pf0, 11, 10, RIM_HI);
  px(pf0, 9, 11, RIM_LO);
  px(pf0, 13, 11, RIM_LO);

  // Play f1: rebound up.
  const pf1 = bobFrame(base, -1);

  return {
    ...buildSprite('sprite-enigmax', [base.grid, f2.grid], 3),
    walk: [base.grid, wf1.grid],
    jump: [jcrouch.grid, jair.grid],
    play: [pf0.grid, pf1.grid],
  };
}

// ---------------------------------------------------------------------------
// sprite-keystrix — 20x20, apex key-raptor; skeleton-key beak, blade-feather
// fan tail, raised talon. Faces right.
// Iterate 5+ times.
// Signature: the beak IS a skeleton key — ring at tip + notched shaft.
// ---------------------------------------------------------------------------

function buildKeystrix(): SpriteDef {
  const W = 20;
  const H = 20;

  // Iteration 1: avian silhouette, beak shape established.
  // Iteration 2: key beak ring, blade feather tail fan.
  // Iteration 3: raised talon, wing blade-slats, keel line.
  // Iteration 4: face eye + glints, circuit body marks.
  // Iteration 5: animation quality, clean rim light check.

  const make = (): PixelCanvas => {
    const c = PixelCanvas.create(W, H);

    // BODY: sleek avian torso, upright-ish facing right.
    fillPolygon(
      c,
      [
        [5, 7],
        [14, 6],
        [16, 8],
        [16, 14],
        [14, 15],
        [5, 15],
        [3, 13],
        [3, 9],
      ],
      MD,
    );

    // Keel line: sternum ridge.
    line(c, 8, 7, 8, 14, LT);

    // HEAD: angular avian skull facing right.
    fillPolygon(
      c,
      [
        [9, 2],
        [15, 2],
        [17, 4],
        [16, 7],
        [9, 7],
        [7, 5],
        [7, 3],
      ],
      LT,
    );

    // SKELETON-KEY BEAK: long angular beak with ring bow at the tip.
    // Beak shaft.
    fillPolygon(
      c,
      [
        [16, 3],
        [19, 4],
        [18, 6],
        [16, 5],
      ],
      SH,
    );
    // Key bow ring at beak tip.
    px(c, 19, 3, MD);
    px(c, 19, 4, MD); // ring.
    px(c, 18, 3, SH);
    px(c, 19, 3, GLINT); // bow glint.
    // Key notch on shaft.
    px(c, 17, 5, OUTLINE);
    px(c, 17, 6, OUTLINE);

    // CREST FEATHERS: swept-back blade feathers from head crown.
    fillPolygon(
      c,
      [
        [8, 1],
        [12, 0],
        [13, 2],
        [10, 3],
      ],
      SH,
    );
    fillPolygon(
      c,
      [
        [11, 0],
        [14, 0],
        [15, 2],
        [12, 2],
      ],
      MD,
    );
    px(c, 12, 0, GLINT); // crest tip glint.

    // EYE: single keen dot with glint.
    px(c, 14, 4, OUTLINE);
    px(c, 15, 4, OUTLINE);
    px(c, 14, 3, GLINT);

    // LEFT WING: large swept blade-wing.
    fillPolygon(
      c,
      [
        [2, 8],
        [6, 7],
        [5, 14],
        [1, 15],
        [0, 12],
        [1, 9],
      ],
      SH,
    );
    // Wing blade-slats (3 overlapping plates).
    line(c, 1, 10, 5, 9, LT);
    line(c, 1, 12, 5, 11, MD);
    line(c, 1, 14, 4, 13, SH);
    // Wing tip glints.
    px(c, 0, 10, GLINT);
    px(c, 0, 12, GLINT);

    // BLADE-FEATHER TAIL FAN: 4 feathers splaying right-downward.
    // Feather 1 (top).
    fillPolygon(
      c,
      [
        [14, 12],
        [18, 9],
        [19, 11],
        [16, 14],
      ],
      LT,
    );
    // Feather 2.
    fillPolygon(
      c,
      [
        [14, 13],
        [19, 12],
        [19, 15],
        [15, 16],
      ],
      MD,
    );
    // Feather 3.
    fillPolygon(
      c,
      [
        [14, 14],
        [18, 15],
        [18, 18],
        [14, 17],
      ],
      SH,
    );
    // Feather 4 (bottom).
    fillPolygon(
      c,
      [
        [14, 15],
        [16, 17],
        [15, 19],
        [12, 18],
      ],
      SH,
    );
    // Tail feather edge glints.
    px(c, 19, 10, GLINT);
    px(c, 19, 14, GLINT);
    px(c, 17, 18, GLINT);

    // LEGS: right leg with raised talon.
    // Right leg (standing).
    fillRect(c, 10, 15, 11, 18, SH);
    px(c, 9, 19, SH);
    px(c, 10, 19, SH);
    px(c, 11, 19, SH);
    // LEFT LEG: raised (talon lifted mid-stride).
    fillRect(c, 6, 14, 7, 17, SH);
    px(c, 5, 14, SH); // knee bend.
    px(c, 4, 13, SH); // talon raised.
    px(c, 5, 13, SH);
    px(c, 4, 12, GLINT); // talon claw glint.

    // Circuit marks on body.
    px(c, 7, 10, GLINT);
    px(c, 7, 11, GLINT);

    outline(c);
    rimLight(c, 'upper-left');

    // Re-stamp glints.
    px(c, 19, 3, GLINT);
    px(c, 14, 3, GLINT);
    px(c, 12, 0, GLINT);
    px(c, 0, 10, GLINT);
    px(c, 0, 12, GLINT);
    px(c, 19, 10, GLINT);
    px(c, 19, 14, GLINT);
    px(c, 17, 18, GLINT);
    px(c, 4, 12, GLINT);
    px(c, 7, 10, GLINT);
    px(c, 7, 11, GLINT);

    return c;
  };

  const base = make();

  // Idle f2: feather fan flutter (tail feathers shift 1px), bob -1.
  const f2 = bobFrame(base, -1);
  px(f2, 19, 9, GLINT);
  px(f2, 19, 10, 0);
  px(f2, 18, 19, GLINT);
  px(f2, 17, 18, 0);

  // Walk f0: base. Walk f1: mid-stride.
  const wf1 = base.clone();
  // Advance right leg.
  fillRect(wf1, 10, 15, 11, 18, 0);
  fillRect(wf1, 11, 15, 12, 18, SH);
  px(wf1, 10, 19, SH);
  px(wf1, 11, 19, SH);
  px(wf1, 12, 19, SH);
  // Set left leg down.
  fillRect(wf1, 6, 14, 7, 17, 0);
  fillRect(wf1, 6, 15, 7, 18, SH);
  px(wf1, 5, 19, SH);
  px(wf1, 6, 19, SH);
  px(wf1, 4, 12, 0);
  px(wf1, 5, 13, 0);
  px(wf1, 5, 14, 0);

  // Jump f0: tuck (body down, wing clamp, talon tuck).
  const jcrouch = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jcrouch.set(x, y + 1, idx));

  // Jump f1: wing spread air (body up 2, wings fully spread).
  const jair = PixelCanvas.create(W, H);
  base.forEach((x, y, idx) => jair.set(x, y - 2, idx));
  // Wings spread wider.
  px(jair, 0, 6, SH);
  px(jair, 0, 8, SH);
  // Tail fans fully open.
  px(jair, 19, 8, GLINT);
  px(jair, 19, 12, GLINT);

  // Play f0: talon swipe (left talon sweeps toward toy).
  const pf0 = base.clone();
  px(pf0, 3, 11, SH); // talon sweeps.
  px(pf0, 2, 10, SH);
  px(pf0, 2, 10, GLINT); // talon claw.
  px(pf0, 1, 9, GLINT);
  // Beak key bow glows.
  px(pf0, 19, 3, RIM_HI);
  px(pf0, 18, 3, RIM_LO);

  // Play f1: bounce back up.
  const pf1 = bobFrame(base, -1);
  px(pf1, 19, 9, GLINT);

  return {
    ...buildSprite('sprite-keystrix', [base.grid, f2.grid], 3),
    walk: [base.grid, wf1.grid],
    jump: [jcrouch.grid, jair.grid],
    play: [pf0.grid, pf1.grid],
  };
}

// ---------------------------------------------------------------------------
// Exports.
// ---------------------------------------------------------------------------

/** All Cipher-line sprites — individually authored, angular/glyph theme. */
export const cipherSprites: SpriteDef[] = [
  buildGlyphit(),
  buildCipherling(),
  buildBitfang(),
  buildRuneclaw(),
  buildVectorix(),
  buildGlyphound(),
  buildCryptarch(),
  buildMatrixion(),
  buildSigilus(),
  buildEnigmax(),
  buildKeystrix(),
];
