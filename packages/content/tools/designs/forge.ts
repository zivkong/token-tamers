/**
 * Forge line sprite designs — the IRON BROOD kingdom (robots / constructs).
 *
 * Identity bible: docs/design/visuals-habitats-achievements.md §13 (Species identity
 * system) + the create-sprites skill. The Iron Brood are boxy, riveted, symmetrical
 * CONSTRUCTS in a rooted heavy stance: a plated chassis on stubby mechanical feet, a
 * glowing VISOR, EMBER-VENTS glowing in the seams (the pulsing core, the GRT motif),
 * BOLT/RIVET studs that multiply with stage, and CHIMNEY-STACKS venting on top. House
 * tint = orange; grade resolves richness.
 *
 * Size law (2026-06-15): egg 12 · sprite 16 · rookie 20 · evolved 24 · prime 28 · apex 32.
 * Flat tones (outline 1 · shadow 3 · body 7 · light 11 · rim 13 · glint 15) — hard cel
 * bands, not dither ramps. Every species ships idle + walk + jump + play banks (same dims).
 * Determinism: seeded LCG (hashStr(id)) — never Math.random / Date.now.
 */

import type { SpriteDef } from '@token-tamers/core';
import {
  PixelCanvas,
  buildSprite,
  fillRect,
  fillEllipse,
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
  RIM_HI,
  GLINT,
} from '../sprite-lib';

// Flat-tone vocabulary shared by every Iron Brood construct.
const SEAM = 2; // dark plate seam
const BODY = 7;
const LIGHT = 11;

/** Geometry of a planted Iron Brood chassis, derived once from the stage size. */
interface IronGeom {
  size: number;
  cx: number;
  groundY: number;
  bodyBot: number;
  bodyTop: number;
  halfW: number;
  headTop: number;
}

interface IronOpts {
  id: string;
  size: number;
  /** Ember-vent seam rows across the chassis (lineage cue: grows with stage). */
  vents: number;
  /** Chimney-stacks venting on top. */
  stacks: number;
  /** Rivet-stud density tier. */
  studs: number;
  /** Blocky side arms. */
  arms?: boolean;
  fps?: number;
  /** Body-tone marks, drawn BEFORE shade (so they cel-shade; structural). */
  bodyMotif?: (c: PixelCanvas, g: IronGeom, rng: Lcg) => void;
  /** Bright marks (ember glints, studs), drawn AFTER shade + rimLight, BEFORE outline. */
  brightMotif?: (c: PixelCanvas, g: IronGeom, rng: Lcg) => void;
}

function ironGeom(size: number): IronGeom {
  const cx = (size - 1) / 2;
  const groundY = size - 1;
  const legH = Math.max(2, Math.round(size * 0.13));
  const bodyTop = Math.round(size * 0.3);
  return {
    size,
    cx,
    groundY,
    bodyBot: groundY - legH,
    bodyTop,
    halfW: Math.round(size * 0.32),
    headTop: bodyTop - Math.max(2, Math.round(size * 0.14)),
  };
}

/** Ember-vent seam rows: dark grooves across the chassis glowing at the joints. */
function drawVents(c: PixelCanvas, g: IronGeom, rows: number): void {
  for (let r = 0; r < rows; r++) {
    const y = g.bodyTop + Math.round((g.bodyBot - g.bodyTop) * ((r + 1) / (rows + 1)));
    const w = g.halfW - 1;
    line(c, Math.round(g.cx - w), y, Math.round(g.cx + w), y, SEAM);
    // Glowing ember segments along the vent.
    for (let x = Math.round(g.cx - w + 1); x <= Math.round(g.cx + w - 1); x += 2)
      c.set(x, y, GLINT);
  }
}

/** The shared Iron Brood builder: one parametric construct + its four banks. */
function ironBrood(opts: IronOpts): SpriteDef {
  const g = ironGeom(opts.size);
  const rng = lcg(hashStr(opts.id));
  const base = PixelCanvas.create(opts.size, opts.size);

  // 1. Two boxy mechanical feet.
  const footW = Math.max(1, Math.round(opts.size * 0.1));
  const footSpan = Math.round(g.halfW * 0.55);
  for (const s of [-1, 1]) {
    const x = Math.round(g.cx + s * footSpan);
    fillRect(base, x - footW + 1, g.bodyBot, x + footW - 1, g.groundY, BODY);
  }

  // 2. Plated chassis (boxy, beveled top corners for a mech read).
  fillRect(
    base,
    Math.round(g.cx - g.halfW),
    g.bodyTop,
    Math.round(g.cx + g.halfW),
    g.bodyBot,
    BODY,
  );
  const bevel = Math.max(1, Math.round(opts.size * 0.06));
  for (let b = 0; b < bevel; b++) {
    for (const s of [-1, 1]) {
      const x = Math.round(g.cx + s * g.halfW) - s * b;
      base.set(x, g.bodyTop + (bevel - 1 - b), 0);
    }
  }

  // 3. Head block + visor band.
  const headW = Math.max(2, Math.round(g.halfW * 0.6));
  fillRect(base, Math.round(g.cx - headW), g.headTop, Math.round(g.cx + headW), g.bodyTop, BODY);

  // 4. Chimney-stacks on top of the shoulders.
  for (let i = 0; i < opts.stacks; i++) {
    const sx = Math.round(
      g.cx + (opts.stacks === 1 ? 0 : (i / (opts.stacks - 1) - 0.5) * 2 * (g.halfW - 1)),
    );
    fillRect(base, sx - 1, g.bodyTop - Math.round(opts.size * 0.12), sx + 1, g.bodyTop, BODY);
  }

  // 5. Blocky side arms.
  if (opts.arms) {
    const armH = Math.round((g.bodyBot - g.bodyTop) * 0.5);
    for (const s of [-1, 1]) {
      const x = Math.round(g.cx + s * (g.halfW + 1));
      fillRect(
        base,
        x,
        g.bodyTop + 2,
        x + s * Math.max(1, Math.round(opts.size * 0.06)),
        g.bodyTop + 2 + armH,
        BODY,
      );
    }
  }

  // 6. Structural body-tone motif.
  opts.bodyMotif?.(base, g, rng);

  // 7. Hard cel shading lit from upper-left; rim-light the top plates.
  const bands = opts.size >= 24 ? 6 : 5;
  shade(base, { dir: 'upper-left', bands, lo: 4, hi: 12, dither: false });
  rimLight(base, 'upper-left');

  // 8. Ember-vents + glowing visor + rivet studs (post-shade so they stay crisp).
  drawVents(base, g, opts.vents);
  // Visor: a glowing optical band across the head.
  for (let x = Math.round(g.cx - headW + 1); x <= Math.round(g.cx + headW - 1); x++) {
    base.set(x, Math.round((g.headTop + g.bodyTop) / 2), GLINT);
  }
  // Rivet studs around the chassis corners (density by tier).
  const studPts: Array<[number, number]> = [
    [g.cx - g.halfW + 1, g.bodyTop + 1],
    [g.cx + g.halfW - 1, g.bodyTop + 1],
    [g.cx - g.halfW + 1, g.bodyBot - 1],
    [g.cx + g.halfW - 1, g.bodyBot - 1],
  ];
  for (let t = 0; t < opts.studs; t++) {
    studPts.push([g.cx - g.halfW + 1, g.bodyTop + 2 + t * 3]);
    studPts.push([g.cx + g.halfW - 1, g.bodyTop + 2 + t * 3]);
  }
  for (const [x, y] of studPts) base.set(Math.round(x), Math.round(y), RIM_HI);
  opts.brightMotif?.(base, g, rng);

  // 9. Crisp 1px silhouette last.
  outline(base);

  // ---- Animation banks (a heavy construct: clank-step, piston-launch, ground-pound) ----
  const idle = [base.grid, bobFrame(base, -1).grid];
  const walk = [base.grid, shiftFrame(base, 1, 0).grid];
  const jump = [shiftFrame(base, 0, 1).grid, shiftFrame(base, 0, -2).grid];
  const pound = shiftFrame(base, 1, 0);
  sparkle(pound, Math.round(g.cx + g.halfW + 1), g.bodyBot, GLINT);
  const play = [pound.grid, shiftFrame(base, -1, 0).grid];

  return { ...buildSprite(opts.id, idle, opts.fps ?? 4), walk, jump, play };
}

// ---------------------------------------------------------------------------
// Iron Brood line — vents/studs multiply, stacks rise, chassis widens & arms.
// ---------------------------------------------------------------------------

// Emberit (16) — pot-bellied furnace-bot: one vent, one stack, a glowing core.
export function buildEmberit(): SpriteDef {
  return ironBrood({ id: 'sprite-emberit', size: 16, vents: 1, stacks: 1, studs: 0 });
}

// Forgeling (20, steady) — treaded plodder: two vents, sturdier studs.
export function buildForgeling(): SpriteDef {
  return ironBrood({ id: 'sprite-forgeling', size: 20, vents: 2, stacks: 1, studs: 1 });
}

// Cindcub (20, bursty) — scrappy cinder-cub: a spark-arm + venting sparks (motif).
export function buildCindcub(): SpriteDef {
  return ironBrood({
    id: 'sprite-cindcub',
    size: 20,
    vents: 1,
    stacks: 1,
    studs: 1,
    arms: true,
    fps: 5,
    brightMotif: (c, g) => {
      sparkle(c, Math.round(g.cx + g.halfW + 2), g.bodyTop + 3, GLINT);
    },
  });
}

// Anvilisk (24, endurance) — anvil-bot: heavy, two vents, big corner studs.
export function buildAnvilisk(): SpriteDef {
  return ironBrood({ id: 'sprite-anvilisk', size: 24, vents: 2, stacks: 1, studs: 2 });
}

// Slaghorn (24, tempo) — piston-hammerer: two stacks + slag horns (motif).
export function buildSlaghorn(): SpriteDef {
  return ironBrood({
    id: 'sprite-slaghorn',
    size: 24,
    vents: 2,
    stacks: 2,
    studs: 1,
    arms: true,
    fps: 5,
    bodyMotif: (c, g) => {
      // Cooling-slag horns from the crown.
      for (const s of [-1, 1]) {
        const x = Math.round(g.cx + s * Math.round(g.halfW * 0.5));
        line(c, x, g.headTop, x + s * 2, g.headTop - 3, BODY);
      }
    },
  });
}

// Kilnox (24, breadth) — walking kiln: three vents reading heat all around.
export function buildKilnox(): SpriteDef {
  return ironBrood({ id: 'sprite-kilnox', size: 24, vents: 3, stacks: 2, studs: 1 });
}

// Smeltitan (28, high) — smelter-titan: a blazing molten core (motif), three vents.
export function buildSmeltitan(): SpriteDef {
  return ironBrood({
    id: 'sprite-smeltitan',
    size: 28,
    vents: 3,
    stacks: 2,
    studs: 2,
    arms: true,
    bodyMotif: (c, g) =>
      fillEllipse(c, Math.round(g.cx), Math.round((g.bodyTop + g.bodyBot) / 2), 3, 3, LIGHT),
    brightMotif: (c, g) =>
      sparkle(c, Math.round(g.cx), Math.round((g.bodyTop + g.bodyBot) / 2), GLINT),
  });
}

// Ironmaw (28, mid) — crusher-jaws: a toothed maw across the lower chassis (motif).
export function buildIronmaw(): SpriteDef {
  return ironBrood({
    id: 'sprite-ironmaw',
    size: 28,
    vents: 2,
    stacks: 1,
    studs: 2,
    arms: true,
    brightMotif: (c, g) => {
      const y = g.bodyBot - 2;
      for (let x = Math.round(g.cx - g.halfW + 2); x <= Math.round(g.cx + g.halfW - 2); x += 2) {
        c.set(x, y, LIGHT);
        c.set(x, y + 1, RIM_HI);
      }
    },
  });
}

// Basaltus (28, low) — basalt-sheathed: rugged dark plates, sparse calm embers.
export function buildBasaltus(): SpriteDef {
  return ironBrood({
    id: 'sprite-basaltus',
    size: 28,
    vents: 2,
    stacks: 1,
    studs: 3,
    bodyMotif: (c, g) => {
      // Cracked basalt plating lines.
      for (let i = 0; i < 3; i++) {
        const x = Math.round(g.cx - g.halfW + 2 + i * Math.round(g.halfW * 0.6));
        line(c, x, g.bodyTop + 2, x - 1, g.bodyBot - 2, SEAM);
      }
    },
  });
}

// Magmarok (32, early) — apex furnace-titan: blazing ember-seams everywhere, three stacks.
export function buildMagmarok(): SpriteDef {
  return ironBrood({
    id: 'sprite-magmarok',
    size: 32,
    vents: 4,
    stacks: 3,
    studs: 3,
    arms: true,
    bodyMotif: (c, g) =>
      fillEllipse(c, Math.round(g.cx), Math.round((g.bodyTop + g.bodyBot) / 2), 3, 3, LIGHT),
    brightMotif: (c, g, rng) => {
      sparkle(c, Math.round(g.cx), Math.round((g.bodyTop + g.bodyBot) / 2), GLINT);
      // Ember sparks rising from the stacks.
      for (let i = 0; i < 4; i++) {
        const x = Math.round(g.cx - g.halfW + rng.int(g.halfW * 2));
        c.set(x, g.bodyTop - Math.round(g.size * 0.16) - rng.int(2), GLINT);
      }
    },
  });
}

// Adamantor (32, late) — adamant apex: heavily plated, a crown of rivet-studs, pristine.
export function buildAdamantor(): SpriteDef {
  return ironBrood({
    id: 'sprite-adamantor',
    size: 32,
    vents: 3,
    stacks: 2,
    studs: 4,
    arms: true,
    brightMotif: (c, g) => {
      // A crown of studs across the head.
      for (let i = 0; i < 5; i++) {
        const x = Math.round(g.cx - g.halfW * 0.6 + (i / 4) * g.halfW * 1.2);
        c.set(x, g.headTop - 1, RIM_HI);
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
