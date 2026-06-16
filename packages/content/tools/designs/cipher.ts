/**
 * Cipher line sprite designs — the CRAG BEASTS kingdom (ground predators).
 *
 * Art direction v2 ("octant / cute -> majestic"), CLEAN REBUILD. Crag Beasts are
 * geometric crystal-stone predators expressed as a SOFT ROUND boulder/plush body
 * with a FEW large clean angular facet planes (NOT a busy field of tiny ones).
 * Every shard — horn, blade, claw, fang — is a SOLID FILLED TRIANGLE (fillPolygon)
 * 2-3px wide at its base; there are NO 1px tapering spikes and NO 1px lines used as
 * spikes or seams. The signature is ONE deliberate CYAN feature per species (a
 * crystal CORE GEM, a crown shard, or a chest glyph) — at most a few accent pixels,
 * never a scatter/speckle/seam-field.
 *
 * CUTE -> MAJESTIC ARC (monotonic): sprite/rookie are adorable round boulder-cubs
 * (head ~= body, huge sparkly catch-lit eyes, blush, stubby nub legs, ONE soft nub
 * horn or shard). evolved trims the chub; prime/apex CONVERGE on the shared archon
 * archetype — a small head on a tall faceted body crowned with a few bold solid
 * crystal shards and a blazing cyan core. Lower stages get DISTINCT silhouettes
 * (kills "too similar"); prime/apex converge.
 *
 * OCTANT SIZE LAW (square, even, height div 4): sprite 20 · rookie 24 · evolved 28 ·
 *   prime 32 · apex 36. Enforced by the content-pack test (width===height===stageSize).
 *
 * COLOR: never store RGB — only palette INDICES. House RED dominates (indices 2..14,
 *   ~70-85% of colored pixels); ACCENT_LO/MID/HI (16/17/18) = the cyan signature on
 *   ONE feature (~10-20%); optional cream BELLY (20). The renderer resolves House
 *   tint + the GRADE beauty ladder + the per-species accent at render time.
 *
 * ORDER OF OPS: shapes -> mirrorX -> shade(onlyBelow:14) -> ACCENT/BELLY decals ->
 *   rimLight -> eyes + glint -> outline LAST. Determinism: seeded lcg(hashStr(id)).
 */

import type { SpriteDef } from '@token-tamers/core';
import {
  PixelCanvas,
  buildSprite,
  fillPolygon,
  fillRect,
  fillEllipse,
  smallEllipse,
  thickLine,
  shade,
  rimLight,
  outline,
  sparkle,
  diamond,
  mirrorX,
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

// House-red carapace tone vocabulary shared by every Crag Beast.
const BODY = 7; // mid carapace tone
const LIGHT = 11; // lit facet plane

/** Geometry of a planted Crag Beast, derived once from the stage size. */
interface CragGeom {
  size: number;
  cx: number;
  groundY: number;
  bodyBot: number; // top of the legs / base of the carapace
  bodyTop: number; // crown of the carapace dome
  headY: number; // eye band
  halfW: number; // carapace half-width
  legH: number;
  /** Maturity ramp 0..1 (sprite=0 -> apex=1): cuteness shrinks, majesty grows. */
  m: number;
}

interface CragOpts {
  id: string;
  size: number;
  /** 0=apex .. 4=sprite stage rank used only to set the maturity ramp. */
  rank: number; // 0 sprite, 1 rookie, 2 evolved, 3 prime, 4 apex (display order)
  /** Visible legs (2 = upright predator, 4 = heavy planted quadruped). */
  legs: number;
  /** Bold solid shoulder shards flanking the central blade (grows with stage). */
  shards: number;
  /** Central brow-blade height tier (the signature crystal spike). */
  blade: number;
  /** Carapace silhouette family (distinct lower stages -> shared archetype). */
  shape: 'cub' | 'bulwark' | 'striker' | 'hound' | 'runner' | 'archon';
  /** Eye style: cute babies get huge round eyes; bosses get slitted glares. */
  eyeStyle: 'cute' | 'keen' | 'slit';
  fps?: number;
  /** Structural body-tone motif, BEFORE shade (so it cel-shades). */
  bodyMotif?: (c: PixelCanvas, g: CragGeom, rng: Lcg) => void;
  /** ONE cyan-accent signature feature, AFTER shade (so the accent survives). */
  accentMotif?: (c: PixelCanvas, g: CragGeom, rng: Lcg) => void;
  /** Bright glints (a couple of catch-lit shard tips), AFTER rimLight. */
  brightMotif?: (c: PixelCanvas, g: CragGeom, rng: Lcg) => void;
}

function cragGeom(size: number, rank: number): CragGeom {
  const cx = (size - 1) / 2;
  const groundY = size - 1;
  const legH = Math.max(2, Math.round(size * 0.15));
  // maturity 0 (sprite) .. 1 (apex): cute babies sit lower & rounder.
  const m = (4 - rank) / 4;
  // Babies: tall round head (carapace high), bosses: body climbs, head small.
  const bodyTop = Math.round(size * (0.3 - 0.06 * (1 - m)));
  return {
    size,
    cx,
    groundY,
    legH,
    m,
    bodyBot: groundY - legH + 1,
    bodyTop,
    headY: bodyTop + Math.max(2, Math.round(size * (0.18 + 0.02 * (1 - m)))),
    halfW: Math.round(size * (0.34 + 0.04 * (1 - m))), // babies a touch chubbier
  };
}

// ---------------------------------------------------------------------------
// Carapace silhouettes — DISTINCT per family, ROUND boulder body + a FEW big
// clean facet planes. Draw the LEFT half then mirrorX in the builder.
// ---------------------------------------------------------------------------

/** Round boulder-cub: a soft chunky crystal pebble (one big dome, rounded base). */
function shapeCub(c: PixelCanvas, g: CragGeom): void {
  const w = g.halfW;
  const midY = Math.round((g.bodyTop + g.bodyBot) / 2);
  // Round boulder mass (left half completed by mirrorX).
  fillEllipse(c, g.cx, midY, w, Math.round((g.bodyBot - g.bodyTop) * 0.6) + 1, BODY);
  fillRect(c, g.cx - w, midY, g.cx, g.bodyBot - 1, BODY);
  // Soften the bottom into a planted pebble.
  fillEllipse(c, g.cx, g.bodyBot - 1, w, 3, BODY);
}

/** Heavy bulwark: a broad rounded dome on a wide planted base + one lit facet. */
function shapeBulwark(c: PixelCanvas, g: CragGeom): void {
  const w = g.halfW;
  const midY = Math.round((g.bodyTop + g.bodyBot) / 2);
  fillEllipse(c, g.cx, midY, w, Math.round((g.bodyBot - g.bodyTop) * 0.62), BODY);
  fillRect(c, g.cx - w, midY, g.cx, g.bodyBot - 1, BODY);
  fillEllipse(c, g.cx, g.bodyBot - 1, w, 2, BODY);
  // One big clean lit facet plane on the upper-left dome (the faceted cue).
  fillPolygon(
    c,
    [
      [g.cx - w + 1, midY - 1],
      [g.cx - Math.round(w * 0.2), g.bodyTop + 1],
      [g.cx, g.bodyTop + Math.round(g.size * 0.12)],
      [g.cx - Math.round(w * 0.55), midY],
    ],
    LIGHT,
  );
}

/** Lean upright striker: a tall rounded prism, shoulders high + a chest facet. */
function shapeStriker(c: PixelCanvas, g: CragGeom): void {
  const w = Math.round(g.halfW * 0.82);
  const midY = Math.round((g.bodyTop + g.bodyBot) / 2);
  fillEllipse(c, g.cx, midY, w, Math.round((g.bodyBot - g.bodyTop) * 0.66), BODY);
  fillRect(c, g.cx - w, midY, g.cx, g.bodyBot - 1, BODY);
  fillEllipse(c, g.cx, g.bodyTop + 2, Math.round(w * 0.75), 3, BODY);
  // One bold lit facet down the chest.
  fillPolygon(
    c,
    [
      [g.cx - Math.round(w * 0.7), midY],
      [g.cx - Math.round(w * 0.15), g.bodyTop + 3],
      [g.cx, midY + Math.round(g.size * 0.06)],
    ],
    LIGHT,
  );
}

/** Hound: a long low rounded body + a solid crystal muzzle jutting forward. */
function shapeHound(c: PixelCanvas, g: CragGeom): void {
  const w = g.halfW;
  const midY = Math.round((g.bodyTop + g.bodyBot) / 2) + 1;
  fillEllipse(c, g.cx, midY, w, Math.round((g.bodyBot - g.bodyTop) * 0.5) + 1, BODY);
  fillRect(c, g.cx - w, midY, g.cx, g.bodyBot - 1, BODY);
  // Lowered solid crystal muzzle (a clean wedge, thick base).
  fillPolygon(
    c,
    [
      [g.cx - w + 1, midY - 1],
      [g.cx - w - Math.round(g.size * 0.14), midY + 2],
      [g.cx - w + 1, midY + 4],
    ],
    BODY,
  );
}

/** Runner: a sleek rounded wedge built for tempo + one clean spine facet. */
function shapeRunner(c: PixelCanvas, g: CragGeom): void {
  const w = g.halfW;
  const midY = Math.round((g.bodyTop + g.bodyBot) / 2);
  fillEllipse(c, g.cx, midY, w, Math.round((g.bodyBot - g.bodyTop) * 0.55), BODY);
  fillRect(c, g.cx - w, midY, g.cx, g.bodyBot - 1, BODY);
  // One bold lit spine ridge facet (the geometric runner cue).
  fillPolygon(
    c,
    [
      [g.cx - Math.round(w * 0.7), midY],
      [g.cx, g.bodyTop + 2],
      [g.cx, midY + Math.round(g.size * 0.08)],
    ],
    LIGHT,
  );
}

/** Archon: tall majestic boss — small head on a towering rounded faceted body. */
function shapeArchon(c: PixelCanvas, g: CragGeom): void {
  const w = g.halfW;
  const shoulder = g.bodyTop + Math.round(g.size * 0.2);
  const midY = Math.round((shoulder + g.bodyBot) / 2);
  // Broad commanding shoulders on a tall rounded body.
  fillEllipse(c, g.cx, midY, w, Math.round((g.bodyBot - shoulder) * 0.62) + 2, BODY);
  fillRect(c, g.cx - w, midY, g.cx, g.bodyBot - 1, BODY);
  // Small crowned head dome above the shoulders.
  fillEllipse(
    c,
    g.cx,
    g.bodyTop + Math.round(g.size * 0.07),
    Math.round(w * 0.5),
    Math.round(g.size * 0.09),
    BODY,
  );
  fillRect(
    c,
    g.cx - Math.round(w * 0.5),
    g.bodyTop + Math.round(g.size * 0.07),
    g.cx,
    shoulder,
    BODY,
  );
  // ONE big clean chest-plate facet (majesty detail, not busy planes).
  fillPolygon(
    c,
    [
      [g.cx - Math.round(w * 0.7), shoulder + 1],
      [g.cx, shoulder],
      [g.cx, shoulder + Math.round(g.size * 0.18)],
      [g.cx - Math.round(w * 0.5), shoulder + Math.round(g.size * 0.16)],
    ],
    LIGHT,
  );
}

const SHAPES: Record<CragOpts['shape'], (c: PixelCanvas, g: CragGeom) => void> = {
  cub: shapeCub,
  bulwark: shapeBulwark,
  striker: shapeStriker,
  hound: shapeHound,
  runner: shapeRunner,
  archon: shapeArchon,
};

// ---------------------------------------------------------------------------
// Shared features — legs, solid blade/shards/horn, eyes. Drawn on the LEFT
// half (or symmetric) so the builder's mirrorX completes the creature.
// ---------------------------------------------------------------------------

/** Stubby planted legs ending in a little crystal claw nub. */
function drawLegs(c: PixelCanvas, g: CragGeom, legs: number): void {
  const legW = Math.max(2, Math.round(g.size * 0.09));
  const span = Math.round(g.halfW * 0.62);
  const xs = legs >= 4 ? [span, Math.round(span * 0.34)] : [span];
  for (const dx of xs) {
    const x = Math.round(g.cx - dx);
    fillRect(c, x - legW + 1, g.bodyBot, x + legW - 1, g.groundY, BODY);
    // a small solid claw wedge at the foot
    fillPolygon(
      c,
      [
        [x - legW + 1, g.groundY],
        [x - legW - 1, g.groundY],
        [x - legW, g.groundY - 2],
      ],
      BODY,
    );
  }
}

/** Central SOLID crystal brow-blade + `pairs` SOLID shoulder shards (filled triangles). */
function drawBladeAndShards(c: PixelCanvas, g: CragGeom, pairs: number, blade: number): void {
  const cxr = Math.round(g.cx);
  const bw = Math.max(2, Math.round(g.size * 0.07));
  const bh = Math.round(g.size * 0.13) * blade;
  // Central faceted blade — a solid wide-based triangle (toyable, never a needle).
  fillPolygon(
    c,
    [
      [cxr - bw, g.bodyTop + 2],
      [cxr + bw, g.bodyTop + 2],
      [cxr, g.bodyTop - bh],
    ],
    BODY,
  );
  for (let i = 0; i < pairs; i++) {
    const off = Math.round(g.halfW * (0.5 + i * 0.28));
    const h = Math.round(g.size * 0.13) + i * Math.round(g.size * 0.04);
    const sw = Math.max(2, Math.round(g.size * 0.06)); // solid base width
    const baseX = Math.round(g.cx - off); // left shard; mirrorX makes the pair
    fillPolygon(
      c,
      [
        [baseX - sw, g.bodyTop + 2],
        [baseX + sw, g.bodyTop + 2],
        [baseX - Math.round(g.size * 0.05), g.bodyTop + 2 - h],
      ],
      BODY,
    );
  }
}

/** A single soft SOLID nub-horn for the cute cub (no shards yet). */
function drawNubHorn(c: PixelCanvas, g: CragGeom): void {
  const x = Math.round(g.cx);
  const h = Math.round(g.size * 0.13);
  const w = Math.max(2, Math.round(g.size * 0.08));
  fillPolygon(
    c,
    [
      [x - w, g.bodyTop + 2],
      [x + w, g.bodyTop + 2],
      [x, g.bodyTop - h],
    ],
    BODY,
  );
}

/** The glowing cyan crystal CORE GEM on the chest (the shared kingdom heart). */
function accentCore(c: PixelCanvas, g: CragGeom, r: number): void {
  const cy = Math.round((g.bodyTop + g.bodyBot) / 2) + 1;
  diamond(c, Math.round(g.cx), cy, r, ACCENT_LO);
  diamond(c, Math.round(g.cx), cy, Math.max(1, r - 1), ACCENT_MID);
  c.set(Math.round(g.cx), cy, ACCENT_HI);
}

/** Eyes by maturity: cute = big round catch-lit; keen = round; slit = predator. */
function drawEyes(c: PixelCanvas, g: CragGeom, style: CragOpts['eyeStyle']): void {
  const ey = g.headY;
  const ex = Math.max(2, Math.round(g.size * (style === 'cute' ? 0.16 : 0.13)));
  if (style === 'cute') {
    // Huge sparkly eyes (~50% of the head) + blush — adorable baby.
    const r = Math.max(2, Math.round(g.size * 0.12));
    for (const s of [-1, 1]) {
      const x = Math.round(g.cx + s * ex);
      smallEllipse(c, x, ey, r, r + 1, OUTLINE);
      smallEllipse(c, x, ey, Math.max(1, r - 1), r, ACCENT_MID); // glassy cyan eye
      c.set(x - 1, ey - 1, RIM_HI); // big catch-light
      c.set(x + 1, ey + 1, GLINT); // sparkle pip
      c.set(x + s, ey + r + 1, RIM_HI); // rosy blush below the eye
    }
    return;
  }
  for (const s of [-1, 1]) {
    const x = Math.round(g.cx + s * ex);
    if (style === 'keen') {
      smallEllipse(c, x, ey, 1, 1, OUTLINE);
      c.set(x, ey, GLINT);
      c.set(x - s, ey - 1, OUTLINE); // slight upward keen tilt
    } else {
      // slit: a commanding upward-slanted predator glare.
      c.set(x, ey, OUTLINE);
      c.set(x + s, ey, OUTLINE);
      c.set(x + 2 * s, ey - 1, OUTLINE);
      c.set(x, ey, GLINT);
    }
  }
}

// ---------------------------------------------------------------------------
// The shared Crag Beast builder + its four animation banks.
// ---------------------------------------------------------------------------

function cragBeast(opts: CragOpts): SpriteDef {
  const g = cragGeom(opts.size, opts.rank);
  const rng = lcg(hashStr(opts.id));
  const base = PixelCanvas.create(opts.size, opts.size);

  // 1. Legs (planted stance, left half).
  drawLegs(base, g, opts.legs);

  // 2. Distinct ROUND faceted carapace silhouette (left half).
  SHAPES[opts.shape](base, g);

  // 3. Weapon: cute cub gets one nub horn; everyone else solid blade + shards.
  if (opts.shape === 'cub') drawNubHorn(base, g);
  else drawBladeAndShards(base, g, opts.shards, opts.blade);

  // 4. Structural body-tone motif (cel-shades with the body), left half.
  opts.bodyMotif?.(base, g, rng);

  // 5. Bilateral symmetry, then hard cel shading + rim-light the lit facets.
  mirrorX(base);
  //    onlyBelow:14 protects ACCENT_*/BELLY decals painted afterwards.
  const bands = opts.size >= 28 ? 6 : 5;
  shade(base, { dir: 'upper-left', bands, lo: 4, hi: 12, dither: false, onlyBelow: 14 });

  // 6. Cream belly UNDER the accent, then the ONE cyan signature feature.
  paintBelly(base, g);
  opts.accentMotif?.(base, g, rng);

  rimLight(base, 'upper-left');

  // 7. Blade-tip catch-light, eyes, a couple of bright glints.
  base.set(Math.round(g.cx), g.bodyTop - Math.round(opts.size * 0.13) * opts.blade, RIM_HI);
  drawEyes(base, g, opts.eyeStyle);
  opts.brightMotif?.(base, g, rng);

  // 8. Crisp 1px silhouette LAST.
  outline(base);

  // ---- Animation banks (grounded predator: bob, stomp-walk, pounce, lunge) ----
  const idle = framesFromDeltas(base, [(_f) => {}, (f) => bobInto(f, -1)]);
  const walk = framesFromDeltas(base, [
    (_f) => {},
    (f) => shiftInto(f, 1, 0),
    (f) => bobInto(f, -1),
    (f) => shiftInto(f, -1, 0),
  ]);
  const jump = framesFromDeltas(base, [(f) => shiftInto(f, 0, 1), (f) => shiftInto(f, 0, -2)]);
  const play = framesFromDeltas(base, [(f) => lungeInto(f, g, rng), (f) => shiftInto(f, -1, 0)]);

  return { ...buildSprite(opts.id, idle, opts.fps ?? 4), walk, jump, play };
}

/** Cream BELLY: a soft under-plate on heavier/lower bodies (adds warmth). */
function paintBelly(c: PixelCanvas, g: CragGeom): void {
  const by = g.bodyBot - 1;
  const w = Math.max(1, Math.round(g.halfW * 0.45));
  for (let dx = -w; dx <= w; dx++) {
    const x = Math.round(g.cx + dx);
    if (c.get(x, by) > 0 && c.get(x, by) <= 14) c.set(x, by, BELLY);
    if (c.get(x, by - 1) > 0 && c.get(x, by - 1) <= 14 && Math.abs(dx) < w - 1) {
      c.set(x, by - 1, BELLY);
    }
  }
}

// ---- in-place frame deltas (clone is provided by framesFromDeltas) ----

function bobInto(f: PixelCanvas, dy: number): void {
  const snap = f.clone();
  for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) f.set(x, y, 0);
  snap.forEach((x, y, idx) => f.set(x, y + dy, idx));
}

function shiftInto(f: PixelCanvas, dx: number, dy: number): void {
  const snap = f.clone();
  for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) f.set(x, y, 0);
  snap.forEach((x, y, idx) => f.set(x + dx, y + dy, idx));
}

function lungeInto(f: PixelCanvas, g: CragGeom, _rng: Lcg): void {
  shiftInto(f, 1, 0);
  // a single crystal-spark flares off the leading shard during the pounce
  sparkle(f, Math.round(g.cx + g.halfW + 1), g.bodyTop + 1, GLINT);
}

// ---------------------------------------------------------------------------
// Crag Beasts roster — DISTINCT round lower silhouettes converging to the
// archon archetype; cute cub at sprite, majestic archon boss at apex. House
// red dominant + ONE cyan signature accent (core/shard/glyph) per species.
// ---------------------------------------------------------------------------

// Glyphit (sprite 20) — adorable boulder-cub: round head~=body, huge sparkly
// eyes + blush, one solid nub horn, ONE tiny solid cyan crystal shard.
export function buildGlyphit(): SpriteDef {
  return cragBeast({
    id: 'sprite-glyphit',
    size: 20,
    rank: 0,
    legs: 2,
    shards: 0,
    blade: 1,
    shape: 'cub',
    eyeStyle: 'cute',
    accentMotif: (c, g) => {
      // ONE little solid cyan shard poking from the crown (the baby's first crystal).
      const x = Math.round(g.cx + Math.round(g.size * 0.16));
      fillPolygon(
        c,
        [
          [x - 1, g.bodyTop + 2],
          [x + 2, g.bodyTop + 2],
          [x, g.bodyTop - 2],
        ],
        ACCENT_MID,
      );
      c.set(x, g.bodyTop - 2, ACCENT_HI);
    },
  });
}

// Cipherling (rookie 24) — still cute but bulking up: a sturdy round bulwark cub
// with a small solid shard pair and a glowing cyan chest-core just emerging.
export function buildCipherling(): SpriteDef {
  return cragBeast({
    id: 'sprite-cipherling',
    size: 24,
    rank: 1,
    legs: 2,
    shards: 1,
    blade: 1,
    shape: 'bulwark',
    eyeStyle: 'cute',
    accentMotif: (c, g) => accentCore(c, g, Math.max(2, Math.round(g.size * 0.08))),
  });
}

// Bitfang (rookie 24) — DISTINCT lean upright striker: tall round prism, a high
// brow-blade and ONE pair of solid cyan fangs (its signature).
export function buildBitfang(): SpriteDef {
  return cragBeast({
    id: 'sprite-bitfang',
    size: 24,
    rank: 1,
    legs: 2,
    shards: 1,
    blade: 2,
    shape: 'striker',
    eyeStyle: 'keen',
    fps: 5,
    accentMotif: (c, g) => {
      // ONE pair of solid glowing cyan fangs jutting under the jaw.
      const fy = g.headY + Math.round(g.size * 0.16);
      for (const s of [-1, 1]) {
        const x = Math.round(g.cx + s * Math.round(g.size * 0.1));
        fillPolygon(
          c,
          [
            [x - 1, fy - 1],
            [x + 1, fy - 1],
            [x, fy + 2],
          ],
          ACCENT_MID,
        );
        c.set(x, fy + 2, ACCENT_HI);
      }
    },
  });
}

// Runeclaw (evolved 28) — heavy planted quadruped with ONE pair of big solid
// cyan rune-CLAWS sweeping forward (its signature), sharpening toward the boss.
export function buildRuneclaw(): SpriteDef {
  return cragBeast({
    id: 'sprite-runeclaw',
    size: 28,
    rank: 2,
    legs: 4,
    shards: 2,
    blade: 2,
    shape: 'bulwark',
    eyeStyle: 'keen',
    bodyMotif: (c, g) => {
      // big solid crystal claw wedge sweeping forward from the lower-left flank.
      const x = Math.round(g.cx - (g.halfW + 1));
      fillPolygon(
        c,
        [
          [x + 2, g.bodyBot - 2],
          [x - 4, g.bodyBot - 1],
          [x - 5, g.bodyBot - 5],
          [x + 1, g.bodyBot - 4],
        ],
        BODY,
      );
    },
    accentMotif: (c, g) => {
      // ONE signature: cyan-lit claw edge on each side (mirrored shape) + chest core.
      for (const s of [-1, 1]) {
        const x = Math.round(g.cx + s * (g.halfW + 1));
        thickLine(c, x - s * 5, g.bodyBot - 5, x - s, g.bodyBot - 4, ACCENT_HI, 2);
      }
      accentCore(c, g, Math.round(g.size * 0.06));
    },
  });
}

// Vectorix (evolved 28) — DISTINCT sleek geometric runner: angled wedge body,
// ONE bold solid cyan vector-shard streaking up the faceted shell (its signature).
export function buildVectorix(): SpriteDef {
  return cragBeast({
    id: 'sprite-vectorix',
    size: 28,
    rank: 2,
    legs: 4,
    shards: 2,
    blade: 1,
    shape: 'runner',
    eyeStyle: 'keen',
    fps: 5,
    accentMotif: (c, g) => {
      // ONE bold solid cyan vector chevron on the chest (a clean directional shard).
      const cy = Math.round((g.bodyTop + g.bodyBot) / 2) + 1;
      fillPolygon(
        c,
        [
          [Math.round(g.cx), g.bodyTop + 3],
          [Math.round(g.cx) + 3, cy],
          [Math.round(g.cx), cy - 2],
          [Math.round(g.cx) - 3, cy],
        ],
        ACCENT_MID,
      );
      c.set(Math.round(g.cx), g.bodyTop + 3, ACCENT_HI);
    },
  });
}

// Glyphound (evolved 28) — DISTINCT stalking hound: long low rounded body, a
// crystal muzzle, and ONE solid cyan brand-glyph on the flank (its signature).
export function buildGlyphound(): SpriteDef {
  return cragBeast({
    id: 'sprite-glyphound',
    size: 28,
    rank: 2,
    legs: 4,
    shards: 1,
    blade: 1,
    shape: 'hound',
    eyeStyle: 'keen',
    accentMotif: (c, g) => {
      // ONE clean cyan brand-glyph (a bold filled crystal sigil) on the shoulder.
      const gx = Math.round(g.cx);
      const gy = Math.round((g.bodyTop + g.bodyBot) / 2);
      diamond(c, gx, gy, 2, ACCENT_LO);
      diamond(c, gx, gy, 1, ACCENT_MID);
      c.set(gx, gy, ACCENT_HI);
    },
  });
}

// Cryptarch (prime 32) — CONVERGING to the archon archetype: a regal crown
// shard, a blazing cyan core, a commanding keen glare.
export function buildCryptarch(): SpriteDef {
  return cragBeast({
    id: 'sprite-cryptarch',
    size: 32,
    rank: 3,
    legs: 4,
    shards: 3,
    blade: 2,
    shape: 'archon',
    eyeStyle: 'slit',
    accentMotif: (c, g) => {
      accentCore(c, g, Math.round(g.size * 0.08));
      // a solid cyan crown-jewel shard set above the brow-blade.
      const jy = g.bodyTop - Math.round(g.size * 0.2);
      fillPolygon(
        c,
        [
          [Math.round(g.cx) - 2, jy + 2],
          [Math.round(g.cx) + 2, jy + 2],
          [Math.round(g.cx), jy - 2],
        ],
        ACCENT_MID,
      );
      c.set(Math.round(g.cx), jy - 2, ACCENT_HI);
    },
  });
}

// Matrixion (prime 32) — archon archetype, the decision-engine: a single bold
// blazing cyan core-gem framed by a clean diamond halo (its signature).
export function buildMatrixion(): SpriteDef {
  return cragBeast({
    id: 'sprite-matrixion',
    size: 32,
    rank: 3,
    legs: 4,
    shards: 2,
    blade: 2,
    shape: 'archon',
    eyeStyle: 'slit',
    accentMotif: (c, g) => {
      const cy = Math.round((g.bodyTop + g.bodyBot) / 2) + 1;
      // a big bold core gem (the engine heart).
      diamond(c, Math.round(g.cx), cy, Math.round(g.size * 0.1), ACCENT_LO);
      diamond(c, Math.round(g.cx), cy, Math.round(g.size * 0.06), ACCENT_MID);
      c.set(Math.round(g.cx), cy, ACCENT_HI);
    },
  });
}

// Sigilus (prime 32) — DISTINCT-yet-converging upright archon: a single bold
// solid cyan sigil-shard sealed on the chest (its ever-watching seal).
export function buildSigilus(): SpriteDef {
  return cragBeast({
    id: 'sprite-sigilus',
    size: 32,
    rank: 3,
    legs: 2,
    shards: 2,
    blade: 1,
    shape: 'archon',
    eyeStyle: 'slit',
    accentMotif: (c, g) => {
      const cy = Math.round((g.bodyTop + g.bodyBot) / 2) + 1;
      // ONE bold cyan sigil: a solid downward chest shard + a core pip.
      fillPolygon(
        c,
        [
          [Math.round(g.cx) - 3, cy - 3],
          [Math.round(g.cx) + 3, cy - 3],
          [Math.round(g.cx), cy + 3],
        ],
        ACCENT_MID,
      );
      c.set(Math.round(g.cx), cy - 3, ACCENT_HI);
      c.set(Math.round(g.cx), cy, ACCENT_LO);
    },
  });
}

// Enigmax (apex 36) — MAJESTIC boss: small head on a towering faceted body,
// a bold crown of solid shards, a deep blazing cyan core (the signature).
export function buildEnigmax(): SpriteDef {
  return cragBeast({
    id: 'sprite-enigmax',
    size: 36,
    rank: 4,
    legs: 4,
    shards: 4,
    blade: 3,
    shape: 'archon',
    eyeStyle: 'slit',
    accentMotif: (c, g) => {
      // ONE deep blazing cyan core (the only accent — bold, not a scatter).
      accentCore(c, g, Math.round(g.size * 0.11));
    },
    brightMotif: (c, g) => {
      // a couple of catch-lit shard tips crown the imposing apex silhouette.
      for (const s of [-1, 1]) {
        c.set(Math.round(g.cx + s * Math.round(g.halfW * 0.7)), g.bodyTop - 1, GLINT);
      }
    },
  });
}

// Keystrix (apex 36) — MAJESTIC boss: the master key. A great solid crystal
// key-blade crown + a jeweled cyan core (the signature).
export function buildKeystrix(): SpriteDef {
  return cragBeast({
    id: 'sprite-keystrix',
    size: 36,
    rank: 4,
    legs: 4,
    shards: 3,
    blade: 3,
    shape: 'archon',
    eyeStyle: 'slit',
    bodyMotif: (c, g) => {
      // a solid key-tooth notch block at the base of the tall brow-blade.
      const bx = Math.round(g.cx);
      const by = g.bodyTop - Math.round(g.size * 0.13);
      fillRect(c, bx - 3, by, bx - 1, by + 1, BODY);
    },
    accentMotif: (c, g) => {
      accentCore(c, g, Math.round(g.size * 0.1));
      // a solid jeweled cyan crown gem crowning the great key-blade.
      const jy = g.bodyTop - Math.round(g.size * 0.28);
      fillPolygon(
        c,
        [
          [Math.round(g.cx) - 2, jy + 2],
          [Math.round(g.cx) + 2, jy + 2],
          [Math.round(g.cx), jy - 2],
        ],
        ACCENT_MID,
      );
      c.set(Math.round(g.cx), jy - 2, ACCENT_HI);
    },
    brightMotif: (c, g) => {
      sparkle(c, Math.round(g.cx), g.bodyTop - Math.round(g.size * 0.28), GLINT);
      for (const s of [-1, 1]) {
        c.set(Math.round(g.cx + s * Math.round(g.halfW * 0.7)), g.bodyTop, GLINT);
      }
    },
  });
}

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
