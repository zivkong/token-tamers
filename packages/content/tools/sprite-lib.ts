/**
 * sprite-lib — a composable pixel-art drawing toolkit for Token Tamers sprites.
 *
 * ===========================================================================
 * ARTIST API CHEAT-SHEET (read this; it is fast)
 * ===========================================================================
 *
 * Everything draws into a mutable INDEX grid: `grid[y][x]` = palette index.
 *   0           = transparent (the backdrop shows through)
 *   1           = darkest / 1px outline (reserve this for `outline`)
 *   1 .. 14     = the shading ramp, 1 = darkest, 14 = lightest
 *   13 .. 14    = rim-light highlights (use `rimLight`)
 *   15          = animated glint slot (sparkles / runes that shimmer at S)
 * Author RICH index variety: depth comes from MANY indices, not 3 flat ones.
 * The render-time palette collapses the ramp for C and expands it for S, so a
 * body painted with ~indices 3..12 reads great at every grade.
 *
 * TYPICAL CREATURE RECIPE (mirror-then-shade-then-edge):
 *   const c = PixelCanvas.create(24, 24);          // even W/H, the stage size (16..36)
 *   fillEllipse(c, 12, 14, 7, 8, 8);               // body mass, mid-ramp
 *   fillEllipse(c, 12, 7, 4, 4, 9);                // head
 *   bezier(c, 17, 9, 23, 3, 21, 12, 5);            // a horn / tail wisp / wing
 *   // ... draw only the LEFT half, then:
 *   mirrorX(c);                                     // bilateral symmetry
 *   shade(c, { dir: 'upper-left', bands: 8, lo: 3, hi: 12, dither: true });
 *   rimLight(c, 'upper-left');                       // index 13/14 lit edge
 *   outline(c);                                      // 1px index-1 silhouette
 *   sparkle(c, 30, 10);                              // optional index-15 glint
 *   const frames = [c.grid, bobFrame(c, 1).grid];    // idle bob
 *   const def = buildSprite('sprite-foo', frames, 2);
 *
 * SIZE LAW (octant art direction v2, 2026-06-16 — the content-pack test is the gate):
 *   - pets: EXACTLY square, even (height divisible by 4 for clean octant 2x4 packing),
 *           by stage — egg 16, sprite 20, rookie 24, evolved 28, prime 32, apex 36
 *           (apex 36 is the renderer's safe ceiling). Each House = a creature Kingdom
 *           body-plan (Sky Court / Crag Beasts / Tide Runners / Iron Brood / Bloom);
 *           see the create-sprites skill.
 *   - habitats: 128x96 (4:3) · trinkets: 28x28
 *
 * DETERMINISM: never use Math.random / Date.now in a design module. Use the
 * seeded `lcg(seed)` here for any "random" scatter so output is reproducible.
 *
 * ORDER OF OPS MATTERS: fill shapes -> mirrorX -> shade -> rimLight -> outline
 * -> decals/sparkle. `outline` traces the OUTSIDE edge with index 1, so run it
 * after shading or the ramp will overwrite the outline.
 * ===========================================================================
 */

import type { SpriteDef } from '@token-tamers/core';

// ---------------------------------------------------------------------------
// Ramp constants — the shared vocabulary of indices.
// ---------------------------------------------------------------------------

/** Darkest ramp index; reserved for the 1px silhouette outline. */
export const OUTLINE = 1;
/** First "body" index (above outline). Shading bands default to start here. */
export const RAMP_LO = 3;
/** Last solid body index before rim-light territory. */
export const RAMP_HI = 12;
/** Rim-light indices (brightest solid colors) for the lit silhouette edge. */
export const RIM_LO = 13;
export const RIM_HI = 14;
/** Animated glint slot — sparkles, rune marks that shimmer at S grade. */
export const GLINT = 15;
/**
 * Per-species SIGNATURE ACCENT band (art direction v2). A SECONDARY color, NOT the
 * House hue: indices 16/17/18 (dark→light) resolve at render time from the species'
 * accent color (the renderer's `buildPalette` accent arg). Use for one signature
 * feature (crest, gem, fins, vents, petals, eye-glow) at ~10–20% of colored pixels —
 * the House hue still dominates (~70–85%, indices 2..14). Paint accent AFTER `shade`
 * (or use `shade({ onlyBelow: RIM_HI })`) so it survives the body re-index.
 */
export const ACCENT_LO = 16;
export const ACCENT_MID = 17;
export const ACCENT_HI = 18;
/** Soft cream belly/underside tone (use sparingly), resolved at render time. */
export const BELLY = 20;

// ---------------------------------------------------------------------------
// Deterministic LCG (no Math.random — required for reproducible assets).
// ---------------------------------------------------------------------------

export interface Lcg {
  /** Next float in [0, 1). */
  next(): number;
  /** Next integer in [0, n). */
  int(n: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
}

/** Seeded LCG. Pass a fixed number (or `hashStr(id)`) for stable scatter. */
export function lcg(seed: number): Lcg {
  let s = seed >>> 0 || 1;
  const next = (): number => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    chance: (p: number) => next() < p,
  };
}

/** FNV-1a string hash → a stable 32-bit seed from a sprite id. */
export function hashStr(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// PixelCanvas — a mutable index grid with safe, clipping accessors.
// ---------------------------------------------------------------------------

export class PixelCanvas {
  readonly width: number;
  readonly height: number;
  /** Row-major index grid; grid[y][x]. Mutable — ops write directly. */
  readonly grid: number[][];

  private constructor(width: number, height: number, grid: number[][]) {
    this.width = width;
    this.height = height;
    this.grid = grid;
  }

  /** New transparent (all-0) canvas. */
  static create(width: number, height: number): PixelCanvas {
    const grid = Array.from({ length: height }, () => new Array<number>(width).fill(0));
    return new PixelCanvas(width, height, grid);
  }

  /** Wrap an existing grid (rows may be ragged; width/height are explicit). */
  static from(grid: number[][], width: number, height: number): PixelCanvas {
    return new PixelCanvas(width, height, grid);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /** Read an index; out-of-bounds reads return 0 (transparent). */
  get(x: number, y: number): number {
    if (!this.inBounds(x, y)) return 0;
    return this.grid[y]?.[x] ?? 0;
  }

  /** Write an index; out-of-bounds writes are silently clipped. */
  set(x: number, y: number, index: number): void {
    if (!this.inBounds(x, y)) return;
    const row = this.grid[y];
    if (row) row[x] = index | 0;
  }

  /** Deep clone (independent grid). */
  clone(): PixelCanvas {
    return PixelCanvas.from(
      this.grid.map((r) => [...r]),
      this.width,
      this.height,
    );
  }

  /** Visit every non-transparent pixel. */
  forEach(fn: (x: number, y: number, index: number) => void): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const v = this.grid[y]?.[x] ?? 0;
        if (v > 0) fn(x, y, v);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Primitive shapes — all clip safely against canvas bounds.
// ---------------------------------------------------------------------------

/**
 * Set a SINGLE pixel — the smallest deliberate mark. Alias of `dot`/`PixelCanvas.set`
 * with the argument order artists think in: (x, y, index). Clips out of bounds.
 */
export function px(c: PixelCanvas, x: number, y: number, index: number): void {
  c.set(x, y, index);
}

/**
 * 1px Bresenham line from (x0,y0) to (x1,y1). Unlike `thickLine` this is exactly
 * one pixel wide with no rounding gaps — ideal for tiny art (whiskers, antennae,
 * scene contours). For thickness > 1 use `thickLine`.
 */
export function line(
  c: PixelCanvas,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  index: number,
): void {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - x);
  const dy = -Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx + dy;
  // Guard against pathological inputs; the longest 1px line fits the canvas.
  let guard = (c.width + c.height) * 2 + 4;
  for (;;) {
    c.set(x, y, index);
    if ((x === tx && y === ty) || guard-- <= 0) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/**
 * Filled ellipse tuned to read cleanly at SMALL radii (2..6) where the generic
 * `fillEllipse` distance test leaves lopsided or single-pixel-spike edges. Uses a
 * symmetric per-row half-width so radius-2..6 blobs are round and balanced; this
 * is the go-to for eyes, cheeks, berries, paws and other tiny features. For large
 * masses keep using `fillEllipse`.
 */
export function smallEllipse(
  c: PixelCanvas,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  index: number,
): void {
  if (rx <= 0 || ry <= 0) return;
  for (let dy = -ry; dy <= ry; dy++) {
    // Half-width at this row from the ellipse equation, rounded to keep
    // small radii symmetric (no single-pixel spikes at the poles).
    const frac = 1 - (dy * dy) / (ry * ry);
    if (frac < 0) continue;
    const halfW = Math.round(rx * Math.sqrt(frac));
    for (let dx = -halfW; dx <= halfW; dx++) {
      c.set(cx + dx, cy + dy, index);
    }
  }
}

/** Eye rendering styles for the `eyes` helper. */
export type EyeStyle = 'dot' | 'round' | 'sleepy' | 'wide';

/**
 * Stamp ONE eye at (x,y) in a small consistent style. The eye is drawn with the
 * outline index for the pupil and a rim-light pixel for the catch-light so it
 * reads at tiny sizes. Call once per eye (typically before `mirrorX`, on the left
 * eye only). Styles:
 *   'dot'    — a single dark pixel (the simplest, for C-grade / tiny pets)
 *   'round'  — a 2px pupil with a 1px white catch-light (the default)
 *   'wide'   — a 3px-wide round eye for expressive faces
 *   'sleepy' — a 1px horizontal lid line (half-closed)
 */
export function eyes(c: PixelCanvas, x: number, y: number, style: EyeStyle = 'round'): void {
  switch (style) {
    case 'dot':
      c.set(x, y, OUTLINE);
      return;
    case 'sleepy':
      c.set(x - 1, y, OUTLINE);
      c.set(x, y, OUTLINE);
      c.set(x + 1, y, OUTLINE);
      return;
    case 'wide':
      smallEllipse(c, x, y, 2, 2, OUTLINE);
      c.set(x - 1, y - 1, RIM_HI); // catch-light
      return;
    case 'round':
    default:
      c.set(x, y, OUTLINE);
      c.set(x + 1, y, OUTLINE);
      c.set(x, y + 1, OUTLINE);
      c.set(x + 1, y + 1, OUTLINE);
      c.set(x, y, RIM_HI); // catch-light pixel
      return;
  }
}

/** Filled axis-aligned ellipse centered at (cx,cy) with radii (rx,ry). */
export function fillEllipse(
  c: PixelCanvas,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  index: number,
): void {
  if (rx <= 0 || ry <= 0) return;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) c.set(x, y, index);
    }
  }
}

/** 1px stroked ellipse outline (no fill). */
export function strokeEllipse(
  c: PixelCanvas,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  index: number,
): void {
  if (rx <= 0 || ry <= 0) return;
  const inside = (x: number, y: number): boolean => {
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    return dx * dx + dy * dy <= 1;
  };
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (!inside(x, y)) continue;
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) {
        c.set(x, y, index);
      }
    }
  }
}

/** Filled circle (ellipse with equal radii). */
export function fillCircle(c: PixelCanvas, cx: number, cy: number, r: number, index: number): void {
  fillEllipse(c, cx, cy, r, r, index);
}

/** Filled axis-aligned rectangle [x0,x1] x [y0,y1] inclusive. */
export function fillRect(
  c: PixelCanvas,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  index: number,
): void {
  const lx = Math.min(x0, x1);
  const hx = Math.max(x0, x1);
  const ly = Math.min(y0, y1);
  const hy = Math.max(y0, y1);
  for (let y = ly; y <= hy; y++) {
    for (let x = lx; x <= hx; x++) c.set(x, y, index);
  }
}

/** 1px stroked rectangle border. */
export function strokeRect(
  c: PixelCanvas,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  index: number,
): void {
  const lx = Math.min(x0, x1);
  const hx = Math.max(x0, x1);
  const ly = Math.min(y0, y1);
  const hy = Math.max(y0, y1);
  for (let x = lx; x <= hx; x++) {
    c.set(x, ly, index);
    c.set(x, hy, index);
  }
  for (let y = ly; y <= hy; y++) {
    c.set(lx, y, index);
    c.set(hx, y, index);
  }
}

/** Filled convex polygon via scanline. `pts` = [[x,y], ...] in any winding. */
export function fillPolygon(c: PixelCanvas, pts: Array<[number, number]>, index: number): void {
  if (pts.length < 3) return;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, py] of pts) {
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      const [ax, ay] = a;
      const [bx, by] = b;
      if (ay === by) continue;
      if ((y >= ay && y < by) || (y >= by && y < ay)) {
        xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.ceil(xs[i]!); x <= Math.floor(xs[i + 1]!); x++) c.set(x, y, index);
    }
  }
}

/** Thick line from (x0,y0) to (x1,y1) with the given pixel thickness. */
export function thickLine(
  c: PixelCanvas,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  index: number,
  thickness = 1,
): void {
  const r = Math.max(0, (thickness - 1) / 2);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    if (r <= 0) {
      c.set(Math.round(px), Math.round(py), index);
    } else {
      fillCircle(c, Math.round(px), Math.round(py), Math.round(r), index);
    }
  }
}

/** Quadratic bezier (P0 -> control -> P1), tapering thickness end-to-end. */
export function bezier(
  c: PixelCanvas,
  x0: number,
  y0: number,
  cxp: number,
  cyp: number,
  x1: number,
  y1: number,
  index: number,
  startThickness = 2,
  endThickness = 1,
): void {
  const approx = Math.hypot(cxp - x0, cyp - y0) + Math.hypot(x1 - cxp, y1 - cyp);
  const steps = Math.max(2, Math.ceil(approx));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const u = 1 - t;
    const px = u * u * x0 + 2 * u * t * cxp + t * t * x1;
    const py = u * u * y0 + 2 * u * t * cyp + t * t * y1;
    const th = startThickness + (endThickness - startThickness) * t;
    const r = Math.max(0, Math.round((th - 1) / 2));
    if (r <= 0) c.set(Math.round(px), Math.round(py), index);
    else fillCircle(c, Math.round(px), Math.round(py), r, index);
  }
}

// ---------------------------------------------------------------------------
// mirrorX — bilateral symmetry, the workhorse for creature bodies.
// ---------------------------------------------------------------------------

/**
 * Mirror the canvas across a vertical axis (default = exact horizontal center).
 * Every non-transparent pixel on one side is copied to the other; existing
 * pixels on the far side are overwritten only where the source is non-zero, so
 * draw ONE half and call this to get a symmetric monster.
 */
export function mirrorX(c: PixelCanvas, axis?: number): void {
  const ax = axis ?? (c.width - 1) / 2;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const v = c.get(x, y);
      if (v <= 0) continue;
      const mx = Math.round(2 * ax - x);
      if (mx !== x) c.set(mx, y, v);
    }
  }
}

// ---------------------------------------------------------------------------
// shade — directional / radial ramp shading with ordered dithering.
// ---------------------------------------------------------------------------

export type LightDir = 'upper-left' | 'upper-right' | 'top' | 'left' | 'right' | 'radial';

export interface ShadeOptions {
  /** Light direction. Default 'upper-left' (the house style). */
  dir?: LightDir;
  /** Number of distinct ramp bands. Default 8. */
  bands?: number;
  /** Lowest ramp index used (darkest body). Default RAMP_LO (3). */
  lo?: number;
  /** Highest ramp index used (brightest body, pre rim-light). Default RAMP_HI. */
  hi?: number;
  /** Apply 2x2 ordered dither between adjacent bands for smooth gradients. */
  dither?: boolean;
  /** Only re-index pixels at/below this index (preserve decals above it). */
  onlyBelow?: number;
}

/** Bayer 2x2 ordered-dither matrix, normalized to [0,1). */
const BAYER2 = [
  [0 / 4, 2 / 4],
  [3 / 4, 1 / 4],
];

/**
 * Remap every filled pixel to a ramp index based on a light-direction gradient,
 * with optional ordered dithering between bands. Run AFTER shapes+mirrorX and
 * BEFORE outline/rimLight. Bodies typically span indices ~3..12.
 */
export function shade(c: PixelCanvas, opts: ShadeOptions = {}): void {
  const dir = opts.dir ?? 'upper-left';
  const bands = Math.max(2, opts.bands ?? 8);
  const lo = opts.lo ?? RAMP_LO;
  const hi = opts.hi ?? RAMP_HI;
  const dither = opts.dither ?? true;
  const onlyBelow = opts.onlyBelow ?? Infinity;

  // Compute the lit-ness gradient extent over filled pixels.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  c.forEach((x, y) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });
  if (minX > maxX) return;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const maxR = Math.max(1, Math.hypot(spanX, spanY) / 2);

  // brightness(x,y) in [0,1]; 1 = brightest (lit), 0 = darkest (shadow).
  const brightness = (x: number, y: number): number => {
    switch (dir) {
      case 'upper-left':
        return 1 - ((x - minX) / spanX + (y - minY) / spanY) / 2;
      case 'upper-right':
        return 1 - ((maxX - x) / spanX + (y - minY) / spanY) / 2;
      case 'top':
        return 1 - (y - minY) / spanY;
      case 'left':
        return 1 - (x - minX) / spanX;
      case 'right':
        return 1 - (maxX - x) / spanX;
      case 'radial':
        return 1 - Math.min(1, Math.hypot(x - cx, y - cy) / maxR);
    }
  };

  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const cur = c.get(x, y);
      if (cur <= 0 || cur > onlyBelow) continue;
      let b = brightness(x, y);
      if (dither) {
        // Nudge by sub-band dither so adjacent bands interleave in a checker.
        const d = BAYER2[y & 1]?.[x & 1] ?? 0;
        b += (d - 0.5) / bands;
      }
      b = b < 0 ? 0 : b > 1 ? 1 : b;
      const band = Math.min(bands - 1, Math.floor(b * bands));
      const index = lo + Math.round((band / (bands - 1)) * (hi - lo));
      c.set(x, y, index);
    }
  }
}

// ---------------------------------------------------------------------------
// outline — trace the silhouette with index 1 (1px, outside edge).
// ---------------------------------------------------------------------------

/**
 * Add a 1px dark outline OUTSIDE the filled silhouette (transparent cells that
 * border a filled cell become index 1). This keeps interior shading intact and
 * gives the crisp "modern sprite" edge. 8-connected so diagonals are covered.
 */
export function outline(c: PixelCanvas, index = OUTLINE): void {
  const filled = (x: number, y: number): boolean => c.get(x, y) > 0;
  const toMark: Array<[number, number]> = [];
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (filled(x, y)) continue;
      let touches = false;
      for (let dy = -1; dy <= 1 && !touches; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (filled(x + dx, y + dy)) {
            touches = true;
            break;
          }
        }
      }
      if (touches) toMark.push([x, y]);
    }
  }
  for (const [x, y] of toMark) c.set(x, y, index);
}

// ---------------------------------------------------------------------------
// rimLight — brightest indices on the lit silhouette edge (the signature pop).
// ---------------------------------------------------------------------------

/**
 * Paint rim-light (indices 13/14) on the filled pixels that sit on the lit edge
 * of the silhouette — i.e. body pixels whose outward neighbor (toward the light)
 * is transparent. Run AFTER shade, BEFORE outline (outline sits just outside).
 */
export function rimLight(c: PixelCanvas, dir: LightDir = 'upper-left'): void {
  const [nx, ny] = lightNormal(dir);
  const out: Array<[number, number, number]> = [];
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (c.get(x, y) <= 0) continue;
      // On the lit edge if the cell toward the light source is empty.
      const litEmpty = c.get(x + nx, y + ny) <= 0;
      const litEmptyX = c.get(x + nx, y) <= 0;
      const litEmptyY = c.get(x, y + ny) <= 0;
      if (litEmpty || litEmptyX || litEmptyY) {
        // Corner-most pixels get the very brightest (14), edges get 13.
        const idx = litEmptyX && litEmptyY ? RIM_HI : RIM_LO;
        out.push([x, y, idx]);
      }
    }
  }
  for (const [x, y, idx] of out) c.set(x, y, idx);
}

function lightNormal(dir: LightDir): [number, number] {
  switch (dir) {
    case 'upper-left':
      return [-1, -1];
    case 'upper-right':
      return [1, -1];
    case 'top':
      return [0, -1];
    case 'left':
      return [-1, 0];
    case 'right':
      return [1, 0];
    case 'radial':
      return [-1, -1];
  }
}

// ---------------------------------------------------------------------------
// Decals & stamps — small marks for detail and personality.
// ---------------------------------------------------------------------------

/** 4-point star stamp (a bright cross + center). Default uses the glint slot. */
export function sparkle(c: PixelCanvas, x: number, y: number, index = GLINT): void {
  c.set(x, y, index);
  c.set(x - 1, y, index);
  c.set(x + 1, y, index);
  c.set(x, y - 1, index);
  c.set(x, y + 1, index);
}

/** Diamond stamp of the given radius. */
export function diamond(c: PixelCanvas, x: number, y: number, r: number, index: number): void {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) + Math.abs(dy) <= r) c.set(x + dx, y + dy, index);
    }
  }
}

/** Single dot (a clipped set). */
export function dot(c: PixelCanvas, x: number, y: number, index: number): void {
  c.set(x, y, index);
}

/**
 * Stamp a small rune-like glyph from a 0/1 bitmap (row-major). Non-zero cells
 * are written with `index` (default GLINT so the mark shimmers at S grade).
 * Use for Cipher sigils, Aether runes, decorative marks.
 */
export function glyphStamp(
  c: PixelCanvas,
  x: number,
  y: number,
  bitmap: number[][],
  index = GLINT,
): void {
  for (let r = 0; r < bitmap.length; r++) {
    const row = bitmap[r];
    if (!row) continue;
    for (let col = 0; col < row.length; col++) {
      if (row[col]) c.set(x + col, y + r, index);
    }
  }
}

/**
 * Scatter `count` deterministic detail pixels of `index` onto already-filled
 * body pixels within an optional bounding box. Useful for speckles, sparkle
 * fields, texture. Driven by a seeded LCG so output is reproducible.
 */
export function scatter(
  c: PixelCanvas,
  rng: Lcg,
  count: number,
  index: number,
  box?: { x0: number; y0: number; x1: number; y1: number },
): void {
  const x0 = box?.x0 ?? 0;
  const y0 = box?.y0 ?? 0;
  const x1 = box?.x1 ?? c.width - 1;
  const y1 = box?.y1 ?? c.height - 1;
  const w = Math.max(1, x1 - x0 + 1);
  const h = Math.max(1, y1 - y0 + 1);
  let placed = 0;
  let guard = count * 40;
  while (placed < count && guard-- > 0) {
    const x = x0 + rng.int(w);
    const y = y0 + rng.int(h);
    if (c.get(x, y) > 0) {
      c.set(x, y, index);
      placed++;
    }
  }
}

// ---------------------------------------------------------------------------
// Frame helpers — turn one canvas into an animated SpriteDef.
// ---------------------------------------------------------------------------

/** Return a copy shifted vertically by `dy` (positive = down) — idle bob. */
export function bobFrame(c: PixelCanvas, dy: number): PixelCanvas {
  const out = PixelCanvas.create(c.width, c.height);
  c.forEach((x, y, idx) => out.set(x, y + dy, idx));
  return out;
}

/** Return a copy shifted horizontally by `dx` — sway / drift. */
export function shiftFrame(c: PixelCanvas, dx: number, dy = 0): PixelCanvas {
  const out = PixelCanvas.create(c.width, c.height);
  c.forEach((x, y, idx) => out.set(x + dx, y + dy, idx));
  return out;
}

/** An eye box: a small rectangle the blink frame flattens to a closed line. */
export interface EyeBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Produce a blink variant: within each eye box, clear the eye and draw a 1px
 * closed-eye line (index OUTLINE) across the vertical middle. The surrounding
 * body is preserved by sampling the body index just outside the box.
 */
export function blink(c: PixelCanvas, eyeBoxes: EyeBox[]): PixelCanvas {
  const out = c.clone();
  for (const box of eyeBoxes) {
    const midY = Math.round((box.y0 + box.y1) / 2);
    // Body color to backfill the cleared eye: sample just above the box.
    const fill = c.get(Math.round((box.x0 + box.x1) / 2), box.y0 - 1) || RAMP_LO;
    for (let y = box.y0; y <= box.y1; y++) {
      for (let x = box.x0; x <= box.x1; x++) {
        out.set(x, y, y === midY ? OUTLINE : fill);
      }
    }
  }
  return out;
}

/**
 * A single authoring edit applied to a clone of the base canvas to produce one
 * animation frame. `draw` receives a fresh clone of the base each call, so a
 * delta only describes what CHANGES this frame (a leg lifts, the body bobs) —
 * the rest of the body comes along automatically from the base.
 */
export type FrameDelta = (frame: PixelCanvas, index: number) => void;

/**
 * Author an animation bank as small edits of a base canvas. For each delta we
 * clone `base`, run the delta, and collect the resulting grid — so a walk/jump/
 * play bank is a handful of tiny diffs instead of N fully redrawn canvases. The
 * returned grids share the base's dims (the contract animation banks require:
 * same width/height as the idle `frames`).
 *
 *   const walk = framesFromDeltas(base, [
 *     (f) => {},                                  // contact pose = the base
 *     (f, i) => { line(f, 18, 30, 18, 33, i); },   // lead leg forward
 *     (f) => bobInto(f, 1),                        // mid-stride bob
 *     (f, i) => { line(f, 22, 30, 22, 33, i); },   // trail leg forward
 *   ]);
 *   const def: SpriteDef = { ...buildSprite(id, [base], 6), walk };
 */
export function framesFromDeltas(
  base: PixelCanvas,
  deltas: FrameDelta[],
  index = RAMP_LO,
): number[][][] {
  return deltas.map((delta) => {
    const frame = base.clone();
    delta(frame, index);
    return frame.grid;
  });
}

/** Assemble a SpriteDef from canvases (or raw grids) at the given fps. */
export function buildSprite(
  id: string,
  frames: Array<PixelCanvas | number[][]>,
  fps: number,
): SpriteDef {
  const grids = frames.map((f) => (f instanceof PixelCanvas ? f.grid : f));
  const first = grids[0] ?? [];
  const height = first.length;
  const width = first[0]?.length ?? 0;
  return { id, width, height, frames: grids, fps };
}
