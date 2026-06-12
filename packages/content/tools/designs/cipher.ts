/**
 * Cipher line sprite designs (House: Cipher — angular/glyph, PWR-leaning).
 *
 * Angular-rune-machine theme: hard edges, hex/triangle motifs, circuit accents.
 * Each species is individually composed from sprite-lib primitives — no shared
 * body template. Full ramp usage (indices 3..14), 1px outline, upper-left rim
 * light, glint runes (index 15) for the Cipher glyph aesthetic.
 *
 * Sizes: sprite-stage 32x32, rookie 34x34-36x36, evolved 40x40, prime 44x44,
 * apex 48x48. All even-dimensioned as required.
 */

import type { SpriteDef } from '@token-tamers/core';
import {
  PixelCanvas,
  buildSprite,
  fillPolygon,
  fillRect,
  fillEllipse,
  strokeRect,
  thickLine,
  bezier,
  mirrorX,
  shade,
  rimLight,
  outline,
  glyphStamp,
  bobFrame,
  blink,
  dot,
  GLINT,
  RIM_HI,
  RIM_LO,
} from '../sprite-lib';

// ---------------------------------------------------------------------------
// Shared glyph bitmaps for Cipher sigils and circuit marks.
// ---------------------------------------------------------------------------

/** A small angular rune — 5x5 cross-and-bar sigil. */
const RUNE_CROSS: number[][] = [
  [0, 1, 1, 1, 0],
  [1, 0, 1, 0, 1],
  [1, 1, 1, 1, 1],
  [1, 0, 1, 0, 1],
  [0, 1, 1, 1, 0],
];

/** A 3x3 hex-node dot pattern (circuit junction). */
const HEX_NODE: number[][] = [
  [0, 1, 0],
  [1, 1, 1],
  [0, 1, 0],
];

/** A 5x3 chevron (for vectorix body trail). */
const CHEVRON: number[][] = [
  [1, 0, 0, 0, 1],
  [0, 1, 0, 1, 0],
  [0, 0, 1, 0, 0],
];

/** A 4x4 lock-icon bitmap (for cryptarch chest). */
const LOCK_ICON: number[][] = [
  [0, 1, 1, 0],
  [1, 0, 0, 1],
  [1, 1, 1, 1],
  [1, 0, 0, 1],
];

// ---------------------------------------------------------------------------
// sprite-glyphit — 32x32, living rune tile, single bright sigil eye.
// A flat angular stone tile with an etched rune on its face. Single luminous
// eye formed by a glint + dark pupil. Hard rectangular silhouette.
// ---------------------------------------------------------------------------

function buildGlyphit(): SpriteDef {
  const W = 32;
  const H = 32;
  const c = PixelCanvas.create(W, H);

  // Outer tile body — a wide octagonal shape (flat-topped stone tile).
  fillPolygon(
    c,
    [
      [4, 2],
      [28, 2],
      [30, 6],
      [30, 26],
      [28, 30],
      [4, 30],
      [2, 26],
      [2, 6],
    ],
    7,
  );

  // Inner face panel — slightly inset, darker.
  fillPolygon(
    c,
    [
      [6, 5],
      [26, 5],
      [28, 8],
      [28, 24],
      [26, 27],
      [6, 27],
      [4, 24],
      [4, 8],
    ],
    5,
  );

  // Etched border groove.
  strokeRect(c, 7, 7, 25, 25, 3);

  // Corner accent marks (angular bracket-corners to frame the face).
  dot(c, 8, 8, 9);
  dot(c, 9, 8, 9);
  dot(c, 8, 9, 9);

  // Large single eye — dominant focal point, center-upper area.
  // Eye surround socket (wide dark rectangle — "slot eye").
  fillRect(c, 10, 7, 22, 12, 3);
  // Iris glow.
  fillEllipse(c, 16, 9, 5, 3, 11);
  // Pupil dark slit.
  fillRect(c, 14, 8, 18, 10, 2);
  // Inner pupil core.
  dot(c, 16, 9, 2);
  // Glint (prominent — this is the sigil eye).
  dot(c, 13, 8, GLINT);
  dot(c, 14, 7, GLINT);
  dot(c, 15, 7, GLINT);

  // The sigil rune — in the lower half of the face.
  glyphStamp(c, 11, 15, RUNE_CROSS, GLINT);

  // Circuit traces on the sides of the face panel (left half).
  thickLine(c, 7, 14, 10, 14, 4, 1);
  thickLine(c, 7, 20, 10, 20, 4, 1);
  dot(c, 7, 14, GLINT);
  dot(c, 7, 20, GLINT);

  // Bottom rune strip (horizontal bar below the cross sigil).
  fillRect(c, 9, 22, 23, 23, 4);
  dot(c, 12, 22, GLINT);
  dot(c, 16, 22, GLINT);
  dot(c, 20, 22, GLINT);

  mirrorX(c);
  shade(c, { dir: 'upper-left', bands: 9, lo: 3, hi: 11, dither: true, onlyBelow: 9 });
  rimLight(c, 'upper-left');
  outline(c);

  // Re-apply all glint features after outline.
  dot(c, 13, 8, GLINT);
  dot(c, 14, 7, GLINT);
  dot(c, 15, 7, GLINT);
  glyphStamp(c, 11, 15, RUNE_CROSS, GLINT);
  dot(c, 7, 14, GLINT);
  dot(c, 25, 14, GLINT); // mirrored
  dot(c, 7, 20, GLINT);
  dot(c, 25, 20, GLINT); // mirrored
  dot(c, 12, 22, GLINT);
  dot(c, 16, 22, GLINT);
  dot(c, 20, 22, GLINT);

  // Frame 2 — slow blink: eye closes to a horizontal slit.
  const f2 = blink(c, [{ x0: 10, y0: 7, x1: 22, y1: 12 }]);
  glyphStamp(f2, 11, 15, RUNE_CROSS, GLINT);
  dot(f2, 12, 22, GLINT);
  dot(f2, 16, 22, GLINT);

  // Frame 3 — rune pulses (brightest, eye glint intensifies).
  const f3 = c.clone();
  glyphStamp(f3, 11, 15, RUNE_CROSS, RIM_HI);
  dot(f3, 14, 7, RIM_HI);
  dot(f3, 15, 7, RIM_HI);
  fillEllipse(f3, 16, 9, 5, 3, RIM_LO);
  dot(f3, 16, 9, 2);
  dot(f3, 13, 8, GLINT);

  return buildSprite('sprite-glyphit', [c, f2, f3], 3);
}

// ---------------------------------------------------------------------------
// sprite-cipherling — 34x34, angular imp folded from code-glyphs, antenna quirk.
// Small bipedal imp with a triangular torso, jagged wing-nubs, and a single
// tall antenna tipped with a glowing node.
// ---------------------------------------------------------------------------

function buildCipherling(): SpriteDef {
  const W = 34;
  const H = 34;
  const c = PixelCanvas.create(W, H);

  // Head — angular hexagon sitting atop the body.
  fillPolygon(
    c,
    [
      [14, 5],
      [20, 5],
      [23, 9],
      [20, 13],
      [14, 13],
      [11, 9],
    ],
    8,
  );

  // Antenna shaft (left half; mirrorX will not duplicate — keep as single).
  thickLine(c, 17, 1, 17, 5, 6, 1);
  // Antenna tip node.
  fillEllipse(c, 17, 1, 2, 2, 11);
  dot(c, 17, 1, GLINT);

  // Eyes — two angular slanted marks.
  // Left eye only (mirrorX copies right).
  fillRect(c, 13, 8, 15, 9, 3);
  dot(c, 14, 8, GLINT); // glint left pupil

  // Torso — triangular chest pointing down.
  fillPolygon(
    c,
    [
      [11, 13],
      [23, 13],
      [22, 22],
      [17, 25],
      [12, 22],
    ],
    7,
  );

  // Circuit line across chest.
  thickLine(c, 13, 17, 16, 17, 9, 1);
  dot(c, 13, 17, GLINT);

  // Wing-nub (left) — small angular triangle jutting out.
  fillPolygon(
    c,
    [
      [6, 15],
      [11, 14],
      [11, 20],
      [7, 20],
    ],
    6,
  );
  dot(c, 7, 16, 4);

  // Arms (left only).
  fillPolygon(
    c,
    [
      [8, 18],
      [12, 17],
      [13, 22],
      [9, 23],
    ],
    7,
  );

  // Claw tips (left hand).
  dot(c, 8, 23, 4);
  dot(c, 10, 24, 4);

  // Legs (left only).
  fillPolygon(
    c,
    [
      [13, 25],
      [16, 24],
      [16, 31],
      [13, 33],
      [11, 31],
    ],
    7,
  );

  // Foot (left).
  fillPolygon(
    c,
    [
      [10, 31],
      [15, 31],
      [14, 33],
      [9, 33],
    ],
    5,
  );

  mirrorX(c);
  shade(c, { dir: 'upper-left', bands: 9, lo: 3, hi: 12, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // Re-apply glint features post-outline.
  dot(c, 14, 8, GLINT);
  dot(c, 20, 8, GLINT);
  dot(c, 17, 1, GLINT);
  dot(c, 13, 17, GLINT);
  dot(c, 21, 17, GLINT);

  // Frame 2 — antenna node pulses, idle bob -1.
  const f2 = bobFrame(c, -1);
  dot(f2, 17, 0, GLINT);
  fillEllipse(f2, 17, 0, 3, 2, RIM_LO);
  dot(f2, 17, 0, GLINT);

  return buildSprite('sprite-cipherling', [c, f2], 3);
}

// ---------------------------------------------------------------------------
// sprite-bitfang — 36x36, compact pixel-beast, oversized jaw of square teeth.
// A squat, wide creature with a massive rectangular jaw and two blocky fists.
// Hard square body with serrated tooth row.
// ---------------------------------------------------------------------------

function buildBitfang(): SpriteDef {
  const W = 36;
  const H = 36;
  const c = PixelCanvas.create(W, H);

  // Main body block — wide, squat, low-center of mass.
  fillRect(c, 8, 11, 28, 22, 7);

  // Head — wider block on top, merged with body.
  fillRect(c, 5, 5, 31, 14, 8);

  // Ear spike plates — left only.
  fillPolygon(
    c,
    [
      [3, 3],
      [7, 2],
      [7, 8],
      [3, 9],
    ],
    6,
  );
  dot(c, 4, 3, 9);

  // Eye sockets — left half: single thick square eye.
  fillRect(c, 7, 7, 14, 12, 3); // left eye socket (dark)
  fillRect(c, 8, 8, 13, 11, 11); // left eye iris (bright)
  fillRect(c, 9, 9, 12, 10, 2); // left pupil slit
  dot(c, 9, 8, GLINT); // left glint
  dot(c, 10, 8, GLINT);

  // Oversized jaw — the defining feature. Wide and deep.
  // Upper jaw (connected to head bottom).
  fillRect(c, 3, 13, 33, 19, 6);
  // Lower jaw (larger, hangs below).
  fillRect(c, 2, 19, 34, 28, 5);

  // Big square teeth — left half, 3 wide teeth on upper jaw edge.
  fillRect(c, 4, 19, 9, 25, 9); // left tooth 1
  fillRect(c, 11, 19, 16, 25, 9); // left tooth 2 (gap at x=10)
  fillRect(c, 18, 19, 23, 25, 9); // center tooth (slightly left of center)

  // Tooth gaps (transparent — left 0-valued gaps between teeth on jaw).
  // Gap 1: col 10, rows 19-25.
  for (let y = 19; y <= 25; y++) c.set(10, y, 0);
  // Gap 2: col 17, rows 19-25.
  for (let y = 19; y <= 25; y++) c.set(17, y, 0);

  // Jaw circuit marks.
  dot(c, 5, 26, GLINT);
  dot(c, 13, 26, GLINT);

  // Arms — left: blocky fist.
  fillRect(c, 1, 15, 7, 22, 7);
  // Knuckle ridges.
  dot(c, 2, 16, 5);
  dot(c, 2, 18, 5);
  dot(c, 2, 20, 5);

  // Legs — left.
  fillRect(c, 9, 28, 16, 34, 6);
  // Foot — left.
  fillRect(c, 8, 32, 18, 35, 5);
  // Toenail marks.
  dot(c, 9, 35, 4);
  dot(c, 13, 35, 4);

  mirrorX(c);
  shade(c, { dir: 'upper-left', bands: 10, lo: 3, hi: 12, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // Re-punch the tooth gaps (shade/outline fills them back in).
  for (let y = 19; y <= 25; y++) {
    c.set(10, y, 0);
    c.set(17, y, 0);
    c.set(26, y, 0); // mirrored gap1
    c.set(19, y, 0); // mirrored gap2 — already 0, but ensure
  }

  // Re-apply glints.
  dot(c, 9, 8, GLINT);
  dot(c, 10, 8, GLINT);
  dot(c, 27, 8, GLINT); // mirrored eye glint
  dot(c, 26, 8, GLINT);
  dot(c, 5, 26, GLINT);
  dot(c, 31, 26, GLINT); // mirrored

  // Frame 2 — mouth open wider (extend gap between jaws).
  const f2 = c.clone();
  // Darken the jaw gap line.
  for (let x = 3; x <= 33; x++) {
    if (f2.get(x, 19) > 0 && f2.get(x, 18) > 0) f2.set(x, 19, 2);
  }
  // Re-punch gaps.
  for (let y = 18; y <= 26; y++) {
    f2.set(10, y, 0);
    f2.set(17, y, 0);
    f2.set(26, y, 0);
  }

  // Frame 3 — idle bob.
  const f3 = bobFrame(c, -1);

  return buildSprite('sprite-bitfang', [c, f2, f3], 3);
}

// ---------------------------------------------------------------------------
// sprite-runeclaw — 40x40, four-legged hunter with engraved claw plates.
// A sleek quadruped with a low-slung body, angular head, and four leg-claws
// each bearing an engraved rune mark.
// ---------------------------------------------------------------------------

function buildRuneclaw(): SpriteDef {
  const W = 40;
  const H = 40;
  const c = PixelCanvas.create(W, H);

  // Torso — long low rectangle with angled front.
  fillPolygon(
    c,
    [
      [12, 16],
      [30, 16],
      [32, 20],
      [32, 28],
      [28, 30],
      [12, 30],
      [8, 28],
      [8, 20],
    ],
    7,
  );

  // Head — angular triangle/wedge facing left.
  fillPolygon(
    c,
    [
      [5, 10],
      [16, 10],
      [18, 14],
      [16, 18],
      [5, 18],
      [3, 14],
    ],
    8,
  );

  // Snout tip — narrow angular point.
  fillPolygon(
    c,
    [
      [1, 13],
      [5, 11],
      [5, 17],
    ],
    6,
  );

  // Eye (single, on head — left creature facing).
  fillEllipse(c, 8, 13, 3, 3, 3);
  fillEllipse(c, 8, 13, 2, 2, 11);
  dot(c, 8, 13, 2);
  dot(c, 7, 12, GLINT);

  // Neck ridges.
  thickLine(c, 14, 11, 14, 15, 5, 1);
  thickLine(c, 12, 12, 12, 15, 4, 1);

  // Tail — angular, upward-swept (right side only, not mirrored).
  fillPolygon(
    c,
    [
      [32, 16],
      [36, 10],
      [38, 12],
      [37, 18],
      [33, 22],
    ],
    7,
  );
  dot(c, 37, 10, GLINT);

  // Front leg/claw (left-front — only draw left side, mirrorX for right).
  fillPolygon(
    c,
    [
      [10, 28],
      [15, 28],
      [16, 35],
      [13, 37],
      [9, 37],
      [8, 33],
    ],
    7,
  );

  // Front claw tips (left).
  fillPolygon(
    c,
    [
      [8, 37],
      [10, 35],
      [12, 38],
      [9, 39],
    ],
    5,
  );
  fillPolygon(
    c,
    [
      [13, 37],
      [15, 36],
      [16, 39],
      [13, 39],
    ],
    5,
  );

  // Rune mark on front claw plate.
  glyphStamp(c, 10, 30, HEX_NODE, GLINT);

  // Back leg/claw (left-rear).
  fillPolygon(
    c,
    [
      [24, 28],
      [29, 28],
      [30, 34],
      [27, 37],
      [23, 37],
      [22, 33],
    ],
    7,
  );

  // Back claw tips (left-rear perspective).
  fillPolygon(
    c,
    [
      [22, 37],
      [24, 35],
      [26, 38],
      [23, 39],
    ],
    5,
  );
  fillPolygon(
    c,
    [
      [27, 37],
      [29, 36],
      [30, 39],
      [27, 39],
    ],
    5,
  );
  glyphStamp(c, 24, 30, HEX_NODE, GLINT);

  // Spine ridge along top of torso.
  for (let x = 12; x <= 30; x += 3) {
    dot(c, x, 16, 10);
    dot(c, x + 1, 15, 9);
  }

  // Circuit lines on torso side (left half).
  thickLine(c, 10, 22, 16, 22, 5, 1);
  dot(c, 13, 22, GLINT);

  shade(c, { dir: 'upper-left', bands: 10, lo: 3, hi: 12, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // Re-apply glints post-outline.
  dot(c, 7, 12, GLINT);
  dot(c, 37, 10, GLINT);
  dot(c, 13, 22, GLINT);
  glyphStamp(c, 10, 30, HEX_NODE, GLINT);
  glyphStamp(c, 24, 30, HEX_NODE, GLINT);

  // Frame 2 — idle head raise (bob -1).
  const f2 = bobFrame(c, -1);

  // Frame 3 — tail twitch (swap glint on tail tip).
  const f3 = c.clone();
  dot(f3, 36, 9, GLINT);
  dot(f3, 38, 11, GLINT);

  return buildSprite('sprite-runeclaw', [c, f2, f3], 3);
}

// ---------------------------------------------------------------------------
// sprite-vectorix — 40x40, arrow-headed darting creature, chevron body trails.
// A sleek, aerodynamic creature with an arrowhead-shaped head and a body
// decorated with chevron trail markings suggesting extreme speed.
// ---------------------------------------------------------------------------

function buildVectorix(): SpriteDef {
  const W = 40;
  const H = 40;
  const c = PixelCanvas.create(W, H);

  // Body — elongated horizontal teardrop/arrow shape.
  fillPolygon(
    c,
    [
      [20, 14],
      [34, 18],
      [36, 20],
      [34, 22],
      [20, 26],
      [8, 24],
      [4, 20],
      [8, 16],
    ],
    8,
  );

  // Head — sharp arrowhead pointing right (the direction of motion).
  fillPolygon(
    c,
    [
      [34, 16],
      [40, 20],
      [34, 24],
      [32, 22],
      [32, 18],
    ],
    9,
  );

  // Eye — on the arrowhead.
  fillEllipse(c, 36, 20, 2, 2, 3);
  dot(c, 36, 20, 2);
  dot(c, 35, 19, GLINT);

  // Wing-fin upper (left, mirror for right) — swept-back.
  fillPolygon(
    c,
    [
      [18, 14],
      [28, 10],
      [32, 12],
      [26, 16],
      [18, 17],
    ],
    7,
  );

  // Wing-fin lower (left).
  fillPolygon(
    c,
    [
      [18, 23],
      [26, 24],
      [32, 28],
      [28, 30],
      [18, 26],
    ],
    7,
  );

  // Chevron body trail markings — left half only.
  glyphStamp(c, 11, 17, CHEVRON, 10);
  glyphStamp(c, 16, 17, CHEVRON, 11);
  glyphStamp(c, 21, 17, CHEVRON, 12);

  // Tail — narrow triangular point to the left.
  fillPolygon(
    c,
    [
      [4, 20],
      [8, 16],
      [10, 20],
      [8, 24],
    ],
    6,
  );
  thickLine(c, 1, 20, 5, 20, 5, 1);
  dot(c, 1, 20, GLINT);
  dot(c, 2, 20, GLINT);

  // Leg-fins (4 stubby limbs, lower-body, left pair only).
  fillPolygon(
    c,
    [
      [15, 24],
      [20, 25],
      [19, 30],
      [14, 29],
    ],
    6,
  );
  fillPolygon(
    c,
    [
      [24, 24],
      [29, 25],
      [28, 30],
      [23, 29],
    ],
    6,
  );

  shade(c, { dir: 'upper-left', bands: 10, lo: 3, hi: 12, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // Re-apply glints.
  dot(c, 35, 19, GLINT);
  dot(c, 1, 20, GLINT);
  dot(c, 2, 20, GLINT);
  // Stamp chevrons again (shade may overwrite).
  glyphStamp(c, 11, 17, CHEVRON, 10);
  glyphStamp(c, 16, 17, CHEVRON, 11);
  glyphStamp(c, 21, 17, CHEVRON, 12);

  // Frame 2 — bob down 1, speed lines.
  const f2 = bobFrame(c, 1);
  dot(f2, 1, 21, GLINT);
  dot(f2, 2, 21, GLINT);

  // Frame 3 — bob up 1.
  const f3 = bobFrame(c, -1);

  return buildSprite('sprite-vectorix', [c, f2, f3], 4);
}

// ---------------------------------------------------------------------------
// sprite-glyphound — 40x40, sleek hound of stacked sigils, glowing collar ring.
// An elegant four-legged hound whose body surface appears made of overlapping
// rune panels. A bright glowing collar ring at the neck is its signature.
// ---------------------------------------------------------------------------

function buildGlyphound(): SpriteDef {
  const W = 40;
  const H = 40;
  const c = PixelCanvas.create(W, H);

  // Body — sleek rectangular core, slightly raised at shoulders.
  fillPolygon(
    c,
    [
      [10, 16],
      [30, 15],
      [33, 18],
      [33, 28],
      [29, 30],
      [11, 30],
      [7, 28],
      [7, 18],
    ],
    7,
  );

  // Shoulder hump (slight rise on torso front).
  fillPolygon(
    c,
    [
      [10, 14],
      [20, 13],
      [22, 16],
      [10, 17],
    ],
    8,
  );

  // Head — narrow angular head set low, forward.
  fillPolygon(
    c,
    [
      [4, 12],
      [14, 11],
      [16, 14],
      [15, 19],
      [4, 19],
      [2, 16],
    ],
    8,
  );

  // Snout — flat, slightly recessed.
  fillRect(c, 1, 15, 6, 18, 6);
  dot(c, 3, 14, 3); // nostril

  // Eye.
  fillEllipse(c, 9, 14, 3, 3, 3);
  fillEllipse(c, 9, 14, 2, 2, 12);
  dot(c, 9, 14, 2);
  dot(c, 8, 13, GLINT);

  // Ear — triangular, swept back.
  fillPolygon(
    c,
    [
      [13, 8],
      [18, 8],
      [17, 12],
      [12, 12],
    ],
    6,
  );
  dot(c, 15, 9, 9);

  // Collar ring — glowing loop around neck junction.
  // (Not mirrored — draw as full ring since it's centered on neck area.)
  for (let angle = 0; angle < 360; angle += 15) {
    const rad = (angle * Math.PI) / 180;
    const rx = 4;
    const ry = 2;
    const nx = Math.round(12 + rx * Math.cos(rad));
    const ny = Math.round(16 + ry * Math.sin(rad));
    c.set(nx, ny, GLINT);
    // Thicken collar ring.
    c.set(nx, ny - 1, RIM_LO);
    c.set(nx, ny + 1, RIM_LO);
  }

  // Rune panels on body (left half).
  glyphStamp(c, 13, 19, HEX_NODE, 11);
  glyphStamp(c, 20, 18, HEX_NODE, 10);

  // Tail — curled upward sweep to the right (draw right side only, will not be mirrored).
  bezier(c, 33, 22, 38, 16, 36, 13, 8, 2, 1);
  dot(c, 35, 13, GLINT);
  dot(c, 36, 12, GLINT);

  // Front legs (left only).
  fillPolygon(
    c,
    [
      [9, 29],
      [14, 29],
      [14, 37],
      [11, 38],
      [8, 37],
      [8, 32],
    ],
    7,
  );
  // Paw.
  fillPolygon(
    c,
    [
      [7, 36],
      [15, 36],
      [14, 39],
      [8, 39],
    ],
    5,
  );
  dot(c, 9, 38, 4);
  dot(c, 12, 38, 4);

  // Back legs (left-rear).
  fillPolygon(
    c,
    [
      [24, 28],
      [29, 28],
      [30, 36],
      [27, 38],
      [23, 38],
      [22, 33],
    ],
    7,
  );
  // Paw.
  fillPolygon(
    c,
    [
      [21, 36],
      [29, 36],
      [28, 39],
      [22, 39],
    ],
    5,
  );
  dot(c, 23, 38, 4);
  dot(c, 26, 38, 4);

  shade(c, { dir: 'upper-left', bands: 10, lo: 3, hi: 12, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // Re-apply glints post-outline.
  dot(c, 8, 13, GLINT);
  dot(c, 35, 13, GLINT);
  dot(c, 36, 12, GLINT);
  glyphStamp(c, 13, 19, HEX_NODE, GLINT);
  glyphStamp(c, 20, 18, HEX_NODE, GLINT);

  // Re-stamp collar ring glints.
  for (let angle = 0; angle < 360; angle += 30) {
    const rad = (angle * Math.PI) / 180;
    const rx = 4;
    const ry = 2;
    const nx = Math.round(12 + rx * Math.cos(rad));
    const ny = Math.round(16 + ry * Math.sin(rad));
    c.set(nx, ny, GLINT);
  }

  // Frame 2 — tail wag up.
  const f2 = c.clone();
  bezier(f2, 33, 22, 39, 14, 37, 11, 8, 2, 1);
  dot(f2, 36, 11, GLINT);

  // Frame 3 — idle bob.
  const f3 = bobFrame(c, -1);

  return buildSprite('sprite-glyphound', [c, f2, f3], 3);
}

// ---------------------------------------------------------------------------
// sprite-cryptarch — 44x44, robed keeper of keys, lock-shaped chest core.
// A tall cloaked figure. Robe made of stacked angular plates. A lock-shaped
// medallion glows on the chest. Carries an oversized key staff.
// ---------------------------------------------------------------------------

function buildCryptarch(): SpriteDef {
  const W = 44;
  const H = 44;
  const c = PixelCanvas.create(W, H);

  // Robe body — wide trapezoid, narrow at top.
  fillPolygon(
    c,
    [
      [14, 18],
      [30, 18],
      [34, 22],
      [36, 38],
      [30, 42],
      [14, 42],
      [8, 38],
      [10, 22],
    ],
    7,
  );

  // Robe layers — stacked horizontal plates (decorative edge lines).
  for (let py = 22; py <= 38; py += 4) {
    thickLine(c, 10, py, 34, py, 4, 1);
  }
  dot(c, 14, 22, GLINT);
  dot(c, 22, 26, GLINT);
  dot(c, 30, 30, GLINT);
  dot(c, 18, 34, GLINT);

  // Chest — slightly raised front panel.
  fillPolygon(
    c,
    [
      [16, 18],
      [28, 18],
      [30, 22],
      [28, 28],
      [16, 28],
      [14, 22],
    ],
    9,
  );

  // Lock icon on chest.
  glyphStamp(c, 18, 19, LOCK_ICON, GLINT);
  // Lock body fill.
  fillRect(c, 19, 22, 25, 27, 11);
  // Lock keyhole.
  fillEllipse(c, 22, 24, 2, 2, 3);
  dot(c, 22, 24, 2);
  dot(c, 22, 25, 3);

  // Head — angular dome with visor.
  fillPolygon(
    c,
    [
      [16, 6],
      [28, 6],
      [30, 10],
      [28, 17],
      [16, 17],
      [14, 10],
    ],
    8,
  );

  // Visor slit — dark horizontal bar across eyes.
  fillRect(c, 15, 11, 29, 14, 3);
  // Eye glow (through visor).
  dot(c, 18, 12, GLINT);
  dot(c, 26, 12, GLINT);

  // Hood/cowl — triangular shadow on head top.
  fillPolygon(
    c,
    [
      [14, 6],
      [22, 3],
      [30, 6],
      [28, 8],
      [16, 8],
    ],
    4,
  );

  // Staff (left-side, tall key staff — not mirrored).
  thickLine(c, 6, 8, 6, 40, 5, 2);
  // Key head — bow (ring).
  fillEllipse(c, 6, 8, 4, 4, 9);
  fillEllipse(c, 6, 8, 2, 2, 3);
  dot(c, 6, 8, GLINT);
  // Key teeth — two notches.
  fillRect(c, 2, 33, 5, 35, 10);
  fillRect(c, 2, 37, 5, 39, 10);
  dot(c, 3, 34, GLINT);
  dot(c, 3, 38, GLINT);

  // Arms (left only).
  fillPolygon(
    c,
    [
      [9, 20],
      [14, 19],
      [13, 30],
      [8, 31],
    ],
    7,
  );
  // Hand gripping staff.
  fillEllipse(c, 7, 31, 3, 3, 8);

  shade(c, { dir: 'upper-left', bands: 10, lo: 3, hi: 12, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // Re-apply key glints.
  dot(c, 6, 8, GLINT);
  dot(c, 3, 34, GLINT);
  dot(c, 3, 38, GLINT);
  dot(c, 18, 12, GLINT);
  dot(c, 26, 12, GLINT);
  glyphStamp(c, 18, 19, LOCK_ICON, GLINT);
  dot(c, 14, 22, GLINT);
  dot(c, 22, 26, GLINT);

  // Frame 2 — staff raised (bob body -1, staff stays).
  const f2 = bobFrame(c, -1);

  // Frame 3 — lock glow intensifies.
  const f3 = c.clone();
  fillRect(f3, 19, 22, 25, 27, 12);
  dot(f3, 22, 24, RIM_HI);
  dot(f3, 21, 24, GLINT);
  dot(f3, 23, 24, GLINT);

  return buildSprite('sprite-cryptarch', [c, f2, f3], 3);
}

// ---------------------------------------------------------------------------
// sprite-matrixion — 44x44, lattice golem, grid torso with pulsing nodes.
// A boxy construct whose torso is a visible circuit-grid lattice. Squared-off
// limbs. Pulsing junction nodes across the body (glint index 15).
// ---------------------------------------------------------------------------

function buildMatrixion(): SpriteDef {
  const W = 44;
  const H = 44;
  const c = PixelCanvas.create(W, H);

  // Torso — large square with rounded corners (polygon for crispness).
  fillPolygon(
    c,
    [
      [12, 14],
      [32, 14],
      [34, 16],
      [34, 32],
      [32, 34],
      [12, 34],
      [10, 32],
      [10, 16],
    ],
    7,
  );

  // Grid lines across torso (horizontal).
  for (let gy = 17; gy <= 31; gy += 4) {
    thickLine(c, 11, gy, 33, gy, 5, 1);
  }
  // Grid lines across torso (vertical — left half only, mirrorX handles right).
  for (let gx = 13; gx <= 22; gx += 4) {
    thickLine(c, gx, 15, gx, 33, 5, 1);
  }

  // Junction nodes at grid intersections (left half).
  for (let gy = 17; gy <= 31; gy += 4) {
    for (let gx = 13; gx <= 22; gx += 4) {
      dot(c, gx, gy, GLINT);
    }
  }

  // Head — cube-shaped with a T-shaped visor.
  fillPolygon(
    c,
    [
      [14, 4],
      [30, 4],
      [32, 6],
      [32, 13],
      [30, 15],
      [14, 15],
      [12, 13],
      [12, 6],
    ],
    8,
  );

  // Visor — T-slot across face center.
  fillRect(c, 14, 8, 30, 11, 3);
  // Eyes glow through visor slot.
  fillEllipse(c, 18, 9, 2, 1, GLINT);
  fillEllipse(c, 26, 9, 2, 1, GLINT);

  // Antenna pair (left half).
  thickLine(c, 17, 1, 17, 4, 9, 1);
  dot(c, 17, 1, GLINT);

  // Shoulder blocks (left only).
  fillRect(c, 7, 14, 13, 20, 8);
  dot(c, 9, 15, 10);

  // Arms (left only) — rectangular with elbow joint.
  fillRect(c, 5, 20, 12, 28, 7);
  // Elbow joint bevel.
  dot(c, 6, 24, 9);
  dot(c, 11, 24, 5);

  // Hand/fist (left).
  fillRect(c, 4, 28, 12, 34, 6);
  // Knuckle circuit nodes.
  dot(c, 6, 29, GLINT);
  dot(c, 9, 29, GLINT);

  // Leg column (left only).
  fillRect(c, 12, 34, 20, 40, 7);

  // Knee joint.
  fillRect(c, 11, 36, 21, 38, 8);
  dot(c, 16, 37, GLINT);

  // Foot platform (left).
  fillRect(c, 10, 40, 22, 43, 5);

  mirrorX(c);
  shade(c, { dir: 'upper-left', bands: 10, lo: 3, hi: 12, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // Re-apply grid node glints (they span full torso after mirrorX).
  for (let gy = 17; gy <= 31; gy += 4) {
    for (let gx = 13; gx <= 31; gx += 4) {
      dot(c, gx, gy, GLINT);
    }
  }
  fillEllipse(c, 18, 9, 2, 1, GLINT);
  fillEllipse(c, 26, 9, 2, 1, GLINT);
  dot(c, 17, 1, GLINT);
  dot(c, 27, 1, GLINT);
  dot(c, 6, 29, GLINT);
  dot(c, 9, 29, GLINT);
  dot(c, 35, 29, GLINT);
  dot(c, 38, 29, GLINT);
  dot(c, 16, 37, GLINT);
  dot(c, 28, 37, GLINT);

  // Frame 2 — nodes pulse (offset glint positions).
  const f2 = c.clone();
  for (let gy = 19; gy <= 31; gy += 4) {
    for (let gx = 15; gx <= 29; gx += 4) {
      dot(f2, gx, gy, RIM_LO);
    }
  }

  // Frame 3 — bob -1.
  const f3 = bobFrame(c, -1);

  return buildSprite('sprite-matrixion', [c, f2, f3], 3);
}

// ---------------------------------------------------------------------------
// sprite-sigilus — 44x44, floating seal-creature, concentric ring wards.
// A spectral floating disc-body with no limbs — it hovers via three
// concentric glowing ring-wards. Face centered in the disc. Eerie and
// distinctive silhouette.
// ---------------------------------------------------------------------------

function buildSigilus(): SpriteDef {
  const W = 44;
  const H = 44;
  const c = PixelCanvas.create(W, H);

  const cx = 22;
  const cy = 23;

  // Outer ring body (filled disc).
  fillEllipse(c, cx, cy, 18, 16, 5);

  // Concentric darker ring (middle of disc).
  fillEllipse(c, cx, cy, 13, 11, 6);

  // Core face plate.
  fillEllipse(c, cx, cy, 9, 8, 8);

  // Concentric ring wards (stroked ellipses as glowing circuit lines).
  // Outer ward ring.
  for (let a = 0; a < 360; a += 5) {
    const rad = (a * Math.PI) / 180;
    const rx = 17;
    const ry = 15;
    const px = Math.round(cx + rx * Math.cos(rad));
    const py = Math.round(cy + ry * Math.sin(rad));
    const cur = c.get(px, py);
    if (cur > 0) c.set(px, py, GLINT);
  }

  // Inner ward ring.
  for (let a = 0; a < 360; a += 7) {
    const rad = (a * Math.PI) / 180;
    const rx = 12;
    const ry = 10;
    const px = Math.round(cx + rx * Math.cos(rad));
    const py = Math.round(cy + ry * Math.sin(rad));
    const cur = c.get(px, py);
    if (cur > 0) c.set(px, py, RIM_LO);
  }

  // Ward nodes — 8 equally spaced bright nodes on outer ring.
  for (let a = 0; a < 360; a += 45) {
    const rad = (a * Math.PI) / 180;
    const rx = 17;
    const ry = 15;
    const px = Math.round(cx + rx * Math.cos(rad));
    const py = Math.round(cy + ry * Math.sin(rad));
    c.set(px, py, GLINT);
  }

  // Cross-hair etchings on face plate (4 lines from center).
  thickLine(c, cx - 7, cy, cx - 3, cy, 10, 1);
  thickLine(c, cx, cy - 6, cx, cy - 2, 10, 1);
  // (mirrorX will add the right/bottom counterparts).
  dot(c, cx - 6, cy, GLINT);
  dot(c, cx, cy - 5, GLINT);

  // Eyes — two angular slits.
  fillRect(c, cx - 6, cy - 2, cx - 2, cy, 3);
  dot(c, cx - 4, cy - 1, GLINT);

  // Nose mark.
  dot(c, cx, cy + 1, 3);
  dot(c, cx, cy + 2, 3);

  // Mouth — angular grimace.
  fillRect(c, cx - 4, cy + 3, cx - 1, cy + 4, 3);
  dot(c, cx - 4, cy + 3, 2);
  dot(c, cx - 1, cy + 3, 2);

  // Floating wisp tendrils below disc (left side).
  bezier(c, cx - 4, cy + 14, cx - 8, cy + 18, cx - 10, cy + 22, 4, 2, 1);
  bezier(c, cx - 10, cy + 14, cx - 14, cy + 17, cx - 14, cy + 20, 4, 2, 1);

  mirrorX(c);
  shade(c, { dir: 'radial', bands: 9, lo: 4, hi: 12, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // Re-apply ward ring glints after shading/outline.
  for (let a = 0; a < 360; a += 45) {
    const rad = (a * Math.PI) / 180;
    const rx = 17;
    const ry = 15;
    const px = Math.round(cx + rx * Math.cos(rad));
    const py = Math.round(cy + ry * Math.sin(rad));
    if (c.get(px, py) > 0) c.set(px, py, GLINT);
  }
  dot(c, cx - 6, cy, GLINT);
  dot(c, cx + 6, cy, GLINT);
  dot(c, cx, cy - 5, GLINT);
  dot(c, cx - 4, cy - 1, GLINT);
  dot(c, cx + 4, cy - 1, GLINT);

  // Frame 2 — disc rotates (bob -1 + ward nodes shift phase).
  const f2 = bobFrame(c, -1);
  for (let a = 22; a < 360; a += 45) {
    const rad = (a * Math.PI) / 180;
    const rx = 17;
    const ry = 15;
    const px = Math.round(cx + rx * Math.cos(rad));
    const py = Math.round(cy - 1 + ry * Math.sin(rad));
    if (f2.get(px, py) > 0) f2.set(px, py, GLINT);
  }

  // Frame 3 — eyes open wide.
  const f3 = c.clone();
  fillRect(f3, cx - 6, cy - 3, cx - 2, cy + 1, 3);
  dot(f3, cx - 4, cy - 1, GLINT);
  fillRect(f3, cx + 2, cy - 3, cx + 6, cy + 1, 3);
  dot(f3, cx + 4, cy - 1, GLINT);

  return buildSprite('sprite-sigilus', [c, f2, f3], 3);
}

// ---------------------------------------------------------------------------
// sprite-enigmax — 48x48, apex puzzle-titan, rotating cube heart, asymmetric horns.
// A massive hulking titan. Its chest is dominated by a floating geometric cube
// that seems to rotate. Each shoulder bears a different-sized horn (asymmetric).
// Angular plates everywhere, high contrast.
// ---------------------------------------------------------------------------

function buildEnigmax(): SpriteDef {
  const W = 48;
  const H = 48;
  const c = PixelCanvas.create(W, H);

  // Main torso — very wide, heavily armored block.
  fillPolygon(
    c,
    [
      [10, 18],
      [38, 18],
      [42, 22],
      [42, 36],
      [38, 40],
      [10, 40],
      [6, 36],
      [6, 22],
    ],
    7,
  );

  // Chest cavity — deep dark inset panel for the cube heart.
  fillPolygon(
    c,
    [
      [16, 20],
      [32, 20],
      [34, 23],
      [34, 35],
      [32, 37],
      [16, 37],
      [14, 35],
      [14, 23],
    ],
    2,
  );

  // Cube heart — large isometric cube floating in the dark chest cavity.
  // Top face (bright highlight).
  fillPolygon(
    c,
    [
      [19, 23],
      [24, 20],
      [29, 23],
      [24, 26],
    ],
    13,
  );
  // Left face (shadow side).
  fillPolygon(
    c,
    [
      [19, 23],
      [24, 26],
      [24, 33],
      [19, 30],
    ],
    7,
  );
  // Right face (mid tone).
  fillPolygon(
    c,
    [
      [24, 26],
      [29, 23],
      [29, 30],
      [24, 33],
    ],
    10,
  );
  // Cube edge glints — all 4 corners.
  dot(c, 24, 20, GLINT);
  dot(c, 19, 23, GLINT);
  dot(c, 29, 23, GLINT);
  dot(c, 24, 33, GLINT);
  // Top face inner glow.
  dot(c, 24, 22, RIM_HI);
  dot(c, 23, 23, RIM_LO);
  dot(c, 25, 23, RIM_LO);

  // Head — massive angular skull.
  fillPolygon(
    c,
    [
      [15, 6],
      [33, 6],
      [36, 10],
      [36, 17],
      [33, 19],
      [15, 19],
      [12, 17],
      [12, 10],
    ],
    8,
  );

  // Visor — dark band across eyes.
  fillRect(c, 14, 10, 34, 14, 3);
  // Eye glow slots (left half).
  fillEllipse(c, 18, 12, 3, 1, GLINT);

  // Jaw plate — hanging slightly below head.
  fillPolygon(
    c,
    [
      [14, 17],
      [34, 17],
      [35, 19],
      [34, 22],
      [14, 22],
      [13, 19],
    ],
    5,
  );
  // Jaw seam line.
  thickLine(c, 14, 19, 34, 19, 3, 1);

  // LEFT horn — tall angular spike.
  fillPolygon(
    c,
    [
      [12, 6],
      [18, 1],
      [20, 4],
      [16, 8],
      [12, 8],
    ],
    9,
  );
  dot(c, 18, 1, GLINT);
  dot(c, 17, 2, GLINT);

  // RIGHT horn — shorter, forward-angled (asymmetric!).
  fillPolygon(
    c,
    [
      [30, 6],
      [35, 3],
      [38, 6],
      [35, 10],
      [30, 9],
    ],
    9,
  );
  dot(c, 37, 4, GLINT);

  // Shoulder armor plates (left only — large, spiky).
  fillPolygon(
    c,
    [
      [2, 18],
      [10, 17],
      [10, 26],
      [4, 28],
      [1, 24],
    ],
    8,
  );
  // Shoulder spike.
  fillPolygon(
    c,
    [
      [1, 16],
      [7, 14],
      [9, 18],
      [3, 20],
    ],
    9,
  );
  dot(c, 3, 14, GLINT);

  // Arms (left only) — thick segmented.
  fillPolygon(
    c,
    [
      [2, 26],
      [10, 25],
      [11, 34],
      [4, 36],
    ],
    7,
  );

  // Gauntlet/fist (left).
  fillPolygon(
    c,
    [
      [1, 34],
      [11, 33],
      [13, 38],
      [9, 41],
      [2, 40],
    ],
    6,
  );
  // Knuckle ridges (left).
  dot(c, 3, 36, 5);
  dot(c, 6, 36, 5);
  dot(c, 9, 36, 5);

  // Legs (left only) — wide and armored.
  fillPolygon(
    c,
    [
      [12, 40],
      [22, 40],
      [23, 46],
      [20, 47],
      [11, 47],
      [10, 44],
    ],
    7,
  );

  // Foot (left) — wide platform.
  fillPolygon(
    c,
    [
      [9, 45],
      [23, 45],
      [24, 47],
      [8, 47],
    ],
    5,
  );

  // Rune marks on torso sides (left).
  glyphStamp(c, 7, 26, HEX_NODE, 10);
  glyphStamp(c, 7, 32, HEX_NODE, 10);

  mirrorX(c);
  shade(c, { dir: 'upper-left', bands: 11, lo: 3, hi: 12, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // Re-apply glints (cube + horns + eyes).
  dot(c, 24, 20, GLINT);
  dot(c, 19, 23, GLINT);
  dot(c, 29, 23, GLINT);
  dot(c, 24, 33, GLINT);
  dot(c, 24, 22, RIM_HI);
  dot(c, 18, 1, GLINT);
  dot(c, 17, 2, GLINT);
  dot(c, 37, 4, GLINT);
  dot(c, 3, 14, GLINT);
  dot(c, 45, 14, GLINT); // mirrored shoulder
  fillEllipse(c, 18, 12, 3, 1, GLINT);
  fillEllipse(c, 30, 12, 3, 1, GLINT); // mirrored eye
  glyphStamp(c, 7, 26, HEX_NODE, GLINT);
  glyphStamp(c, 7, 32, HEX_NODE, GLINT);

  // Frame 2 — cube heart "rotates" (swap face brightness to simulate rotation).
  const f2 = c.clone();
  // Top face dims, side faces swap highlight.
  fillPolygon(
    f2,
    [
      [19, 23],
      [24, 20],
      [29, 23],
      [24, 26],
    ],
    10,
  );
  fillPolygon(
    f2,
    [
      [19, 23],
      [24, 26],
      [24, 33],
      [19, 30],
    ],
    13,
  );
  fillPolygon(
    f2,
    [
      [24, 26],
      [29, 23],
      [29, 30],
      [24, 33],
    ],
    7,
  );
  dot(f2, 24, 20, GLINT);
  dot(f2, 19, 23, GLINT);
  dot(f2, 29, 23, GLINT);
  dot(f2, 24, 33, GLINT);
  dot(f2, 24, 22, RIM_LO);
  dot(f2, 19, 25, RIM_HI);

  // Frame 3 — idle bob -1.
  const f3 = bobFrame(c, -1);

  return buildSprite('sprite-enigmax', [c, f2, f3], 3);
}

// ---------------------------------------------------------------------------
// sprite-keystrix — 48x48, apex key-raptor, beak like a skeleton key, fan of
// blade-feathers. A powerful raptor-form creature. Beak has a ring-bow at tip
// like a skeleton key. Tail is a magnificent fan of blade-feathers.
// ---------------------------------------------------------------------------

function buildKeystrix(): SpriteDef {
  const W = 48;
  const H = 48;
  const c = PixelCanvas.create(W, H);

  // Main body — sleek avian torso.
  fillPolygon(
    c,
    [
      [16, 18],
      [32, 16],
      [36, 20],
      [36, 32],
      [32, 36],
      [16, 36],
      [12, 32],
      [12, 20],
    ],
    7,
  );

  // Chest keel — raised sternum ridge.
  fillPolygon(
    c,
    [
      [20, 20],
      [28, 19],
      [30, 24],
      [28, 30],
      [20, 30],
      [18, 24],
    ],
    9,
  );
  thickLine(c, 24, 20, 24, 30, 11, 1); // center keel line

  // Head — angular avian skull.
  fillPolygon(
    c,
    [
      [16, 8],
      [28, 7],
      [32, 11],
      [30, 17],
      [16, 18],
      [12, 14],
      [12, 10],
    ],
    8,
  );

  // Crest feathers (left half — angular swept-back blades).
  fillPolygon(
    c,
    [
      [12, 6],
      [18, 2],
      [22, 5],
      [20, 9],
      [13, 10],
    ],
    9,
  );
  fillPolygon(
    c,
    [
      [18, 5],
      [22, 0],
      [26, 3],
      [24, 8],
      [19, 9],
    ],
    8,
  );
  dot(c, 18, 2, GLINT);
  dot(c, 22, 0, GLINT);

  // KEY BEAK — the signature feature. Long angular beak with a circular
  // ring-bow at the tip (skeleton key bow).
  // Beak shaft.
  fillPolygon(
    c,
    [
      [30, 11],
      [44, 13],
      [43, 16],
      [30, 15],
    ],
    7,
  );
  // Key bow ring (circle at beak tip).
  fillEllipse(c, 44, 14, 4, 4, 9);
  fillEllipse(c, 44, 14, 2, 2, 3);
  dot(c, 44, 14, GLINT);
  // Key bow inner hole.
  dot(c, 44, 13, 2);
  dot(c, 44, 15, 2);
  // Beak serration (key-teeth marks).
  dot(c, 36, 15, 4);
  dot(c, 39, 15, 4);
  dot(c, 42, 15, 4);

  // Eye.
  fillEllipse(c, 19, 12, 3, 3, 3);
  fillEllipse(c, 19, 12, 2, 2, 12);
  dot(c, 19, 12, 2);
  dot(c, 18, 11, GLINT);

  // Wing (left side — large angular swept wing, fills left area).
  fillPolygon(
    c,
    [
      [8, 18],
      [16, 17],
      [14, 32],
      [4, 36],
      [2, 28],
      [4, 22],
    ],
    6,
  );

  // Wing blade-feathers (3 overlapping angular slats).
  fillPolygon(
    c,
    [
      [4, 26],
      [14, 22],
      [15, 25],
      [5, 29],
    ],
    8,
  );
  fillPolygon(
    c,
    [
      [3, 30],
      [13, 26],
      [14, 29],
      [4, 33],
    ],
    7,
  );
  fillPolygon(
    c,
    [
      [2, 34],
      [12, 30],
      [13, 33],
      [3, 37],
    ],
    6,
  );

  // Wing tip glints.
  dot(c, 3, 26, GLINT);
  dot(c, 2, 30, GLINT);
  dot(c, 2, 34, GLINT);

  // Tail fan — magnificent blade-feather fan (right side, not mirrored).
  // Central tail feathers.
  fillPolygon(
    c,
    [
      [34, 28],
      [40, 20],
      [43, 22],
      [38, 32],
    ],
    8,
  );
  fillPolygon(
    c,
    [
      [34, 30],
      [42, 24],
      [44, 28],
      [38, 36],
    ],
    7,
  );
  fillPolygon(
    c,
    [
      [34, 32],
      [40, 30],
      [44, 34],
      [38, 38],
    ],
    6,
  );
  fillPolygon(
    c,
    [
      [34, 33],
      [38, 36],
      [42, 40],
      [36, 40],
    ],
    5,
  );

  // Tail feather edge glints.
  dot(c, 43, 22, GLINT);
  dot(c, 44, 27, GLINT);
  dot(c, 44, 33, GLINT);
  dot(c, 42, 39, GLINT);

  // Rune markings along tail shafts.
  dot(c, 38, 25, 11);
  dot(c, 39, 29, 11);
  dot(c, 38, 33, 11);

  // Taloned legs (left only).
  fillPolygon(
    c,
    [
      [16, 35],
      [21, 34],
      [22, 42],
      [19, 44],
      [15, 44],
      [14, 39],
    ],
    7,
  );

  // Talons (left — three forward-pointing curved claws).
  bezier(c, 14, 43, 10, 46, 8, 47, 4, 2, 1);
  bezier(c, 17, 44, 15, 47, 13, 47, 4, 2, 1);
  bezier(c, 20, 44, 20, 47, 18, 47, 4, 2, 1);

  // Talon glints.
  dot(c, 8, 47, GLINT);
  dot(c, 13, 47, GLINT);
  dot(c, 18, 47, GLINT);

  // Circuit etchings on torso (left half).
  glyphStamp(c, 14, 22, HEX_NODE, 10);
  glyphStamp(c, 14, 28, HEX_NODE, 10);

  shade(c, { dir: 'upper-left', bands: 11, lo: 3, hi: 12, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // Re-apply all critical glints.
  dot(c, 44, 14, GLINT);
  dot(c, 18, 11, GLINT);
  dot(c, 18, 2, GLINT);
  dot(c, 22, 0, GLINT);
  dot(c, 43, 22, GLINT);
  dot(c, 44, 27, GLINT);
  dot(c, 44, 33, GLINT);
  dot(c, 42, 39, GLINT);
  dot(c, 3, 26, GLINT);
  dot(c, 2, 30, GLINT);
  dot(c, 2, 34, GLINT);
  dot(c, 8, 47, GLINT);
  dot(c, 13, 47, GLINT);
  dot(c, 18, 47, GLINT);
  glyphStamp(c, 14, 22, HEX_NODE, GLINT);
  glyphStamp(c, 14, 28, HEX_NODE, GLINT);

  // Frame 2 — wings spread slightly wider.
  const f2 = c.clone();
  fillPolygon(
    f2,
    [
      [7, 17],
      [16, 17],
      [14, 32],
      [3, 37],
      [1, 28],
      [3, 21],
    ],
    6,
  );
  dot(f2, 2, 26, GLINT);
  dot(f2, 1, 30, GLINT);

  // Frame 3 — bob -1 (hovering pose).
  const f3 = bobFrame(c, -1);

  return buildSprite('sprite-keystrix', [c, f2, f3], 3);
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
