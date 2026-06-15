/**
 * Flux line sprite designs — the TIDE RUNNERS kingdom (aquatic / swift).
 *
 * Identity bible: docs/design/visuals-habitats-achievements.md §13 (Species identity
 * system) + the create-sprites skill. Tide Runners are streamlined, fast, always
 * "mid-motion": a horizontal teardrop body that faces RIGHT (the renderer flips for
 * left), a swept-back dorsal FIN-CREST that grows more back-swept (faster-looking)
 * each stage, a forked tail, a single forward EYE, and CURRENT-RIBBONS streaming off
 * the tail (the SPD motif). House tint = magenta; grade resolves richness.
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
  shade,
  rimLight,
  outline,
  sparkle,
  shiftFrame,
  bobFrame,
  lcg,
  hashStr,
  type Lcg,
  OUTLINE,
  RIM_HI,
  GLINT,
} from '../sprite-lib';

// Flat-tone vocabulary shared by every Tide Runner.
const SHADOW = 3;
const BODY = 7;
const LIGHT = 11;

/** Geometry of a Tide Runner body, derived once from the stage size. */
interface TideGeom {
  size: number;
  cy: number;
  bodyCx: number;
  bodyRx: number;
  bodyRy: number;
  noseX: number;
  tailX: number;
}

interface TideOpts {
  id: string;
  size: number;
  /** Dorsal fin-crest spines (lineage cue: grows with stage). */
  crest: number;
  /** Extra back-sweep on the crest — leaner/faster (bursty/tempo) forms set this high. */
  sweep?: number;
  /** Current-ribbon strands trailing off the tail. */
  ribbons: number;
  fps?: number;
  /** Body-tone marks, drawn BEFORE shade (so they cel-shade; structural). */
  bodyMotif?: (c: PixelCanvas, g: TideGeom, rng: Lcg) => void;
  /** Bright marks (glint/light), drawn AFTER shade + rimLight, BEFORE outline. */
  brightMotif?: (c: PixelCanvas, g: TideGeom, rng: Lcg) => void;
}

function tideGeom(size: number): TideGeom {
  const cy = Math.round(size * 0.48);
  const bodyCx = Math.round(size * 0.46);
  const bodyRx = Math.max(3, Math.round(size * 0.3));
  const bodyRy = Math.max(2, Math.round(size * 0.19));
  return { size, cy, bodyCx, bodyRx, bodyRy, noseX: bodyCx + bodyRx, tailX: bodyCx - bodyRx };
}

/** A swept-back dorsal crest spine; tip leans toward the tail (left). */
function drawCrest(c: PixelCanvas, g: TideGeom, i: number, sweep: number): void {
  const baseX = g.bodyCx + Math.round(g.bodyRx * 0.3) - i * Math.max(2, Math.round(g.size * 0.12));
  const topY = g.cy - g.bodyRy;
  const h = Math.round(g.size * 0.14) + i * Math.round(g.size * 0.03);
  const back = Math.round(g.size * 0.1) + sweep;
  fillPolygon(
    c,
    [
      [baseX, topY],
      [baseX - back, topY - h],
      [baseX - back + 2, topY - h + 1],
      [baseX + 2, topY],
    ],
    BODY,
  );
}

/** A wavy current-ribbon trailing left off the tail. */
function drawRibbon(c: PixelCanvas, x0: number, y0: number, len: number, rng: Lcg): void {
  let y = y0;
  for (let i = 0; i < len; i++) {
    const x = x0 - i;
    if (x < 0) break;
    c.set(x, y, i >= len - 2 ? SHADOW : BODY);
    if (rng.chance(0.5)) y += rng.int(3) - 1;
  }
}

/** A single forward eye near the nose. */
function tideEye(c: PixelCanvas, g: TideGeom): void {
  const x = g.noseX - Math.max(2, Math.round(g.size * 0.12));
  const y = g.cy - 1;
  fillEllipse(c, x, y, 1, 1, LIGHT);
  c.set(x, y, OUTLINE);
  c.set(x, y - 1, RIM_HI);
}

/** The shared Tide Runner builder: one parametric swift swimmer + its four banks. */
function tideRunner(opts: TideOpts): SpriteDef {
  const g = tideGeom(opts.size);
  const rng = lcg(hashStr(opts.id));
  const sweep = opts.sweep ?? 0;
  const base = PixelCanvas.create(opts.size, opts.size);

  // 1. Streamlined body: horizontal teardrop + pointed snout at the right.
  fillEllipse(base, g.bodyCx, g.cy, g.bodyRx, g.bodyRy, BODY);
  fillPolygon(
    base,
    [
      [g.noseX - 1, g.cy - g.bodyRy + 1],
      [g.noseX + Math.round(g.size * 0.08), g.cy],
      [g.noseX - 1, g.cy + g.bodyRy - 1],
    ],
    BODY,
  );

  // 2. Forked tail at the left.
  const tlen = Math.round(g.size * 0.18);
  const th = Math.round(g.size * 0.16);
  fillPolygon(
    base,
    [
      [g.tailX + 1, g.cy],
      [g.tailX - tlen, g.cy - th],
      [g.tailX - Math.round(tlen * 0.4), g.cy],
    ],
    BODY,
  );
  fillPolygon(
    base,
    [
      [g.tailX + 1, g.cy],
      [g.tailX - tlen, g.cy + th],
      [g.tailX - Math.round(tlen * 0.4), g.cy],
    ],
    BODY,
  );

  // 3. Dorsal fin-crest + a pectoral fin below.
  for (let i = 0; i < opts.crest; i++) drawCrest(base, g, i, sweep);
  fillPolygon(
    base,
    [
      [g.bodyCx, g.cy + g.bodyRy - 1],
      [g.bodyCx - Math.round(g.size * 0.12), g.cy + g.bodyRy + Math.round(g.size * 0.1)],
      [g.bodyCx + 2, g.cy + g.bodyRy],
    ],
    BODY,
  );

  // 4. Structural body-tone motif.
  opts.bodyMotif?.(base, g, rng);

  // 5. Cel shading lit from upper-left; rim-light the wet top edge.
  const bands = opts.size >= 24 ? 6 : 5;
  shade(base, { dir: 'upper-left', bands, lo: 4, hi: 12, dither: false });
  rimLight(base, 'upper-left');

  // 6. Current-ribbons stream off the tail (post-shade so they stay distinct).
  for (let j = 0; j < opts.ribbons; j++) {
    drawRibbon(
      base,
      g.tailX - tlen,
      g.cy + (j - (opts.ribbons - 1) / 2) * 2,
      Math.round(g.size * 0.4),
      rng,
    );
  }
  tideEye(base, g);
  opts.brightMotif?.(base, g, rng);

  // 7. Crisp 1px silhouette last.
  outline(base);

  // ---- Animation banks (a swimmer: dart, leap, zig-zag) ----
  const idle = [base.grid, bobFrame(base, -1).grid];
  const walk = [base.grid, shiftFrame(base, 1, -1).grid];
  const jump = [shiftFrame(base, 0, 1).grid, shiftFrame(base, 0, -2).grid];
  const dart = shiftFrame(base, 1, -1);
  sparkle(dart, g.noseX + 1, g.cy, GLINT);
  const play = [dart.grid, shiftFrame(base, -1, 1).grid];

  return { ...buildSprite(opts.id, idle, opts.fps ?? 4), walk, jump, play };
}

// ---------------------------------------------------------------------------
// Tide Runners line — crest grows 1→2→3, ribbons multiply, body lengthens.
// ---------------------------------------------------------------------------

// Sparkit (16) — spark-minnow: tiny, one crest spine, one ribbon.
export function buildSparkit(): SpriteDef {
  return tideRunner({ id: 'sprite-sparkit', size: 16, crest: 1, ribbons: 1, fps: 5 });
}

// Fluxling (20, steady) — smooth glider: one crest, two ribbons.
export function buildFluxling(): SpriteDef {
  return tideRunner({ id: 'sprite-fluxling', size: 20, crest: 1, ribbons: 2 });
}

// Voltby (20, bursty) — static-zipper: swept twin crest + a forked static spark (motif).
export function buildVoltby(): SpriteDef {
  return tideRunner({
    id: 'sprite-voltby',
    size: 20,
    crest: 2,
    sweep: 2,
    ribbons: 1,
    fps: 6,
    brightMotif: (c, g) => {
      // A forked static bolt off the tail.
      line(c, g.tailX - 2, g.cy, g.tailX - 5, g.cy - 3, GLINT);
      line(c, g.tailX - 5, g.cy - 3, g.tailX - 4, g.cy - 5, GLINT);
    },
  });
}

// Arcfin (24, endurance) — broad-finned cruiser: two crest, two ribbons, long fins.
export function buildArcfin(): SpriteDef {
  return tideRunner({ id: 'sprite-arcfin', size: 24, crest: 2, ribbons: 2 });
}

// Photonix (24, tempo) — blink-swift: triple swept crest + motion after-images (motif).
export function buildPhotonix(): SpriteDef {
  return tideRunner({
    id: 'sprite-photonix',
    size: 24,
    crest: 3,
    sweep: 3,
    ribbons: 1,
    fps: 6,
    brightMotif: (c, g) => {
      // After-image streaks behind the body.
      for (let i = 1; i <= 3; i++) c.set(g.tailX - i * 2, g.cy, i % 2 ? GLINT : LIGHT);
    },
  });
}

// Surgewing (24, breadth) — wide-finned: a fanned extra pectoral fin (motif), three ribbons.
export function buildSurgewing(): SpriteDef {
  return tideRunner({
    id: 'sprite-surgewing',
    size: 24,
    crest: 2,
    ribbons: 3,
    bodyMotif: (c, g) => {
      // Upper fanned wing-fin.
      fillPolygon(
        c,
        [
          [g.bodyCx, g.cy - g.bodyRy + 1],
          [g.bodyCx - Math.round(g.size * 0.14), g.cy - g.bodyRy - Math.round(g.size * 0.08)],
          [g.bodyCx + 3, g.cy - g.bodyRy + 1],
        ],
        BODY,
      );
    },
  });
}

// Stormlynx (28, high) — storm-hunter: sharp swept crest + a lightning glint along the spine.
export function buildStormlynx(): SpriteDef {
  return tideRunner({
    id: 'sprite-stormlynx',
    size: 28,
    crest: 3,
    sweep: 2,
    ribbons: 2,
    brightMotif: (c, g) => {
      for (let i = 0; i < 3; i++) c.set(g.bodyCx - 3 + i * 3, g.cy - 1 + (i % 2), GLINT);
    },
  });
}

// Luminaire (28, mid) — living lantern: a glowing radiant core (its motif).
export function buildLuminaire(): SpriteDef {
  return tideRunner({
    id: 'sprite-luminaire',
    size: 28,
    crest: 2,
    ribbons: 2,
    bodyMotif: (c, g) => fillEllipse(c, g.bodyCx, g.cy, 2, 2, LIGHT),
    brightMotif: (c, g) => {
      sparkle(c, g.bodyCx, g.cy, GLINT);
      strokeEllipse(c, g.bodyCx, g.cy, g.bodyRx + 2, g.bodyRy + 2, GLINT);
    },
  });
}

// Ionyx (28, low) — calm charged drifter: a wide stilling current-aura ring.
export function buildIonyx(): SpriteDef {
  return tideRunner({
    id: 'sprite-ionyx',
    size: 28,
    crest: 2,
    sweep: 1,
    ribbons: 3,
    brightMotif: (c, g) => strokeEllipse(c, g.bodyCx, g.cy, g.bodyRx + 3, g.bodyRy + 3, GLINT),
  });
}

// Voltaicore (32, early) — the storm-core apex: multi-crest, a clustered storm-core (motif).
export function buildVoltaicore(): SpriteDef {
  return tideRunner({
    id: 'sprite-voltaicore',
    size: 32,
    crest: 3,
    sweep: 1,
    ribbons: 3,
    bodyMotif: (c, g) => fillEllipse(c, g.bodyCx, g.cy, 3, 2, LIGHT),
    brightMotif: (c, g) => {
      sparkle(c, g.bodyCx, g.cy, GLINT);
      sparkle(c, g.bodyCx - 4, g.cy - 2, GLINT);
      sparkle(c, g.bodyCx + 4, g.cy + 1, GLINT);
    },
  });
}

// Radiantus (32, late) — radiant-crowned apex: a crown of crest spines + a halo of current.
export function buildRadiantus(): SpriteDef {
  return tideRunner({
    id: 'sprite-radiantus',
    size: 32,
    crest: 4,
    sweep: 2,
    ribbons: 4,
    brightMotif: (c, g) => {
      strokeEllipse(c, g.bodyCx, g.cy, g.bodyRx + 3, g.bodyRy + 3, GLINT);
      for (let i = 0; i < 3; i++) c.set(g.bodyCx - 4 + i * 4, g.cy - g.bodyRy - 1, RIM_HI);
    },
  });
}

export const fluxSprites: SpriteDef[] = [
  buildSparkit(),
  buildFluxling(),
  buildVoltby(),
  buildArcfin(),
  buildPhotonix(),
  buildSurgewing(),
  buildStormlynx(),
  buildLuminaire(),
  buildIonyx(),
  buildVoltaicore(),
  buildRadiantus(),
];
