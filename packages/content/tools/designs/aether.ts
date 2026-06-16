/**
 * Aether line sprite designs — the SKY COURT kingdom (flying creatures).
 *
 * Identity bible: docs/design/visuals-habitats-achievements.md §13 (Species identity
 * system) + the create-sprites skill. Sky Court creatures FLOAT (never touch ground),
 * built from a vertical teardrop body, a single luminous HALO-EYE (the WIS motif),
 * WING-PLANES that multiply with stage, and VEIL-TRAILS of light drifting below.
 * House tint = cyan; grade resolves richness at render time.
 *
 * LOCKED ART DIRECTION v2 ("octant / cute->majestic"):
 *  - CUTE -> MAJESTIC ARC. Babies are adorable downy halo-chicks (head ~= body, huge
 *    sparkly catch-lit eyes ~45-55% of head, blush, stubby nub limbs). The line sharpens
 *    monotonically to a MAJESTIC seraph boss at apex (small regal head on a tall radiant
 *    body ~1:3, crown, broad GOLD-edged blade-wings, glowing chest core, light-veils).
 *    Eye-to-head ratio shrinks egg->apex; silhouette complexity rises.
 *  - DISTINCT -> CONVERGE. Sprite/rookie get DISTINCT, varied silhouettes (different
 *    body-plans within the same kingdom); prime/apex CONVERGE on the shared archetype.
 *  - ROUNDED BUT DETAILED. Rich detail, but rounded corners + thickened thin bits so
 *    every form reads as a soft toyable plush/figure. Apex stays the most imposing.
 *  - HOUSE HUE DOMINATES (~70-85% cyan, indices 2..14). Each species has ONE signature
 *    SECONDARY accent (ACCENT_LO/MID/HI = 16/17/18) at ~10-20% on a signature feature,
 *    plus an optional cream BELLY (index 20).
 *  - NEVER store RGB — only palette indices; the renderer resolves House tint + GRADE
 *    beauty ladder + the per-species accent at render time.
 *
 * Octant size law: egg 16 · sprite 20 · rookie 24 · evolved 28 · prime 32 · apex 36
 * (square, even, height divisible by 4). Every species ships idle + walk + jump + play
 * banks (same dims), authored as small deltas of the idle base via framesFromDeltas.
 * Determinism: seeded LCG (hashStr(id)) — never Math.random / Date.now.
 */

import type { SpriteDef } from '@token-tamers/core';
import {
  PixelCanvas,
  buildSprite,
  fillEllipse,
  fillPolygon,
  fillCircle,
  strokeEllipse,
  line,
  thickLine,
  mirrorX,
  shade,
  rimLight,
  outline,
  sparkle,
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

// Cyan house-tone vocabulary shared by every Sky Court creature (flat cel bands).
const SHADOW = 4;
const BODY = 7;
const LIGHT = 11;

// ---------------------------------------------------------------------------
// Geometry — derived once from the stage size. As `maturity` rises 0 -> 1 the
// head shrinks relative to the body and the form elongates (cute -> majestic).
// ---------------------------------------------------------------------------

interface SkyGeom {
  size: number;
  cx: number;
  // head
  headCy: number;
  headR: number;
  // body (teardrop)
  bodyCy: number;
  bodyRx: number;
  bodyRy: number;
  topY: number;
  botY: number;
  shoulderY: number;
  // 0 = chick (cute), 1 = seraph (majestic)
  maturity: number;
}

/**
 * @param size stage px (square)
 * @param maturity 0 (downy chick) -> 1 (towering seraph). Drives the head:body
 *   ratio and the body elongation. Eye scale is derived from this in `skyEye`.
 */
function skyGeom(size: number, maturity: number): SkyGeom {
  const cx = (size - 1) / 2;
  // Head is huge on babies (~0.30 of size) and small on the apex (~0.15).
  const headR = Math.max(3, Math.round(size * (0.31 - 0.17 * maturity)));
  // Body is squat+wide on babies, tall+narrow on the seraph.
  const bodyRx = Math.max(3, Math.round(size * (0.24 - 0.06 * maturity)));
  const bodyRy = Math.max(3, Math.round(size * (0.17 + 0.13 * maturity)));
  // Head sits high; the gap to the body grows with maturity (a neck appears).
  const headCy = Math.round(size * (0.3 - 0.04 * maturity)) + headR - 2;
  const bodyCy = Math.round(headCy + headR * 0.7 + bodyRy * 0.85);
  return {
    size,
    cx,
    headCy,
    headR,
    bodyCy,
    bodyRx,
    bodyRy,
    topY: bodyCy - bodyRy,
    botY: bodyCy + bodyRy,
    shoulderY: bodyCy - Math.round(bodyRy * 0.4),
    maturity,
  };
}

// ---------------------------------------------------------------------------
// Body parts — every part rounds its corners + thickens thin bits.
// ---------------------------------------------------------------------------

/**
 * A swept, rounded wing-plane sail from the left shoulder. Babies get a single
 * stubby downy nub; the apex gets broad blade-feathers (the tip is widened so it
 * never reads spindly). mirrorX makes the right pair.
 */
function drawWing(c: PixelCanvas, g: SkyGeom, i: number, sweep: number, accentEdge: boolean): void {
  const shoulderX = Math.round(g.cx - g.bodyRx + 1);
  const reach = Math.round(g.size * (0.16 + 0.05 * g.maturity)) + i * Math.round(g.size * 0.1);
  const lift = Math.round(g.size * 0.1) + i * Math.round(g.size * 0.06) + sweep;
  const droop = Math.round(g.size * 0.06) + i * Math.round(g.size * 0.03);
  const sY = g.shoulderY - i;
  const tipX = shoulderX - reach;
  const tipY = sY - lift;
  const trailX = shoulderX - Math.round(reach * 0.5);
  const trailY = sY + droop;
  // Rounded wing membrane.
  fillPolygon(
    c,
    [
      [shoulderX, sY - 2],
      [shoulderX, sY + 2],
      [trailX, trailY],
      [tipX, tipY],
    ],
    BODY,
  );
  // Thicken the tip so it reads as a soft blade-feather, not a spike.
  fillCircle(c, tipX, tipY, 1, BODY);
  // Gold blade-feather edge for the grown forms (the seraph silhouette cue).
  if (accentEdge) {
    thickLine(c, tipX, tipY, trailX, trailY, ACCENT_MID, 2);
    c.set(tipX, tipY, ACCENT_HI);
  }
}

/**
 * The Sky Court signature: a single glowing wisdom halo-EYE. Babies get a huge
 * sparkly catch-lit eye (~half the head) with blush; the apex gets a small,
 * commanding crown-eye. Eye radius scales DOWN with maturity.
 */
function skyEye(c: PixelCanvas, g: SkyGeom, accent: boolean): void {
  const x = Math.round(g.cx);
  const y = g.headCy;
  // Eye radius: ~0.5 of head on babies, ~0.28 on the apex.
  const r = Math.max(1, Math.round(g.headR * (0.52 - 0.24 * g.maturity)));
  // Bright sclera halo (cyan light), then the dark pupil.
  fillEllipse(c, x, y, r + 1, r + 1, LIGHT);
  if (accent) strokeEllipse(c, x, y, r + 1, r + 1, ACCENT_MID); // accent iris ring
  fillEllipse(c, x, y, r, r, OUTLINE);
  // Big sparkly catch-light + luminous core spark.
  c.set(x, y, GLINT);
  c.set(x - r, y - r, RIM_HI);
  if (r >= 2) c.set(x - r + 1, y - r, RIM_HI);
  // Cute blush dabs on the small stages only.
  if (g.maturity < 0.45) {
    const bx = Math.round(g.headR * 0.75);
    c.set(x - bx, y + 1, ACCENT_LO);
    c.set(x - bx - 1, y + 1, ACCENT_LO);
    c.set(x + bx, y + 1, ACCENT_LO);
    c.set(x + bx + 1, y + 1, ACCENT_LO);
  }
}

/** Stubby downy nub limbs for the cute stages (rounded, never spindly). */
function drawNubs(c: PixelCanvas, g: SkyGeom): void {
  const ny = g.botY - 1;
  fillCircle(c, Math.round(g.cx - g.bodyRx * 0.45), ny, 1, BODY);
  fillCircle(c, Math.round(g.cx + g.bodyRx * 0.45), ny, 1, BODY);
}

/** A wavy rounded strand of light descending from the underside (veil-trail). */
function drawVeil(c: PixelCanvas, x0: number, y0: number, len: number, rng: Lcg): void {
  let x = x0;
  for (let i = 0; i < len; i++) {
    const y = y0 + i;
    if (y >= c.height) break;
    c.set(x, y, i >= len - 2 ? SHADOW : BODY);
    if (i < len - 2) c.set(x + 1, y, BODY); // thicken so it reads as a soft ribbon
    if (rng.chance(0.4)) x += rng.int(3) - 1;
  }
}

/** A glowing chest core — appears on the grown forms (the seraph's heart-light). */
function drawCore(c: PixelCanvas, g: SkyGeom, accent: boolean): void {
  const x = Math.round(g.cx);
  const y = Math.round(g.bodyCy + g.bodyRy * 0.1);
  fillCircle(c, x, y, 2, accent ? ACCENT_HI : GLINT);
  c.set(x, y, GLINT);
  c.set(x, y - 1, RIM_HI);
}

/** A small regal crown of light-spurs above the head (grown forms only). */
function drawCrown(c: PixelCanvas, g: SkyGeom, points: number): void {
  const baseY = g.headCy - g.headR - 1;
  const span = Math.max(2, Math.round(g.headR * 0.85));
  const h = Math.max(2, Math.round(g.size * 0.1));
  for (let k = 0; k < points; k++) {
    const t = points === 1 ? 0 : (k / (points - 1)) * 2 - 1;
    const sx = Math.round(g.cx + t * span);
    const tip = baseY - h + Math.round(Math.abs(t) * 2); // center spur tallest
    thickLine(c, sx, baseY, sx, tip, LIGHT, 2);
    c.set(sx, tip, ACCENT_HI);
  }
}

/** A faint halo ring above the head (juvenile/awakened forms). */
function drawHaloRing(c: PixelCanvas, g: SkyGeom, accent: boolean): void {
  strokeEllipse(
    c,
    Math.round(g.cx),
    g.headCy - g.headR - 1,
    g.headR,
    1,
    accent ? ACCENT_MID : LIGHT,
  );
}

// ---------------------------------------------------------------------------
// Per-species parameters — variety from a TABLE, cohesion from the shared
// builder + the Sky Court body-plan.
// ---------------------------------------------------------------------------

type Halo = 'none' | 'ring' | 'crown';

interface SkyParams {
  id: string;
  size: number;
  /** 0 (downy chick) -> 1 (towering seraph). Drives head:body + eye scale. */
  maturity: number;
  /** Wing-planes per side. */
  wings: number;
  /** Extra upward sweep on the wings (leaner/faster forms). */
  sweep?: number;
  /** Veil-trail strands drifting below. */
  veils: number;
  halo: Halo;
  /** Gold blade-feather edges on the wings (grown forms). */
  bladeWings?: boolean;
  /** Glowing chest core. */
  core?: boolean;
  /** Crown spur count (when halo === 'crown'). */
  crownPoints?: number;
  /** Stubby nub limbs (cute stages). */
  nubs?: boolean;
  /** Cream belly patch. */
  belly?: boolean;
  /** Per-species accent applied to the eye-iris ring + core. */
  accentEye?: boolean;
  fps?: number;
  /** Body-tone motif drawn AFTER mirror, BEFORE shade (cel-shades). */
  bodyMotif?: (c: PixelCanvas, g: SkyGeom, rng: Lcg) => void;
  /** Accent/decal motif drawn AFTER shade + rimLight, BEFORE eyes/outline. */
  accentMotif?: (c: PixelCanvas, g: SkyGeom, rng: Lcg) => void;
  /** Bright glint motif drawn just before outline. */
  brightMotif?: (c: PixelCanvas, g: SkyGeom, rng: Lcg) => void;
}

// ---------------------------------------------------------------------------
// The shared Sky Court builder: one parametric flying creature + four banks.
// ORDER OF OPS: shapes -> mirrorX -> shade(onlyBelow:14) -> ACCENT/BELLY decals
//   -> rimLight -> eyes+sparkle -> outline LAST.
// ---------------------------------------------------------------------------

function skyCreature(p: SkyParams): SpriteDef {
  const g = skyGeom(p.size, p.maturity);
  const rng = lcg(hashStr(p.id));
  const sweep = p.sweep ?? 0;
  const base = PixelCanvas.create(p.size, p.size);

  // 1. Wing-planes (left side only — mirrored below).
  for (let i = 0; i < p.wings; i++) drawWing(base, g, i, sweep, !!p.bladeWings);

  // 2. Floating teardrop body: round top + tapering rounded point below.
  fillEllipse(base, g.cx, g.bodyCy, g.bodyRx, g.bodyRy, BODY);
  fillPolygon(
    base,
    [
      [g.cx - g.bodyRx + 1, g.botY - 1],
      [g.cx + g.bodyRx - 1, g.botY - 1],
      [g.cx, g.botY + Math.round(g.bodyRy * 0.55)],
    ],
    BODY,
  );
  fillCircle(base, g.cx, g.botY + Math.round(g.bodyRy * 0.5), 1, BODY); // round the point

  // 3. Big round head (the cute anchor; small + regal on the apex).
  fillCircle(base, g.cx, g.headCy, g.headR, BODY);

  // 4. Stubby nub limbs (cute stages).
  if (p.nubs) drawNubs(base, g);

  // 5. Symmetry — duplicate the left wings/body onto the right.
  mirrorX(base);

  // 6. Veil-trails drift from the underside (center longest, sides shorter).
  const veilBase = g.botY + Math.round(g.bodyRy * 0.5);
  for (let j = 0; j < p.veils; j++) {
    const off = j * Math.max(2, Math.round(p.size * 0.12));
    const len = Math.max(2, Math.round(p.size * (0.26 + 0.1 * g.maturity)) - j * 2);
    drawVeil(base, Math.round(g.cx - off), veilBase, len, rng);
    if (off > 0) drawVeil(base, Math.round(g.cx + off), veilBase, len, rng);
  }

  // 7. Body-tone motif (asymmetric features that should still cel-shade).
  p.bodyMotif?.(base, g, rng);

  // 8. Cel shading — protect accent/belly/glint (indices > 14 survive).
  const bands = p.size >= 28 ? 6 : 5;
  shade(base, {
    dir: 'upper-left',
    bands,
    lo: SHADOW,
    hi: LIGHT + 1,
    dither: false,
    onlyBelow: 14,
  });

  // 9. Cream belly patch (painted after shade so it keeps its tone).
  if (p.belly) {
    const by = Math.round(g.bodyCy + g.bodyRy * 0.25);
    fillEllipse(
      base,
      Math.round(g.cx),
      by,
      Math.max(1, g.bodyRx - 2),
      Math.max(1, g.bodyRy - 1),
      BELLY,
    );
  }

  // 10. Accent / decal motif (signature secondary color).
  p.accentMotif?.(base, g, rng);

  // 11. Rim-light on the lit edge.
  rimLight(base, 'upper-left');

  // 12. Halo / crown above the head (post-shade so it stays bright).
  if (p.halo === 'ring') drawHaloRing(base, g, !!p.accentEye);
  else if (p.halo === 'crown') drawCrown(base, g, p.crownPoints ?? 3);

  // 13. Glowing chest core (grown forms).
  if (p.core) drawCore(base, g, !!p.accentEye);

  // 14. The single luminous halo-eye (lineage anchor) + bright motif.
  skyEye(base, g, !!p.accentEye);
  p.brightMotif?.(base, g, rng);

  // 15. Crisp 1px silhouette LAST.
  outline(base);

  // ---- Animation banks (a floating creature: drift, updraft, swoop) ----
  // idle: gentle vertical bob.
  const idle = framesFromDeltas(base, [(_f) => {}, (f) => bobInto(f, 1)]);
  // walk: side drift + wing flutter (faces right; renderer flips for left).
  const walk = framesFromDeltas(base, [
    (_f) => {},
    (f) => shiftInto(f, 1, 0),
    (f) => shiftInto(f, 1, -1),
    (f) => shiftInto(f, 0, 0),
  ]);
  // jump: crouch -> updraft stretch.
  const jump = framesFromDeltas(base, [(f) => shiftInto(f, 0, 1), (f) => shiftInto(f, 0, -2)]);
  // play: swoop + a flung spark toward the toy.
  const play = framesFromDeltas(base, [
    (f) => {
      shiftInto(f, 1, -1);
      sparkle(f, Math.round(g.cx + g.bodyRx + 2), g.shoulderY, GLINT);
    },
    (f) => shiftInto(f, -1, 0),
  ]);

  return { ...buildSprite(p.id, idle, p.fps ?? 4), walk, jump, play };
}

/** Shift the live frame's content in place by (dx,dy) (delta-friendly). */
function shiftInto(f: PixelCanvas, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  const snapshot: Array<[number, number, number]> = [];
  f.forEach((x, y, idx) => snapshot.push([x, y, idx]));
  for (const row of f.grid) row.fill(0);
  for (const [x, y, idx] of snapshot) f.set(x + dx, y + dy, idx);
}

/** Vertical bob in place. */
function bobInto(f: PixelCanvas, dy: number): void {
  shiftInto(f, 0, dy);
}

// ---------------------------------------------------------------------------
// Mote (16×16) — the universal egg: a dormant glowing orb cradling a future Sky
// Court gene (a single sleepy eye + a hatch-crack, one veil hint). Neutral/Wild.
// ---------------------------------------------------------------------------

export function buildMote(): SpriteDef {
  const W = 16;
  const cx = (W - 1) / 2;
  const cy = 8;
  const base = PixelCanvas.create(W, W);

  // Egg-orb body.
  fillEllipse(base, cx, cy, 5, 6, BODY);
  shade(base, {
    dir: 'upper-left',
    bands: 5,
    lo: SHADOW,
    hi: LIGHT + 1,
    dither: false,
    onlyBelow: 14,
  });
  // A faint cyan belly glow.
  fillEllipse(base, Math.round(cx), cy + 2, 2, 2, BELLY);
  rimLight(base, 'upper-left');

  // A dormant single eye (sleepy line) — the Sky Court motif, not yet awake.
  line(base, Math.round(cx) - 1, cy - 1, Math.round(cx) + 1, cy - 1, OUTLINE);
  // Hatch-crack zig down the lower face.
  line(base, Math.round(cx), cy + 1, Math.round(cx) - 1, cy + 3, OUTLINE);
  line(base, Math.round(cx) - 1, cy + 3, Math.round(cx) + 1, cy + 4, OUTLINE);
  // Faint inner glow glint.
  sparkle(base, Math.round(cx) + 1, cy - 3, GLINT);
  outline(base);

  const idle = framesFromDeltas(base, [(_f) => {}, (f) => bobInto(f, 1)]);
  const walk = framesFromDeltas(base, [(_f) => {}, (f) => shiftInto(f, 1, 0)]);
  const jump = framesFromDeltas(base, [(f) => shiftInto(f, 0, 1), (f) => shiftInto(f, 0, -2)]);
  const play = framesFromDeltas(base, [
    (f) => {
      shiftInto(f, 1, -1);
      sparkle(f, Math.round(cx) + 3, cy - 3, GLINT);
    },
    (f) => shiftInto(f, -1, 0),
  ]);
  return { ...buildSprite('sprite-mote', idle, 3), walk, jump, play };
}

// ---------------------------------------------------------------------------
// Sky Court line. Lower stages = DISTINCT body-plans (kills "too similar");
// prime/apex CONVERGE on the seraph archetype (crown + blade-wings + core).
// ---------------------------------------------------------------------------

// Wisp (20, sprite) — adorable downy halo-chick: round head ~= body, ONE big
// sparkly eye, single stubby wing-nub per side, one soft veil. Most cute.
export function buildWisp(): SpriteDef {
  return skyCreature({
    id: 'sprite-wisp',
    size: 20,
    maturity: 0,
    wings: 1,
    veils: 1,
    halo: 'none',
    nubs: true,
    belly: true,
    accentEye: true,
    fps: 4,
  });
}

// Aetherling (24, rookie) — sturdier downy juvenile, a first faint halo RING,
// two veils, a cream belly. Rounder & wider — a distinct "cherub-pod" silhouette.
export function buildAetherling(): SpriteDef {
  return skyCreature({
    id: 'sprite-aetherling',
    size: 24,
    maturity: 0.18,
    wings: 1,
    veils: 2,
    halo: 'ring',
    nubs: true,
    belly: true,
    accentEye: true,
    fps: 4,
  });
}

// Murmur (24, rookie) — leaner echo-moth: TWIN swept wings + a split twin-tail
// veil (its motif). A DISTINCT darty silhouette vs the round Aetherling.
export function buildMurmur(): SpriteDef {
  return skyCreature({
    id: 'sprite-murmur',
    size: 24,
    maturity: 0.22,
    wings: 2,
    sweep: 2,
    veils: 0,
    halo: 'none',
    belly: true,
    accentEye: true,
    fps: 5,
    bodyMotif: (c, g) => {
      // Twin echo-tails forking from the body point (thickened ribbons).
      thickLine(c, Math.round(g.cx) - 1, g.botY, Math.round(g.cx) - 3, g.botY + 5, BODY, 2);
      thickLine(c, Math.round(g.cx) + 1, g.botY, Math.round(g.cx) + 3, g.botY + 5, BODY, 2);
    },
    accentMotif: (c, g) => {
      c.set(Math.round(g.cx) - 3, g.botY + 5, ACCENT_MID);
      c.set(Math.round(g.cx) + 3, g.botY + 5, ACCENT_MID);
    },
    brightMotif: (c, g) => sparkle(c, Math.round(g.cx) - 3, g.botY + 5, GLINT),
  });
}

// Oraclet (28, evolved) — layered oracle: two wings, halo ring, riddle-bands
// across the body (accent bands = its motif). Halfway to the archetype.
export function buildOraclet(): SpriteDef {
  return skyCreature({
    id: 'sprite-oraclet',
    size: 28,
    maturity: 0.45,
    wings: 2,
    veils: 2,
    halo: 'ring',
    core: true,
    accentEye: true,
    bodyMotif: (c, g) => {
      for (let k = 0; k < 2; k++) {
        const y = g.bodyCy + k * 3 + 1;
        line(c, Math.round(g.cx - g.bodyRx + 1), y, Math.round(g.cx + g.bodyRx - 1), y, SHADOW);
      }
    },
    accentMotif: (c, g) => {
      // Riddle-bands recolored to the species accent.
      const y = g.bodyCy + 1;
      line(c, Math.round(g.cx - g.bodyRx + 1), y, Math.round(g.cx + g.bodyRx - 1), y, ACCENT_MID);
    },
  });
}

// Cirrux (28, evolved) — comet-flyer: swept wings + a crystalline accent
// wake-streak (asymmetric motif). A DISTINCT raked silhouette.
export function buildCirrux(): SpriteDef {
  return skyCreature({
    id: 'sprite-cirrux',
    size: 28,
    maturity: 0.42,
    wings: 2,
    sweep: 3,
    veils: 1,
    halo: 'none',
    core: true,
    accentEye: true,
    fps: 5,
    accentMotif: (c, g) => {
      // Trailing comet wake to the lower-left (accent ramp).
      for (let i = 0; i < 5; i++) {
        c.set(Math.round(g.cx - g.bodyRx - i - 1), g.botY - 2 + i, i % 2 ? ACCENT_HI : ACCENT_MID);
      }
    },
    brightMotif: (c, g) => sparkle(c, Math.round(g.cx - g.bodyRx - 1), g.botY - 1, GLINT),
  });
}

// Nimbusk (28, evolved) — nimbus of wisdom-sigils: two wings + a ring of three
// accent sigil-glints orbiting the head. A DISTINCT haloed silhouette.
export function buildNimbusk(): SpriteDef {
  return skyCreature({
    id: 'sprite-nimbusk',
    size: 28,
    maturity: 0.46,
    wings: 2,
    veils: 2,
    halo: 'ring',
    core: true,
    accentEye: true,
    accentMotif: (c, g) => {
      const r = g.headR + 3;
      sparkle(c, Math.round(g.cx - r), g.headCy, ACCENT_HI);
      sparkle(c, Math.round(g.cx + r), g.headCy, ACCENT_HI);
      sparkle(c, Math.round(g.cx), g.headCy - g.headR - 3, ACCENT_HI);
    },
    brightMotif: (c, g) => {
      sparkle(c, Math.round(g.cx - g.headR - 3), g.headCy, GLINT);
      sparkle(c, Math.round(g.cx + g.headR + 3), g.headCy, GLINT);
    },
  });
}

// Seraphix (32, prime) — radiant seraph: three blade-wings, halo crown, a glowing
// core + orbiting accent sparks. CONVERGING hard on the apex archetype.
export function buildSeraphix(): SpriteDef {
  return skyCreature({
    id: 'sprite-seraphix',
    size: 32,
    maturity: 0.7,
    wings: 3,
    veils: 2,
    halo: 'crown',
    crownPoints: 3,
    bladeWings: true,
    core: true,
    accentEye: true,
    accentMotif: (c, g) => {
      sparkle(c, Math.round(g.cx - g.bodyRx - 2), g.shoulderY - 2, ACCENT_HI);
      sparkle(c, Math.round(g.cx + g.bodyRx + 2), g.shoulderY - 2, ACCENT_HI);
    },
  });
}

// Thoughtwarden (32, prime) — guardian seraph: broad blade-wings + twin accent
// light-pillars flanking it (its motif), full crown, glowing core.
export function buildThoughtwarden(): SpriteDef {
  return skyCreature({
    id: 'sprite-thoughtwarden',
    size: 32,
    maturity: 0.68,
    wings: 2,
    veils: 1,
    halo: 'crown',
    crownPoints: 3,
    bladeWings: true,
    core: true,
    accentEye: true,
    accentMotif: (c, g) => {
      const px1 = Math.round(g.cx - g.bodyRx - 3);
      const px2 = Math.round(g.cx + g.bodyRx + 3);
      thickLine(c, px1, g.topY, px1, g.botY + 2, ACCENT_MID, 2);
      thickLine(c, px2, g.topY, px2, g.botY + 2, ACCENT_MID, 2);
      c.set(px1, g.topY, ACCENT_HI);
      c.set(px2, g.topY, ACCENT_HI);
    },
  });
}

// Halcyore (32, prime) — calm seraph drifter: three soft blade-wings + a wide
// stilling accent aura ring, three veils, crown, core. Serene, still majestic.
export function buildHalcyore(): SpriteDef {
  return skyCreature({
    id: 'sprite-halcyore',
    size: 32,
    maturity: 0.66,
    wings: 3,
    sweep: 1,
    veils: 3,
    halo: 'crown',
    crownPoints: 1,
    bladeWings: true,
    core: true,
    accentEye: true,
    accentMotif: (c, g) =>
      strokeEllipse(c, Math.round(g.cx), g.bodyCy, g.bodyRx + 4, g.bodyRy + 3, ACCENT_MID),
    brightMotif: (c, g) =>
      strokeEllipse(c, Math.round(g.cx), g.bodyCy, g.bodyRx + 5, g.bodyRy + 4, GLINT),
  });
}

// Aurelion (36, apex) — THE APEX SERAPH-BIRD (approved anchor): small regal head
// on a tall radiant body (~1:3), broad cyan blade-wings edged in GOLD, halo-crown,
// glowing chest core, light-veils + orbiting thought-sparks. The boss silhouette.
export function buildAurelion(): SpriteDef {
  return skyCreature({
    id: 'sprite-aurelion',
    size: 36,
    maturity: 1,
    wings: 3,
    veils: 3,
    halo: 'crown',
    crownPoints: 3,
    bladeWings: true,
    core: true,
    accentEye: true,
    brightMotif: (c, g) => {
      const r = g.bodyRx + 6;
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

// Mindspire (36, apex) — crystallized apex seraph: small head crowned by a tall
// faceted accent crystal-spire + orbiting truth-satellites, blade-wings, core.
export function buildMindspire(): SpriteDef {
  return skyCreature({
    id: 'sprite-mindspire',
    size: 36,
    maturity: 1,
    wings: 2,
    veils: 1,
    halo: 'crown',
    crownPoints: 1,
    bladeWings: true,
    core: true,
    accentEye: true,
    bodyMotif: (c, g) => {
      // A faceted spire crystal rising from the crown (thickened so it's solid).
      fillPolygon(
        c,
        [
          [Math.round(g.cx), g.headCy - g.headR - 9],
          [Math.round(g.cx) - 3, g.headCy - g.headR - 1],
          [Math.round(g.cx) + 3, g.headCy - g.headR - 1],
        ],
        LIGHT,
      );
    },
    accentMotif: (c, g) => {
      // Recolor the spire faces with the accent + facet edge.
      line(
        c,
        Math.round(g.cx),
        g.headCy - g.headR - 9,
        Math.round(g.cx),
        g.headCy - g.headR - 2,
        ACCENT_MID,
      );
      c.set(Math.round(g.cx), g.headCy - g.headR - 9, ACCENT_HI);
    },
    brightMotif: (c, g) => {
      // Satellites orbiting on the horizontal axis.
      sparkle(c, Math.round(g.cx - g.bodyRx - 4), g.bodyCy - 1, GLINT);
      sparkle(c, Math.round(g.cx + g.bodyRx + 4), g.bodyCy + 1, GLINT);
      c.set(Math.round(g.cx), g.headCy - g.headR - 9, RIM_HI);
    },
  });
}

// NOTE: the shared neutral egg `sprite-mote` is authored in bloom.ts (the Bloom
// owns the neutral egg), so it is intentionally NOT emitted here.
export const aetherSprites: SpriteDef[] = [
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
