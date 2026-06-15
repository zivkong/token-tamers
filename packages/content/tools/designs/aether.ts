/**
 * Aether line sprite designs — the SKY COURT kingdom (flying animals).
 *
 * Identity bible: docs/design/visuals-habitats-achievements.md §13 (Species identity
 * system) + the create-sprites skill. Sky Court creatures FLOAT (never touch ground),
 * built from a vertical teardrop body, a single luminous HALO-EYE (the WIS motif),
 * WING-PLANES that multiply with stage (1 → 2 → 3 per side), and VEIL-TRAILS of light
 * drifting below. House tint = cyan; grade resolves richness at render time.
 *
 * Size law (2026-06-15): egg 12 · sprite 16 · rookie 20 · evolved 24 · prime 28 · apex 32.
 * Flat tones (outline 1 · shadow 3 · body 7 · light 11 · rim 13 · glint 15) — cel bands,
 * not dither ramps. Every species ships idle + walk + jump + play banks (same dims).
 * Determinism: seeded LCG (hashStr(id)) — never Math.random / Date.now.
 */

import type { SpriteDef } from '@token-tamers/core';
import {
  PixelCanvas,
  buildSprite,
  fillEllipse,
  fillPolygon,
  strokeEllipse,
  line,
  mirrorX,
  shade,
  rimLight,
  outline,
  eyes,
  sparkle,
  shiftFrame,
  bobFrame,
  lcg,
  hashStr,
  type EyeStyle,
  type Lcg,
  OUTLINE,
  RIM_HI,
  GLINT,
} from '../sprite-lib';

// Flat-tone vocabulary shared by every Sky Court creature.
const SHADOW = 3;
const BODY = 7;
const LIGHT = 11;

type Halo = 'none' | 'ring' | 'crown';

/** Geometry of a Sky Court body, derived once from the stage size. */
interface SkyGeom {
  size: number;
  cx: number;
  bodyCy: number;
  bodyRx: number;
  bodyRy: number;
  topY: number;
  botY: number;
  shoulderY: number;
}

interface SkyOpts {
  id: string;
  size: number;
  /** Wing-planes per side (lineage cue: grows with stage). */
  wings: number;
  /** Extra upward sweep on the wings — leaner/faster (bursty) forms set this high. */
  sweep?: number;
  /** Veil-trail strands drifting below the body. */
  veils: number;
  halo: Halo;
  eye?: EyeStyle;
  fps?: number;
  /** Body-tone marks, drawn AFTER mirror + BEFORE shade (so they cel-shade; may be asymmetric). */
  bodyMotif?: (c: PixelCanvas, g: SkyGeom, rng: Lcg) => void;
  /** Bright marks (glint/light/outline), drawn AFTER shade + rimLight, BEFORE outline. */
  brightMotif?: (c: PixelCanvas, g: SkyGeom, rng: Lcg) => void;
}

function skyGeom(size: number): SkyGeom {
  const cx = (size - 1) / 2;
  const bodyRx = Math.max(2, Math.round(size * 0.17));
  const bodyRy = Math.max(3, Math.round(size * 0.26));
  const bodyCy = Math.round(size * 0.44);
  return {
    size,
    cx,
    bodyCy,
    bodyRx,
    bodyRy,
    topY: bodyCy - bodyRy,
    botY: bodyCy + bodyRy,
    shoulderY: bodyCy - Math.round(bodyRy * 0.35),
  };
}

/** A swept wing-plane sail from the left shoulder; mirrorX makes the right pair. */
function drawWing(c: PixelCanvas, g: SkyGeom, i: number, sweep: number): void {
  const shoulderX = Math.round(g.cx - g.bodyRx + 1);
  const reach = Math.round(g.size * 0.15) + i * Math.round(g.size * 0.11);
  const lift = Math.round(g.size * 0.09) + i * Math.round(g.size * 0.05) + sweep;
  const droop = Math.round(g.size * 0.05) + i * Math.round(g.size * 0.03);
  const sY = g.shoulderY - i;
  const tipX = shoulderX - reach;
  const tipY = sY - lift;
  const trailX = shoulderX - Math.round(reach * 0.45);
  const trailY = sY + droop;
  fillPolygon(
    c,
    [
      [shoulderX, sY - 1],
      [tipX, tipY],
      [trailX, trailY],
    ],
    BODY,
  );
}

/** The Sky Court signature: a single glowing wisdom-eye (bright halo + dark pupil + spark). */
function skyEye(c: PixelCanvas, x: number, y: number, big: boolean): void {
  const r = big ? 2 : 1;
  fillEllipse(c, x, y, r + 1, r + 1, LIGHT); // bright sclera halo
  fillEllipse(c, x, y, r, r, OUTLINE); // dark pupil
  c.set(x, y, GLINT); // luminous core spark
  c.set(x - r, y - r, RIM_HI); // catch-light
}

/** A wavy strand of light descending from the body underside. */
function drawVeil(c: PixelCanvas, x0: number, y0: number, len: number, rng: Lcg): void {
  let x = x0;
  for (let i = 0; i < len; i++) {
    const y = y0 + i;
    if (y >= c.height) break;
    c.set(x, y, i >= len - 2 ? SHADOW : BODY);
    if (rng.chance(0.45)) x += rng.int(3) - 1;
  }
}

/** The shared Sky Court builder: one parametric flying creature + its four banks. */
function skyCreature(opts: SkyOpts): SpriteDef {
  const g = skyGeom(opts.size);
  const rng = lcg(hashStr(opts.id));
  const sweep = opts.sweep ?? 0;
  const base = PixelCanvas.create(opts.size, opts.size);

  // 1. Wing-planes (left side only — mirrored below).
  for (let i = 0; i < opts.wings; i++) drawWing(base, g, i, sweep);

  // 2. Floating teardrop body: round top + tapering point below.
  fillEllipse(base, g.cx, g.bodyCy, g.bodyRx, g.bodyRy, BODY);
  fillPolygon(
    base,
    [
      [g.cx - g.bodyRx + 1, g.botY - 1],
      [g.cx + g.bodyRx - 1, g.botY - 1],
      [g.cx, g.botY + Math.round(g.bodyRy * 0.6)],
    ],
    BODY,
  );

  // 3. Symmetry — duplicate the left wings onto the right.
  mirrorX(base);

  // 4. Veil-trails drift from the underside (center longest, sides shorter).
  const veilBase = g.botY + Math.round(g.bodyRy * 0.4);
  for (let j = 0; j < opts.veils; j++) {
    const off = j * Math.max(2, Math.round(opts.size * 0.12));
    const len = Math.max(2, Math.round(opts.size * 0.28) - j * 2);
    drawVeil(base, Math.round(g.cx - off), veilBase, len, rng);
    if (off > 0) drawVeil(base, Math.round(g.cx + off), veilBase, len, rng);
  }

  // 5. Body-tone motif (asymmetric features that should still cel-shade).
  opts.bodyMotif?.(base, g, rng);

  // 6. Cel shading (flat bands, no dither) lit from upper-left.
  const bands = opts.size >= 24 ? 6 : 5;
  shade(base, { dir: 'upper-left', bands, lo: 4, hi: 12, dither: false });
  rimLight(base, 'upper-left');

  // 7. Halo above the head (drawn post-shade so it keeps its bright tone).
  if (opts.halo === 'ring') {
    strokeEllipse(base, Math.round(g.cx), g.topY - 2, g.bodyRx + 1, 1, LIGHT);
  } else if (opts.halo === 'crown') {
    const cyTop = g.topY - 1;
    for (let k = -1; k <= 1; k++) {
      const sx = Math.round(g.cx) + k * Math.max(2, Math.round(g.bodyRx * 0.8));
      line(base, sx, cyTop, sx, cyTop - Math.max(2, Math.round(g.size * 0.12)), LIGHT);
      base.set(sx, cyTop - Math.max(2, Math.round(g.size * 0.12)), RIM_HI);
    }
  }

  // 8. The single luminous halo-eye (the lineage anchor) + bright motif.
  if (opts.eye === 'sleepy') {
    eyes(base, Math.round(g.cx), g.shoulderY + 1, 'sleepy');
  } else {
    skyEye(base, Math.round(g.cx), g.shoulderY + 1, opts.size >= 24);
  }
  opts.brightMotif?.(base, g, rng);

  // 9. Crisp 1px silhouette last.
  outline(base);

  // ---- Animation banks (a floating creature: drift, updraft, swoop) ----
  const idle = [base.grid, bobFrame(base, -1).grid];
  const walk = [base.grid, shiftFrame(base, 1, -1).grid];
  const jump = [shiftFrame(base, 0, 1).grid, shiftFrame(base, 0, -2).grid];
  const swoop = shiftFrame(base, 1, -1);
  sparkle(swoop, Math.round(g.cx + g.bodyRx + 2), g.shoulderY, GLINT);
  const play = [swoop.grid, shiftFrame(base, -1, 0).grid];

  return { ...buildSprite(opts.id, idle, opts.fps ?? 4), walk, jump, play };
}

// ---------------------------------------------------------------------------
// Mote (12×12) — the universal egg: a dormant glowing orb cradling a future Sky
// Court gene (a single sleepy eye + a hatch-crack, one veil hint). Neutral/Wild.
// ---------------------------------------------------------------------------

export function buildMote(): SpriteDef {
  const W = 12;
  const cx = (W - 1) / 2;
  const cy = 6;
  const base = PixelCanvas.create(W, W);

  // Egg-orb body.
  fillEllipse(base, cx, cy, 4, 5, BODY);
  shade(base, { dir: 'upper-left', bands: 5, lo: 4, hi: 12, dither: false });
  rimLight(base, 'upper-left');

  // A dormant single eye (sleepy) — the Sky Court motif, not yet awake.
  eyes(base, Math.round(cx), cy - 1, 'sleepy');
  // Hatch-crack zig down the lower face.
  line(base, Math.round(cx), cy + 1, Math.round(cx) - 1, cy + 3, OUTLINE);
  line(base, Math.round(cx) - 1, cy + 3, Math.round(cx) + 1, cy + 4, OUTLINE);
  // Faint inner glow glint.
  sparkle(base, Math.round(cx) + 1, cy - 2, GLINT);
  outline(base);

  const idle = [base.grid, bobFrame(base, -1).grid];
  const walk = [base.grid, shiftFrame(base, 1, 0).grid];
  const jump = [shiftFrame(base, 0, 1).grid, shiftFrame(base, 0, -2).grid];
  const wobble = shiftFrame(base, 1, -1);
  sparkle(wobble, Math.round(cx) + 2, cy - 2, GLINT);
  const play = [wobble.grid, shiftFrame(base, -1, 0).grid];
  return { ...buildSprite('sprite-mote', idle, 3), walk, jump, play };
}

// ---------------------------------------------------------------------------
// Sky Court line — wings grow 1→1/2→2→3, halo appears at rookie, crown at apex.
// ---------------------------------------------------------------------------

// Wisp (16) — hatchling moth-wisp: one wing per side, big curious eye, one veil.
export function buildWisp(): SpriteDef {
  return skyCreature({
    id: 'sprite-wisp',
    size: 16,
    wings: 1,
    veils: 1,
    halo: 'none',
    eye: 'wide',
  });
}

// Aetherling (20, steady) — sturdier juvenile, faint halo ring, two veils.
export function buildAetherling(): SpriteDef {
  return skyCreature({ id: 'sprite-aetherling', size: 20, wings: 1, veils: 2, halo: 'ring' });
}

// Murmur (20, bursty) — leaner echo-moth: TWIN swept wings + a split twin-tail veil (its motif).
export function buildMurmur(): SpriteDef {
  return skyCreature({
    id: 'sprite-murmur',
    size: 20,
    wings: 2,
    sweep: 2,
    veils: 0,
    halo: 'none',
    fps: 5,
    bodyMotif: (c, g) => {
      // Twin echo-tails forking from the body point.
      line(c, Math.round(g.cx) - 1, g.botY, Math.round(g.cx) - 3, g.botY + 4, BODY);
      line(c, Math.round(g.cx) + 1, g.botY, Math.round(g.cx) + 3, g.botY + 4, BODY);
    },
    brightMotif: (c, g) => sparkle(c, Math.round(g.cx) - 3, g.botY + 4, GLINT),
  });
}

// Oraclet (24, endurance) — layered oracle: two wings, halo ring, riddle-bands across the body.
export function buildOraclet(): SpriteDef {
  return skyCreature({
    id: 'sprite-oraclet',
    size: 24,
    wings: 2,
    veils: 2,
    halo: 'ring',
    bodyMotif: (c, g) => {
      for (let k = 0; k < 2; k++) {
        const y = g.bodyCy + k * 3 + 1;
        line(c, Math.round(g.cx - g.bodyRx + 1), y, Math.round(g.cx + g.bodyRx - 1), y, SHADOW);
      }
    },
  });
}

// Cirrux (24, tempo) — comet-flyer: swept wings + a crystalline wake-streak (asymmetric motif).
export function buildCirrux(): SpriteDef {
  return skyCreature({
    id: 'sprite-cirrux',
    size: 24,
    wings: 2,
    sweep: 3,
    veils: 1,
    halo: 'none',
    fps: 5,
    brightMotif: (c, g) => {
      // Trailing comet wake to the lower-left.
      for (let i = 0; i < 4; i++) {
        c.set(Math.round(g.cx - g.bodyRx - i - 1), g.botY - 1 + i, i % 2 ? GLINT : LIGHT);
      }
    },
  });
}

// Nimbusk (24, breadth) — nimbus of wisdom-sigils: two wings + a ring of three sigil-glints.
export function buildNimbusk(): SpriteDef {
  return skyCreature({
    id: 'sprite-nimbusk',
    size: 24,
    wings: 2,
    veils: 2,
    halo: 'ring',
    brightMotif: (c, g) => {
      const r = g.bodyRx + 3;
      sparkle(c, Math.round(g.cx - r), g.bodyCy, GLINT);
      sparkle(c, Math.round(g.cx + r), g.bodyCy, GLINT);
      sparkle(c, Math.round(g.cx), g.topY - 4, GLINT);
    },
  });
}

// Seraphix (28, high consistency) — radiant seraph: three wing-planes, halo ring, orbiting sparks.
export function buildSeraphix(): SpriteDef {
  return skyCreature({
    id: 'sprite-seraphix',
    size: 28,
    wings: 3,
    veils: 2,
    halo: 'ring',
    brightMotif: (c, g) => {
      sparkle(c, Math.round(g.cx - g.bodyRx - 2), g.shoulderY - 2, GLINT);
      sparkle(c, Math.round(g.cx + g.bodyRx + 2), g.shoulderY - 2, GLINT);
    },
  });
}

// Thoughtwarden (28, mid) — guardian: broad wings + twin light-pillars flanking it (its motif).
export function buildThoughtwarden(): SpriteDef {
  return skyCreature({
    id: 'sprite-thoughtwarden',
    size: 28,
    wings: 2,
    veils: 1,
    halo: 'crown',
    eye: 'wide',
    brightMotif: (c, g) => {
      const px1 = Math.round(g.cx - g.bodyRx - 3);
      const px2 = Math.round(g.cx + g.bodyRx + 3);
      line(c, px1, g.topY, px1, g.botY + 2, LIGHT);
      line(c, px2, g.topY, px2, g.botY + 2, LIGHT);
    },
  });
}

// Halcyore (28, low consistency) — calm drifter: three soft wings + a wide stilling aura ring.
export function buildHalcyore(): SpriteDef {
  return skyCreature({
    id: 'sprite-halcyore',
    size: 28,
    wings: 3,
    sweep: 1,
    veils: 3,
    halo: 'ring',
    eye: 'sleepy',
    brightMotif: (c, g) =>
      strokeEllipse(c, Math.round(g.cx), g.bodyCy, g.bodyRx + 4, g.bodyRy + 3, GLINT),
  });
}

// Aurelion (32, early arc) — the apex seraph: three grand wings, full crown, orbiting thought-sparks.
export function buildAurelion(): SpriteDef {
  return skyCreature({
    id: 'sprite-aurelion',
    size: 32,
    wings: 3,
    veils: 3,
    halo: 'crown',
    eye: 'wide',
    brightMotif: (c, g) => {
      const r = g.bodyRx + 5;
      for (let a = 0; a < 4; a++) {
        const ang = (a / 4) * Math.PI * 2;
        sparkle(
          c,
          Math.round(g.cx + Math.cos(ang) * r),
          Math.round(g.bodyCy + Math.sin(ang) * r),
          GLINT,
        );
      }
    },
  });
}

// Mindspire (32, late arc) — crystallized apex: a vertical crystal spire + orbiting truth-satellites.
export function buildMindspire(): SpriteDef {
  return skyCreature({
    id: 'sprite-mindspire',
    size: 32,
    wings: 2,
    veils: 1,
    halo: 'crown',
    eye: 'wide',
    bodyMotif: (c, g) => {
      // A faceted spire crystal rising from the crown.
      fillPolygon(
        c,
        [
          [Math.round(g.cx), g.topY - 7],
          [Math.round(g.cx) - 2, g.topY - 1],
          [Math.round(g.cx) + 2, g.topY - 1],
        ],
        LIGHT,
      );
    },
    brightMotif: (c, g) => {
      // Satellites orbiting on the horizontal axis.
      sparkle(c, Math.round(g.cx - g.bodyRx - 4), g.bodyCy - 1, GLINT);
      sparkle(c, Math.round(g.cx + g.bodyRx + 4), g.bodyCy + 1, GLINT);
      c.set(Math.round(g.cx), g.topY - 7, RIM_HI);
    },
  });
}

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
