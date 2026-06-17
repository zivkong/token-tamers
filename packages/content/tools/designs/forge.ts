/**
 * Forge line sprite designs — the IRON BROOD kingdom (robots / constructs / automatons).
 *
 * Art direction v2 ("octant / cute -> majestic"), HARD-METAL pass (2026-06-17). The Iron
 * Brood are BOXY RIVETED CONSTRUCTS — never soft, never organic, never teddy-bear:
 *
 *  - BOXY RIVETED PLATING: bodies are hard-edged rectangular plates (fillRect / straight-edged
 *    fillPolygon) with FLAT tops and ANGULAR shoulders (single-pixel chamfers, NOT round
 *    blobs). Bolt/rivet studs (RIM_HI dots over an OUTLINE shadow) march along every plate
 *    seam and corner.
 *  - METALLIC SHEEN: a crisp 1px RIM_HI specular strip runs along the top edge of each plate
 *    (a hard highlight line, not a soft gradient) so the panels read as polished metal.
 *  - HARD SILHOUETTE: segmented mechanical limbs/joints (boxy elbows), antenna + vent stacks,
 *    angular pauldrons. No round bellies, no round ears.
 *  - EMBER GLOW = the accent ONLY: the warm orange/gold ACCENT_* + GLINT is CONCENTRATED into
 *    VENTS, SEAMS, EYES and a glowing CORE — never a coat over the whole body. The plating uses
 *    the steely orange-bronze house ramp so it reads as METAL with ember accents (no brown mud).
 *  - CUTE -> MAJESTIC: the baby (emberit) is a tiny boxy bot with big glowing visor-eyes and a
 *    stubby antenna — charming, but unmistakably a ROBOT. Each stage hardens; the apex
 *    (magmarok / adamantor) is a majestic armored titan: small head on a tall plated tower,
 *    crowned core, massive pauldrons, a commanding eye-band.
 *  - DISTINCT -> CONVERGE: sprite/rookie/evolved get varied chassis (pot-block, treaded roller,
 *    spark-cub, anvil, piston, drum) so the line never reads "too similar"; prime/apex converge
 *    to the shared boss-tower archetype.
 *  - INDICES ONLY — never RGB. The renderer resolves House tint + grade ladder + the
 *    per-species accent (hot-gold ember ~#ffd23f) at render time.
 *
 * Octant size law: sprite 20 · rookie 24 · evolved 28 · prime 32 · apex 36 (square, even,
 * height divisible by 4). Every species ships idle + walk + jump + play banks (same dims)
 * via framesFromDeltas. Determinism: seeded LCG (hashStr(id)) — never Math.random / Date.now.
 */

import type { SpriteDef } from '@token-tamers/core';
import {
  PixelCanvas,
  buildSprite,
  framesFromDeltas,
  fillRect,
  fillPolygon,
  smallEllipse,
  fillCircle,
  line,
  diamond,
  shade,
  rimLight,
  outline,
  eyes,
  sparkle,
  lcg,
  hashStr,
  type Lcg,
  type EyeStyle,
  OUTLINE,
  RIM_HI,
  GLINT,
  ACCENT_LO,
  ACCENT_MID,
  ACCENT_HI,
  BELLY,
} from '../sprite-lib';

// Plate-tone vocabulary shared by every Iron Brood construct (steely orange-bronze ramp).
const SEAM = 2; // dark plate seam / panel gap (recessed groove)
const PLATE = 7; // mid plate body
const PLATE_HI = 11; // lit plate face

/** Body silhouette families — distinct at the low stages, converging up the line. */
type Plan =
  | 'chibi' // sprite: little boxy baby bot, head ~= body, antenna
  | 'roller' // treaded plodder, wide low tread base
  | 'cub' // scrappy spark-cub with a raised piston arm
  | 'anvil' // squat anvil block, flared angular shoulders
  | 'piston' // tall narrow hammerer with stack-horns
  | 'kiln' // segmented drum kiln, vent rings all around
  | 'tower' // prime/apex boss-mech tower
  | 'titan'; // apex pinnacle: crowned core + massive pauldrons

interface ForgeGeom {
  size: number;
  cx: number;
  groundY: number;
  bodyBot: number;
  bodyTop: number;
  headTop: number;
  headBot: number;
  halfW: number;
  headHalf: number;
}

interface ForgeOpts {
  id: string;
  size: number;
  plan: Plan;
  /** Ember-vent seam rows across the chassis (grows up the line). */
  vents: number;
  /** Chimney-stacks / exhausts venting on top. */
  stacks: number;
  /** Rivet-stud density tier (seam rows of studs). */
  studs: number;
  /** Eye style for the visor face (cute -> commanding). */
  eye: EyeStyle;
  /** Eye-band vertical half-extent as a fraction of head height (shrinks up the line). */
  eyeScale: number;
  /** A stubby antenna mast on the head (baby charm — still a robot). */
  antenna?: boolean;
  /** Big angular side arms / pauldrons (converging archetype at prime/apex). */
  arms?: boolean;
  /** Cream belly plate panel (a bolted-on chest plate). */
  belly?: boolean;
  /** Glowing core medallion at chest center (prime/apex boss cue). */
  core?: boolean;
  /** Crown of rivet-spikes across the head (apex majesty). */
  crown?: boolean;
  fps?: number;
  /** Extra structural plates, drawn BEFORE shade (so they cel-shade as metal). */
  plateMotif?: (c: PixelCanvas, g: ForgeGeom, rng: Lcg) => void;
  /** Accent decals (ember glow, gems), drawn AFTER shade+rim, BEFORE eyes/outline. */
  accentMotif?: (c: PixelCanvas, g: ForgeGeom, rng: Lcg) => void;
}

/**
 * Stage geometry. The proportion is the cute->majestic lever: small stages keep a big
 * head close to the body; the boss stages drop the head small atop a tall chassis.
 */
function forgeGeom(size: number, plan: Plan): ForgeGeom {
  const cx = (size - 1) / 2;
  const groundY = size - 1;
  // Head share of total height: large for chibi, small for the boss tower.
  const headShare =
    plan === 'chibi'
      ? 0.4
      : plan === 'cub' || plan === 'roller'
        ? 0.34
        : plan === 'titan'
          ? 0.2
          : plan === 'tower'
            ? 0.24
            : 0.3;
  const footH = Math.max(2, Math.round(size * 0.1));
  const headTop = Math.max(1, Math.round(size * 0.06));
  const headBot = Math.round(headTop + size * headShare);
  const bodyTop = headBot - 1; // chassis tucks just under the head
  const bodyBot = groundY - footH;
  // Body width: wide squat base for low stages, statelier taper for the tower.
  const widthShare =
    plan === 'roller' || plan === 'anvil' || plan === 'kiln'
      ? 0.4
      : plan === 'titan' || plan === 'tower'
        ? 0.34
        : plan === 'piston'
          ? 0.28
          : 0.36;
  const headWShare = plan === 'chibi' ? 0.32 : plan === 'titan' || plan === 'tower' ? 0.2 : 0.26;
  return {
    size,
    cx,
    groundY,
    bodyBot,
    bodyTop,
    headTop,
    headBot,
    halfW: Math.round(size * widthShare),
    headHalf: Math.round(size * headWShare),
  };
}

/**
 * Chamfer the four corners of a plate rect with a single hard diagonal cut (an angular
 * BEVEL, not a soft round). `r` cells are sliced off each corner along a straight 45°
 * edge — this is what gives the Iron Brood its hard mechanical shoulders.
 */
function bevelCorners(
  c: PixelCanvas,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
): void {
  for (let i = 0; i < r; i++) {
    for (let j = 0; j + i < r; j++) {
      c.set(x0 + i, y0 + j, 0);
      c.set(x1 - i, y0 + j, 0);
      c.set(x0 + i, y1 - j, 0);
      c.set(x1 - i, y1 - j, 0);
    }
  }
}

/** A crisp 1px specular sheen strip along the top edge of a plate (polished-metal cue). */
function sheenStrip(c: PixelCanvas, x0: number, x1: number, y: number): void {
  for (let x = Math.round(x0); x <= Math.round(x1); x++) {
    if (c.get(x, y) > 0) c.set(x, y, RIM_HI);
  }
}

/** A single rivet stud: a bright bolt head over a 1px cast shadow (reads as raised metal). */
function rivet(c: PixelCanvas, x: number, y: number): void {
  const rx = Math.round(x);
  const ry = Math.round(y);
  if (c.get(rx, ry) <= 0) return;
  c.set(rx, ry, RIM_HI);
  if (c.get(rx, ry + 1) > 0) c.set(rx, ry + 1, SEAM);
}

/** Segmented boxy feet (hard nub feet for babies, wide treads for the heavies). */
function drawFeet(c: PixelCanvas, g: ForgeGeom, plan: Plan): void {
  const footW = Math.max(1, Math.round(g.size * (plan === 'piston' ? 0.07 : 0.1)));
  const span = Math.round(g.halfW * (plan === 'kiln' || plan === 'roller' ? 0.6 : 0.5));
  for (const s of [-1, 1]) {
    const x = Math.round(g.cx + s * span);
    // ankle joint block + foot plate (boxy, segmented)
    fillRect(c, x - footW + 1, g.bodyBot, x + footW - 1, g.groundY, PLATE);
    line(c, x - footW + 1, g.bodyBot, x + footW - 1, g.bodyBot, SEAM); // joint seam
  }
}

/** A wide treaded skirt with link grooves (roller / heavy bases). */
function drawTreads(c: PixelCanvas, g: ForgeGeom): void {
  const x0 = Math.round(g.cx - g.halfW - 1);
  const x1 = Math.round(g.cx + g.halfW + 1);
  fillRect(c, x0, g.bodyBot - 1, x1, g.bodyBot + 1, PLATE);
  for (let x = x0 + 1; x <= x1 - 1; x += 2) line(c, x, g.bodyBot - 1, x, g.bodyBot + 1, SEAM);
}

/** The plated chassis body — hard rectangular panels with angular bevels (varies by plan). */
function drawChassis(c: PixelCanvas, g: ForgeGeom, plan: Plan): void {
  const x0 = Math.round(g.cx - g.halfW);
  const x1 = Math.round(g.cx + g.halfW);
  if (plan === 'kiln') {
    // Segmented drum kiln: a stack of boxy plate rings, NOT a soft ellipse.
    const top = g.bodyTop;
    const bot = g.bodyBot;
    const rings = 3;
    for (let r = 0; r < rings; r++) {
      const ry0 = Math.round(top + ((bot - top) * r) / rings);
      const ry1 = Math.round(top + ((bot - top) * (r + 1)) / rings) - 1;
      // each ring is slightly inset at the very top/bottom to imply a barrel, but stays boxy
      const inset = r === 0 ? 1 : 0;
      fillRect(c, x0 + inset, ry0, x1 - inset, ry1, PLATE);
      line(c, x0, ry1, x1, ry1, SEAM); // ring seam
    }
    bevelCorners(c, x0, top, x1, bot, 1);
  } else {
    fillRect(c, x0, g.bodyTop, x1, g.bodyBot, PLATE);
    // hard angular shoulder bevel (bigger chamfer on the chunky low-stage bots)
    const r = plan === 'chibi' || plan === 'cub' ? 2 : plan === 'anvil' ? 1 : 1;
    bevelCorners(c, x0, g.bodyTop, x1, g.bodyBot, r);
  }
  if (plan === 'roller') drawTreads(c, g);
  // a recessed mid-belt seam splitting the chassis into stacked plates
  const beltY = Math.round((g.bodyTop + g.bodyBot) / 2);
  line(c, x0 + 1, beltY, x1 - 1, beltY, SEAM);
}

/** The head block + visor band — a hard plated cube (cute big eyes for babies, eye-band for bosses). */
function drawHead(c: PixelCanvas, g: ForgeGeom, plan: Plan): void {
  const x0 = Math.round(g.cx - g.headHalf);
  const x1 = Math.round(g.cx + g.headHalf);
  fillRect(c, x0, g.headTop, x1, g.headBot, PLATE);
  const r = plan === 'chibi' || plan === 'cub' ? 1 : 1;
  bevelCorners(c, x0, g.headTop, x1, g.headBot, r);
  // a neck seam where the head meets the chassis
  line(c, x0 + 1, g.headBot, x1 - 1, g.headBot, SEAM);
}

/** A stubby antenna mast with a glowing tip — baby charm that still reads as a robot. */
function drawAntenna(c: PixelCanvas, g: ForgeGeom): void {
  const h = Math.max(2, Math.round(g.size * 0.16));
  const ax = Math.round(g.cx - Math.max(1, Math.round(g.headHalf * 0.4)));
  fillRect(c, ax, g.headTop - h, ax, g.headTop - 1, PLATE);
  c.set(ax, g.headTop - h, ACCENT_HI); // glowing bulb tip
  c.set(ax, g.headTop - h - 1, ACCENT_MID);
}

/** Ember-vent seam rows: dark recessed grooves glowing hot inside (ACCENT core + GLINT). */
function drawVents(c: PixelCanvas, g: ForgeGeom, rows: number): void {
  for (let r = 0; r < rows; r++) {
    const y = g.bodyTop + Math.round((g.bodyBot - g.bodyTop) * ((r + 1) / (rows + 1)));
    const w = g.halfW - 2;
    const xl = Math.round(g.cx - w);
    const xr = Math.round(g.cx + w);
    line(c, xl, y, xr, y, SEAM); // dark groove
    line(c, xl, y - 1, xr, y - 1, SEAM); // groove lip (2px recess)
    for (let x = xl + 1; x <= xr - 1; x++) c.set(x, y, ACCENT_MID); // hot filament
    for (let x = xl + 1; x <= xr - 1; x += 2) c.set(x, y, ACCENT_HI); // brightest glints
    for (let x = xl + 1; x <= xr - 1; x += 3) c.set(x, y - 1, ACCENT_LO); // heat-halo above
  }
}

/** Chimney exhaust stacks venting on top of the shoulders (boxy, with a glowing mouth). */
function drawStacks(c: PixelCanvas, g: ForgeGeom, count: number): void {
  const h = Math.max(2, Math.round(g.size * 0.13));
  for (let i = 0; i < count; i++) {
    const sx = Math.round(
      g.cx + (count === 1 ? 0 : (i / (count - 1) - 0.5) * 2 * (g.headHalf + 2)),
    );
    fillRect(c, sx - 1, g.headBot - h, sx + 1, g.headBot, PLATE);
    sheenStrip(c, sx - 1, sx + 1, g.headBot - h); // sheen on the stack rim
    c.set(sx, g.headBot - h, ACCENT_HI); // glowing exhaust mouth
    c.set(sx, g.headBot - h - 1, ACCENT_MID);
  }
}

/** The visor / eye band — the lineage motif. Cute glowing visor optics -> commanding band. */
function drawFace(c: PixelCanvas, g: ForgeGeom, opts: ForgeOpts): void {
  const midY = Math.round(g.headTop + (g.headBot - g.headTop) * 0.5);
  const half = Math.max(1, Math.round(g.headHalf * opts.eyeScale));
  if (opts.eye === 'wide' || opts.eye === 'round') {
    // Two big glowing visor lenses (babies & rookies) — a recessed dark visor slot with
    // hot optic cores and a hard catch-light. Boxy lens housings, not round cartoon eyes.
    const ex = Math.max(2, Math.round(g.headHalf * 0.5));
    const lensR = opts.eye === 'wide' ? 2 : 1;
    // recessed visor band behind the lenses
    fillRect(
      c,
      Math.round(g.cx - ex - lensR),
      midY - 1,
      Math.round(g.cx + ex + lensR),
      midY + 1,
      SEAM,
    );
    for (const s of [-1, 1]) {
      const exx = Math.round(g.cx + s * ex);
      smallEllipse(c, exx, midY, lensR, lensR, OUTLINE);
      c.set(exx, midY, ACCENT_MID);
      c.set(exx - s, midY, ACCENT_HI);
      c.set(exx + s, midY - 1, RIM_HI); // hard catch-light
    }
  } else if (opts.eye === 'sleepy') {
    // A single wide commanding visor band (bosses) — a recessed slot with a hot scanner line.
    const xl = Math.round(g.cx - half);
    const xr = Math.round(g.cx + half);
    fillRect(c, xl, midY - 1, xr, midY + 1, SEAM);
    line(c, xl, midY, xr, midY, OUTLINE);
    for (let x = xl + 1; x <= xr - 1; x += 2) c.set(x, midY, ACCENT_HI);
    c.set(Math.round(g.cx), midY, GLINT); // a central scanner glint
  } else {
    eyes(c, Math.round(g.cx), midY, 'dot');
    c.set(Math.round(g.cx), midY, ACCENT_HI);
  }
}

/** Big angular side arms / pauldrons — the converging heavy-mech archetype (boxy, segmented). */
function drawArms(c: PixelCanvas, g: ForgeGeom, plan: Plan): void {
  const armH = Math.round((g.bodyBot - g.bodyTop) * (plan === 'titan' ? 0.5 : 0.42));
  const armW = Math.max(2, Math.round(g.size * 0.1));
  const top = g.bodyTop + 1;
  for (const s of [-1, 1]) {
    const xIn = Math.round(g.cx + s * (g.halfW + 1));
    const xOut = xIn + s * armW;
    const lx = Math.min(xIn, xOut);
    const rx = Math.max(xIn, xOut);
    // angular pauldron: a hard trapezoid slab (flat top, sloped outer underside)
    fillPolygon(
      c,
      [
        [lx, top],
        [rx, top],
        [rx, top + armH - 1],
        [lx, top + armH],
      ],
      PLATE,
    );
    sheenStrip(c, lx, rx, top); // hard specular top edge
    // a boxy forearm segment hanging below the pauldron
    const fx = Math.round(g.cx + s * (g.halfW + 1));
    fillRect(
      c,
      fx,
      top + armH,
      fx + s * Math.max(1, armW - 1),
      top + armH + Math.round(armH * 0.6),
      PLATE,
    );
    line(c, fx, top + armH, fx + s * Math.max(1, armW - 1), top + armH, SEAM); // elbow joint
  }
}

/** The shared Iron Brood builder: one parametric construct + its four anim banks. */
function forgeBot(opts: ForgeOpts): SpriteDef {
  const plan = opts.plan;
  const g = forgeGeom(opts.size, plan);
  const rng = lcg(hashStr(opts.id));
  const c = PixelCanvas.create(opts.size, opts.size);

  // 1. Big arms/pauldrons behind the body (drawn first so the chassis overlaps them).
  if (opts.arms) drawArms(c, g, plan);

  // 2. Feet, chassis, head.
  drawFeet(c, g, plan);
  drawChassis(c, g, plan);
  drawHead(c, g, plan);
  if (opts.antenna) drawAntenna(c, g);

  // 3. Structural extra plates (per species).
  opts.plateMotif?.(c, g, rng);

  // 4. Hard cel shading lit from upper-left (flat, no dither = crisp metal facets).
  //    Steely orange-bronze range (lo 4 .. hi 11) avoids a muddy brown wash.
  //    onlyBelow:14 protects any accent decals already placed (none yet here).
  const bands = opts.size >= 28 ? 6 : 5;
  shade(c, { dir: 'upper-left', bands, lo: 4, hi: 11, dither: false, onlyBelow: 14 });

  // 5. Crisp metallic SHEEN: a hard specular strip along the top edge of the head + chassis.
  sheenStrip(c, g.cx - g.headHalf + 1, g.cx + g.headHalf - 1, g.headTop);
  sheenStrip(c, g.cx - g.halfW + 1, g.cx + g.halfW - 1, g.bodyTop);
  rimLight(c, 'upper-left');

  // 6. Bolted-on chest plate (paint AFTER shade so it keeps its own tone) — a hard panel.
  if (opts.belly) {
    const by0 = Math.round(g.bodyTop + (g.bodyBot - g.bodyTop) * 0.26);
    const by1 = Math.round(g.bodyBot - 2);
    const bhx = Math.max(2, Math.round(g.halfW * 0.5));
    fillRect(c, Math.round(g.cx - bhx), by0, Math.round(g.cx + bhx), by1, BELLY);
    bevelCorners(c, Math.round(g.cx - bhx), by0, Math.round(g.cx + bhx), by1, 1);
    // bolts at the chest-plate corners
    rivet(c, g.cx - bhx, by0);
    rivet(c, g.cx + bhx, by0);
    rivet(c, g.cx - bhx, by1 - 1);
    rivet(c, g.cx + bhx, by1 - 1);
  }

  // 7. Ember-vents + stacks + glowing core medallion (concentrated warm glow).
  drawVents(c, g, opts.vents);
  if (opts.stacks > 0) drawStacks(c, g, opts.stacks);
  if (opts.core) {
    const cyc = Math.round((g.bodyTop + g.bodyBot) / 2);
    const cr = Math.max(2, Math.round(g.halfW * 0.34));
    fillCircle(c, g.cx, cyc, cr, ACCENT_LO);
    fillCircle(c, g.cx, cyc, Math.max(1, cr - 1), ACCENT_MID);
    c.set(g.cx, cyc, ACCENT_HI);
    sparkle(c, g.cx, cyc, GLINT);
    // hard hex-bolt ring framing the core (mechanical, not a soft halo)
    for (const [dx, dy] of [
      [-cr - 1, 0],
      [cr + 1, 0],
      [0, -cr - 1],
      [0, cr + 1],
    ]) {
      rivet(c, g.cx + dx, cyc + dy);
    }
  }

  // 8. Rivet studs marching along the plate seams + corners (metallic SHEEN dots; density by tier).
  const studPts: Array<[number, number]> = [
    [g.cx - g.halfW + 1, g.bodyTop + 1],
    [g.cx + g.halfW - 1, g.bodyTop + 1],
    [g.cx - g.halfW + 1, g.bodyBot - 1],
    [g.cx + g.halfW - 1, g.bodyBot - 1],
    [g.cx - g.headHalf + 1, g.headTop + 1],
    [g.cx + g.headHalf - 1, g.headTop + 1],
  ];
  for (let t = 0; t < opts.studs; t++) {
    const yy = g.bodyTop + 2 + t * 3;
    studPts.push([g.cx - g.halfW + 1, yy]);
    studPts.push([g.cx + g.halfW - 1, yy]);
  }
  for (const [x, y] of studPts) rivet(c, x, y);

  // 9. Crown of rivet-spikes across the head (apex majesty).
  if (opts.crown) {
    for (let i = 0; i < 5; i++) {
      const x = Math.round(g.cx - g.headHalf + (i / 4) * g.headHalf * 2);
      c.set(x, g.headTop - 1, RIM_HI);
      if (i % 2 === 0) {
        c.set(x, g.headTop - 2, PLATE_HI);
        c.set(x, g.headTop - 3, ACCENT_HI);
      }
    }
  }

  // 10. Per-species accent decals (ember motifs, gems).
  opts.accentMotif?.(c, g, rng);

  // 11. Face / visor (placed late so nothing clobbers the eyes), then outline LAST.
  drawFace(c, g, opts);
  outline(c);

  // ---- Animation banks: a heavy construct (clank-step, piston-launch, ground-pound). ----
  const baseGrid = c.grid;
  const ventY = g.bodyTop + Math.round((g.bodyBot - g.bodyTop) * 0.5);

  const idle = framesFromDeltas(c, [
    () => {},
    // breathing ember pulse along the mid vent
    (f) => {
      for (let x = Math.round(g.cx - g.halfW + 2); x <= Math.round(g.cx + g.halfW - 2); x += 2)
        f.set(x, ventY, ACCENT_HI);
    },
  ]);

  const walk = framesFromDeltas(c, [
    () => {},
    // weight shift: advance lead foot
    (f) => {
      const lead = Math.round(g.cx + Math.round(g.halfW * 0.5));
      f.set(lead, g.groundY, 0);
      f.set(lead, g.bodyBot - 1, PLATE);
    },
    (f) => {
      const trail = Math.round(g.cx - Math.round(g.halfW * 0.5));
      f.set(trail, g.groundY, 0);
      f.set(trail, g.bodyBot - 1, PLATE);
    },
  ]);

  const jump = framesFromDeltas(c, [
    // crouch: tuck the head down a row
    (f) => {
      for (let x = 0; x < f.width; x++) {
        const v = baseGrid[g.headTop]?.[x] ?? 0;
        if (v) f.set(x, g.headBot, v);
      }
    },
    // launch: ember burst beneath the feet
    (f) => {
      for (const s of [-1, 1]) {
        const x = Math.round(g.cx + s * Math.round(g.halfW * 0.5));
        f.set(x, g.groundY, ACCENT_HI);
        f.set(x, g.groundY - 1, ACCENT_MID);
      }
    },
  ]);

  const play = framesFromDeltas(c, [
    () => {},
    // ground-pound spark fan to the side
    (f) => {
      const px = Math.round(g.cx + g.halfW + 1);
      sparkle(f, px, g.bodyBot, GLINT);
      f.set(px + 1, g.bodyBot - 1, ACCENT_HI);
      f.set(px, g.bodyBot - 2, ACCENT_MID);
    },
  ]);

  return { ...buildSprite(opts.id, idle, opts.fps ?? 4), walk, jump, play };
}

// ---------------------------------------------------------------------------
// Iron Brood line — distinct hard-metal babies converging to a majestic boss-tower apex.
// ---------------------------------------------------------------------------

// Emberit (sprite 20) — a tiny boxy furnace-bot: big glowing visor lenses, a stubby antenna,
// one ember core vent. Charming but unmistakably a little ROBOT.
export function buildEmberit(): SpriteDef {
  return forgeBot({
    id: 'sprite-emberit',
    size: 20,
    plan: 'chibi',
    vents: 1,
    stacks: 0,
    studs: 0,
    eye: 'wide',
    eyeScale: 0.5,
    antenna: true,
    belly: true,
    fps: 4,
  });
}

// Forgeling (rookie 24) — boxy treaded plodder: wide tread base, two warm vents, antenna.
export function buildForgeling(): SpriteDef {
  return forgeBot({
    id: 'sprite-forgeling',
    size: 24,
    plan: 'roller',
    vents: 2,
    stacks: 1,
    studs: 1,
    eye: 'round',
    eyeScale: 0.45,
    antenna: true,
    belly: true,
    fps: 4,
  });
}

// Cindcub (rookie 24) — scrappy spark-cub: a raised piston arm flinging cinders (accent).
export function buildCindcub(): SpriteDef {
  return forgeBot({
    id: 'sprite-cindcub',
    size: 24,
    plan: 'cub',
    vents: 1,
    stacks: 1,
    studs: 1,
    eye: 'round',
    eyeScale: 0.45,
    arms: true,
    fps: 5,
    accentMotif: (c, g) => {
      // a fan of flung sparks off the raised right arm
      const ax = Math.round(g.cx + g.halfW + 2);
      const ay = g.bodyTop + 2;
      c.set(ax, ay, ACCENT_HI);
      c.set(ax + 1, ay - 1, ACCENT_MID);
      c.set(ax, ay - 2, ACCENT_LO);
      c.set(ax + 2, ay - 2, ACCENT_LO);
      c.set(ax + 1, ay - 3, ACCENT_MID);
      c.set(ax - 1, ay - 1, ACCENT_HI);
      sparkle(c, ax, ay - 1, GLINT);
      // a hot square stoke-port vent on the cub's chest (signature ember)
      const vy = Math.round((g.bodyTop + g.bodyBot) / 2);
      fillRect(c, g.cx - 1, vy - 1, g.cx + 1, vy + 1, SEAM);
      c.set(g.cx, vy, ACCENT_HI);
      c.set(g.cx - 1, vy, ACCENT_MID);
      c.set(g.cx + 1, vy, ACCENT_MID);
    },
  });
}

// Anvilisk (evolved 28) — squat anvil block: flared angular shoulders, heavy corner studs.
export function buildAnvilisk(): SpriteDef {
  return forgeBot({
    id: 'sprite-anvilisk',
    size: 28,
    plan: 'anvil',
    vents: 2,
    stacks: 0,
    studs: 2,
    eye: 'round',
    eyeScale: 0.4,
    arms: true,
    belly: true,
    fps: 4,
    plateMotif: (c, g) => {
      // hard angular anvil-horn flare jutting from the upper chassis (straight-edged wedges)
      for (const s of [-1, 1]) {
        const x0 = Math.round(g.cx + s * g.halfW);
        fillPolygon(
          c,
          [
            [x0, g.bodyTop],
            [x0 + s * 3, g.bodyTop - 2],
            [x0 + s * 3, g.bodyTop],
            [x0, g.bodyTop + 2],
          ],
          PLATE,
        );
      }
    },
  });
}

// Slaghorn (evolved 28) — piston-hammerer: tall narrow body, twin slag-horn stacks.
export function buildSlaghorn(): SpriteDef {
  return forgeBot({
    id: 'sprite-slaghorn',
    size: 28,
    plan: 'piston',
    vents: 2,
    stacks: 2,
    studs: 1,
    eye: 'round',
    eyeScale: 0.4,
    arms: true,
    fps: 5,
    accentMotif: (c, g) => {
      // cooling-slag horns glowing at the tips, jutting hard from the crown
      for (const s of [-1, 1]) {
        const x = Math.round(g.cx + s * Math.round(g.headHalf * 0.7));
        line(c, x, g.headTop, x + s * 2, g.headTop - 3, PLATE_HI);
        c.set(x + s * 2, g.headTop - 3, ACCENT_HI);
        c.set(x + s * 2, g.headTop - 2, ACCENT_MID);
        c.set(x + s, g.headTop - 1, ACCENT_LO);
      }
      // molten slag glowing at the piston cuffs (signature ember band)
      const dy = g.bodyBot - 2;
      for (let x = Math.round(g.cx - g.halfW + 2); x <= Math.round(g.cx + g.halfW - 2); x += 2) {
        c.set(x, dy, ACCENT_MID);
        c.set(x, dy + 1, ACCENT_HI);
      }
    },
  });
}

// Kilnox (evolved 28) — segmented drum-kiln: boxy barrel rings radiating heat from three vents.
export function buildKilnox(): SpriteDef {
  return forgeBot({
    id: 'sprite-kilnox',
    size: 28,
    plan: 'kiln',
    vents: 3,
    stacks: 2,
    studs: 1,
    eye: 'round',
    eyeScale: 0.4,
    fps: 4,
    accentMotif: (c, g) => {
      // square side stoke-ports glowing on the drum flanks
      for (const s of [-1, 1]) {
        const x = Math.round(g.cx + s * (g.halfW - 1));
        const y = Math.round((g.bodyTop + g.bodyBot) / 2);
        c.set(x, y, ACCENT_HI);
        c.set(x, y - 1, ACCENT_LO);
        c.set(x, y + 1, ACCENT_LO);
      }
    },
  });
}

// Smeltitan (prime 32) — towering smelter boss: a blazing molten CORE, converging tower.
export function buildSmeltitan(): SpriteDef {
  return forgeBot({
    id: 'sprite-smeltitan',
    size: 32,
    plan: 'tower',
    vents: 3,
    stacks: 2,
    studs: 2,
    eye: 'sleepy',
    eyeScale: 0.55,
    arms: true,
    core: true,
    fps: 4,
  });
}

// Ironmaw (prime 32) — crusher-jaws boss: a toothed maw glowing across the lower chassis.
export function buildIronmaw(): SpriteDef {
  return forgeBot({
    id: 'sprite-ironmaw',
    size: 32,
    plan: 'tower',
    vents: 2,
    stacks: 1,
    studs: 2,
    eye: 'sleepy',
    eyeScale: 0.55,
    arms: true,
    fps: 4,
    accentMotif: (c, g) => {
      // interlocking glowing teeth across the maw (hard alternating triangles)
      const y = g.bodyBot - 2;
      for (let x = Math.round(g.cx - g.halfW + 2); x <= Math.round(g.cx + g.halfW - 2); x += 2) {
        c.set(x, y, ACCENT_MID);
        c.set(x, y + 1, ACCENT_HI);
        c.set(x + 1, y + 1, OUTLINE);
      }
    },
  });
}

// Basaltus (prime 32) — basalt-sheathed boss: rugged dark cracked plates, calm seam embers.
export function buildBasaltus(): SpriteDef {
  return forgeBot({
    id: 'sprite-basaltus',
    size: 32,
    plan: 'tower',
    vents: 2,
    stacks: 1,
    studs: 3,
    eye: 'sleepy',
    eyeScale: 0.5,
    arms: true,
    fps: 4,
    plateMotif: (c, g) => {
      // cracked basalt plating seams down the chassis
      for (let i = 0; i < 3; i++) {
        const x = Math.round(g.cx - g.halfW + 2 + i * Math.round(g.halfW * 0.7));
        line(c, x, g.bodyTop + 2, x - 1, g.bodyBot - 2, SEAM);
      }
    },
    accentMotif: (c, g, rng) => {
      // a deep magma fissure smouldering down the chest, embers in the cracks
      const fx = g.cx;
      for (let y = g.bodyTop + 3; y <= g.bodyBot - 3; y++) {
        const jit = rng.int(3) - 1;
        c.set(fx + jit, y, ACCENT_MID);
        if (y % 2 === 0) c.set(fx + jit, y, ACCENT_HI);
      }
      for (let i = 0; i < 7; i++) {
        const x = Math.round(g.cx - g.halfW + 3 + rng.int(g.halfW * 2 - 6));
        const y = g.bodyTop + 3 + rng.int(g.bodyBot - g.bodyTop - 6);
        c.set(x, y, ACCENT_LO);
      }
    },
  });
}

// Magmarok (apex 36) — apex furnace-titan: crowned blazing core, massive pauldrons, ember storm.
export function buildMagmarok(): SpriteDef {
  return forgeBot({
    id: 'sprite-magmarok',
    size: 36,
    plan: 'titan',
    vents: 4,
    stacks: 3,
    studs: 3,
    eye: 'sleepy',
    eyeScale: 0.7,
    arms: true,
    core: true,
    crown: true,
    fps: 4,
    accentMotif: (c, g, rng) => {
      // an ember storm rising from the chassis and stacks
      for (let i = 0; i < 6; i++) {
        const x = Math.round(g.cx - g.halfW + rng.int(g.halfW * 2));
        const y = g.headBot - Math.round(g.size * 0.14) - rng.int(3);
        c.set(x, y, i % 2 === 0 ? ACCENT_HI : ACCENT_MID);
      }
      // molten shoulder vents glowing on the pauldrons
      for (const s of [-1, 1]) {
        const x = Math.round(g.cx + s * (g.halfW + 2));
        c.set(x, g.bodyTop + 3, ACCENT_HI);
      }
    },
  });
}

// Adamantor (apex 36) — adamant apex: pristine heavy plating, a crown of rivet-studs + gem core.
export function buildAdamantor(): SpriteDef {
  return forgeBot({
    id: 'sprite-adamantor',
    size: 36,
    plan: 'titan',
    vents: 3,
    stacks: 2,
    studs: 4,
    eye: 'sleepy',
    eyeScale: 0.7,
    arms: true,
    core: true,
    crown: true,
    belly: true,
    fps: 4,
    accentMotif: (c, g) => {
      // a faceted gem set above the core, flanked by adamant fins
      const gy = g.bodyTop + 2;
      diamond(c, g.cx, gy, 1, ACCENT_HI);
      c.set(g.cx, gy, GLINT);
      for (const s of [-1, 1]) {
        const x = Math.round(g.cx + s * (g.halfW - 1));
        c.set(x, g.bodyTop + 2, ACCENT_MID);
      }
    },
  });
}

export const forgeSprites: SpriteDef[] = [
  buildEmberit(),
  buildForgeling(),
  buildCindcub(),
  buildAnvilisk(),
  buildSlaghorn(),
  buildKilnox(),
  buildSmeltitan(),
  buildIronmaw(),
  buildBasaltus(),
  buildMagmarok(),
  buildAdamantor(),
];
