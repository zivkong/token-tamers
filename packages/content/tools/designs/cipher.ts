/**
 * Cipher line sprite designs — the CRAG BEASTS kingdom (ground predators).
 *
 * Identity bible: docs/design/visuals-habitats-achievements.md §13 (Species identity
 * system) + the create-sprites skill. Crag Beasts are heavy, low, PLANTED predators:
 * a faceted angular CARAPACE on stubby legs, two slitted PREDATOR EYES, GLYPH-SEAMS
 * etched across the shell glowing at the joints (the PWR motif), and a BROW-BLADE/horns
 * that sharpen and multiply with stage. House tint = red; grade resolves richness.
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
  fillPolygon,
  fillRect,
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

// Flat-tone vocabulary shared by every Crag Beast.
const SEAM = 2; // etched glyph-groove (darker than shadow)
const BODY = 7;
const LIGHT = 11;

/** Geometry of a planted Crag Beast, derived once from the stage size. */
interface CragGeom {
  size: number;
  cx: number;
  groundY: number;
  bodyBot: number;
  bodyTop: number;
  halfW: number;
  legH: number;
}

interface CragOpts {
  id: string;
  size: number;
  /** Visible legs (2 = predator stance, 4 = heavy quadruped). */
  legs: number;
  /** Shoulder horn pairs flanking the central brow-blade (lineage cue: grows with stage). */
  horns: number;
  /** Brow-blade height tier (the signature spike). */
  blade: number;
  /** Glyph-seam rows etched across the carapace. */
  seams: number;
  fps?: number;
  /** Body-tone marks, drawn BEFORE shade (so they cel-shade; structural). */
  bodyMotif?: (c: PixelCanvas, g: CragGeom, rng: Lcg) => void;
  /** Bright/dark marks (glint/seam/eye), drawn AFTER shade + rimLight, BEFORE outline. */
  brightMotif?: (c: PixelCanvas, g: CragGeom, rng: Lcg) => void;
}

function cragGeom(size: number): CragGeom {
  const cx = (size - 1) / 2;
  const groundY = size - 1;
  const legH = Math.max(2, Math.round(size * 0.16));
  return {
    size,
    cx,
    groundY,
    legH,
    bodyBot: groundY - legH + 1,
    bodyTop: Math.round(size * 0.3),
    halfW: Math.round(size * 0.34),
  };
}

/** Two slitted predator eyes glaring forward, with a hot glint pupil. */
function predatorEyes(c: PixelCanvas, g: CragGeom): void {
  const ey = g.bodyTop + Math.max(1, Math.round(g.size * 0.16));
  const ex = Math.max(1, Math.round(g.size * 0.13));
  for (const s of [-1, 1]) {
    const x = Math.round(g.cx + s * ex);
    c.set(x, ey, OUTLINE);
    c.set(x + s, ey, OUTLINE);
    c.set(x + 2 * s, ey - 1, OUTLINE); // upward slant = menace
    c.set(x, ey, GLINT); // glowing pupil
  }
}

/** A central brow-blade plus `pairs` shoulder horns angling up-and-out. */
function drawHorns(c: PixelCanvas, g: CragGeom, pairs: number, blade: number): void {
  const bw = Math.max(1, Math.round(g.size * 0.06));
  const bh = Math.round(g.size * 0.16) * blade;
  // Central brow-blade (the signature).
  fillPolygon(
    c,
    [
      [Math.round(g.cx) - bw, g.bodyTop],
      [Math.round(g.cx) + bw, g.bodyTop],
      [Math.round(g.cx), g.bodyTop - bh],
    ],
    BODY,
  );
  for (let i = 0; i < pairs; i++) {
    const off = Math.round(g.halfW * (0.5 + i * 0.28));
    const h = Math.round(g.size * 0.12) + i * Math.round(g.size * 0.05);
    for (const s of [-1, 1]) {
      const baseX = Math.round(g.cx + s * off);
      fillPolygon(
        c,
        [
          [baseX, g.bodyTop + 2],
          [baseX + s, g.bodyTop + 2],
          [baseX + s * Math.round(g.size * 0.12), g.bodyTop + 2 - h],
        ],
        BODY,
      );
    }
  }
}

/** Glyph-seams: etched grooves across the shell with glowing rune-studs at the joints. */
function drawSeams(c: PixelCanvas, g: CragGeom, rows: number): void {
  for (let r = 0; r < rows; r++) {
    const y = g.bodyTop + Math.round((g.bodyBot - g.bodyTop) * ((r + 1) / (rows + 1)));
    const w = g.halfW - 1 - r;
    line(c, Math.round(g.cx - w), y, Math.round(g.cx + w), y, SEAM);
    c.set(Math.round(g.cx - w), y, GLINT);
    c.set(Math.round(g.cx + w), y, GLINT);
    if (r % 2 === 0) c.set(Math.round(g.cx), y, GLINT);
  }
}

/** The shared Crag Beast builder: one parametric ground predator + its four banks. */
function cragBeast(opts: CragOpts): SpriteDef {
  const g = cragGeom(opts.size);
  const rng = lcg(hashStr(opts.id));
  const base = PixelCanvas.create(opts.size, opts.size);

  // 1. Stubby planted legs at the base corners.
  const legW = Math.max(1, Math.round(opts.size * 0.08));
  const span = Math.round(g.halfW * 0.62);
  const xs =
    opts.legs >= 4 ? [-span, -Math.round(span * 0.3), Math.round(span * 0.3), span] : [-span, span];
  for (const dx of xs) {
    const x = Math.round(g.cx + dx);
    fillRect(base, x - legW + 1, g.bodyBot, x + legW - 1, g.groundY, BODY);
  }

  // 2. Faceted carapace dome (angular, hard-edged).
  const shoulder = g.bodyTop + Math.round(opts.size * 0.1);
  fillPolygon(
    base,
    [
      [Math.round(g.cx - g.halfW), g.bodyBot],
      [Math.round(g.cx - g.halfW + 1), shoulder],
      [Math.round(g.cx - g.halfW * 0.5), g.bodyTop],
      [Math.round(g.cx + g.halfW * 0.5), g.bodyTop],
      [Math.round(g.cx + g.halfW - 1), shoulder],
      [Math.round(g.cx + g.halfW), g.bodyBot],
    ],
    BODY,
  );

  // 3. Horns + central brow-blade.
  drawHorns(base, g, opts.horns, opts.blade);

  // 4. Structural body-tone motif (asymmetric features that should still cel-shade).
  opts.bodyMotif?.(base, g, rng);

  // 5. Hard cel shading lit from upper-left; rim-light the top facets.
  const bands = opts.size >= 24 ? 6 : 5;
  shade(base, { dir: 'upper-left', bands, lo: 4, hi: 12, dither: false });
  rimLight(base, 'upper-left');

  // 6. Glyph-seams + predator eyes + bright motif (post-shade so they stay crisp).
  drawSeams(base, g, opts.seams);
  predatorEyes(base, g);
  // Brow-blade tip catch-light keeps the signature reading.
  base.set(Math.round(g.cx), g.bodyTop - Math.round(opts.size * 0.16) * opts.blade, RIM_HI);
  opts.brightMotif?.(base, g, rng);

  // 7. Crisp 1px silhouette last.
  outline(base);

  // ---- Animation banks (a grounded predator: stomp, pounce, head-butt) ----
  const idle = [base.grid, bobFrame(base, -1).grid];
  const walk = [base.grid, shiftFrame(base, 1, 0).grid];
  const jump = [shiftFrame(base, 0, 1).grid, shiftFrame(base, 0, -2).grid];
  const lunge = shiftFrame(base, 1, 0);
  sparkle(lunge, Math.round(g.cx + g.halfW + 1), g.bodyTop, GLINT);
  const play = [lunge.grid, shiftFrame(base, -1, 0).grid];

  return { ...buildSprite(opts.id, idle, opts.fps ?? 4), walk, jump, play };
}

// ---------------------------------------------------------------------------
// Crag Beasts line — horns/blade sharpen, seams multiply, stance widens to 4 legs.
// ---------------------------------------------------------------------------

// Glyphit (16) — compact angular cub: one brow-blade, two legs, a single glyph seam.
export function buildGlyphit(): SpriteDef {
  return cragBeast({ id: 'sprite-glyphit', size: 16, legs: 2, horns: 0, blade: 1, seams: 1 });
}

// Cipherling (20, steady) — bulkier plated juvenile: a horn pair, two seams.
export function buildCipherling(): SpriteDef {
  return cragBeast({ id: 'sprite-cipherling', size: 20, legs: 2, horns: 1, blade: 1, seams: 2 });
}

// Bitfang (20, bursty) — lean striker: tall brow-blade + jutting lower fangs (its motif).
export function buildBitfang(): SpriteDef {
  return cragBeast({
    id: 'sprite-bitfang',
    size: 20,
    legs: 2,
    horns: 1,
    blade: 2,
    seams: 1,
    fps: 5,
    brightMotif: (c, g) => {
      const fy = g.bodyBot - 1;
      for (const s of [-1, 1]) {
        const x = Math.round(g.cx + s * Math.round(g.size * 0.1));
        c.set(x, fy, LIGHT);
        c.set(x, fy + 1, RIM_HI);
      }
    },
  });
}

// Runeclaw (24, endurance) — massive rune-claws (its motif), heavy 4-leg stance.
export function buildRuneclaw(): SpriteDef {
  return cragBeast({
    id: 'sprite-runeclaw',
    size: 24,
    legs: 4,
    horns: 1,
    blade: 1,
    seams: 2,
    bodyMotif: (c, g) => {
      // Big curved claws sweeping forward from the lower flanks.
      for (const s of [-1, 1]) {
        const x = Math.round(g.cx + s * (g.halfW + 1));
        fillPolygon(
          c,
          [
            [x, g.bodyBot - 2],
            [x + s * 3, g.bodyBot - 1],
            [x + s * 4, g.bodyBot - 4],
            [x + s, g.bodyBot - 3],
          ],
          BODY,
        );
      }
    },
  });
}

// Vectorix (24, tempo) — geometric runner: extra mid legs + bright vector-edges (its motif).
export function buildVectorix(): SpriteDef {
  return cragBeast({
    id: 'sprite-vectorix',
    size: 24,
    legs: 4,
    horns: 2,
    blade: 1,
    seams: 1,
    fps: 5,
    brightMotif: (c, g) => {
      // Diagonal vector trajectories across the shell.
      for (const s of [-1, 1]) {
        line(
          c,
          Math.round(g.cx),
          g.bodyTop + 2,
          Math.round(g.cx + s * g.halfW),
          g.bodyBot - 2,
          LIGHT,
        );
      }
    },
  });
}

// Glyphound (24, breadth) — hound with a hash-coat: an extra eye pair + scattered glyph glints.
export function buildGlyphound(): SpriteDef {
  return cragBeast({
    id: 'sprite-glyphound',
    size: 24,
    legs: 4,
    horns: 1,
    blade: 1,
    seams: 2,
    brightMotif: (c, g, rng) => {
      // A second, smaller eye pair (breadth = more senses).
      const ey = g.bodyTop + Math.round(g.size * 0.3);
      for (const s of [-1, 1]) c.set(Math.round(g.cx + s * Math.round(g.size * 0.22)), ey, GLINT);
      // Hash-coat speckle of rune-studs.
      for (let i = 0; i < 5; i++) {
        const x = Math.round(g.cx + (rng.int(g.halfW * 2) - g.halfW));
        const y = g.bodyTop + 2 + rng.int(g.bodyBot - g.bodyTop - 3);
        if (c.get(x, y) > 0) c.set(x, y, GLINT);
      }
    },
  });
}

// Cryptarch (28, high consistency) — regal archon: a key-crown of horns, full seams.
export function buildCryptarch(): SpriteDef {
  return cragBeast({
    id: 'sprite-cryptarch',
    size: 28,
    legs: 4,
    horns: 3,
    blade: 2,
    seams: 3,
    brightMotif: (c, g) => {
      // Crown-jewel glint set above the brow-blade.
      sparkle(c, Math.round(g.cx), g.bodyTop - Math.round(g.size * 0.28), GLINT);
    },
  });
}

// Matrixion (28, mid) — living decision-matrix: a grid of node-glints across the shell.
export function buildMatrixion(): SpriteDef {
  return cragBeast({
    id: 'sprite-matrixion',
    size: 28,
    legs: 4,
    horns: 2,
    blade: 1,
    seams: 2,
    brightMotif: (c, g) => {
      for (let r = 0; r < 3; r++) {
        for (let col = -1; col <= 1; col++) {
          const x = Math.round(g.cx + col * Math.round(g.size * 0.16));
          const y = g.bodyTop + 4 + r * Math.round(g.size * 0.13);
          if (c.get(x, y) > 0) c.set(x, y, GLINT);
        }
      }
    },
  });
}

// Sigilus (28, low consistency) — sealed sigils: an asymmetric rewriting sigil-ring (its motif).
export function buildSigilus(): SpriteDef {
  return cragBeast({
    id: 'sprite-sigilus',
    size: 28,
    legs: 2,
    horns: 2,
    blade: 1,
    seams: 3,
    brightMotif: (c, g) => {
      // A ring of sigil-studs (the ever-rewriting seal).
      const r = Math.round(g.size * 0.2);
      const cy = Math.round((g.bodyTop + g.bodyBot) / 2);
      for (let a = 0; a < 6; a++) {
        const ang = (a / 6) * Math.PI * 2;
        const x = Math.round(g.cx + Math.cos(ang) * r);
        const y = Math.round(cy + Math.sin(ang) * r * 0.7);
        if (c.get(x, y) > 0) c.set(x, y, GLINT);
      }
    },
  });
}

// Enigmax (32, early arc) — the unsolvable enigma: dense horns + a fractured glyph-storm.
export function buildEnigmax(): SpriteDef {
  return cragBeast({
    id: 'sprite-enigmax',
    size: 32,
    legs: 4,
    horns: 4,
    blade: 3,
    seams: 4,
    brightMotif: (c, g, rng) => {
      // A storm of indecipherable glyph-glints scattered over the shell.
      for (let i = 0; i < 9; i++) {
        const x = Math.round(g.cx + (rng.int(g.halfW * 2) - g.halfW));
        const y = g.bodyTop + 2 + rng.int(g.bodyBot - g.bodyTop - 3);
        if (c.get(x, y) > 0) c.set(x, y, GLINT);
      }
    },
  });
}

// Keystrix (32, late arc) — the master key: a great key-blade + a jeweled crown.
export function buildKeystrix(): SpriteDef {
  return cragBeast({
    id: 'sprite-keystrix',
    size: 32,
    legs: 4,
    horns: 2,
    blade: 3,
    seams: 3,
    bodyMotif: (c, g) => {
      // Key-teeth notched into the base of the tall brow-blade.
      const bx = Math.round(g.cx);
      const by = g.bodyTop - Math.round(g.size * 0.16);
      fillRect(c, bx + 1, by, bx + 3, by + 1, BODY);
      fillRect(c, bx + 1, by + 3, bx + 2, by + 4, BODY);
    },
    brightMotif: (c, g) => {
      sparkle(c, Math.round(g.cx), g.bodyTop - Math.round(g.size * 0.34), GLINT);
      sparkle(c, Math.round(g.cx - g.halfW * 0.6), g.bodyTop - 1, GLINT);
      sparkle(c, Math.round(g.cx + g.halfW * 0.6), g.bodyTop - 1, GLINT);
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
