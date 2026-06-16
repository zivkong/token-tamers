/**
 * Flux line sprite designs — the TIDE RUNNERS kingdom (aquatic / swift).
 *
 * LOCKED ART DIRECTION v2 ("octant / cute -> majestic"). Tide Runners are streamlined
 * horizontal swimmers — a teardrop body that faces RIGHT (the renderer flips for left),
 * trailing CURRENT-RIBBONS (the SPD motif), with an electric/light SPARK signature. The
 * House hue (rose-magenta) DOMINATES every form; each species carries ONE signature
 * SECONDARY accent (indices 16/17/18) on a single feature, plus an optional cream BELLY.
 *
 * CUTE -> MAJESTIC ARC:
 *   - sprite/rookie are ADORABLE fish-babies: head ~= body, huge sparkly catch-lit eyes,
 *     blush, stubby nub fins, soft round silhouettes that are DISTINCT per species.
 *   - evolved trims the cuteness; prime/apex CONVERGE on the shared House archetype — a
 *     small head on a tall, finned body with a towering tiered dorsal crown, grand forked
 *     tail and laced current-ribbons. Apex = the most imposing (a majestic sovereign).
 * Eye-to-head ratio SHRINKS sprite->apex; silhouette complexity RISES. Everything stays
 * ROUNDED-BUT-DETAILED: sharp corners softened, thin bits thickened (toyable plush look).
 *
 * NEW OCTANT SIZE LAW: sprite 20 · rookie 24 · evolved 28 · prime 32 · apex 36 (square,
 * even, height divisible by 4). Author flat tones (cel bands, not dither ramps). Every
 * species ships idle + walk + jump + play banks (same dims) via framesFromDeltas.
 * Determinism: seeded LCG (hashStr(id)) — never Math.random / Date.now.
 *
 * NEVER store RGB — only palette INDICES. The renderer resolves House tint + GRADE beauty
 * ladder + the per-species accent at render time (C flat -> S gold-glow).
 */

import type { SpriteDef } from '@token-tamers/core';
import {
  PixelCanvas,
  buildSprite,
  fillEllipse,
  smallEllipse,
  fillCircle,
  fillPolygon,
  strokeEllipse,
  line,
  thickLine,
  shade,
  rimLight,
  outline,
  sparkle,
  eyes,
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

// Flat-tone vocabulary shared by every Tide Runner (House hue resolves these).
const SHADOW = 3;
const BODY = 7;
const LIGHT = 11;

// ---------------------------------------------------------------------------
// Geometry — derived once from the stage size + the "majesty" of the form.
//   majesty 0 = a round baby (head ~= body, wide & short).
//   majesty 1 = a towering sovereign (small head on a tall body ~1:3).
// The body axis stays HORIZONTAL (kingdom law); majesty raises the dorsal mass,
// shrinks the head, and stacks the crown — the cute->majestic arc in one knob.
// ---------------------------------------------------------------------------

interface TideGeom {
  size: number;
  /** Spine height (vertical center of the body mass). */
  cy: number;
  /** Body centre + radii (horizontal teardrop). */
  bodyCx: number;
  bodyRx: number;
  bodyRy: number;
  /** Nose / tail anchor x. */
  noseX: number;
  tailX: number;
  /** Head (the cute babies have a big one; majestic forms a small one). */
  headCx: number;
  headCy: number;
  headR: number;
  /** Eye placement + radius (shrinks with majesty). */
  eyeX: number;
  eyeY: number;
  eyeR: number;
  /** Dorsal crown root (top of the body, where crest spines stack). */
  crownX: number;
  crownTopY: number;
}

function tideGeom(size: number, majesty: number): TideGeom {
  const cy = Math.round(size * (0.5 + majesty * 0.02));
  const bodyCx = Math.round(size * (0.5 - majesty * 0.04));
  // Babies are squat & round (rx~ry); sovereigns are taller (ry grows, rx eases).
  const bodyRx = Math.max(4, Math.round(size * (0.34 - majesty * 0.05)));
  const bodyRy = Math.max(3, Math.round(size * (0.2 + majesty * 0.12)));
  const noseX = bodyCx + bodyRx;
  const tailX = bodyCx - bodyRx;

  // Head: a fat fraction of the body for babies, a small turret for sovereigns.
  const headR = Math.max(2, Math.round(bodyRy * (1.05 - majesty * 0.55)));
  const headCx = noseX - Math.round(bodyRx * (0.28 + majesty * 0.12));
  const headCy = cy - Math.round(bodyRy * majesty * 0.45);

  // Eye: large & low (catch-lit baby) -> small & commanding (boss).
  const eyeR = Math.max(1, Math.round(headR * (0.55 - majesty * 0.32)));
  const eyeX = headCx + Math.round(headR * 0.45);
  const eyeY = headCy + (majesty < 0.5 ? Math.max(0, Math.round(headR * 0.1)) : -1);

  return {
    size,
    cy,
    bodyCx,
    bodyRx,
    bodyRy,
    noseX,
    tailX,
    headCx,
    headCy,
    headR,
    eyeX,
    eyeY,
    eyeR,
    crownX: bodyCx + Math.round(bodyRx * 0.12),
    crownTopY: cy - bodyRy,
  };
}

// ---------------------------------------------------------------------------
// Accent decals — a tiny menu of signature features (one per species).
// Painted AFTER shade with the ACCENT_* indices so the House hue still
// dominates (~70-85%) and the accent reads on one signature feature.
// ---------------------------------------------------------------------------

type AccentKind =
  | 'crest' // a colored dorsal crest / tiered crown (the lineage cue)
  | 'gem' // a round core gem on the flank
  | 'fins' // colored fin webbing (tail + pectoral + dorsal stripe)
  | 'vents' // a row of side spark-vents
  | 'petals' // a radiant petal crown of points (apex regalia)
  | 'eye'; // an accent eye-glow ring

// ---------------------------------------------------------------------------
// Per-species PARAM TABLE — variety from params, cohesion from the builder.
// ---------------------------------------------------------------------------

interface TideParams {
  id: string;
  size: number;
  /** 0 = adorable baby … 1 = majestic sovereign (drives the whole arc). */
  majesty: number;
  /** Dorsal crest spines (stacks into a tiered crown as majesty rises). */
  crest: number;
  /** Extra back-sweep on the crest (leaner / faster look). */
  sweep: number;
  /** Current-ribbon strands trailing off the tail (the SPD motif). */
  ribbons: number;
  /** Signature accent feature + how many marks of it. */
  accent: AccentKind;
  accentCount: number;
  /** Soft cream belly underside (the toyable plush touch). */
  belly: boolean;
  /** Stubby nub pectoral fins (baby cue) vs swept blade fins (majestic). */
  nubFins: boolean;
  /** Rosy cheek blush (babies only). */
  blush: boolean;
  /** idle fps. */
  fps: number;
  /** A bright spark glint flourish (placed last, before outline). */
  spark?: (c: PixelCanvas, g: TideGeom, rng: Lcg) => void;
}

// ---------------------------------------------------------------------------
// Shared drawing primitives.
// ---------------------------------------------------------------------------

/**
 * Per-build scratch list of crest spine leading edges: [tipX, tipY, baseX,
 * baseY, accent]. Populated by drawCrest, consumed by the 'crest'/'petals'
 * accents so the signature color laces the WHOLE crown; reset per species.
 */
let crestSpineEdges: Array<[number, number, number, number, boolean]> = [];

/** A swept-back dorsal crest spine; tip leans toward the tail (left). The
 *  top-most few stack into a tiered crown on majestic forms. */
function drawCrest(
  c: PixelCanvas,
  g: TideGeom,
  i: number,
  p: TideParams,
  accentTip: boolean,
): void {
  const step = Math.max(2, Math.round(g.size * 0.1));
  const baseX = g.crownX - i * step;
  const topY = g.crownTopY;
  // Crown tiers: spines grow TALLER toward the head on majestic forms.
  const grow = p.majesty > 0.5 ? p.crest - i : i;
  const h = Math.round(g.size * 0.11) + grow * Math.round(g.size * 0.05);
  const back = Math.round(g.size * 0.08) + p.sweep;
  // Rounded, thickened spine (a soft fin, not a needle).
  fillPolygon(
    c,
    [
      [baseX + 1, topY + 1],
      [baseX - back, topY - h + 1],
      [baseX - back + 2, topY - h],
      [baseX - back + 3, topY - h + 2],
      [baseX + 3, topY + 1],
    ],
    BODY,
  );
  // Record the spine's leading edge so the post-shade crest accent can lace it.
  crestSpineEdges.push([baseX - back + 1, topY - h + 1, baseX + 1, topY, accentTip]);
}

/** A wavy current-ribbon trailing left off the tail (post-shade so it stays
 *  distinct). Babies get short stubby ribbons; sovereigns long laced ones. */
function drawRibbon(c: PixelCanvas, x0: number, y0: number, len: number, rng: Lcg): void {
  let y = y0;
  for (let i = 0; i < len; i++) {
    const x = x0 - i;
    if (x < 0) break;
    const tail = i >= len - 2;
    c.set(x, y, tail ? SHADOW : i % 4 === 0 ? LIGHT : BODY);
    if (rng.chance(0.45)) y += rng.int(3) - 1;
  }
}

/** A small 5px accent diamond bloom (bright center, soft edges). */
function diamondAccent(c: PixelCanvas, x: number, y: number): void {
  c.set(x, y, ACCENT_HI);
  c.set(x - 1, y, ACCENT_MID);
  c.set(x + 1, y, ACCENT_MID);
  c.set(x, y - 1, ACCENT_MID);
  c.set(x, y + 1, ACCENT_MID);
}

/** Paint the species' signature accent feature (post-shade, protected indices). */
function paintAccent(c: PixelCanvas, g: TideGeom, p: TideParams): void {
  switch (p.accent) {
    case 'gem': {
      // A round core gem on the flank (cute baby spark, boss reactor-core).
      const r = Math.max(1, Math.round(g.bodyRy * 0.5));
      fillCircle(c, g.bodyCx, g.cy, r, ACCENT_MID);
      fillCircle(c, g.bodyCx, g.cy, Math.max(0, r - 1), ACCENT_HI);
      c.set(g.bodyCx - 1, g.cy - 1, RIM_HI);
      break;
    }
    case 'fins': {
      // Recolor the whole tail-fork + pectoral fins in the signature hue — the
      // accent RIDES the swift fins. Only repaint existing body pixels (no
      // strays), keeping the body-hue core intact so the House still dominates.
      const tlen = Math.round(g.size * (0.24 + 0.05));
      for (let dy = -g.size; dy <= g.size; dy++) {
        for (let dx = -tlen - 2; dx <= 2; dx++) {
          const x = g.tailX + dx;
          const y = g.cy + dy;
          if (c.get(x, y) <= 0) continue;
          // tail fork = left of the body centre; web it in accent.
          if (x < g.tailX + 1) {
            const edge = Math.abs(dy) >= Math.abs(dx) - 1;
            c.set(x, y, edge ? ACCENT_HI : ACCENT_MID);
          }
        }
      }
      // A solid dorsal accent stripe along the back + a belly-edge fin line.
      for (let dx = -Math.round(g.bodyRx * 0.6); dx <= Math.round(g.bodyRx * 0.6); dx++) {
        const x = g.bodyCx + dx;
        if (c.get(x, g.cy - g.bodyRy + 1) > 0) c.set(x, g.cy - g.bodyRy + 1, ACCENT_LO);
        if (c.get(x, g.cy + g.bodyRy - 1) > 0 && (dx & 1) === 0) {
          c.set(x, g.cy + g.bodyRy - 1, ACCENT_MID);
        }
      }
      break;
    }
    case 'vents': {
      // A row of side spark-vents along the flank (bright electric ports).
      const n = Math.max(2, p.accentCount);
      for (let i = 0; i < n; i++) {
        const x = g.bodyCx - g.bodyRx + 2 + Math.round((i / (n - 1 || 1)) * (g.bodyRx + 1));
        c.set(x, g.cy + 1, ACCENT_MID);
        c.set(x, g.cy, ACCENT_HI);
        c.set(x, g.cy - 1, ACCENT_LO);
        c.set(x, g.cy + 2, ACCENT_MID);
      }
      break;
    }
    case 'petals': {
      // A radiant fan of accent points arcing over the crown spines (apex
      // regalia). Anchor each petal to a real crest spine tip so it always
      // lands on the silhouette, then thicken into a soft bloom.
      const tips = crestSpineEdges.length
        ? crestSpineEdges
        : [[g.crownX, g.crownTopY - 2, g.crownX, g.crownTopY, true] as const];
      for (const [tx, ty] of tips) {
        const px = Math.max(1, Math.min(g.size - 2, tx));
        const py = Math.max(2, Math.min(g.size - 2, ty - 1));
        // A soft petal bloom on each spine tip + a connecting stem glow.
        diamondAccent(c, px, py);
        c.set(px, py + 1, ACCENT_LO);
        c.set(px, py + 2, ACCENT_MID);
      }
      // A crowning center jewel + a bright accent band along the dorsal crown.
      fillCircle(c, g.crownX, g.crownTopY - Math.round(g.size * 0.12), 1, ACCENT_HI);
      for (let dx = -Math.round(g.bodyRx * 0.7); dx <= Math.round(g.bodyRx * 0.3); dx++) {
        const x = g.crownX + dx;
        if (c.get(x, g.crownTopY) > 0) c.set(x, g.crownTopY, ACCENT_LO);
        if (c.get(x, g.crownTopY + 1) > 0 && (dx & 1) === 0) c.set(x, g.crownTopY + 1, ACCENT_MID);
      }
      break;
    }
    case 'eye': {
      // An accent glow ring around the eye (electric stare).
      strokeEllipse(c, g.eyeX, g.eyeY, g.eyeR + 1, g.eyeR + 1, ACCENT_MID);
      strokeEllipse(c, g.eyeX, g.eyeY, g.eyeR + 2, g.eyeR + 2, ACCENT_LO);
      break;
    }
    case 'crest': {
      // Flood every crown spine with the signature accent — a vivid colored
      // crest that survives shade (these indices are protected). Repaints only
      // body pixels inside each spine's bounding triangle, so no strays.
      for (const [tipX, tipY, baseX, baseY] of crestSpineEdges) {
        const lo = Math.min(tipY, baseY);
        const hi = Math.max(tipY, baseY);
        const x0 = Math.min(tipX, baseX) - 1;
        const x1 = Math.max(tipX, baseX) + 3;
        for (let y = lo; y <= hi; y++) {
          for (let x = x0; x <= x1; x++) {
            if (c.get(x, y) > 0 && c.get(x, y) <= LIGHT) {
              c.set(x, y, y <= lo + 1 ? ACCENT_HI : ACCENT_MID);
            }
          }
        }
      }
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// The shared Tide Runner builder: one parametric swift swimmer + four banks.
// ORDER OF OPS: shapes -> shade -> accent/belly decals -> rimLight -> eyes
//               -> spark -> ribbons -> outline LAST.
// ---------------------------------------------------------------------------

function tideRunner(p: TideParams): SpriteDef {
  const g = tideGeom(p.size, p.majesty);
  const rng = lcg(hashStr(p.id));
  const c = PixelCanvas.create(p.size, p.size);
  crestSpineEdges = [];

  // 1. Streamlined body: horizontal teardrop + a soft pointed snout at the right.
  fillEllipse(c, g.bodyCx, g.cy, g.bodyRx, g.bodyRy, BODY);
  fillPolygon(
    c,
    [
      [g.noseX - 2, g.cy - g.bodyRy + 1],
      [g.noseX + Math.round(p.size * 0.06), g.cy],
      [g.noseX - 2, g.cy + g.bodyRy - 1],
    ],
    BODY,
  );

  // 2. Head turret (big & round for babies; a small commanding dome for bosses).
  fillCircle(c, g.headCx, g.headCy, g.headR, BODY);

  // 3. Grand forked tail at the left (thickened so it reads as a soft fin).
  const tlen = Math.round(p.size * (0.2 + p.majesty * 0.08));
  const th = Math.round(p.size * (0.15 + p.majesty * 0.06));
  fillPolygon(
    c,
    [
      [g.tailX + 2, g.cy],
      [g.tailX - tlen, g.cy - th],
      [g.tailX - tlen + 2, g.cy - Math.round(th * 0.4)],
      [g.tailX - Math.round(tlen * 0.35), g.cy],
    ],
    BODY,
  );
  fillPolygon(
    c,
    [
      [g.tailX + 2, g.cy],
      [g.tailX - tlen, g.cy + th],
      [g.tailX - tlen + 2, g.cy + Math.round(th * 0.4)],
      [g.tailX - Math.round(tlen * 0.35), g.cy],
    ],
    BODY,
  );

  // 4. Dorsal crest / tiered crown (records spine edges for the crest accent).
  for (let i = 0; i < p.crest; i++) {
    drawCrest(c, g, i, p, i >= p.crest - Math.max(1, p.accentCount));
  }

  // 5. Pectoral fins: stubby cute nubs vs swept majestic blades.
  if (p.nubFins) {
    fillCircle(c, g.bodyCx - 1, g.cy + g.bodyRy, Math.max(1, Math.round(p.size * 0.07)), BODY);
    fillCircle(c, g.bodyCx + Math.round(g.bodyRx * 0.4), g.cy + g.bodyRy, 1, BODY);
  } else {
    fillPolygon(
      c,
      [
        [g.bodyCx, g.cy + g.bodyRy - 1],
        [g.bodyCx - Math.round(p.size * 0.14), g.cy + g.bodyRy + Math.round(p.size * 0.12)],
        [g.bodyCx - Math.round(p.size * 0.04), g.cy + g.bodyRy + Math.round(p.size * 0.13)],
        [g.bodyCx + 3, g.cy + g.bodyRy],
      ],
      BODY,
    );
  }

  // 6. Cel shading lit from upper-left (protect accent/belly: onlyBelow RIM_HI).
  const bands = p.size >= 28 ? 6 : 5;
  shade(c, { dir: 'upper-left', bands, lo: SHADOW, hi: LIGHT, dither: false, onlyBelow: RIM_HI });

  // 7. Signature accent + optional cream belly (post-shade so they survive).
  if (p.belly) {
    // A soft underside swatch (lower half of the body teardrop).
    for (let dx = -g.bodyRx + 1; dx <= g.bodyRx - 1; dx++) {
      const x = g.bodyCx + dx;
      const yy = g.cy + Math.max(1, g.bodyRy - 1);
      if (c.get(x, yy) > 0) c.set(x, yy, BELLY);
      if (c.get(x, yy - 1) > 0 && rng.chance(0.5)) c.set(x, yy - 1, BELLY);
    }
  }
  paintAccent(c, g, p);

  // 8. Rim-light the wet, lit top edge (the signature pop).
  rimLight(c, 'upper-left');

  // 9. Eyes: BIG sparkly catch-lit baby eyes -> small commanding boss eyes.
  if (p.majesty < 0.45) {
    smallEllipse(c, g.eyeX, g.eyeY, g.eyeR, g.eyeR, OUTLINE);
    // Big bright catch-light makes it adorable.
    c.set(g.eyeX - 1, g.eyeY - 1, RIM_HI);
    c.set(g.eyeX, g.eyeY - 1, GLINT);
    c.set(g.eyeX + 1, g.eyeY, LIGHT);
  } else {
    eyes(c, g.eyeX, g.eyeY, p.majesty > 0.75 ? 'wide' : 'round');
    if (p.majesty > 0.75) c.set(g.eyeX, g.eyeY - 1, GLINT);
  }

  // 10. Blush (babies only) — two soft rosy cheek dots under the eye.
  if (p.blush) {
    c.set(g.headCx + 2, g.headCy + g.headR, ACCENT_LO);
    c.set(g.headCx + 3, g.headCy + g.headR, ACCENT_LO);
  }

  // 11. The electric spark flourish (bright glints), placed late to survive.
  p.spark?.(c, g, rng);

  // 12. Current-ribbons stream off the tail.
  for (let j = 0; j < p.ribbons; j++) {
    drawRibbon(
      c,
      g.tailX - tlen,
      g.cy + Math.round((j - (p.ribbons - 1) / 2) * 2),
      Math.round(p.size * (0.34 + p.majesty * 0.14)),
      rng,
    );
  }

  // 13. Crisp 1px silhouette LAST.
  outline(c);

  // ---- Animation banks (a swimmer: dart, leap, zig-zag) ----
  const sparkleX = g.noseX + 1;
  const idle = framesFromDeltas(c, [(f) => void f, (f) => shiftDown(f, 1)]);
  const walk = framesFromDeltas(c, [
    (f) => void f,
    (f) => shiftDX(f, 1, -1),
    (f) => shiftDown(f, 1),
    (f) => shiftDX(f, -1, -1),
  ]);
  const jump = framesFromDeltas(c, [
    (f) => shiftDown(f, 1),
    (f) => shiftDX(f, 0, -2),
    (f) => shiftDX(f, 0, -1),
  ]);
  const play = framesFromDeltas(c, [
    (f) => {
      shiftDX(f, 1, -1);
      sparkle(f, sparkleX, g.cy, GLINT);
    },
    (f) => shiftDX(f, -1, 1),
  ]);

  return { ...buildSprite(p.id, idle, p.fps), walk, jump, play };
}

/** In-place vertical shift of a frame clone (preserves dims). */
function shiftDown(f: PixelCanvas, dy: number): void {
  shiftDX(f, 0, dy);
}

/** In-place (dx,dy) shift of a frame clone (samples then rewrites). */
function shiftDX(f: PixelCanvas, dx: number, dy: number): void {
  const snap: Array<[number, number, number]> = [];
  f.forEach((x, y, idx) => snap.push([x, y, idx]));
  for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) f.set(x, y, 0);
  for (const [x, y, idx] of snap) f.set(x + dx, y + dy, idx);
}

// ===========================================================================
// THE FLUX ROSTER — distinct cute babies -> a convergent majestic apex.
//   majesty climbs sprite(.05) -> rookie(.2) -> evolved(.45) -> prime(.72)
//   -> apex(.95). Lower stages get DISTINCT silhouettes (varied accents,
//   fin styles, body proportions); prime/apex converge on the House archetype.
// ===========================================================================

// --- sprite (20) — the adorable spark-minnow baby, glowing core-gem ---
export function buildSparkit(): SpriteDef {
  return tideRunner({
    id: 'sprite-sparkit',
    size: 20,
    majesty: 0.05,
    crest: 1,
    sweep: 1,
    ribbons: 1,
    accent: 'gem',
    accentCount: 1,
    belly: true,
    nubFins: true,
    blush: true,
    fps: 5,
    spark: (c, g) => sparkle(c, g.noseX, g.cy - 1, GLINT),
  });
}

// --- rookie (24) — smooth round glider, ribbon-tailed fin-finned cutie ---
export function buildFluxling(): SpriteDef {
  return tideRunner({
    id: 'sprite-fluxling',
    size: 24,
    majesty: 0.2,
    crest: 1,
    sweep: 1,
    ribbons: 2,
    accent: 'fins',
    accentCount: 1,
    belly: true,
    nubFins: true,
    blush: true,
    fps: 4,
  });
}

// --- rookie (24) — static-zipper baby: forked bolt + spark-vents (DISTINCT) ---
export function buildVoltby(): SpriteDef {
  return tideRunner({
    id: 'sprite-voltby',
    size: 24,
    majesty: 0.2,
    crest: 2,
    sweep: 3,
    ribbons: 1,
    accent: 'vents',
    accentCount: 3,
    belly: true,
    nubFins: true,
    blush: true,
    fps: 6,
    spark: (c, g) => {
      // A forked static bolt off the tail (its electric signature).
      line(c, g.tailX - 2, g.cy, g.tailX - 5, g.cy - 3, GLINT);
      line(c, g.tailX - 5, g.cy - 3, g.tailX - 4, g.cy - 5, GLINT);
    },
  });
}

// --- evolved (28) — broad-finned endurance cruiser (trimming the baby fat) ---
export function buildArcfin(): SpriteDef {
  return tideRunner({
    id: 'sprite-arcfin',
    size: 28,
    majesty: 0.45,
    crest: 2,
    sweep: 1,
    ribbons: 2,
    accent: 'fins',
    accentCount: 2,
    belly: true,
    nubFins: false,
    blush: false,
    fps: 4,
  });
}

// --- evolved (28) — blink-swift after-image tempo runner, electric eye ---
export function buildPhotonix(): SpriteDef {
  return tideRunner({
    id: 'sprite-photonix',
    size: 28,
    majesty: 0.45,
    crest: 3,
    sweep: 3,
    ribbons: 1,
    accent: 'eye',
    accentCount: 1,
    belly: false,
    nubFins: false,
    blush: false,
    fps: 6,
    spark: (c, g) => {
      // After-image streaks behind the body.
      for (let i = 1; i <= 3; i++) c.set(g.tailX - i * 2, g.cy, i % 2 ? GLINT : LIGHT);
    },
  });
}

// --- evolved (28) — wide wing-finned breadth swimmer + core gem ---
export function buildSurgewing(): SpriteDef {
  return tideRunner({
    id: 'sprite-surgewing',
    size: 28,
    majesty: 0.45,
    crest: 2,
    sweep: 1,
    ribbons: 3,
    accent: 'gem',
    accentCount: 1,
    belly: false,
    nubFins: false,
    blush: false,
    fps: 4,
    spark: (c, g) => {
      // Upper fanned wing-fin highlight.
      thickLine(
        c,
        g.bodyCx,
        g.cy - g.bodyRy,
        g.bodyCx - Math.round(g.size * 0.12),
        g.cy - g.bodyRy - Math.round(g.size * 0.06),
        RIM_HI,
        1,
      );
    },
  });
}

// --- prime (32) — storm-hunter, converging on the House archetype ---
export function buildStormlynx(): SpriteDef {
  return tideRunner({
    id: 'sprite-stormlynx',
    size: 32,
    majesty: 0.72,
    crest: 3,
    sweep: 2,
    ribbons: 2,
    accent: 'crest',
    accentCount: 2,
    belly: false,
    nubFins: false,
    blush: false,
    fps: 4,
    spark: (c, g) => {
      // A lightning glint laced along the spine.
      for (let i = 0; i < 4; i++) c.set(g.bodyCx - 4 + i * 3, g.cy - 1 + (i % 2), GLINT);
    },
  });
}

// --- prime (32) — living lantern, radiant core gem + halo ---
export function buildLuminaire(): SpriteDef {
  return tideRunner({
    id: 'sprite-luminaire',
    size: 32,
    majesty: 0.72,
    crest: 3,
    sweep: 1,
    ribbons: 2,
    accent: 'gem',
    accentCount: 1,
    belly: false,
    nubFins: false,
    blush: false,
    fps: 4,
    spark: (c, g) => {
      sparkle(c, g.bodyCx, g.cy, GLINT);
      strokeEllipse(c, g.bodyCx, g.cy, g.bodyRx + 2, g.bodyRy + 2, GLINT);
    },
  });
}

// --- prime (32) — calm charged drifter, stilling current-aura + crest ---
export function buildIonyx(): SpriteDef {
  return tideRunner({
    id: 'sprite-ionyx',
    size: 32,
    majesty: 0.72,
    crest: 3,
    sweep: 1,
    ribbons: 3,
    accent: 'crest',
    accentCount: 2,
    belly: false,
    nubFins: false,
    blush: false,
    fps: 3,
    spark: (c, g) => strokeEllipse(c, g.bodyCx, g.cy, g.bodyRx + 3, g.bodyRy + 3, GLINT),
  });
}

// --- apex (36) — the storm-core sovereign: tiered crown + clustered core ---
export function buildVoltaicore(): SpriteDef {
  return tideRunner({
    id: 'sprite-voltaicore',
    size: 36,
    majesty: 0.95,
    crest: 4,
    sweep: 1,
    ribbons: 3,
    accent: 'gem',
    accentCount: 1,
    belly: false,
    nubFins: false,
    blush: false,
    fps: 4,
    spark: (c, g) => {
      sparkle(c, g.bodyCx, g.cy, GLINT);
      sparkle(c, g.bodyCx - 5, g.cy - 2, GLINT);
      sparkle(c, g.bodyCx + 5, g.cy + 1, GLINT);
    },
  });
}

// --- apex (36) — the radiant-crowned sovereign: petal crown + current halo ---
export function buildRadiantus(): SpriteDef {
  return tideRunner({
    id: 'sprite-radiantus',
    size: 36,
    majesty: 0.95,
    crest: 4,
    sweep: 2,
    ribbons: 4,
    accent: 'petals',
    accentCount: 5,
    belly: false,
    nubFins: false,
    blush: false,
    fps: 4,
    spark: (c, g) => {
      strokeEllipse(c, g.bodyCx, g.cy, g.bodyRx + 3, g.bodyRy + 3, GLINT);
      for (let i = 0; i < 4; i++) c.set(g.bodyCx - 6 + i * 4, g.crownTopY - 1, RIM_HI);
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
