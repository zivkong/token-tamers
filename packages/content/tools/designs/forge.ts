/**
 * Forge line sprite designs — the IRON BROOD kingdom (robots / constructs).
 *
 * Art direction v2 ("octant / cute -> majestic"). The Iron Brood are BOXY, riveted
 * CONSTRUCTS: hard-edged plate panels (fillRect), bolt/rivet studs, crisp metallic
 * SHEEN strips on plate edges (RIM_HI), and the warm House tone CONCENTRATED as EMBER
 * GLOW in vents/seams/core (ACCENT_* + GLINT, hot-gold accent) — never a brown wash.
 *
 *  - CUTE -> MAJESTIC: the sprite stage is an ADORABLE chibi bot (head ~= body, huge
 *    sparkly visor-eyes, blush, stubby nub feet). Each stage sharpens; the apex is a
 *    towering boss-mech (small head on a tall ~1:3 plated tower, crowned core, big
 *    pauldrons, commanding eye-band). Eye-to-head ratio shrinks egg->apex.
 *  - DISTINCT -> CONVERGE: sprite/rookie/evolved get VARIED body-plans (pot-belly,
 *    treaded roller, anvil block, kiln drum, jawed crusher...) so the line never reads
 *    "too similar"; prime/apex converge to the shared boss-tower archetype.
 *  - ROUNDED-BUT-DETAILED: corners are softened (clipped bevels), thin bits thickened.
 *  - COLOR: House orange DOMINATES (indices 2..14, ~75-85%); each species gets ONE
 *    signature secondary ACCENT (ACCENT_LO/MID/HI = 16/17/18) at ~10-20% on a signature
 *    feature (vent-core, crest, jaw, gem), with an optional cream BELLY (20) plate.
 *  - INDICES ONLY — never RGB. The renderer resolves House tint + grade ladder + the
 *    per-species accent at render time.
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
  fillEllipse,
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

// Plate-tone vocabulary shared by every Iron Brood construct (House orange ramp).
const SEAM = 2; // dark plate seam / panel gap
const PLATE = 7; // mid plate body
const PLATE_HI = 11; // lit plate face

/** Body silhouette families — distinct at the low stages, converging up the line. */
type Plan =
  | 'chibi' // sprite: round-cornered baby bot, head ~= body
  | 'roller' // treaded plodder, wide low base
  | 'cub' // scrappy spark-cub with a raised arm
  | 'anvil' // squat anvil block, flared shoulders
  | 'piston' // tall narrow hammerer with stack-horns
  | 'kiln' // round drum kiln, vents all around
  | 'tower' // prime/apex boss-mech tower
  | 'titan'; // apex pinnacle: crowned core + pauldrons

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
  /** Rivet-stud density tier. */
  studs: number;
  /** Eye style for the visor face (cute -> commanding). */
  eye: EyeStyle;
  /** Eye-band vertical half-extent as a fraction of head height (shrinks up the line). */
  eyeScale: number;
  /** Adorable blush dots (low stages only). */
  blush?: boolean;
  /** Big side arms / pauldrons (converging archetype at prime/apex). */
  arms?: boolean;
  /** Cream belly plate panel. */
  belly?: boolean;
  /** Glowing core medallion at chest center (prime/apex boss cue). */
  core?: boolean;
  /** Crown of studs / spikes across the head (apex majesty). */
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
      ? 0.42
      : plan === 'cub' || plan === 'roller'
        ? 0.36
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
  const headWShare = plan === 'chibi' ? 0.34 : plan === 'titan' || plan === 'tower' ? 0.2 : 0.26;
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

/** Round-clip the four corners of the last-drawn rect region for a soft, toyable read. */
function roundCorners(
  c: PixelCanvas,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
): void {
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < r - i; j++) {
      c.set(x0 + i, y0 + j, 0);
      c.set(x1 - i, y0 + j, 0);
      c.set(x0 + i, y1 - j, 0);
      c.set(x1 - i, y1 - j, 0);
    }
  }
}

/** Stubby boxy feet (nub feet for babies, wide treads for the heavies). */
function drawFeet(c: PixelCanvas, g: ForgeGeom, plan: Plan): void {
  const footW = Math.max(1, Math.round(g.size * (plan === 'piston' ? 0.07 : 0.1)));
  const span = Math.round(g.halfW * (plan === 'kiln' || plan === 'roller' ? 0.6 : 0.5));
  for (const s of [-1, 1]) {
    const x = Math.round(g.cx + s * span);
    fillRect(c, x - footW + 1, g.bodyBot, x + footW - 1, g.groundY, PLATE);
    // soften the outer-bottom corner
    c.set(x + s * footW, g.groundY, 0);
  }
}

/** The plated chassis body with rounded corners (varies by body-plan). */
function drawChassis(c: PixelCanvas, g: ForgeGeom, plan: Plan): void {
  const x0 = Math.round(g.cx - g.halfW);
  const x1 = Math.round(g.cx + g.halfW);
  if (plan === 'kiln') {
    // Drum kiln: round barrel torso.
    fillEllipse(
      c,
      g.cx,
      (g.bodyTop + g.bodyBot) / 2,
      g.halfW,
      (g.bodyBot - g.bodyTop) / 2 + 1,
      PLATE,
    );
  } else {
    fillRect(c, x0, g.bodyTop, x1, g.bodyBot, PLATE);
    const r = plan === 'chibi' || plan === 'cub' || plan === 'roller' ? 3 : 2;
    roundCorners(c, x0, g.bodyTop, x1, g.bodyBot, r);
  }
  // roller gets a wide tread skirt
  if (plan === 'roller') {
    fillRect(c, x0 - 1, g.bodyBot - 1, x1 + 1, g.bodyBot + 1, SEAM);
  }
}

/** The head block + visor band (cute big-eyed for babies, narrow eye-band for bosses). */
function drawHead(c: PixelCanvas, g: ForgeGeom, plan: Plan): void {
  const x0 = Math.round(g.cx - g.headHalf);
  const x1 = Math.round(g.cx + g.headHalf);
  if (plan === 'chibi' || plan === 'cub') {
    // Big round-cube baby head.
    fillRect(c, x0, g.headTop, x1, g.headBot, PLATE);
    roundCorners(c, x0, g.headTop, x1, g.headBot, 2);
  } else if (plan === 'titan' || plan === 'tower') {
    // Small crested boss head.
    fillRect(c, x0, g.headTop, x1, g.headBot, PLATE);
    roundCorners(c, x0, g.headTop, x1, g.headBot, 1);
  } else {
    fillRect(c, x0, g.headTop, x1, g.headBot, PLATE);
    roundCorners(c, x0, g.headTop, x1, g.headBot, 1);
  }
}

/** Ember-vent seam rows: dark grooves glowing hot in the gap (ACCENT core + GLINT). */
function drawVents(c: PixelCanvas, g: ForgeGeom, rows: number): void {
  for (let r = 0; r < rows; r++) {
    const y = g.bodyTop + Math.round((g.bodyBot - g.bodyTop) * ((r + 1) / (rows + 1)));
    const w = g.halfW - 2;
    const xl = Math.round(g.cx - w);
    const xr = Math.round(g.cx + w);
    // dark groove
    line(c, xl, y, xr, y, SEAM);
    // hot ember filament inside the groove
    for (let x = xl + 1; x <= xr - 1; x++) c.set(x, y, ACCENT_MID);
    // brightest glints punctuating the vent
    for (let x = xl + 1; x <= xr - 1; x += 2) c.set(x, y, ACCENT_HI);
    // a faint heat-halo above
    for (let x = xl + 1; x <= xr - 1; x += 3) c.set(x, y - 1, ACCENT_LO);
  }
}

/** Chimney stacks / exhausts venting on top of the shoulders. */
function drawStacks(c: PixelCanvas, g: ForgeGeom, count: number): void {
  const h = Math.max(2, Math.round(g.size * 0.12));
  for (let i = 0; i < count; i++) {
    const sx = Math.round(
      g.cx + (count === 1 ? 0 : (i / (count - 1) - 0.5) * 2 * (g.headHalf + 2)),
    );
    fillRect(c, sx - 1, g.headBot - h, sx + 1, g.headBot, PLATE);
    // glowing exhaust mouth
    c.set(sx, g.headBot - h, ACCENT_HI);
  }
}

/** The visor / eye band — the lineage motif. Cute huge sparkle eyes -> commanding band. */
function drawFace(c: PixelCanvas, g: ForgeGeom, opts: ForgeOpts): void {
  const midY = Math.round(g.headTop + (g.headBot - g.headTop) * 0.5);
  const half = Math.max(1, Math.round(g.headHalf * opts.eyeScale));
  if (opts.eye === 'wide' || opts.eye === 'round') {
    // Two big catch-lit visor eyes (babies & rookies) — adorable glowing optics.
    const ex = Math.max(2, Math.round(g.headHalf * 0.5));
    for (const s of [-1, 1]) {
      const exx = Math.round(g.cx + s * ex);
      // dark eye well, warm glowing iris, bright catch-light — reads as a cute lens
      smallEllipse(c, exx, midY, opts.eye === 'wide' ? 2 : 1, opts.eye === 'wide' ? 2 : 1, OUTLINE);
      c.set(exx, midY, ACCENT_MID);
      c.set(exx - s, midY, ACCENT_HI);
      c.set(exx + s, midY - 1, RIM_HI); // sparkle catch-light
    }
  } else if (opts.eye === 'sleepy') {
    // A single wide commanding visor band (bosses).
    fillRect(c, Math.round(g.cx - half), midY, Math.round(g.cx + half), midY, OUTLINE);
    for (let x = Math.round(g.cx - half) + 1; x <= Math.round(g.cx + half) - 1; x += 2)
      c.set(x, midY, GLINT);
  } else {
    eyes(c, Math.round(g.cx), midY, 'dot');
  }
  if (opts.blush) {
    for (const s of [-1, 1]) {
      const bx = Math.round(g.cx + s * (g.headHalf - 1));
      c.set(bx, midY + 1, ACCENT_LO);
    }
  }
}

/** Big side arms / pauldrons — the converging heavy-mech archetype. */
function drawArms(c: PixelCanvas, g: ForgeGeom, plan: Plan): void {
  const armH = Math.round((g.bodyBot - g.bodyTop) * (plan === 'titan' ? 0.5 : 0.42));
  const armW = Math.max(2, Math.round(g.size * 0.1));
  const top = g.bodyTop + 1;
  for (const s of [-1, 1]) {
    const x = Math.round(g.cx + s * (g.halfW + 1));
    fillRect(c, x, top, x + s * armW, top + armH, PLATE);
    // round the outer corners into a pauldron
    c.set(x + s * armW, top, 0);
    c.set(x + s * armW, top + armH, 0);
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

  // 3. Structural extra plates (per species).
  opts.plateMotif?.(c, g, rng);

  // 4. Hard cel shading lit from upper-left; rim-light the lit plate edges (the SHEEN).
  //    onlyBelow:14 protects any accent/belly decals already placed (none yet here).
  const bands = opts.size >= 28 ? 6 : 5;
  shade(c, { dir: 'upper-left', bands, lo: 4, hi: 12, dither: false, onlyBelow: 14 });
  rimLight(c, 'upper-left');

  // 5. Cream belly plate panel (paint AFTER shade so it keeps its own tone).
  if (opts.belly) {
    const by0 = Math.round(g.bodyTop + (g.bodyBot - g.bodyTop) * 0.28);
    const by1 = Math.round(g.bodyBot - 1);
    const bhx = Math.max(1, Math.round(g.halfW * 0.45));
    fillEllipse(c, g.cx, (by0 + by1) / 2, bhx, (by1 - by0) / 2, BELLY);
  }

  // 6. Ember-vents + stacks + glowing core medallion (concentrated warm glow).
  drawVents(c, g, opts.vents);
  if (opts.stacks > 0) drawStacks(c, g, opts.stacks);
  if (opts.core) {
    const cyc = Math.round((g.bodyTop + g.bodyBot) / 2);
    const cr = Math.max(2, Math.round(g.halfW * 0.34));
    fillCircle(c, g.cx, cyc, cr, ACCENT_LO);
    fillCircle(c, g.cx, cyc, Math.max(1, cr - 1), ACCENT_MID);
    c.set(g.cx, cyc, ACCENT_HI);
    sparkle(c, g.cx, cyc, GLINT);
  }

  // 7. Rivet studs along the plate edges (metallic SHEEN dots; density by tier).
  const studPts: Array<[number, number]> = [
    [g.cx - g.halfW + 1, g.bodyTop + 1],
    [g.cx + g.halfW - 1, g.bodyTop + 1],
    [g.cx - g.halfW + 1, g.bodyBot - 1],
    [g.cx + g.halfW - 1, g.bodyBot - 1],
  ];
  for (let t = 0; t < opts.studs; t++) {
    const yy = g.bodyTop + 2 + t * 3;
    studPts.push([g.cx - g.halfW + 1, yy]);
    studPts.push([g.cx + g.halfW - 1, yy]);
  }
  for (const [x, y] of studPts) c.set(Math.round(x), Math.round(y), RIM_HI);

  // 8. Crown of studs across the head (apex majesty).
  if (opts.crown) {
    for (let i = 0; i < 5; i++) {
      const x = Math.round(g.cx - g.headHalf + (i / 4) * g.headHalf * 2);
      c.set(x, g.headTop - 1, RIM_HI);
      if (i % 2 === 0) c.set(x, g.headTop - 2, ACCENT_HI);
    }
  }

  // 9. Per-species accent decals (ember motifs, gems).
  opts.accentMotif?.(c, g, rng);

  // 10. Face / visor (placed late so nothing clobbers the eyes), then outline LAST.
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
    // weight shift: lift the body a touch, advance lead foot
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
// Iron Brood line — distinct cute babies converging to a majestic boss-tower apex.
// ---------------------------------------------------------------------------

// Emberit (sprite 20) — adorable pot-bellied furnace-bot: big sparkle visor, one core vent.
export function buildEmberit(): SpriteDef {
  return forgeBot({
    id: 'sprite-emberit',
    size: 20,
    plan: 'chibi',
    vents: 1,
    stacks: 1,
    studs: 0,
    eye: 'wide',
    eyeScale: 0.5,
    blush: true,
    belly: true,
    fps: 4,
  });
}

// Forgeling (rookie 24) — cute treaded plodder: wide tread base, two warm vents.
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
    blush: true,
    belly: true,
    fps: 4,
  });
}

// Cindcub (rookie 24) — scrappy spark-cub: a raised spark-arm flinging cinders (accent).
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
    blush: true,
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
      // a hot cheek-vent on the cub's chest (signature ember)
      const vy = Math.round((g.bodyTop + g.bodyBot) / 2);
      smallEllipse(c, g.cx, vy, 2, 1, ACCENT_MID);
      c.set(g.cx, vy, ACCENT_HI);
    },
  });
}

// Anvilisk (evolved 28) — squat anvil block: flared shoulders, heavy corner studs.
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
      // anvil horn flare across the upper chassis
      for (const s of [-1, 1]) {
        const x0 = Math.round(g.cx + s * g.halfW);
        line(c, x0, g.bodyTop, x0 + s * 2, g.bodyTop - 1, PLATE);
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
      // cooling-slag horns glowing at the tips, jutting from the crown
      for (const s of [-1, 1]) {
        const x = Math.round(g.cx + s * Math.round(g.headHalf * 0.7));
        line(c, x, g.headTop, x + s * 2, g.headTop - 3, PLATE_HI);
        c.set(x + s * 2, g.headTop - 3, ACCENT_HI);
        c.set(x + s * 2, g.headTop - 2, ACCENT_MID);
        c.set(x + s, g.headTop - 1, ACCENT_LO);
      }
      // molten slag dripping at the piston cuffs (signature ember band)
      const dy = g.bodyBot - 2;
      for (let x = Math.round(g.cx - g.halfW + 2); x <= Math.round(g.cx + g.halfW - 2); x += 2) {
        c.set(x, dy, ACCENT_MID);
        c.set(x, dy + 1, ACCENT_HI);
      }
    },
  });
}

// Kilnox (evolved 28) — round drum-kiln: barrel torso radiating heat from three vents.
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
      // side stoke-ports glowing on the drum flanks
      for (const s of [-1, 1]) {
        const x = Math.round(g.cx + s * (g.halfW - 1));
        const y = Math.round((g.bodyTop + g.bodyBot) / 2);
        c.set(x, y, ACCENT_HI);
        c.set(x, y - 1, ACCENT_LO);
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
      // interlocking glowing teeth across the maw
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

// Magmarok (apex 36) — apex furnace-titan: crowned blazing core, big pauldrons, ember storm.
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
