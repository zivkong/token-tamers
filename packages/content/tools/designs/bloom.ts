/**
 * Wild line sprite designs — THE BLOOM kingdom (plants / feral nature).
 *
 * Identity bible: docs/design/visuals-habitats-achievements.md §13 (Species identity
 * system) + the create-sprites skill. The Bloom are feral flower-creatures: a soft
 * round BODY, an asymmetric BLOOM-CROWN of petals on top (the signature, opening wider
 * and grander with stage), ROOT-TENDRIL limbs, and a glowing FLOWER CORE on the chest.
 * This is the neutral house of unmapped genes — balanced stats; House tint = verdant
 * green; the per-species ACCENT (signature hot-pink #ff4fa3 on the line's crown/core)
 * and the GRADE beauty ladder resolve at render time.
 *
 * OCTANT ART DIRECTION v2 ("cute -> majestic"):
 *  - CUTE babies, MAJESTIC apex. The sprite/rookie have a head ~= body, huge sparkly
 *    catch-lit eyes (~half the head), blush, stubby root nubs. Each later stage shrinks
 *    the eye-to-head ratio and grows the silhouette toward a tall bloom-titan (head ~1:3
 *    of a commanding body) with a full crown + root-tendril limbs + a radiant core.
 *  - DISTINCT lower silhouettes (sprout/mosskit/thornkit each a different body-plan to
 *    kill "too similar"), CONVERGING to the shared Bloom archetype at prime/apex.
 *  - ROUNDED-but-DETAILED: soft toyable forms, thickened tendrils/petals, no spindly bits.
 *  - HOUSE green DOMINATES (~70-85% of colored pixels); ONE signature accent per species
 *    (ACCENT_LO/MID/HI = 16/17/18) on a signature feature; optional cream BELLY (20).
 *
 * Size law (OCTANT, 2026): egg 16 · sprite 20 · rookie 24 · evolved 28 · prime 32 · apex 36
 * (square; even; height divisible by 4). Every species ships idle + walk + jump + play
 * banks (same dims) via framesFromDeltas. Determinism: seeded LCG (hashStr(id)) only —
 * never Math.random / Date.now.
 *
 * NOTE: the shared neutral egg `sprite-mote` is authored HERE (the Bloom is the neutral
 * home of unmapped genes); it must be removed from any other house module so the id is
 * unique in the assembled pack.
 */

import type { SpriteDef } from '@token-tamers/core';
import {
  PixelCanvas,
  buildSprite,
  fillEllipse,
  smallEllipse,
  fillCircle,
  fillPolygon,
  line,
  thickLine,
  bezier,
  mirrorX,
  shade,
  rimLight,
  outline,
  sparkle,
  scatter,
  framesFromDeltas,
  lcg,
  hashStr,
  type Lcg,
  OUTLINE,
  RIM_HI,
  GLINT,
  ACCENT_LO,
  ACCENT_MID,
  ACCENT_HI,
  BELLY,
} from '../sprite-lib';

// Flat-tone vocabulary shared by every Bloom creature (house-green ramp).
const SHADOW = 4;
const BODY = 7;
const LIGHT = 11;

// ---------------------------------------------------------------------------
// Geometry — derived once per species from its stage size and a "maturity" t.
// t=0 is the cutest baby (sprout), t=1 is the grandest titan (apex). It drives
// the head:body ratio, the eye size, the crown spread and the silhouette height.
// ---------------------------------------------------------------------------

interface BloomGeom {
  size: number;
  cx: number;
  groundY: number;
  /** Maturity 0..1 (cute -> majestic). */
  t: number;
  /** Body (torso) mass. */
  bodyCy: number;
  bodyRx: number;
  bodyRy: number;
  /** Head mass (sits atop the body; baby = huge, apex = small). */
  headCy: number;
  headRx: number;
  headRy: number;
  /** Eye radius and spacing (shrinks with maturity). */
  eyeR: number;
  eyeY: number;
  eyeDx: number;
  /** Crown anchor (top of head) + spread radius. */
  crownY: number;
  crownR: number;
  /** Flower-core position on the chest. */
  coreY: number;
}

/** Crown silhouette flavor — distinct lower forms; primes/apex use 'flower'. */
type CrownStyle = 'bud' | 'leaf' | 'thorn' | 'cap' | 'flower' | 'canopy';
/** Body silhouette flavor — varied for the lower stages, converging up. */
type BodyPlan = 'round' | 'tall' | 'sprig' | 'titan';

interface BloomParams {
  id: string;
  size: number;
  /** Maturity 0..1 — cute babies low, majestic apex high. */
  t: number;
  plan: BodyPlan;
  crown: CrownStyle;
  /** Petal / thorn / leaf count in the crown. */
  motifs: number;
  /** Root-tendril limbs at the base. */
  roots: number;
  /** Per-species signature accent (the hot-pink-family decal feature). */
  accentFeature: 'crown' | 'core' | 'petals' | 'spots' | 'gem' | 'glow';
  /** Cream belly patch. */
  belly?: boolean;
  /** Eye style for the face. */
  eye?: 'sparkle' | 'round' | 'calm' | 'fierce';
  /** Show the glowing flower core on the chest. */
  core?: boolean;
  fps?: number;
}

function bloomGeom(p: BloomParams): BloomGeom {
  const { size, t } = p;
  const cx = (size - 1) / 2;
  const groundY = size - 1;

  // Cute babies: big head, small low body. Majestic: small head, tall body.
  const headFrac = 0.34 - 0.14 * t; // head radius as fraction of size
  const bodyFrac = 0.2 + 0.12 * t; // body radius as fraction of size
  const headRx = Math.max(3, Math.round(size * headFrac));
  const headRy = Math.max(3, Math.round(size * headFrac * (p.plan === 'tall' ? 0.94 : 1.02)));
  const bodyRx = Math.max(3, Math.round(size * bodyFrac));
  const bodyRy = Math.max(3, Math.round(size * (bodyFrac + 0.02 + 0.06 * t)));

  // Vertical stack: a baby is mostly head near the middle; a titan is a tall
  // body with a small head riding high.
  const headCy = Math.round(size * (0.34 - 0.06 * t) + headRy * 0.1);
  const bodyCy = Math.round(headCy + headRy * 0.75 + bodyRy * 0.55);

  // Eyes shrink as it matures (eye ~50% of head when cute -> ~22% at apex).
  const eyeFrac = 0.5 - 0.28 * t;
  const eyeR = Math.max(1, Math.round(headRx * eyeFrac * 0.6));
  const eyeY = headCy + Math.round(headRy * (0.05 + 0.08 * t));
  const eyeDx = Math.max(2, Math.round(headRx * (0.42 + 0.06 * t)));

  const crownY = headCy - headRy;
  const crownR = Math.round(size * (0.12 + 0.16 * t));
  const coreY = Math.round(bodyCy - bodyRy * 0.1);

  return {
    size,
    cx,
    groundY,
    t,
    bodyCy,
    bodyRx,
    bodyRy,
    headCy,
    headRx,
    headRy,
    eyeR,
    eyeY,
    eyeDx,
    crownY,
    crownR,
    coreY,
  };
}

// ---------------------------------------------------------------------------
// Body plans — the silhouette mass (drawn on the LEFT half, then mirrored).
// ---------------------------------------------------------------------------

function drawBody(c: PixelCanvas, g: BloomGeom, plan: BodyPlan): void {
  // Head (always present, the face).
  fillEllipse(c, g.cx, g.headCy, g.headRx, g.headRy, BODY);

  switch (plan) {
    case 'round': {
      // Tiny dumpling: head and a small round tummy almost fused (cutest).
      fillEllipse(c, g.cx, g.bodyCy, g.bodyRx, g.bodyRy, BODY);
      // Soft neck fill so head+body read as one plush blob.
      fillEllipse(c, g.cx, (g.headCy + g.bodyCy) / 2, g.bodyRx - 1, 2, BODY);
      break;
    }
    case 'sprig': {
      // A leggy seedling: small body on a slim stem (distinct silhouette).
      fillEllipse(c, g.cx, g.bodyCy, g.bodyRx, Math.round(g.bodyRy * 0.8), BODY);
      thickLine(c, g.cx, g.bodyCy, g.cx, g.groundY - 2, BODY, 3);
      break;
    }
    case 'tall': {
      // An upright torso (rookie/evolved). Pear-shaped, broader at the base.
      fillEllipse(c, g.cx, g.bodyCy, g.bodyRx, g.bodyRy, BODY);
      fillEllipse(c, g.cx, g.bodyCy + Math.round(g.bodyRy * 0.5), g.bodyRx + 1, 3, BODY);
      // Connect head to body.
      fillEllipse(c, g.cx, (g.headCy + g.bodyCy) / 2, g.bodyRx - 1, 2, BODY);
      break;
    }
    case 'titan': {
      // The grand archetype: a towering trunk-body, broad shoulders, small head.
      fillEllipse(c, g.cx, g.bodyCy, g.bodyRx + 1, g.bodyRy, BODY);
      // Shoulders.
      fillEllipse(c, g.cx, g.headCy + g.headRy, g.bodyRx + 2, Math.round(g.bodyRy * 0.45), BODY);
      // Trunk taper toward the roots.
      fillPolygon(
        c,
        [
          [g.cx - g.bodyRx, g.bodyCy],
          [g.cx + g.bodyRx, g.bodyCy],
          [g.cx + Math.round(g.bodyRx * 0.7), g.groundY - 2],
          [g.cx - Math.round(g.bodyRx * 0.7), g.groundY - 2],
        ],
        BODY,
      );
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Root-tendril limbs — thick, rounded (never spindly). Drawn full-width.
// ---------------------------------------------------------------------------

function drawRoots(c: PixelCanvas, g: BloomGeom, count: number, rng: Lcg): void {
  const baseY = g.bodyCy + g.bodyRy - 1;
  const reach = Math.round(g.size * (0.1 + 0.06 * g.t));
  for (let j = 0; j < count; j++) {
    const t = count === 1 ? 0.5 : j / (count - 1);
    const spread = (t - 0.5) * (g.bodyRx * 2 + 2);
    const x0 = Math.round(g.cx + spread);
    const footX = Math.round(x0 + (t < 0.5 ? -reach : reach) * (0.4 + rng.next() * 0.6));
    const footY = g.groundY - rng.int(2);
    // A thick rounded tendril sweeping out to a rounded foot-bulb.
    bezier(c, g.cx, baseY - 1, x0, baseY + 2, footX, footY, BODY, 4, 3);
    fillCircle(c, footX, footY, 2, BODY);
  }
}

// ---------------------------------------------------------------------------
// Bloom-crown — the signature. Distinct shapes low, full flower up. Asymmetric
// (drawn AFTER mirror so it can lean — the Bloom is never perfectly symmetric).
// Petals are rounded and thick; thorns/leaves are stubby and soft-cornered.
// ---------------------------------------------------------------------------

function drawCrown(c: PixelCanvas, g: BloomGeom, style: CrownStyle, motifs: number): void {
  const cxp = Math.round(g.cx);
  const cyp = g.crownY;
  const r = g.crownR;
  const petalR = Math.max(2, Math.round(g.size * 0.07));

  if (style === 'bud') {
    // A single closed teardrop bud (cutest baby crown).
    fillEllipse(c, cxp, cyp - 1, petalR, petalR + 1, BODY);
    fillPolygon(
      c,
      [
        [cxp, cyp - petalR - 2],
        [cxp - petalR, cyp],
        [cxp + petalR, cyp],
      ],
      BODY,
    );
    return;
  }
  if (style === 'cap') {
    // A wide soft mushroom cap.
    fillEllipse(c, cxp, cyp, Math.round(r * 1.2), Math.round(r * 0.62), BODY);
    fillEllipse(c, cxp, cyp + 1, Math.round(r * 1.2), 2, BODY);
    return;
  }
  if (style === 'canopy') {
    // A layered tree canopy (apex eldergrove): stacked rounded leaf masses.
    fillEllipse(c, cxp, cyp + 1, Math.round(r * 1.25), Math.round(r * 0.7), BODY);
    fillEllipse(
      c,
      cxp - Math.round(r * 0.6),
      cyp - 1,
      Math.round(r * 0.7),
      Math.round(r * 0.6),
      BODY,
    );
    fillEllipse(
      c,
      cxp + Math.round(r * 0.6),
      cyp - 1,
      Math.round(r * 0.7),
      Math.round(r * 0.6),
      BODY,
    );
    fillEllipse(c, cxp, cyp - Math.round(r * 0.6), Math.round(r * 0.8), Math.round(r * 0.6), BODY);
    return;
  }

  // Radial crowns: flower petals / soft thorns / leaf-fan, leaning slightly.
  const lean = 0.18; // asymmetric tilt
  const arc = style === 'leaf' ? Math.PI * 0.9 : Math.PI * 1.55;
  const start = -Math.PI / 2 - arc / 2 + lean;
  for (let i = 0; i < motifs; i++) {
    const tt = motifs === 1 ? 0.5 : i / (motifs - 1);
    const ang = start + tt * arc;
    const px = Math.round(cxp + Math.cos(ang) * r);
    const py = Math.round(cyp + Math.sin(ang) * r);
    if (style === 'thorn') {
      // Stubby SOFT thorn (rounded base, short point) — toyable, not spiky.
      const tipx = Math.round(cxp + Math.cos(ang) * r * 1.4);
      const tipy = Math.round(cyp + Math.sin(ang) * r * 1.4);
      thickLine(c, cxp, cyp, px, py, BODY, 3);
      fillPolygon(
        c,
        [
          [px - 1, py + 1],
          [px + 1, py + 1],
          [tipx, tipy],
        ],
        BODY,
      );
      fillCircle(c, px, py, 1, BODY);
    } else if (style === 'leaf') {
      // Rounded leaf paddle.
      thickLine(c, cxp, cyp, px, py, BODY, 2);
      fillEllipse(c, px, py, petalR, Math.max(2, petalR - 1), BODY);
    } else {
      // Rounded flower petal.
      thickLine(c, cxp, cyp, px, py, BODY, 2);
      fillCircle(c, px, py, petalR, BODY);
    }
  }
  // Bloom hub.
  fillCircle(c, cxp, cyp, Math.max(1, petalR - 1), LIGHT);
}

// ---------------------------------------------------------------------------
// Accent decals — ONE signature accent per species (~10-20%), painted AFTER
// shade so it survives. Uses ACCENT_LO/MID/HI (the hot-pink family at render).
// ---------------------------------------------------------------------------

/** Paint a small rounded accent blob (mid fill + bright center) on filled px only. */
function tintBlob(c: PixelCanvas, x: number, y: number, r: number, mid: number, hi: number): void {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      if (c.get(x + dx, y + dy) > 0) c.set(x + dx, y + dy, mid);
    }
  }
  c.set(x, y, hi);
}

function paintAccent(c: PixelCanvas, g: BloomGeom, p: BloomParams, rng: Lcg): void {
  const cxp = Math.round(g.cx);
  switch (p.accentFeature) {
    case 'crown': {
      // The whole crown blooms in the accent: petal blobs tinted + bright tips.
      const r = g.crownR;
      const tips = Math.max(4, p.motifs);
      const petalR = Math.max(2, Math.round(g.size * 0.07));
      for (let i = 0; i < tips; i++) {
        const ang = -Math.PI / 2 - Math.PI * 0.72 + (i / (tips - 1)) * Math.PI * 1.44;
        const px = Math.round(cxp + Math.cos(ang) * r);
        const py = Math.round(g.crownY + Math.sin(ang) * r);
        if (c.get(px, py) > 0) {
          tintBlob(c, px, py, petalR, ACCENT_MID, ACCENT_HI);
        }
      }
      // Accent hub.
      fillCircle(c, cxp, g.crownY, Math.max(1, petalR - 1), ACCENT_HI);
      break;
    }
    case 'core': {
      // A big glowing flower-core gem on the chest + an accent petal ring above.
      const cr = Math.max(3, Math.round(g.size * 0.11));
      fillCircle(c, cxp, g.coreY, cr, ACCENT_MID);
      fillCircle(c, cxp, g.coreY, Math.max(1, cr - 2), ACCENT_HI);
      c.set(cxp - 1, g.coreY - 1, ACCENT_LO);
      c.set(cxp + 1, g.coreY + 1, ACCENT_LO);
      // Petal-tip accents on the crown so the line's accent reads up top too.
      for (const s of [-1, 1]) {
        const px = Math.round(cxp + s * g.crownR);
        if (c.get(px, g.crownY) > 0) tintBlob(c, px, g.crownY, 2, ACCENT_MID, ACCENT_HI);
      }
      break;
    }
    case 'petals': {
      // A full accent flower-crown: a broad tinted hub + accent petal tips.
      fillCircle(c, cxp, g.crownY, Math.max(3, Math.round(g.crownR * 0.7)), ACCENT_MID);
      fillCircle(c, cxp, g.crownY, Math.max(1, Math.round(g.crownR * 0.42)), ACCENT_HI);
      const tips = Math.max(5, p.motifs);
      for (let i = 0; i < tips; i++) {
        const ang = -Math.PI / 2 - Math.PI * 0.7 + (i / (tips - 1)) * Math.PI * 1.4;
        const px = Math.round(cxp + Math.cos(ang) * g.crownR);
        const py = Math.round(g.crownY + Math.sin(ang) * g.crownR);
        if (c.get(px, py) > 0) tintBlob(c, px, py, 2, ACCENT_MID, ACCENT_HI);
      }
      break;
    }
    case 'spots': {
      // Bioluminescent accent freckles + a small accent core, across body/cap.
      scatter(c, rng, Math.round(g.size * 1.2), ACCENT_MID, {
        x0: cxp - g.bodyRx,
        y0: g.crownY,
        x1: cxp + g.bodyRx,
        y1: g.bodyCy + Math.round(g.bodyRy * 0.3),
      });
      scatter(c, rng, Math.round(g.size * 0.5), ACCENT_HI, {
        x0: cxp - g.bodyRx,
        y0: g.crownY,
        x1: cxp + g.bodyRx,
        y1: g.bodyCy,
      });
      fillCircle(c, cxp, g.coreY, 2, ACCENT_MID);
      c.set(cxp, g.coreY, ACCENT_HI);
      break;
    }
    case 'gem': {
      // A bold faceted accent gem on the brow + a glowing accent vein + core.
      const gy = g.headCy - Math.round(g.headRy * 0.35);
      const gr = Math.max(2, Math.round(g.size * 0.06));
      fillPolygon(
        c,
        [
          [cxp, gy - gr],
          [cxp - gr, gy],
          [cxp, gy + gr],
          [cxp + gr, gy],
        ],
        ACCENT_MID,
      );
      fillCircle(c, cxp, gy, 1, ACCENT_HI);
      c.set(cxp - 1, gy + 1, ACCENT_LO);
      // Accent vein + core gem on the chest.
      thickLine(
        c,
        cxp,
        g.coreY - Math.round(g.bodyRy * 0.3),
        cxp,
        g.coreY + Math.round(g.bodyRy * 0.5),
        ACCENT_LO,
        2,
      );
      fillCircle(c, cxp, g.coreY, Math.max(2, Math.round(g.size * 0.06)), ACCENT_MID);
      fillCircle(c, cxp, g.coreY, 1, ACCENT_HI);
      break;
    }
    case 'glow': {
      // Apex: a radiant accent aura — a large core gem + a broad crown hub.
      const cr = Math.max(3, Math.round(g.size * 0.1));
      fillCircle(c, cxp, g.coreY, cr, ACCENT_MID);
      fillCircle(c, cxp, g.coreY, Math.max(1, cr - 2), ACCENT_HI);
      c.set(cxp - 1, g.coreY - 1, ACCENT_LO);
      fillCircle(c, cxp, g.crownY, Math.max(3, Math.round(g.crownR * 0.55)), ACCENT_MID);
      fillCircle(c, cxp, g.crownY, Math.max(1, Math.round(g.crownR * 0.3)), ACCENT_HI);
      // Accent petal tips fanning the grand crown.
      const tips = 7;
      for (let i = 0; i < tips; i++) {
        const ang = -Math.PI / 2 - Math.PI * 0.7 + (i / (tips - 1)) * Math.PI * 1.4;
        const px = Math.round(cxp + Math.cos(ang) * g.crownR);
        const py = Math.round(g.crownY + Math.sin(ang) * g.crownR);
        if (c.get(px, py) > 0) tintBlob(c, px, py, 2, ACCENT_MID, ACCENT_HI);
      }
      break;
    }
  }
}

/** Cream belly patch (index 20), painted after shade, before rim/eyes. */
function paintBelly(c: PixelCanvas, g: BloomGeom): void {
  const by = g.bodyCy + Math.round(g.bodyRy * 0.2);
  for (let dy = -Math.round(g.bodyRy * 0.4); dy <= Math.round(g.bodyRy * 0.7); dy++) {
    const w = Math.round(g.bodyRx * 0.6 * (1 - Math.abs(dy) / (g.bodyRy + 2)));
    for (let dx = -w; dx <= w; dx++) {
      const x = Math.round(g.cx + dx);
      const y = by + dy;
      if (c.get(x, y) > 0 && c.get(x, y) < ACCENT_LO) c.set(x, y, BELLY);
    }
  }
}

// ---------------------------------------------------------------------------
// Face — big sparkly catch-lit eyes (cute) shrinking to commanding eyes (apex),
// plus a blush on the babies.
// ---------------------------------------------------------------------------

function drawFace(c: PixelCanvas, g: BloomGeom, p: BloomParams): void {
  const style = p.eye ?? 'round';
  for (const s of [-1, 1]) {
    const ex = Math.round(g.cx + s * g.eyeDx);
    const ey = g.eyeY;
    if (style === 'sparkle') {
      // Big round eye with a bold catch-light (adorable).
      smallEllipse(c, ex, ey, g.eyeR + 1, g.eyeR + 1, OUTLINE);
      c.set(ex - s, ey - 1, RIM_HI); // big catch-light
      c.set(ex + s, ey + 1, RIM_HI); // secondary sparkle
    } else if (style === 'fierce') {
      // A narrowed commanding eye (small, sharp top lid) for the titans.
      smallEllipse(c, ex, ey, g.eyeR, Math.max(1, g.eyeR - 1), OUTLINE);
      line(c, ex - g.eyeR, ey - 1, ex + g.eyeR, ey - 2, OUTLINE); // stern brow
      c.set(ex - s, ey - 1, RIM_HI);
    } else if (style === 'calm') {
      smallEllipse(c, ex, ey, g.eyeR, g.eyeR, OUTLINE);
      c.set(ex - s, ey - 1, RIM_HI);
    } else {
      // round (default expressive)
      smallEllipse(c, ex, ey, g.eyeR, g.eyeR, OUTLINE);
      c.set(ex - s, ey - 1, RIM_HI);
    }
  }
  // Blush on the cute babies (t small) — soft accent cheeks.
  if (g.t < 0.34) {
    for (const s of [-1, 1]) {
      const bx = Math.round(g.cx + s * (g.eyeDx + g.eyeR + 1));
      c.set(bx, g.eyeY + 1, ACCENT_LO);
      c.set(bx, g.eyeY + 2, ACCENT_LO);
    }
  }
}

// ---------------------------------------------------------------------------
// The shared Bloom builder: one parametric plant-beast + its four banks.
// ---------------------------------------------------------------------------

function bloomCreature(p: BloomParams): SpriteDef {
  const g = bloomGeom(p);
  const rng = lcg(hashStr(p.id));
  const base = PixelCanvas.create(p.size, p.size);

  // 1. Body mass + roots on the LEFT half, then mirror for a soft symmetric base.
  drawBody(base, g, p.plan);
  drawRoots(base, g, p.roots, lcg(hashStr(p.id + 'roots')));
  mirrorX(base);

  // 2. Crown LAST among shapes (asymmetric — drawn after mirror so it can lean).
  drawCrown(base, g, p.crown, p.motifs);

  // 3. Cel shading lit from upper-left (protect accent/belly indices: onlyBelow 14).
  const bands = p.size >= 28 ? 6 : 5;
  shade(base, { dir: 'upper-left', bands, lo: SHADOW, hi: 12, dither: false, onlyBelow: 14 });

  // 4. Accent + belly decals (post-shade so they stay saturated).
  if (p.belly) paintBelly(base, g);
  paintAccent(base, g, p, rng);

  // 5. Rim-light the lit leafy edge.
  rimLight(base, 'upper-left');

  // 6. Glowing flower-core highlight (structural, on most mid/late forms).
  if (p.core) {
    sparkle(base, Math.round(g.cx), g.coreY - 1, GLINT);
  }

  // 7. Face (eyes + blush) — placed late so the catch-lights survive.
  drawFace(base, g, p);

  // 8. Crisp 1px silhouette LAST.
  outline(base);

  // ---- Animation banks (a rooted plant: wind-sway, hop, lean-reach) ----
  const idle = [base.grid, bobFrame(base, -1)];
  const cx = Math.round(g.cx);

  const walk = framesFromDeltas(base, [
    (_f) => {}, // contact = base
    (f) => shiftInto(f, base, 1, 0),
    (f) => shiftInto(f, base, 0, -1),
    (f) => shiftInto(f, base, -1, 0),
  ]);

  const jump = framesFromDeltas(base, [
    (f) => shiftInto(f, base, 0, 1), // crouch
    (f) => shiftInto(f, base, 0, -2), // air-stretch
    (f) => shiftInto(f, base, 0, -1),
  ]);

  const play = framesFromDeltas(base, [
    (f) => shiftInto(f, base, 1, -1), // lean toward the toy
    (f) => {
      shiftInto(f, base, 1, -1);
      sparkle(f, cx + g.bodyRx + 1, g.crownY, GLINT);
    },
    (f) => shiftInto(f, base, -1, 0),
  ]);

  return { ...buildSprite(p.id, idle, p.fps ?? 4), walk, jump, play };
}

/** Replace `frame` content with `base` shifted by (dx,dy) — a clean re-pose. */
function shiftInto(frame: PixelCanvas, base: PixelCanvas, dx: number, dy: number): void {
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) frame.set(x, y, 0);
  }
  base.forEach((x, y, idx) => frame.set(x + dx, y + dy, idx));
}

/** Idle bob helper returning a grid (shift the base down/up by dy). */
function bobFrame(base: PixelCanvas, dy: number): number[][] {
  const out = PixelCanvas.create(base.width, base.height);
  base.forEach((x, y, idx) => out.set(x, y + dy, idx));
  return out.grid;
}

// ===========================================================================
// The shared neutral EGG — sprite-mote (16). A round downy seed-orb that
// pre-shows a faint bloom bud. Neutral house (unmapped genes live in the Bloom).
// ===========================================================================

export function buildMote(): SpriteDef {
  const W = 16;
  const cx = (W - 1) / 2;
  const cy = 9;
  const base = PixelCanvas.create(W, W);

  // Downy round seed-orb body (slightly egg-tall).
  fillEllipse(base, cx, cy, 6, 7, BODY);
  // A soft seed-seam.
  line(base, Math.round(cx) - 4, cy + 1, Math.round(cx) + 4, cy + 1, SHADOW);

  shade(base, { dir: 'upper-left', bands: 5, lo: SHADOW, hi: 12, dither: false, onlyBelow: 14 });

  // A bloom BUD peeking from the crown (the promise of a flower) + a faint core.
  fillPolygon(
    base,
    [
      [Math.round(cx), cy - 10],
      [Math.round(cx) - 3, cy - 5],
      [Math.round(cx) + 3, cy - 5],
    ],
    ACCENT_MID,
  );
  fillCircle(base, Math.round(cx), cy - 7, 1, ACCENT_HI);
  base.set(Math.round(cx) - 2, cy - 5, ACCENT_LO);
  base.set(Math.round(cx) + 2, cy - 5, ACCENT_LO);
  // A faint accent core glimmer through the shell.
  fillCircle(base, Math.round(cx), cy + 1, 1, ACCENT_MID);

  rimLight(base, 'upper-left');

  // A dormant sleepy face + a faint inner glint.
  base.set(Math.round(cx) - 2, cy, OUTLINE);
  base.set(Math.round(cx) + 2, cy, OUTLINE);
  base.set(Math.round(cx) - 3, cy - 1, RIM_HI);
  sparkle(base, Math.round(cx) + 1, cy - 2, GLINT);

  outline(base);

  const idle = [base.grid, bobFrame(base, -1)];
  const walk = framesFromDeltas(base, [(_f) => {}, (f) => shiftInto(f, base, 1, 0)]);
  const jump = framesFromDeltas(base, [
    (f) => shiftInto(f, base, 0, 1),
    (f) => shiftInto(f, base, 0, -2),
  ]);
  const play = framesFromDeltas(base, [
    (f) => shiftInto(f, base, 1, -1),
    (f) => {
      shiftInto(f, base, -1, 0);
      sparkle(f, Math.round(cx) + 3, cy - 2, GLINT);
    },
  ]);
  return { ...buildSprite('sprite-mote', idle, 3), walk, jump, play };
}

// ===========================================================================
// The Bloom roster — cute babies -> majestic titans; distinct low silhouettes
// converging to the shared crown+core+root-tendril archetype.
// ===========================================================================

// Sprout (sprite, 20) — ADORABLE seedling: round dumpling, single bud crown,
// huge sparkly eyes, blush, two stubby roots. The cutest baby.
export function buildSprout(): SpriteDef {
  return bloomCreature({
    id: 'sprite-sprout',
    size: 20,
    t: 0.0,
    plan: 'round',
    crown: 'bud',
    motifs: 1,
    roots: 2,
    accentFeature: 'crown',
    belly: true,
    eye: 'sparkle',
    fps: 4,
  });
}

// Mosskit (rookie, 24, steady) — mossy cub: soft round body, a small leaf-fan
// crown, glowing moss-spot freckles (accent), still big-eyed and cute.
export function buildMosskit(): SpriteDef {
  return bloomCreature({
    id: 'sprite-mosskit',
    size: 24,
    t: 0.2,
    plan: 'round',
    crown: 'leaf',
    motifs: 3,
    roots: 3,
    accentFeature: 'spots',
    belly: true,
    eye: 'sparkle',
    fps: 4,
  });
}

// Thornkit (rookie, 24, bursty) — DISTINCT prickly sprig: a slim leggy stem-body
// with a stubby soft-thorn crown + accent thorn-tips. Different silhouette.
export function buildThornkit(): SpriteDef {
  return bloomCreature({
    id: 'sprite-thornkit',
    size: 24,
    t: 0.22,
    plan: 'sprig',
    crown: 'thorn',
    motifs: 5,
    roots: 2,
    accentFeature: 'crown',
    eye: 'round',
    fps: 5,
  });
}

// Bramblox (evolved, 28, endurance) — sturdy bramble-knot: a tall woody torso,
// thick tangled roots, a small thorn crown, an accent core gem appears.
export function buildBramblox(): SpriteDef {
  return bloomCreature({
    id: 'sprite-bramblox',
    size: 28,
    t: 0.42,
    plan: 'tall',
    crown: 'thorn',
    motifs: 5,
    roots: 4,
    accentFeature: 'gem',
    core: true,
    eye: 'round',
    fps: 4,
  });
}

// Pollenix (evolved, 28, tempo) — bright pollen-drifter: tall body, an opening
// flower crown, an accent flower-core on the chest, drifting glints.
export function buildPollenix(): SpriteDef {
  return bloomCreature({
    id: 'sprite-pollenix',
    size: 28,
    t: 0.44,
    plan: 'tall',
    crown: 'flower',
    motifs: 5,
    roots: 3,
    accentFeature: 'core',
    core: true,
    eye: 'round',
    fps: 5,
  });
}

// Sporecap (evolved, 28, breadth) — DISTINCT walking mushroom: a wide soft cap
// instead of petals, accent spore-spots glowing beneath, stubby roots.
export function buildSporecap(): SpriteDef {
  return bloomCreature({
    id: 'sprite-sporecap',
    size: 28,
    t: 0.4,
    plan: 'round',
    crown: 'cap',
    motifs: 0,
    roots: 3,
    accentFeature: 'spots',
    belly: true,
    eye: 'calm',
    fps: 4,
  });
}

// Verdantyr (prime, 32, high) — perpetual bloom: converging archetype — a
// commanding torso, a full open flower crown (accent petals), a glowing core.
export function buildVerdantyr(): SpriteDef {
  return bloomCreature({
    id: 'sprite-verdantyr',
    size: 32,
    t: 0.66,
    plan: 'titan',
    crown: 'flower',
    motifs: 7,
    roots: 4,
    accentFeature: 'petals',
    core: true,
    eye: 'calm',
    fps: 4,
  });
}

// Bloomwarden (prime, 32, mid) — grove-guardian: archetype torso, a flower crown
// + an accent core gem (the warden's heart), broad rooted stance.
export function buildBloomwarden(): SpriteDef {
  return bloomCreature({
    id: 'sprite-bloomwarden',
    size: 32,
    t: 0.68,
    plan: 'titan',
    crown: 'flower',
    motifs: 7,
    roots: 5,
    accentFeature: 'core',
    core: true,
    eye: 'fierce',
    fps: 4,
  });
}

// Gnarloak (prime, 32, low) — gnarled oak-warden: archetype torso under a layered
// leaf canopy, an accent brow-gem, deep thick roots. Stern.
export function buildGnarloak(): SpriteDef {
  return bloomCreature({
    id: 'sprite-gnarloak',
    size: 32,
    t: 0.7,
    plan: 'titan',
    crown: 'canopy',
    motifs: 0,
    roots: 5,
    accentFeature: 'gem',
    core: true,
    eye: 'fierce',
    fps: 4,
  });
}

// Sylvaroot (apex, 36, early) — radiant grove-spirit: the MAJESTIC boss — small
// commanding head on a towering body, a grand flower crown + radiant accent glow.
export function buildSylvaroot(): SpriteDef {
  return bloomCreature({
    id: 'sprite-sylvaroot',
    size: 36,
    t: 0.92,
    plan: 'titan',
    crown: 'flower',
    motifs: 9,
    roots: 6,
    accentFeature: 'glow',
    core: true,
    eye: 'fierce',
    fps: 4,
  });
}

// Eldergrove (apex, 36, late) — ancient root-titan: the grandest — a towering
// trunk-body, a vast layered canopy crown, a radiant accent core. Imposing.
export function buildEldergrove(): SpriteDef {
  return bloomCreature({
    id: 'sprite-eldergrove',
    size: 36,
    t: 1.0,
    plan: 'titan',
    crown: 'canopy',
    motifs: 0,
    roots: 6,
    accentFeature: 'glow',
    core: true,
    eye: 'fierce',
    fps: 3,
  });
}

export const bloomSprites: SpriteDef[] = [
  buildMote(),
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
