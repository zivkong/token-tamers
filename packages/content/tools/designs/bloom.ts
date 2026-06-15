/**
 * Wild line sprite designs — THE BLOOM kingdom (plants / feral nature).
 *
 * Identity bible: docs/design/visuals-habitats-achievements.md §13 (Species identity
 * system) + the create-sprites skill. The Bloom are rooted, organic plant-beasts: a soft
 * BULB body with a gentle face, a BLOOM-CROWN of petals/leaves on top that opens wider
 * with stage (the signature), a base of ROOT-TENDRILS, and drifting POLLEN glints. This
 * is the feral house of unmapped genes — neutral/balanced stats. House tint = green;
 * grade resolves richness.
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

// Flat-tone vocabulary shared by every Bloom creature.
const SHADOW = 3;
const BODY = 7;
const LIGHT = 11;

/** Geometry of a rooted Bloom body, derived once from the stage size. */
interface BloomGeom {
  size: number;
  cx: number;
  groundY: number;
  bodyCy: number;
  bodyRx: number;
  bodyRy: number;
  crownY: number;
}

interface BloomOpts {
  id: string;
  size: number;
  /** Bloom-crown petals (lineage cue: opens wider with stage). */
  petals: number;
  /** Root-tendril strands at the base. */
  roots: number;
  /** Crown style: a soft flower, sharp thorns, or a mushroom cap. */
  crown?: 'flower' | 'thorns' | 'cap';
  fps?: number;
  /** Body-tone marks, drawn BEFORE shade (so they cel-shade; structural). */
  bodyMotif?: (c: PixelCanvas, g: BloomGeom, rng: Lcg) => void;
  /** Bright marks (pollen/glints), drawn AFTER shade + rimLight, BEFORE outline. */
  brightMotif?: (c: PixelCanvas, g: BloomGeom, rng: Lcg) => void;
}

function bloomGeom(size: number): BloomGeom {
  const cx = (size - 1) / 2;
  const bodyRx = Math.max(3, Math.round(size * 0.26));
  const bodyRy = Math.max(3, Math.round(size * 0.24));
  const bodyCy = Math.round(size * 0.56);
  return { size, cx, groundY: size - 1, bodyCy, bodyRx, bodyRy, crownY: bodyCy - bodyRy };
}

/** A wavy root tendril descending to the ground line. */
function drawRoot(c: PixelCanvas, x0: number, y0: number, toY: number, rng: Lcg): void {
  let x = x0;
  for (let y = y0; y <= toY; y++) {
    c.set(x, y, y >= toY - 1 ? SHADOW : BODY);
    if (rng.chance(0.5)) x += rng.int(3) - 1;
  }
}

/** The bloom-crown: a ring of petals (or thorns, or a mushroom cap) at the top. */
function drawCrown(c: PixelCanvas, g: BloomGeom, petals: number, style: string): void {
  if (style === 'cap') {
    fillEllipse(
      c,
      Math.round(g.cx),
      g.crownY,
      Math.round(g.bodyRx * 1.15),
      Math.round(g.bodyRy * 0.7),
      BODY,
    );
    fillEllipse(c, Math.round(g.cx - 1), g.crownY - 1, Math.round(g.bodyRx * 0.5), 1, LIGHT);
    return;
  }
  const cxp = Math.round(g.cx);
  const cyp = g.crownY;
  const pr = Math.round(g.size * 0.15);
  const petalR = Math.max(1, Math.round(g.size * 0.06));
  for (let i = 0; i < petals; i++) {
    const t = petals === 1 ? 0.5 : i / (petals - 1);
    const ang = -Math.PI * 0.86 + t * (Math.PI * 0.72);
    const px = Math.round(cxp + Math.cos(ang) * pr);
    const py = Math.round(cyp + Math.sin(ang) * pr);
    if (style === 'thorns') {
      // A sharp thorn spike from the crown.
      const tx = Math.round(cxp + Math.cos(ang) * pr * 1.5);
      const ty = Math.round(cyp + Math.sin(ang) * pr * 1.5);
      fillPolygon(
        c,
        [
          [cxp, cyp],
          [px, py + 1],
          [tx, ty],
        ],
        BODY,
      );
    } else {
      line(c, cxp, cyp, px, py, BODY);
      fillEllipse(c, px, py, petalR, petalR, BODY);
    }
  }
  // Bloom center.
  fillEllipse(c, cxp, cyp, Math.max(1, petalR - 1), Math.max(1, petalR - 1), LIGHT);
}

/** Two gentle eyes on the bulb face. */
function bloomEyes(c: PixelCanvas, g: BloomGeom): void {
  const ey = g.bodyCy - Math.round(g.size * 0.02);
  for (const s of [-1, 1]) {
    const x = Math.round(g.cx + s * Math.round(g.size * 0.1));
    c.set(x, ey, OUTLINE);
    c.set(x, ey - 1, RIM_HI);
  }
}

/** The shared Bloom builder: one parametric plant-beast + its four banks. */
function bloomCreature(opts: BloomOpts): SpriteDef {
  const g = bloomGeom(opts.size);
  const rng = lcg(hashStr(opts.id));
  const base = PixelCanvas.create(opts.size, opts.size);

  // 1. Root-tendrils fan from the base to the ground.
  const baseY = g.bodyCy + g.bodyRy - 1;
  for (let j = 0; j < opts.roots; j++) {
    const t = opts.roots === 1 ? 0.5 : j / (opts.roots - 1);
    const x0 = Math.round(g.cx + (t - 0.5) * g.bodyRx * 1.5);
    drawRoot(base, x0, baseY, g.groundY, rng);
  }

  // 2. Soft bulb body.
  fillEllipse(base, g.cx, g.bodyCy, g.bodyRx, g.bodyRy, BODY);

  // 3. Bloom-crown on top.
  drawCrown(base, g, opts.petals, opts.crown ?? 'flower');

  // 4. Structural body-tone motif.
  opts.bodyMotif?.(base, g, rng);

  // 5. Cel shading lit from upper-left; rim-light the leafy top edge.
  const bands = opts.size >= 24 ? 6 : 5;
  shade(base, { dir: 'upper-left', bands, lo: 4, hi: 12, dither: false });
  rimLight(base, 'upper-left');

  // 6. Gentle face + drifting pollen + bright motif (post-shade so they stay crisp).
  bloomEyes(base, g);
  opts.brightMotif?.(base, g, rng);

  // 7. Crisp 1px silhouette last.
  outline(base);

  // ---- Animation banks (a rooted plant: wind-sway, hop, lean) ----
  const idle = [base.grid, bobFrame(base, -1).grid];
  const walk = [base.grid, shiftFrame(base, 1, 0).grid];
  const jump = [shiftFrame(base, 0, 1).grid, shiftFrame(base, 0, -2).grid];
  const lean = shiftFrame(base, 1, -1);
  sparkle(lean, Math.round(g.cx + g.bodyRx + 1), g.crownY, GLINT);
  const play = [lean.grid, shiftFrame(base, -1, 0).grid];

  return { ...buildSprite(opts.id, idle, opts.fps ?? 4), walk, jump, play };
}

// ---------------------------------------------------------------------------
// The Bloom line — crown opens 1→2→3→5 petals, roots deepen, body grows.
// ---------------------------------------------------------------------------

// Sprout (16) — seedling: a single closed bud, one root, tiny face.
export function buildSprout(): SpriteDef {
  return bloomCreature({ id: 'sprite-sprout', size: 16, petals: 1, roots: 1 });
}

// Mosskit (20, steady) — mossy cub: two soft petals, two roots, mossy speckle.
export function buildMosskit(): SpriteDef {
  return bloomCreature({
    id: 'sprite-mosskit',
    size: 20,
    petals: 2,
    roots: 2,
    brightMotif: (c, g, rng) => {
      for (let i = 0; i < 4; i++) {
        const x = Math.round(g.cx + (rng.int(g.bodyRx * 2) - g.bodyRx));
        const y = g.bodyCy + rng.int(g.bodyRy);
        if (c.get(x, y) > 0) c.set(x, y, LIGHT);
      }
    },
  });
}

// Thornkit (20, bursty) — prickly sprout: a crown of sharp thorns.
export function buildThornkit(): SpriteDef {
  return bloomCreature({
    id: 'sprite-thornkit',
    size: 20,
    petals: 3,
    roots: 2,
    crown: 'thorns',
    fps: 5,
  });
}

// Bramblox (24, endurance) — bramble-knot: thick tangled roots + bramble texture (motif).
export function buildBramblox(): SpriteDef {
  return bloomCreature({
    id: 'sprite-bramblox',
    size: 24,
    petals: 3,
    roots: 4,
    bodyMotif: (c, g) => {
      // Tangled bramble strokes across the bulb.
      for (let i = 0; i < 3; i++) {
        const y = g.bodyCy - 2 + i * 2;
        line(c, Math.round(g.cx - g.bodyRx + 1), y, Math.round(g.cx + g.bodyRx - 1), y + 1, SHADOW);
      }
    },
  });
}

// Pollenix (24, tempo) — pollen-drifter: scattered drifting pollen-glints (motif).
export function buildPollenix(): SpriteDef {
  return bloomCreature({
    id: 'sprite-pollenix',
    size: 24,
    petals: 3,
    roots: 2,
    fps: 5,
    brightMotif: (c, g) => {
      sparkle(c, Math.round(g.cx - g.bodyRx - 2), g.crownY, GLINT);
      sparkle(c, Math.round(g.cx + g.bodyRx + 2), g.crownY + 2, GLINT);
      sparkle(c, Math.round(g.cx), g.crownY - Math.round(g.size * 0.22), GLINT);
    },
  });
}

// Sporecap (24, breadth) — walking mushroom: a wide cap + spore-glints beneath (motif).
export function buildSporecap(): SpriteDef {
  return bloomCreature({
    id: 'sprite-sporecap',
    size: 24,
    petals: 0,
    roots: 2,
    crown: 'cap',
    brightMotif: (c, g) => {
      for (let i = 0; i < 3; i++) {
        c.set(Math.round(g.cx - g.bodyRx + 2 + i * g.bodyRx), g.crownY + 2, GLINT);
      }
    },
  });
}

// Verdantyr (28, high) — perpetual bloom: a full open flower crown + side vines.
export function buildVerdantyr(): SpriteDef {
  return bloomCreature({
    id: 'sprite-verdantyr',
    size: 28,
    petals: 5,
    roots: 3,
    bodyMotif: (c, g) => {
      for (const s of [-1, 1]) {
        line(
          c,
          Math.round(g.cx + s * g.bodyRx),
          g.bodyCy,
          Math.round(g.cx + s * (g.bodyRx + 3)),
          g.bodyCy - 3,
          BODY,
        );
      }
    },
  });
}

// Bloomwarden (28, mid) — grove-guardian: petals fan into a protective shield-ring (motif).
export function buildBloomwarden(): SpriteDef {
  return bloomCreature({
    id: 'sprite-bloomwarden',
    size: 28,
    petals: 5,
    roots: 3,
    brightMotif: (c, g) => {
      // A ring of leaf-tips around the bulb (the shield).
      const r = g.bodyRx + 2;
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        c.set(
          Math.round(g.cx + Math.cos(ang) * r),
          Math.round(g.bodyCy + Math.sin(ang) * r * 0.8),
          GLINT,
        );
      }
    },
  });
}

// Gnarloak (28, low) — gnarled sapling: woody asymmetric branches + deep roots (motif).
export function buildGnarloak(): SpriteDef {
  return bloomCreature({
    id: 'sprite-gnarloak',
    size: 28,
    petals: 3,
    roots: 4,
    bodyMotif: (c, g) => {
      // Asymmetric woody branch reaching up-left.
      line(
        c,
        Math.round(g.cx - 2),
        g.crownY + 2,
        Math.round(g.cx - g.bodyRx - 2),
        g.crownY - 4,
        BODY,
      );
      line(
        c,
        Math.round(g.cx - g.bodyRx - 2),
        g.crownY - 4,
        Math.round(g.cx - g.bodyRx - 4),
        g.crownY - 6,
        BODY,
      );
    },
  });
}

// Sylvaroot (32, early) — radiant grove-spirit: a lush flowering crown + flowering vines.
export function buildSylvaroot(): SpriteDef {
  return bloomCreature({
    id: 'sprite-sylvaroot',
    size: 32,
    petals: 6,
    roots: 4,
    bodyMotif: (c, g) => {
      for (const s of [-1, 1]) {
        line(
          c,
          Math.round(g.cx + s * g.bodyRx),
          g.bodyCy + 1,
          Math.round(g.cx + s * (g.bodyRx + 4)),
          g.bodyCy - 4,
          BODY,
        );
      }
    },
    brightMotif: (c, g, rng) => {
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI - Math.PI;
        const r = g.bodyRx + 3 + rng.int(2);
        c.set(
          Math.round(g.cx + Math.cos(ang) * r),
          Math.round(g.crownY + Math.sin(ang) * r),
          GLINT,
        );
      }
    },
  });
}

// Eldergrove (32, late) — ancient root-titan: a dense canopy crown + a deep root mass.
export function buildEldergrove(): SpriteDef {
  return bloomCreature({
    id: 'sprite-eldergrove',
    size: 32,
    petals: 5,
    roots: 5,
    crown: 'cap',
    bodyMotif: (c, g) => {
      // A second, broader canopy layer.
      fillEllipse(c, Math.round(g.cx), g.crownY - 3, Math.round(g.bodyRx * 0.9), 2, BODY);
      // Trunk rings.
      for (let i = 0; i < 2; i++) {
        const y = g.bodyCy + i * 3;
        line(c, Math.round(g.cx - g.bodyRx + 1), y, Math.round(g.cx + g.bodyRx - 1), y, SHADOW);
      }
    },
    brightMotif: (c, g) => {
      for (let i = 0; i < 4; i++)
        c.set(Math.round(g.cx - g.bodyRx + 2 + i * g.bodyRx * 0.7), g.crownY - 1, GLINT);
    },
  });
}

export const bloomSprites: SpriteDef[] = [
  buildSprout(),
  buildMosskit(),
  buildThornkit(),
  buildBramblox(),
  buildPollenix(),
  buildSporecap(),
  buildVerdantyr(),
  buildBloomwarden(),
  buildGnarloak(),
  buildSylvaroot(),
  buildEldergrove(),
];
