/**
 * Scenery sprite designs — habitats (backgrounds) + trinkets (toys/objects).
 *
 * OCTANT SIZE LAW (2026-06-17 revamp — SUPERSEDES the old 96x48 / 20x20 law):
 *   - habitats: EXACTLY 128x96 (4:3) — real sky + midground + ground/foreground
 *     depth (parallax layers), richer multi-color scenes, 2-3 animated frames.
 *   - trinkets: EXACTLY 28x28, 2 frames — detailed, charming, toy-like objects.
 * The content-pack test enforces width/height === 128/96 for habitats and 28 for
 * trinkets. Pets author at their stage size (egg 16 .. apex 36) — see sprite-lib.
 *
 * All scenes use a palette-indexed ramp (0 = transparent). Every habitat declares
 * a direct multi-color `palette` of 8..15 hexes in habitats.json; the renderer
 * maps sprite index N -> palette[N-1] with NO grade ladder and NO dimming — the
 * scene owns its colors. The per-habitat palette index contract (same meanings
 * as the JSON palette ordering) is documented per builder below.
 *
 * Generic multi-color palette index contract (1..15):
 *   1 = darkest shadow / deep background      9 = light accent
 *   2 = deep shadow / outline                10 = bright highlight
 *   3 = shadow / back-depth                  11 = sky/ceiling primary
 *   4 = mid-shadow / ground-dark             12 = cloud / bright surface
 *   5 = mid / distant color                  13 = rim / near-white highlight
 *   6 = mid-light                            14 = brightest solid
 *   7 = floor/ground dominant                15 = glint / twinkle (animated)
 *   8 = foreground mid
 *
 * trinketSlots (anchor coords in habitats.json) are authored for the 128x96 canvas.
 *
 * Deterministic: seeded LCG only (no Math.random / Date.now).
 */

import {
  PixelCanvas,
  buildSprite,
  fillRect,
  fillEllipse,
  fillCircle,
  strokeEllipse,
  strokeRect,
  dot,
  line,
  thickLine,
  lcg,
  hashStr,
} from '../sprite-lib';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const HW = 128; // habitat width  (4:3)
const HH = 96; // habitat height

const TW = 28; // trinket width
const TH = 28; // trinket height

/**
 * Paint a vertical sky gradient: for each row pick a palette index from `bands`,
 * an array of { until, idx } stops sorted ascending by `until` (exclusive top).
 */
function skyGradient(c: PixelCanvas, bands: Array<{ until: number; idx: number }>): void {
  for (let y = 0; y < HH; y++) {
    let idx = bands[bands.length - 1]?.idx ?? 0;
    for (const b of bands) {
      if (y < b.until) {
        idx = b.idx;
        break;
      }
    }
    for (let x = 0; x < HW; x++) c.set(x, y, idx);
  }
}

/** A drifting parallax cloud puff: stacked ellipses with a bright top + soft base. */
function cloud(
  c: PixelCanvas,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  shadow: number,
  body: number,
  top: number,
): void {
  fillEllipse(c, cx, cy + 1, rx, ry, shadow);
  fillEllipse(c, cx + rx - 2, cy + 1, Math.round(rx * 0.6), Math.round(ry * 0.7), shadow);
  fillEllipse(c, cx - rx + 2, cy + 1, Math.round(rx * 0.55), Math.round(ry * 0.6), shadow);
  fillEllipse(c, cx, cy, rx, Math.round(ry * 0.85), body);
  fillEllipse(c, cx + rx - 3, cy, Math.round(rx * 0.55), Math.round(ry * 0.6), body);
  fillEllipse(c, cx - rx + 3, cy, Math.round(rx * 0.5), Math.round(ry * 0.55), body);
  fillEllipse(c, cx, cy - Math.round(ry * 0.4), Math.round(rx * 0.7), Math.round(ry * 0.4), top);
}

// ===========================================================================
// HABITATS
// ===========================================================================

// ---------------------------------------------------------------------------
// Terminal Den — cozy hacker den (warm lamp amber vs cool monitor cyan).
// 1=very dark bg, 2=dark wall, 3=shadow, 4=desk wood, 5=monitor glow,
// 6=screen mid-cyan, 7=bright cyan text, 8=warm lamp amber, 9=lamp highlight,
// 10=desk top, 11=plant green, 12=bright screen, 13=near-white cyan, 14=white, 15=cursor
// ---------------------------------------------------------------------------

function buildTerminalDen(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  // Back wall — dark, with vertical lighting falloff toward the floor.
  fillRect(c, 0, 0, HW - 1, HH - 1, 2);
  for (let y = 0; y < 70; y += 8) {
    for (let x = 0; x < HW; x++) if (c.get(x, y) === 2) c.set(x, y, 1);
  }
  // Soft monitor bloom on the wall (radial cool glow behind the screen).
  fillEllipse(c, 64, 30, 56, 34, 3);
  fillEllipse(c, 64, 30, 44, 26, 2);

  // Hanging string-lights across the top (cozy bokeh).
  for (let x = 6; x < HW; x += 16) {
    const sag = 3 + Math.round(2 * Math.sin(x * 0.4));
    dot(c, x, sag + 4, frame === 0 ? 9 : 8);
    dot(c, x, sag + 3, 8);
    line(c, x - 8, sag + 3, x, sag + 4, 3);
  }

  // ---- Monitor (midground) ----
  fillRect(c, 26, 8, 102, 60, 1); // bezel shadow
  fillRect(c, 28, 9, 100, 58, 3); // bezel
  fillRect(c, 31, 11, 97, 55, 6); // screen face
  fillRect(c, 34, 13, 94, 52, 7); // glow zone
  fillRect(c, 40, 16, 88, 48, 12); // bright field
  fillRect(c, 52, 16, 76, 28, 13); // hottest center

  // CRT scanlines.
  for (let y = 14; y <= 54; y += 3) {
    for (let x = 32; x <= 96; x++) {
      const v = c.get(x, y);
      if (v >= 6 && v <= 13) c.set(x, y, Math.max(5, v - 2));
    }
  }

  // Terminal code lines (cyan text bars).
  const codeLines = [
    { y: 18, x0: 42, len: 36 },
    { y: 22, x0: 42, len: 24 },
    { y: 26, x0: 46, len: 40 },
    { y: 30, x0: 42, len: 18 },
    { y: 34, x0: 46, len: 30 },
    { y: 38, x0: 42, len: 44 },
    { y: 42, x0: 46, len: 22 },
    { y: 46, x0: 42, len: 34 },
  ];
  for (const ln of codeLines) {
    for (let x = ln.x0; x < ln.x0 + ln.len && x < 94; x++) {
      c.set(x, ln.y, 7);
      if ((x - ln.x0) % 6 === 5) c.set(x, ln.y, 6); // word gaps
    }
  }
  // Blinking cursor on frame 1.
  if (frame === 1) fillRect(c, 42, 50, 45, 51, 15);
  else fillRect(c, 42, 50, 45, 51, 13);

  // Screen edge halo.
  strokeRect(c, 30, 10, 98, 56, 5);

  // Monitor stand + base.
  fillRect(c, 60, 60, 68, 66, 3);
  fillRect(c, 52, 66, 76, 68, 4);

  // ---- Desk (foreground) ----
  fillRect(c, 0, 68, HW - 1, 72, 4); // desk top mass
  for (let x = 0; x < HW; x++) c.set(x, 68, 10); // lit front lip
  fillRect(c, 0, 73, HW - 1, HH - 1, 3); // desk front face
  for (let x = 0; x < HW; x++) c.set(x, 73, 4);
  // Wood grain on the front face.
  for (let y = 76; y < HH; y += 4) {
    for (let x = 0; x < HW; x += 3) if (c.get(x, y) === 3) c.set(x, y, 4);
  }

  // Keyboard.
  fillRect(c, 38, 64, 90, 68, 3);
  strokeRect(c, 38, 64, 90, 68, 2);
  for (let kx = 41; kx <= 88; kx += 3) {
    c.set(kx, 65, 4);
    c.set(kx, 66, 5);
  }

  // Desk lamp — left.
  fillRect(c, 8, 64, 14, 67, 4); // base
  line(c, 10, 64, 14, 54, 3); // arm
  line(c, 14, 54, 20, 50, 3);
  fillEllipse(c, 17, 49, 6, 4, 8); // shade
  fillEllipse(c, 17, 49, 4, 3, 9);
  dot(c, 17, 48, 14); // bulb
  // Warm pooled glow on the desk.
  for (let lx = 0; lx < 36; lx++) {
    const warmth = lx < 10 ? 8 : lx < 20 ? 4 : 3;
    if (c.get(lx, 69) === 4 || c.get(lx, 69) === 10) c.set(lx, 69, warmth);
    if (lx < 26 && c.get(lx, 70) === 4) c.set(lx, 70, lx < 14 ? 4 : 3);
  }

  // Potted plant — right.
  fillRect(c, 104, 60, 114, 67, 8); // terracotta pot
  fillRect(c, 105, 59, 113, 60, 9);
  strokeRect(c, 104, 59, 114, 67, 2);
  fillEllipse(c, 109, 54, 5, 5, 11); // foliage
  fillEllipse(c, 104, 52, 3, 3, 11);
  fillEllipse(c, 114, 52, 3, 3, 11);
  fillEllipse(c, 109, 50, 3, 3, 11);
  dot(c, 109, 49, 13);
  if (frame === 0) dot(c, 105, 49, 15); // dew glint

  // Coffee mug (warm steam wisp).
  fillRect(c, 94, 62, 100, 67, 8);
  c.set(101, 63, 8);
  c.set(101, 64, 8);
  fillRect(c, 95, 62, 99, 63, 9);
  if (frame === 1) {
    dot(c, 96, 59, 13);
    dot(c, 98, 57, 12);
  } else {
    dot(c, 97, 58, 13);
  }

  // Floating glyph dust near the screen edges.
  const glyphs = [
    [10, 14],
    [16, 24],
    [12, 34],
    [20, 44],
    [8, 52],
    [118, 16],
    [122, 28],
    [114, 38],
    [120, 48],
    [124, 22],
  ] as const;
  const gb = frame === 0 ? 7 : 12;
  for (const [gx, gy] of glyphs) {
    c.set(gx, gy, gb);
    c.set(gx + 1, gy, 5);
  }

  return c;
}

// ---------------------------------------------------------------------------
// Meadow — blue sky, white clouds, sun, layered hills, flowers.
// 1=dark earth, 2=distant hill shadow, 3=back hill, 4=mid hill, 5=front ground dark,
// 6=grass mid, 7=grass light, 8=sky blue, 9=sky light, 10=cloud shadow, 11=cloud white,
// 12=sun halo, 13=sun yellow, 14=flower bright, 15=flower glint
// ---------------------------------------------------------------------------

function buildMeadow(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  // Sky — light at top fading to grass-lit near the horizon.
  skyGradient(c, [
    { until: 14, idx: 9 },
    { until: 30, idx: 9 },
    { until: 46, idx: 8 },
    { until: 58, idx: 8 },
    { until: 64, idx: 7 },
    { until: HH, idx: 7 },
  ]);

  // Sun — upper left.
  const sunX = 22;
  const sunY = 16;
  fillEllipse(c, sunX, sunY, 13, 13, 12);
  fillEllipse(c, sunX, sunY, 9, 9, 13);
  fillEllipse(c, sunX, sunY, 5, 5, 14);
  dot(c, sunX - 2, sunY - 2, 14);
  // Soft rays.
  for (let i = 0; i < 7; i++) {
    const a = i * 0.62 + 0.2;
    dot(c, Math.round(sunX + Math.cos(a) * 17), Math.round(sunY + Math.sin(a) * 17), 12);
    dot(c, Math.round(sunX + Math.cos(a) * 21), Math.round(sunY + Math.sin(a) * 21), 9);
  }

  // Parallax hills — far -> mid -> front.
  for (let x = 0; x < HW; x++) {
    const h = 50 + Math.round(5 * Math.sin(x * 0.045 + 0.4));
    for (let y = h; y < HH; y++) c.set(x, y, 3);
    c.set(x, h, 4);
    if (h > 1) c.set(x, h - 1, 7);
  }
  for (let x = 0; x < HW; x++) {
    const h = 60 + Math.round(7 * Math.sin(x * 0.04 + 0.9));
    for (let y = h; y < HH; y++) c.set(x, y, 4);
    c.set(x, h, 6);
    if (h > 1) c.set(x, h - 1, 7);
  }
  for (let x = 0; x < HW; x++) {
    const h = 74 + Math.round(4 * Math.sin(x * 0.06 + 2.1));
    for (let y = h; y < HH; y++) c.set(x, y, 5);
    c.set(x, h, 7);
    if (h + 1 < HH) c.set(x, h + 1, 6);
  }

  // Ground texture scatter.
  const rng = lcg(hashStr('habitat-meadow'));
  for (let i = 0; i < 70; i++) {
    const gx = rng.int(HW);
    const gy = 78 + rng.int(16);
    if (c.get(gx, gy) === 5) c.set(gx, gy, 6);
  }
  // Grass blades along the front crest.
  for (let x = 2; x < HW; x += 5) {
    const baseY = 74 + Math.round(4 * Math.sin(x * 0.06 + 2.1));
    line(c, x, baseY, x - 1, baseY - 3, 7);
    line(c, x + 1, baseY, x + 2, baseY - 4, 6);
  }

  // Drifting clouds.
  const d1 = frame === 1 ? 2 : 0;
  cloud(c, 70 + d1, 18, 15, 7, 10, 11, 14);
  cloud(c, 104 + (frame === 1 ? -1 : 0), 30, 10, 5, 10, 11, 14);
  cloud(c, 44 + d1, 12, 8, 4, 10, 11, 14);

  // Flowers on the front ground.
  const flowers = [
    [6, 80],
    [18, 78],
    [30, 82],
    [48, 80],
    [82, 82],
    [96, 80],
    [110, 78],
    [120, 82],
    [12, 86],
    [40, 84],
    [74, 88],
    [104, 86],
    [56, 82],
    [88, 80],
    [24, 86],
    [66, 84],
    [116, 88],
    [2, 84],
  ] as const;
  for (const [fx, fy] of flowers) {
    const bright = frame === 0 ? 14 : 15;
    c.set(fx, fy, bright);
    c.set(fx - 1, fy, 13);
    c.set(fx + 1, fy, 13);
    c.set(fx, fy - 1, 13);
    c.set(fx, fy + 1, 13);
    c.set(fx, fy + 2, 6); // tiny stem
  }

  // Distant tree silhouettes at far edges.
  const trees = [
    { x: 2, y: 46, rx: 5, ry: 7 },
    { x: 12, y: 42, rx: 6, ry: 9 },
    { x: 118, y: 46, rx: 5, ry: 7 },
    { x: 126, y: 42, rx: 6, ry: 9 },
  ];
  for (const { x, y, rx, ry } of trees) {
    fillEllipse(c, x, y, rx, ry, 2);
    fillRect(c, x - 1, y + ry - 1, x + 1, y + ry + 4, 2);
  }

  // Butterfly drifting between frames.
  const bx = frame === 0 ? 60 : 64;
  const by = frame === 0 ? 40 : 36;
  dot(c, bx, by, 14);
  dot(c, bx - 1, by - 1, 13);
  dot(c, bx + 1, by - 1, 13);
  dot(c, bx - 1, by + 1, 14);
  dot(c, bx + 1, by + 1, 14);

  return c;
}

// ---------------------------------------------------------------------------
// Rooftop Night — deep blue night, warm moon, amber windows, city parallax.
// 1=black sky top, 2=deep night, 3=midnight blue, 4=city far, 5=city near,
// 6=rooftop concrete, 7=ledge highlight, 8=window amber dim, 9=window amber bright,
// 10=moon halo, 11=moon body, 12=moon bright, 13=star dim, 14=star bright, 15=star twinkle
// ---------------------------------------------------------------------------

function buildRooftopNight(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  skyGradient(c, [
    { until: 12, idx: 1 },
    { until: 28, idx: 2 },
    { until: 44, idx: 3 },
    { until: 58, idx: 2 },
    { until: HH, idx: 3 },
  ]);

  // Horizon city glow (warm light pollution).
  for (let x = 0; x < HW; x++) {
    c.set(x, 54, 6);
    c.set(x, 55, 3);
  }

  // Dim star scatter.
  const rng = lcg(hashStr('habitat-rooftop-night'));
  for (let i = 0; i < 60; i++) {
    const sx = rng.int(HW);
    const sy = rng.int(46);
    if (c.get(sx, sy) <= 3) c.set(sx, sy, 13);
  }
  // Medium cross-halo stars.
  const medStars = [
    [10, 6],
    [34, 4],
    [58, 9],
    [86, 6],
    [112, 8],
    [22, 14],
    [70, 16],
    [100, 13],
    [44, 20],
  ] as const;
  for (const [sx, sy] of medStars) {
    c.set(sx, sy, 14);
    c.set(sx - 1, sy, 13);
    c.set(sx + 1, sy, 13);
    c.set(sx, sy - 1, 13);
    c.set(sx, sy + 1, 13);
  }
  // Bright twinkle stars (animated).
  const brightStars = [
    [28, 8],
    [74, 5],
    [108, 12],
    [50, 16],
    [90, 18],
    [16, 24],
  ] as const;
  for (const [sx, sy] of brightStars) {
    const b = frame === 0 ? 15 : 14;
    const d = frame === 0 ? 14 : 13;
    c.set(sx, sy, b);
    c.set(sx - 1, sy, d);
    c.set(sx + 1, sy, d);
    c.set(sx, sy - 1, d);
    c.set(sx, sy + 1, d);
  }

  // Crescent moon — upper right.
  const mx = 102;
  const my = 18;
  const mr = 14;
  fillEllipse(c, mx, my, mr, mr, 10);
  fillEllipse(c, mx, my, mr - 1, mr - 1, 11);
  fillEllipse(c, mx, my, mr - 4, mr - 4, 12);
  fillEllipse(c, mx + 1, my - 1, 4, 4, 12);
  fillEllipse(c, mx - 7, my - 6, mr - 1, mr - 1, 3); // crescent cut
  c.set(mx + 5, my + 5, 10);
  c.set(mx + 8, my + 3, 11);
  strokeEllipse(c, mx, my, mr + 4, mr + 4, 10);
  strokeEllipse(c, mx, my, mr + 7, mr + 7, 3);

  // Far city silhouette parallax.
  const farB = [
    { x: 0, w: 12, h: 26 },
    { x: 11, w: 7, h: 18 },
    { x: 17, w: 15, h: 34 },
    { x: 31, w: 10, h: 22 },
    { x: 40, w: 17, h: 42 },
    { x: 56, w: 9, h: 26 },
    { x: 64, w: 11, h: 18 },
    { x: 74, w: 16, h: 38 },
    { x: 89, w: 10, h: 26 },
    { x: 98, w: 13, h: 22 },
    { x: 110, w: 10, h: 34 },
    { x: 119, w: 12, h: 18 },
  ];
  const farBase = HH - 20;
  for (const { x, w, h } of farB) {
    const topY = farBase - h;
    fillRect(c, x, topY, x + w - 1, farBase, 4);
    for (let bx = x; bx < x + w; bx++) c.set(bx, topY, 3);
  }

  // Near city silhouette.
  const nearB = [
    { x: 0, w: 9, h: 22 },
    { x: 7, w: 13, h: 30 },
    { x: 19, w: 7, h: 18 },
    { x: 24, w: 16, h: 36 },
    { x: 39, w: 10, h: 26 },
    { x: 48, w: 15, h: 34 },
    { x: 62, w: 8, h: 22 },
    { x: 69, w: 13, h: 30 },
    { x: 81, w: 10, h: 20 },
    { x: 90, w: 16, h: 36 },
    { x: 105, w: 9, h: 22 },
    { x: 113, w: 8, h: 18 },
    { x: 120, w: 13, h: 26 },
  ];
  const nearBase = HH - 20;
  for (const { x, w, h } of nearB) {
    const topY = nearBase - h;
    fillRect(c, x, topY, x + w - 1, nearBase, 5);
    for (let bx = x; bx < x + w; bx++) c.set(bx, topY, 4);
  }

  // Window lights (amber grid on the buildings).
  for (let i = 0; i < 90; i++) {
    const wx = rng.int(HW);
    const wy = 30 + rng.int(nearBase - 30);
    if (c.get(wx, wy) === 4 || c.get(wx, wy) === 5) {
      const near = c.get(wx, wy) === 5;
      const lit = near ? (frame === 0 ? 9 : 8) : 8;
      if (rng.chance(near ? 0.5 : 0.35)) {
        c.set(wx, wy, lit);
        if (c.get(wx + 1, wy) >= 4) c.set(wx + 1, wy, 8);
      }
    }
  }

  // Ground / rooftop deck.
  fillRect(c, 0, nearBase, HW - 1, HH - 1, 5);
  for (let x = 0; x < HW; x++) c.set(x, nearBase, 6);

  // Rooftop ledges (foreground corners).
  for (const side of ['L', 'R'] as const) {
    const x0 = side === 'L' ? 0 : HW - 24;
    const x1 = side === 'L' ? 24 : HW - 1;
    fillRect(c, x0, HH - 16, x1, HH - 1, 6);
    fillRect(c, x0, HH - 16, x1, HH - 14, 7);
    fillRect(c, x0, HH - 8, x1, HH - 1, 5);
    for (let x = x0; x <= x1; x++) c.set(x, HH - 16, 7);
    for (let x = x0 + 3; x <= x1 - 3; x += 6) {
      c.set(x, HH - 13, 5);
      c.set(x, HH - 12, 5);
    }
  }

  return c;
}

// ---------------------------------------------------------------------------
// Beach Cove — turquoise sea, sand floor, palm, sunset sky.
// 1=deep ocean, 2=ocean mid, 3=ocean shallow, 4=sand shadow, 5=sand mid, 6=sand light,
// 7=sky peach, 8=sky orange, 9=sky warm pink, 10=cloud rose, 11=sun orange, 12=sun yellow,
// 13=foam white, 14=palm green, 15=sparkle
// ---------------------------------------------------------------------------

function buildBeachCove(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  // Sunset sky.
  skyGradient(c, [
    { until: 12, idx: 12 },
    { until: 24, idx: 11 },
    { until: 36, idx: 9 },
    { until: 46, idx: 8 },
    { until: 50, idx: 7 },
    { until: HH, idx: 7 },
  ]);

  // Sun disc — upper right.
  const sx = 104;
  const sy = 20;
  fillEllipse(c, sx, sy, 14, 14, 10);
  fillEllipse(c, sx, sy, 10, 10, 11);
  fillEllipse(c, sx, sy, 6, 6, 12);
  dot(c, sx - 2, sy - 2, 13);

  // Cloud wisps.
  const d1 = frame === 1 ? 2 : 0;
  cloud(c, 40 + d1, 16, 13, 4, 10, 9, 13);
  cloud(c, 70 + d1, 24, 9, 3, 10, 9, 13);

  // Horizon glow band.
  for (let x = 0; x < HW; x++) {
    c.set(x, 49, 11);
    c.set(x, 50, 8);
  }

  // Ocean depth bands.
  for (let x = 0; x < HW; x++) {
    for (let y = 50; y < 60; y++) c.set(x, y, 2);
    for (let y = 60; y < 70; y++) c.set(x, y, 3);
  }

  // Animated foam wave lines.
  const w1 = frame === 0 ? 54 : 55;
  const w2 = frame === 0 ? 62 : 61;
  for (let x = 6; x < HW - 6; x += 12) {
    c.set(x, w1, 13);
    c.set(x + 1, w1, 13);
    c.set(x + 2, w1 + 1, 13);
  }
  for (let x = 12; x < HW - 12; x += 14) {
    c.set(x, w2, 13);
    c.set(x + 1, w2, 13);
  }

  // Sun reflection column on the water.
  for (let y = 50; y < 70; y++) {
    if (c.get(sx, y) >= 1 && c.get(sx, y) <= 3) {
      c.set(sx - 1, y, 11);
      c.set(sx, y, 12);
      c.set(sx + 1, y, 11);
    }
  }

  // Sandy beach floor.
  for (let x = 0; x < HW; x++) {
    for (let y = 70; y < HH; y++) c.set(x, y, 5);
  }
  for (let x = 0; x < HW; x++) c.set(x, 70, 6); // dry highlight
  for (let x = 0; x < HW; x++) {
    c.set(x, 68, 3); // wet shoreline
    c.set(x, 69, 4);
  }
  // Wavy foam edge at the shore.
  for (let x = 0; x < HW; x += 2) {
    const fy = 68 + Math.round(Math.sin(x * 0.3 + (frame === 1 ? 0.6 : 0)));
    c.set(x, fy, 13);
  }
  // Sand texture.
  const rng = lcg(hashStr('habitat-beach-cove'));
  for (let i = 0; i < 80; i++) {
    const gx = rng.int(HW);
    const gy = 72 + rng.int(22);
    if (c.get(gx, gy) === 5) c.set(gx, gy, 6);
  }
  for (let i = 0; i < 24; i++) {
    const gx = rng.int(HW);
    const gy = 74 + rng.int(18);
    if (c.get(gx, gy) === 5 || c.get(gx, gy) === 6) c.set(gx, gy, 4);
  }

  // Palm tree — left.
  thickLine(c, 16, 68, 22, 44, 14, 3);
  for (let y = 44; y <= 68; y += 3) c.set(20, y, 13); // trunk highlight
  const fronds: Array<[number, number]> = [
    [2, 34],
    [8, 30],
    [26, 28],
    [38, 32],
    [42, 40],
  ];
  for (const [ex, ey] of fronds) {
    line(c, 22, 44, ex, ey, 14);
    line(c, 22, 44, ex - 1, ey + 1, 14);
  }
  // Coconuts.
  dot(c, 22, 46, 8);
  dot(c, 24, 47, 8);
  dot(c, 20, 47, 8);

  // Seashells.
  const shells = [
    [30, 80],
    [52, 86],
    [74, 78],
    [96, 84],
    [114, 80],
    [42, 90],
  ] as const;
  for (const [shx, shy] of shells) {
    c.set(shx, shy, 13);
    c.set(shx + 1, shy, 6);
    c.set(shx, shy + 1, 4);
  }
  // Water sparkles frame 0.
  if (frame === 0) {
    dot(c, 56, 56, 15);
    dot(c, 84, 52, 15);
    dot(c, 30, 60, 15);
  }

  return c;
}

// ---------------------------------------------------------------------------
// Forest Glade — layered canopy, god-rays, mossy floor, fireflies.
// 1=deep forest shadow, 2=bark brown, 3=deep canopy, 4=mid canopy, 5=canopy highlight,
// 6=forest floor dark, 7=moss green, 8=moss highlight, 9=sky through leaves, 10=god-ray glow,
// 11=bark highlight, 12=leaf light, 13=bright leaf, 14=firefly glow, 15=firefly hot
// ---------------------------------------------------------------------------

function buildForestGlade(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  fillRect(c, 0, 0, HW - 1, HH - 1, 1);

  // Sky glimpses through the canopy.
  const skyPatches = [
    { x: 40, y: 6, rx: 11, ry: 6 },
    { x: 74, y: 9, rx: 8, ry: 4 },
    { x: 96, y: 4, rx: 7, ry: 4 },
    { x: 20, y: 10, rx: 6, ry: 4 },
  ];
  for (const { x, y, rx, ry } of skyPatches) {
    fillEllipse(c, x, y, rx, ry, 9);
    fillEllipse(c, x, y, rx - 2, ry - 1, 10);
  }

  // God-rays (diagonal beams).
  const rays = [
    { sx: 40, sy: 12, angle: 0.3, len: 40 },
    { sx: 74, sy: 13, angle: 0.5, len: 34 },
    { sx: 20, sy: 14, angle: 0.6, len: 28 },
  ];
  for (const { sx, sy, angle, len } of rays) {
    for (let d = 0; d < len; d++) {
      const rx = Math.round(sx + Math.sin(angle) * d);
      const ry = sy + d;
      if (ry < HH && rx >= 0 && rx < HW) {
        if (c.get(rx, ry) <= 3) c.set(rx, ry, d < 14 ? 10 : 9);
        if (c.get(rx + 1, ry) <= 2) c.set(rx + 1, ry, 9);
      }
    }
  }

  // Parallax canopy bands.
  for (let x = 0; x < HW; x++) {
    const h = 16 + Math.round(7 * Math.sin(x * 0.06 + 0.5));
    for (let y = 0; y < h; y++) if (c.get(x, y) === 1) c.set(x, y, 3);
  }
  for (let x = 0; x < HW; x++) {
    const h = 28 + Math.round(8 * Math.sin(x * 0.05 + 1.2));
    for (let y = 0; y < h; y++) if (c.get(x, y) <= 1) c.set(x, y, 4);
  }
  // Lit canopy fringe.
  for (let x = 0; x < HW; x++) {
    for (let y = 0; y < 44; y++) {
      if (c.get(x, y) >= 3 && c.get(x, y + 1) <= 1) {
        c.set(x, y, 5);
        if (y + 1 < HH) c.set(x, y + 1, 12);
        break;
      }
    }
  }

  // Tree trunks.
  for (const tx of [8, 26, 104, 120]) {
    for (let y = 18; y < 76; y++) {
      c.set(tx, y, 2);
      c.set(tx + 1, y, 11);
      c.set(tx + 2, y, 2);
      c.set(tx + 3, y, 2);
    }
    fillEllipse(c, tx + 1, 75, 6, 3, 2);
    // Bark notches.
    for (let y = 24; y < 72; y += 8) c.set(tx + 1, y, 2);
  }

  // Mossy forest floor.
  for (let x = 0; x < HW; x++) {
    for (let y = 76; y < HH; y++) c.set(x, y, 6);
  }
  for (let x = 0; x < HW; x++) {
    c.set(x, 76, 7);
    c.set(x, 77, 8);
  }
  const rng = lcg(hashStr('habitat-forest-glade'));
  for (let i = 0; i < 80; i++) {
    const gx = rng.int(HW);
    const gy = 78 + rng.int(16);
    if (c.get(gx, gy) === 6) c.set(gx, gy, 7);
  }
  // Mushrooms.
  for (let i = 0; i < 8; i++) {
    const gx = rng.int(HW - 6) + 3;
    const gy = 80 + rng.int(12);
    c.set(gx, gy, 10);
    c.set(gx, gy - 1, 14);
    c.set(gx - 1, gy, 10);
  }
  // Ferns.
  for (let i = 0; i < 12; i++) {
    const gx = 4 + rng.int(HW - 8);
    const gy = 80 + rng.int(8);
    line(c, gx, gy, gx - 2, gy - 4, 7);
    line(c, gx, gy, gx + 2, gy - 4, 8);
  }

  // Foreground branch silhouettes.
  thickLine(c, 0, 28, 16, 40, 2, 2);
  thickLine(c, 0, 22, 12, 32, 2, 2);
  thickLine(c, HW - 1, 24, HW - 16, 34, 2, 2);
  thickLine(c, HW - 1, 30, HW - 14, 42, 2, 2);

  // Fireflies (drift between frames).
  const flies0 = [
    [30, 56],
    [54, 44],
    [78, 50],
    [96, 58],
    [114, 46],
    [44, 64],
  ] as const;
  const flies1 = [
    [33, 53],
    [55, 47],
    [76, 47],
    [98, 55],
    [116, 49],
    [42, 60],
  ] as const;
  const flies = frame === 0 ? flies0 : flies1;
  for (const [fx, fy] of flies) {
    dot(c, fx, fy, 15);
    dot(c, fx - 1, fy, 14);
    dot(c, fx + 1, fy, 14);
    dot(c, fx, fy - 1, 14);
    dot(c, fx, fy + 1, 14);
  }

  return c;
}

// ---------------------------------------------------------------------------
// Snowpeak — pale ice peaks, aurora band, snow floor.
// 1=deep night, 2=dark sky, 3=aurora teal, 4=aurora green, 5=aurora violet,
// 6=distant peak shadow, 7=near peak mid, 8=snow shadow, 9=snow mid, 10=snow bright,
// 11=ice glint, 12=aurora pink, 13=star, 14=near-white ice, 15=sparkle
// ---------------------------------------------------------------------------

function buildSnowpeak(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  fillRect(c, 0, 0, HW - 1, HH - 1, 2);
  for (let x = 0; x < HW; x++) for (let y = 0; y < 16; y++) c.set(x, y, 1);

  // Stars.
  const rng = lcg(hashStr('habitat-snowpeak'));
  for (let i = 0; i < 50; i++) {
    const sx = rng.int(HW);
    const sy = rng.int(40);
    if (c.get(sx, sy) <= 2) c.set(sx, sy, 13);
  }
  dot(c, 28, 6, 15);
  dot(c, 84, 8, 15);
  dot(c, 112, 5, frame === 0 ? 15 : 13);

  // Aurora ribbons.
  const auroraY = 22;
  for (let x = 0; x < HW; x++) {
    const phase = x * 0.05 + (frame === 1 ? 0.3 : 0);
    const y = Math.round(auroraY + Math.sin(phase) * 4 + Math.sin(phase * 0.4) * 3);
    c.set(x, y, 4);
    c.set(x, y + 1, 3);
    c.set(x, y + 2, 3);
    c.set(x, y - 1, 5);
    c.set(x, y + 3, 12);
    if (x % 3 === 0) c.set(x, y + 4, 12);
    if (x % 4 === 1) c.set(x, y - 2, 5);
    if (x % 5 === 2) c.set(x, y - 3, 5);
  }

  // Distant peaks.
  for (let x = 0; x < HW; x++) {
    const p1 = 56 - Math.round(24 * Math.max(0, 1 - Math.abs(x - 34) / 28));
    const p2 = 56 - Math.round(30 * Math.max(0, 1 - Math.abs(x - 94) / 34));
    const h = Math.min(p1, p2);
    for (let y = h; y < HH; y++) if (c.get(x, y) <= 2 || c.get(x, y) > 5) c.set(x, y, 6);
    if (c.get(x, h) === 6) c.set(x, h, 8);
  }
  // Near peaks with snow caps.
  for (let x = 0; x < HW; x++) {
    const p1 = 68 - Math.round(34 * Math.max(0, 1 - Math.abs(x - 22) / 26));
    const p2 = 68 - Math.round(38 * Math.max(0, 1 - Math.abs(x - 66) / 30));
    const p3 = 68 - Math.round(30 * Math.max(0, 1 - Math.abs(x - 108) / 22));
    const h = Math.min(p1, Math.min(p2, p3));
    for (let y = h; y < HH; y++) {
      if (c.get(x, y) === 6 || c.get(x, y) <= 2 || c.get(x, y) > 7) c.set(x, y, 7);
    }
    if (c.get(x, h) === 7) c.set(x, h, 10);
    if (c.get(x, h + 1) === 7) c.set(x, h + 1, 9);
    if (x > 0 && c.get(x, h) === 10 && c.get(x - 1, h) <= 2) c.set(x, h, 14);
  }

  // Snow floor.
  for (let x = 0; x < HW; x++) for (let y = 78; y < HH; y++) c.set(x, y, 9);
  for (let x = 0; x < HW; x++) {
    c.set(x, 78, 10);
    c.set(x, 79, 10);
  }
  // Snow drifts.
  for (let x = 0; x < HW; x++) {
    const d = 84 + Math.round(3 * Math.sin(x * 0.08 + 1.0));
    if (c.get(x, d) === 9) c.set(x, d, 8);
  }
  for (let i = 0; i < 40; i++) {
    const gx = rng.int(HW);
    const gy = 80 + rng.int(14);
    if (c.get(gx, gy) === 9) c.set(gx, gy, 8);
  }
  // Ice crystals.
  const crystalX = [14, 30, 50, 72, 92, 112] as const;
  for (const cx of crystalX) {
    c.set(cx, 78, frame === 0 ? 15 : 14);
    c.set(cx + 1, 78, 11);
    c.set(cx, 77, 14);
  }
  // Drifting snowflakes.
  for (let i = 0; i < 16; i++) {
    const fx = (rng.int(HW) + (frame === 1 ? 1 : 0)) % HW;
    const fy = 40 + rng.int(36);
    if (c.get(fx, fy) >= 6) c.set(fx, fy, 14);
  }

  return c;
}

// ---------------------------------------------------------------------------
// Desert Dunes — orange/pink dusk, dune layers, cactus, sand floor.
// 1=deep shadow, 2=dune shadow, 3=dune mid, 4=sand warm, 5=sand light, 6=sky pink,
// 7=sky orange, 8=sky peach, 9=sun halo, 10=sun body, 11=cactus green, 12=bright sand,
// 13=sky bright, 14=cloud highlight, 15=star/sparkle
// ---------------------------------------------------------------------------

function buildDesertDunes(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  skyGradient(c, [
    { until: 12, idx: 13 },
    { until: 24, idx: 10 },
    { until: 36, idx: 9 },
    { until: 46, idx: 8 },
    { until: 56, idx: 7 },
    { until: HH, idx: 6 },
  ]);

  // Setting sun near the horizon center.
  fillEllipse(c, 64, 52, 16, 16, 9);
  fillEllipse(c, 64, 52, 12, 12, 10);
  // Cut by the horizon.
  for (let x = 0; x < HW; x++) {
    for (let y = 56; y < 60; y++) {
      if (c.get(x, y) === 10 || c.get(x, y) === 9) c.set(x, y, 7);
    }
    if (c.get(x, 60) >= 9) c.set(x, 60, 6);
  }

  // High wispy clouds.
  const d1 = frame === 0 ? 0 : 2;
  cloud(c, 28 + d1, 16, 14, 3, 8, 7, 14);
  cloud(c, 96 + d1, 22, 10, 3, 8, 7, 14);

  // Distant dunes.
  for (let x = 0; x < HW; x++) {
    const h = 56 + Math.round(6 * Math.sin(x * 0.035 + 0.5));
    for (let y = h; y < HH; y++) if (c.get(x, y) >= 6) c.set(x, y, 2);
    if (c.get(x, h) === 2) c.set(x, h, 3);
  }
  // Near dunes.
  for (let x = 0; x < HW; x++) {
    const h = 66 + Math.round(9 * Math.sin(x * 0.045 + 1.5));
    for (let y = h; y < HH; y++) c.set(x, y, 3);
    c.set(x, h, 4);
    if (h > 0) c.set(x, h - 1, 5);
  }

  // Sand floor.
  for (let x = 0; x < HW; x++) for (let y = 78; y < HH; y++) c.set(x, y, 4);
  for (let x = 0; x < HW; x++) {
    c.set(x, 78, 12);
    c.set(x, 79, 5);
  }
  // Ripple texture.
  const rng = lcg(hashStr('habitat-desert-dunes'));
  for (let i = 0; i < 18; i++) {
    const startX = rng.int(HW - 24);
    const y = 82 + rng.int(10);
    for (let xi = 0; xi < 16; xi++) c.set(startX + xi, y, 5);
  }

  // Cactus — right side.
  fillRect(c, 108, 52, 112, 78, 11);
  fillRect(c, 102, 60, 108, 62, 11);
  fillRect(c, 102, 56, 104, 62, 11);
  fillRect(c, 112, 64, 118, 66, 11);
  fillRect(c, 116, 58, 118, 66, 11);
  for (let y = 52; y <= 78; y++) if (c.get(108, y) === 11) c.set(108, y, 12); // lit edge
  // Thorns.
  dot(c, 110, 50, 1);
  dot(c, 101, 56, 1);
  dot(c, 118, 58, 1);
  // Small cactus left.
  fillRect(c, 22, 70, 25, 78, 11);
  c.set(22, 70, 12);

  // Rocks.
  fillEllipse(c, 30, 84, 5, 3, 2);
  fillEllipse(c, 80, 86, 6, 3, 2);
  dot(c, 31, 82, 1);
  dot(c, 81, 84, 1);

  // Dusk stars.
  const stars = [
    [20, 6],
    [44, 4],
    [94, 5],
    [118, 3],
    [70, 8],
  ] as const;
  for (const [sx, sy] of stars) {
    c.set(sx, sy, frame === 0 ? 15 : 14);
  }

  return c;
}

// ---------------------------------------------------------------------------
// Crimson Mars — butterscotch sky, red rock strata, twin moons, regolith floor.
// 1=dark rock shadow, 2=deep rust, 3=rock shadow, 4=rock mid-red, 5=rock stratum light,
// 6=sky tan, 7=sky butterscotch, 8=sky pale, 9=dust haze, 10=moon 1 body, 11=moon 1 bright,
// 12=moon 2 dim, 13=regolith light, 14=dust highlight, 15=horizon glow
// ---------------------------------------------------------------------------

function buildCrimsonMars(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  skyGradient(c, [
    { until: 16, idx: 8 },
    { until: 32, idx: 7 },
    { until: 46, idx: 7 },
    { until: 56, idx: 6 },
    { until: HH, idx: 6 },
  ]);

  // Dust haze near horizon.
  for (let x = 0; x < HW; x++) {
    c.set(x, 50, 9);
    c.set(x, 51, 9);
    c.set(x, 52, 6);
  }

  // Twin moons.
  fillEllipse(c, 98, 16, 9, 9, 10);
  fillEllipse(c, 98, 16, 6, 6, 11);
  dot(c, 95, 14, 11);
  fillEllipse(c, 95, 12, 7, 7, 7); // crescent cut
  fillEllipse(c, 28, 24, 4, 4, 12);
  fillEllipse(c, 28, 24, 3, 3, 11);

  // Distant mesa.
  for (let x = 0; x < HW; x++) {
    const h = 48 + Math.round(5 * Math.sin(x * 0.035 + 0.3));
    for (let y = h; y < HH; y++) if (c.get(x, y) >= 6) c.set(x, y, 2);
    if (c.get(x, h) === 2) c.set(x, h, 3);
  }
  // Mid rock layer.
  for (let x = 0; x < HW; x++) {
    const h = 60 + Math.round(8 * Math.sin(x * 0.045 + 1.0));
    for (let y = h; y < HH; y++) c.set(x, y, 3);
    c.set(x, h, 4);
    if (h + 1 < HH) c.set(x, h + 1, 5);
  }
  // Strata bands.
  for (let y = 56; y < 78; y += 4) {
    for (let x = 0; x < HW; x++) if (c.get(x, y) === 3) c.set(x, y, 4);
  }
  for (let y = 58; y < 78; y += 7) {
    for (let x = 0; x < HW; x++) if (c.get(x, y) === 3) c.set(x, y, 2);
  }

  // Regolith floor.
  for (let x = 0; x < HW; x++) for (let y = 78; y < HH; y++) c.set(x, y, 4);
  for (let x = 0; x < HW; x++) {
    c.set(x, 78, 13);
    c.set(x, 79, 5);
  }
  const rng = lcg(hashStr('habitat-crimson-mars'));
  for (let i = 0; i < 60; i++) {
    const gx = rng.int(HW);
    const gy = 82 + rng.int(12);
    c.set(gx, gy, rng.chance(0.5) ? 3 : 2);
  }

  // Backlit horizon glow (animated).
  const glowIdx = frame === 1 ? 15 : 14;
  for (let x = 0; x < HW; x++) if (c.get(x, 51) === 9) c.set(x, 51, glowIdx);

  // Rocky outcrops.
  fillEllipse(c, 18, 84, 7, 4, 2);
  dot(c, 15, 81, 1);
  dot(c, 21, 81, 3);
  fillEllipse(c, 114, 82, 6, 4, 2);
  dot(c, 116, 79, 3);
  fillEllipse(c, 64, 88, 5, 3, 2);

  return c;
}

// ---------------------------------------------------------------------------
// Europa Ice — Jupiter looming, teal ice plain, cracks.
// 1=black space, 2=deep space, 3=Jupiter shadow, 4=Jupiter band dark, 5=Jupiter band mid,
// 6=Jupiter band light, 7=Jupiter highlight, 8=ice deep shadow, 9=ice crack blue,
// 10=ice surface mid, 11=ice bright, 12=ice glint, 13=Jupiter limb, 14=near-white ice, 15=sparkle
// ---------------------------------------------------------------------------

function buildEuropaIce(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  fillRect(c, 0, 0, HW - 1, HH - 1, 1);

  // Sparse stars.
  const rng = lcg(hashStr('habitat-europa-ice'));
  for (let i = 0; i < 26; i++) {
    const sx = rng.int(HW);
    const sy = rng.int(60);
    if (c.get(sx, sy) === 1) c.set(sx, sy, 13);
  }

  // Jupiter — huge disc filling the upper sky.
  const jx = 70;
  const jy = 24;
  const jrx = 52;
  const jry = 38;
  fillEllipse(c, jx, jy, jrx, jry, 5);
  for (let y = jy - jry; y <= jy + jry; y++) {
    const dist = Math.abs(y - jy);
    const hw = Math.round(jrx * Math.sqrt(Math.max(0, 1 - (dist * dist) / (jry * jry))));
    if (hw <= 0) continue;
    const band = Math.floor(((y - (jy - jry)) / (2 * jry)) * 11);
    const col = band % 2 === 0 ? 4 : band % 3 === 0 ? 6 : 5;
    for (let x = jx - hw; x <= jx + hw; x++) c.set(x, y, col);
  }
  strokeEllipse(c, jx, jy, jrx, jry, 3);
  for (let y = jy - jry; y <= jy + jry; y++) {
    const dist = Math.abs(y - jy);
    const hw = Math.round(jrx * Math.sqrt(Math.max(0, 1 - (dist * dist) / (jry * jry))));
    if (hw <= 0) continue;
    if (c.get(jx - hw, y) >= 3) c.set(jx - hw, y, 7);
    if (c.get(jx - hw + 1, y) >= 3) c.set(jx - hw + 1, y, 6);
  }
  // Great Red Spot.
  fillEllipse(c, jx + 12, jy + 6, 9, 6, 4);
  fillEllipse(c, jx + 12, jy + 6, 6, 4, 3);
  dot(c, jx + 12, jy + 6, 13);

  // Ice horizon — surface fills the lower scene.
  const horizon = 60;
  for (let y = horizon; y < HH; y++) for (let x = 0; x < HW; x++) c.set(x, y, 10);

  // Crack network.
  const cracks = [
    { x0: 0, y0: 68, x1: 40, y1: 76 },
    { x0: 26, y0: 62, x1: 74, y1: 72 },
    { x0: 60, y0: 66, x1: 108, y1: 80 },
    { x0: 80, y0: 62, x1: 128, y1: 74 },
    { x0: 14, y0: 76, x1: 54, y1: 84 },
    { x0: 74, y0: 76, x1: 120, y1: 86 },
  ];
  for (const { x0, y0, x1, y1 } of cracks) {
    line(c, x0, y0, x1, y1, 9);
    line(c, x0 + 1, y0 + 1, x1 + 1, y1 + 1, 8);
  }

  // Ice panels.
  for (let x = 0; x < HW; x++) {
    for (let y = horizon; y < HH; y++) {
      if (c.get(x, y) === 10 && (x + y) % 9 < 2) c.set(x, y, 11);
    }
  }
  // Bright top edge + Jupiter glow reflection.
  for (let x = 0; x < HW; x++) {
    if (c.get(x, horizon) >= 8) c.set(x, horizon, 11);
    if (c.get(x, horizon + 1) >= 8) c.set(x, horizon + 1, 12);
  }
  for (let x = 28; x <= 112; x++) if (c.get(x, horizon) < 15) c.set(x, horizon, 13);

  // Glinting crystals (animated).
  const crystals = [
    [12, 64],
    [34, 70],
    [58, 62],
    [86, 68],
    [108, 74],
    [124, 64],
  ] as const;
  for (const [cx, cy] of crystals) {
    c.set(cx, cy, frame === 0 ? 15 : 14);
    c.set(cx + 1, cy, 12);
  }

  return c;
}

// ---------------------------------------------------------------------------
// Lunar Base — grey moonscape, Earth-rise, dome structures, metal deck.
// 1=black space, 2=regolith shadow, 3=regolith dark, 4=regolith mid, 5=regolith light,
// 6=dome structure, 7=dome highlight, 8=deck metal, 9=deck highlight, 10=Earth blue,
// 11=Earth green, 12=Earth cloud, 13=Earth highlight, 14=star, 15=light beacon
// ---------------------------------------------------------------------------

function buildLunarBase(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  fillRect(c, 0, 0, HW - 1, HH - 1, 1);

  // Stars.
  const rng = lcg(hashStr('habitat-lunar-base'));
  for (let i = 0; i < 40; i++) {
    const sx = rng.int(HW);
    const sy = rng.int(56);
    if (c.get(sx, sy) === 1) c.set(sx, sy, 14);
  }
  dot(c, 40, 8, frame === 0 ? 15 : 14);
  dot(c, 86, 12, frame === 1 ? 15 : 14);

  // Earth-rise — upper left.
  const ex = 24;
  const ey = 22;
  const er = 16;
  fillEllipse(c, ex, ey, er, er, 10);
  fillEllipse(c, ex - 5, ey - 3, 6, 5, 11);
  fillEllipse(c, ex + 3, ey + 2, 5, 5, 11);
  fillEllipse(c, ex, ey - 7, 8, 3, 11);
  fillEllipse(c, ex - 3, ey + 5, 6, 3, 12);
  fillEllipse(c, ex + 5, ey - 2, 4, 2, 12);
  strokeEllipse(c, ex, ey, er, er, 2);
  for (let y2 = ey - er; y2 <= ey + er; y2++) {
    const dist = Math.abs(y2 - ey);
    const hw = Math.round(er * Math.sqrt(Math.max(0, 1 - (dist * dist) / (er * er))));
    if (hw <= 0) continue;
    if (c.get(ex - hw, y2) >= 10) c.set(ex - hw, y2, 13);
  }

  // Lunar horizon.
  for (let x = 0; x < HW; x++) {
    const h = 64 + Math.round(3 * Math.sin(x * 0.035 + 0.5));
    for (let y = h; y < HH; y++) c.set(x, y, 3);
    c.set(x, h, 4);
  }
  // Distant crater rims.
  strokeEllipse(c, 40, 64, 16, 5, 4);
  strokeEllipse(c, 96, 66, 11, 4, 4);
  fillEllipse(c, 40, 66, 14, 4, 2);
  fillEllipse(c, 96, 68, 9, 3, 2);

  // Dome structures.
  fillEllipse(c, 30, 60, 16, 9, 6);
  strokeEllipse(c, 30, 60, 16, 9, 2);
  fillEllipse(c, 27, 55, 7, 4, 7);
  dot(c, 25, 53, 14);
  fillEllipse(c, 30, 60, 5, 4, 7); // window
  fillEllipse(c, 104, 62, 12, 7, 6);
  strokeEllipse(c, 104, 62, 12, 7, 2);
  fillEllipse(c, 101, 58, 5, 3, 7);
  dot(c, 99, 56, 14);
  // Tunnel connecting the domes.
  fillRect(c, 46, 62, 80, 66, 6);
  for (let x = 46; x <= 80; x++) c.set(x, 62, 7);
  strokeRect(c, 46, 62, 80, 66, 2);

  // Metal deck floor.
  for (let x = 0; x < HW; x++) for (let y = 78; y < HH; y++) c.set(x, y, 8);
  for (let x = 0; x < HW; x++) c.set(x, 78, 9);
  for (let x = 0; x < HW; x += 12) for (let y = 80; y < HH; y++) c.set(x, y, 7);
  for (let y = 82; y < HH; y += 6) for (let x = 0; x < HW; x++) c.set(x, y, 7);

  // Beacon lights.
  dot(c, 30, 50, frame === 0 ? 15 : 6);
  dot(c, 104, 54, frame === 1 ? 15 : 6);

  return c;
}

// ---------------------------------------------------------------------------
// Nebula Drift — violet/teal/rose clouds, dense starfield, asteroid floor.
// 1=deep void, 2=space shadow, 3=nebula violet deep, 4=nebula violet mid, 5=nebula teal,
// 6=nebula rose, 7=nebula pink, 8=nebula bright, 9=dense star field, 10=bright core,
// 11=star cluster, 12=asteroid rock, 13=asteroid highlight, 14=bright star, 15=sparkle
// ---------------------------------------------------------------------------

function buildNebulaDrift(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  fillRect(c, 0, 0, HW - 1, HH - 1, 1);

  // Dense starfield.
  const rng = lcg(hashStr('habitat-nebula-drift'));
  for (let i = 0; i < 180; i++) {
    const sx = rng.int(HW);
    const sy = rng.int(80);
    c.set(sx, sy, rng.chance(0.3) ? 9 : 2);
  }
  const brightStars = [
    [10, 8],
    [28, 4],
    [50, 12],
    [72, 6],
    [92, 14],
    [110, 4],
    [120, 10],
    [18, 18],
    [60, 22],
    [100, 24],
  ] as const;
  for (const [sx, sy] of brightStars) c.set(sx, sy, 11);
  dot(c, 42, 10, frame === 0 ? 15 : 14);
  dot(c, 96, 6, frame === 1 ? 15 : 14);

  // Layered nebula clouds.
  fillEllipse(c, 28, 28, 24, 16, 3);
  fillEllipse(c, 40, 22, 20, 12, 4);
  fillEllipse(c, 18, 34, 14, 9, 3);
  fillEllipse(c, 86, 20, 26, 18, 5);
  fillEllipse(c, 104, 16, 16, 11, 5);
  fillEllipse(c, 72, 26, 14, 10, 5);
  fillEllipse(c, 56, 36, 20, 13, 6);
  fillEllipse(c, 68, 30, 14, 9, 7);
  fillEllipse(c, 46, 44, 12, 8, 6);

  // Bright nebula core.
  fillEllipse(c, 64, 28, 12, 7, 8);
  fillEllipse(c, 64, 28, 7, 4, 10);
  dot(c, 62, 26, 14);

  // Subtle frame drift.
  if (frame === 1) {
    dot(c, 40, 21, 8);
    dot(c, 86, 18, 8);
    dot(c, 56, 35, 8);
  }

  // Stars showing through the nebula.
  for (let i = 0; i < 60; i++) {
    const sx = rng.int(HW);
    const sy = rng.int(64);
    if (c.get(sx, sy) > 1) continue;
    c.set(sx, sy, 2);
  }

  // Asteroid floor.
  for (let x = 0; x < HW; x++) {
    const h = 80 + Math.round(3 * Math.sin(x * 0.07 + 0.7));
    for (let y = h; y < HH; y++) c.set(x, y, 12);
    c.set(x, h, 13);
  }
  // Rock chunks.
  fillEllipse(c, 22, 86, 9, 4, 12);
  fillEllipse(c, 22, 84, 6, 3, 13);
  fillEllipse(c, 66, 88, 10, 4, 12);
  fillEllipse(c, 66, 86, 7, 3, 13);
  fillEllipse(c, 108, 84, 8, 4, 12);
  fillEllipse(c, 108, 82, 5, 3, 13);
  // Mineral veins.
  dot(c, 24, 86, 10);
  dot(c, 68, 88, 10);
  dot(c, 110, 84, 10);

  return c;
}

// ---------------------------------------------------------------------------
// Starship Deck — observation deck, huge window, streaking stars, deck floor.
// 1=deep space black, 2=space shadow, 3=star streak far, 4=star streak mid,
// 5=star streak bright, 6=window frame dark, 7=window frame metal, 8=deck surface,
// 9=deck highlight, 10=console glow, 11=instrument light, 12=window center bright,
// 13=console warm, 14=metal rim, 15=indicator light
// ---------------------------------------------------------------------------

function buildStarshipDeck(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  fillRect(c, 0, 0, HW - 1, HH - 1, 1);

  // Star streaks (warp motion blur).
  const rng = lcg(hashStr('habitat-starship-deck'));
  for (let i = 0; i < 70; i++) {
    const sy = rng.int(56);
    const sx = rng.int(HW - 28);
    const len = 4 + rng.int(22);
    const bright = rng.chance(0.25) ? 5 : rng.chance(0.5) ? 4 : 3;
    for (let dx = 0; dx < len; dx++) {
      const x = sx + dx;
      if (x < HW) c.set(x, sy, bright);
    }
    if (sx + len < HW) c.set(sx + len, sy, 2);
    if (sx > 0) c.set(sx - 1, sy, 2);
  }
  if (frame === 1) {
    for (let i = 0; i < 14; i++) {
      const sy = rng.int(52);
      const sx = rng.int(90);
      const len = 6 + rng.int(18);
      for (let dx = 0; dx < len; dx++) if (sx + dx < HW) c.set(sx + dx, sy, 5);
    }
  }

  // Window frame.
  fillRect(c, 0, 0, HW - 1, 3, 6); // top
  fillRect(c, 0, 0, 4, 60, 6); // left
  fillRect(c, HW - 5, 0, HW - 1, 60, 6); // right
  fillRect(c, 0, 58, HW - 1, 62, 7); // sill
  for (let x = 0; x < HW; x++) c.set(x, 58, 14); // sill rim
  for (let y = 0; y < 58; y++) {
    c.set(4, y, 7);
    c.set(HW - 6, y, 7);
  }
  // Center mullion + two more struts (3-pane window).
  for (const sx of [42, 84]) {
    fillRect(c, sx, 0, sx + 3, 60, 7);
    for (let y = 0; y < 58; y++) c.set(sx + 1, y, 14);
  }

  // Observation deck floor.
  for (let x = 0; x < HW; x++) for (let y = 64; y < HH; y++) c.set(x, y, 8);
  for (let x = 0; x < HW; x++) c.set(x, 64, 9);
  for (let x = 0; x < HW; x += 16) for (let y = 66; y < HH; y++) c.set(x, y, 7);
  for (let y = 70; y < HH; y += 6) for (let x = 0; x < HW; x++) c.set(x, y, 7);

  // Control consoles.
  fillRect(c, 4, 62, 30, 68, 10);
  fillRect(c, 4, 62, 30, 63, 13);
  strokeRect(c, 4, 62, 30, 68, 6);
  dot(c, 10, 63, 15);
  dot(c, 16, 63, frame === 0 ? 15 : 11);
  dot(c, 22, 63, 11);
  fillRect(c, 7, 65, 16, 67, 11);
  fillRect(c, HW - 31, 62, HW - 5, 68, 10);
  fillRect(c, HW - 31, 62, HW - 5, 63, 13);
  strokeRect(c, HW - 31, 62, HW - 5, 68, 6);
  dot(c, HW - 25, 63, 11);
  dot(c, HW - 18, 63, frame === 1 ? 15 : 11);
  dot(c, HW - 11, 63, 15);
  fillRect(c, HW - 18, 65, HW - 9, 67, 11);

  // Window glow on the floor lip.
  for (let x = 6; x < HW - 6; x++) if (c.get(x, 64) === 9) c.set(x, 64, 12);

  return c;
}

// ---------------------------------------------------------------------------
// Habitat builder dispatch
// ---------------------------------------------------------------------------

function buildHabitat(id: string, frame: number): PixelCanvas {
  switch (id) {
    case 'habitat-terminal-den':
      return buildTerminalDen(frame);
    case 'habitat-meadow':
      return buildMeadow(frame);
    case 'habitat-rooftop-night':
      return buildRooftopNight(frame);
    case 'habitat-beach-cove':
      return buildBeachCove(frame);
    case 'habitat-forest-glade':
      return buildForestGlade(frame);
    case 'habitat-snowpeak':
      return buildSnowpeak(frame);
    case 'habitat-desert-dunes':
      return buildDesertDunes(frame);
    case 'habitat-crimson-mars':
      return buildCrimsonMars(frame);
    case 'habitat-europa-ice':
      return buildEuropaIce(frame);
    case 'habitat-lunar-base':
      return buildLunarBase(frame);
    case 'habitat-nebula-drift':
      return buildNebulaDrift(frame);
    case 'habitat-starship-deck':
      return buildStarshipDeck(frame);
    default:
      throw new Error(`Unknown habitat: ${id}`);
  }
}

// ===========================================================================
// TRINKETS (28x28, 2 frames)
// ===========================================================================

// ---------------------------------------------------------------------------
// TRINKET: Bouncy Ball
// ---------------------------------------------------------------------------

function buildBouncyBall(frame: number): PixelCanvas {
  const c = PixelCanvas.create(TW, TH);

  if (frame === 0) {
    const cx = 14;
    const cy = 13;
    fillEllipse(c, cx, cy, 10, 10, 7);
    fillEllipse(c, cx, cy, 9, 9, 9);
    fillEllipse(c, cx - 1, cy + 1, 7, 7, 6);
    // Colour band across the middle.
    for (let x = cx - 9; x <= cx + 9; x++) c.set(x, cy + 4, 5);
    for (let x = cx - 8; x <= cx + 8; x++) c.set(x, cy + 5, 5);
    dot(c, cx + 4, cy + 6, 11);
    // Glossy highlight.
    fillEllipse(c, cx - 3, cy - 3, 3, 3, 12);
    dot(c, cx - 4, cy - 4, 14);
    dot(c, cx - 3, cy - 4, 13);
    strokeEllipse(c, cx, cy, 10, 10, 1);
    fillEllipse(c, cx, 26, 8, 1, 3); // soft shadow
  } else {
    const cx = 14;
    const cy = 17;
    fillEllipse(c, cx, cy, 11, 7, 7);
    fillEllipse(c, cx, cy, 10, 6, 9);
    fillEllipse(c, cx - 1, cy + 1, 7, 4, 6);
    for (let x = cx - 8; x <= cx + 8; x++) c.set(x, cy + 1, 5);
    fillEllipse(c, cx - 3, cy - 2, 3, 2, 12);
    dot(c, cx - 4, cy - 3, 14);
    strokeEllipse(c, cx, cy, 11, 7, 1);
    fillEllipse(c, cx, 25, 9, 1, 3); // squash shadow
  }

  return c;
}

// ---------------------------------------------------------------------------
// TRINKET: Cushion
// ---------------------------------------------------------------------------

function buildCushion(frame: number): PixelCanvas {
  const c = PixelCanvas.create(TW, TH);

  const top = frame === 0 ? 6 : 8;
  const bot = frame === 0 ? 22 : 23;
  const midY = (top + bot) >> 1;

  // Plump pillow body, lit top + shaded underside.
  fillRect(c, 4, top + 1, 23, bot - 1, 8);
  fillRect(c, 5, top, 22, bot, 7);
  fillRect(c, 5, top, 22, top + 3, 10);
  fillRect(c, 5, bot - 3, 22, bot, 5);
  // Rounded sides.
  for (let y = top + 1; y <= bot - 1; y++) {
    c.set(4, y, 6);
    c.set(23, y, 6);
    c.set(3, y, 6);
  }
  // Seam cross + center button.
  for (let x = 7; x <= 20; x++) c.set(x, midY, 6);
  for (let y = top + 1; y <= bot - 1; y++) c.set(14, y, 6);
  fillCircle(c, 14, midY, 2, 11);
  dot(c, 14, midY, 14);
  // Tufted corners.
  dot(c, 4, top - 1, 11);
  dot(c, 23, top - 1, 11);
  dot(c, 3, top, 10);
  dot(c, 24, top, 10);
  dot(c, 4, bot + 1, 9);
  dot(c, 23, bot + 1, 9);
  strokeRect(c, 4, top, 23, bot, 1);

  return c;
}

// ---------------------------------------------------------------------------
// TRINKET: Lava Lamp
// ---------------------------------------------------------------------------

function buildLavaLamp(frame: number): PixelCanvas {
  const c = PixelCanvas.create(TW, TH);

  // Base + cap.
  fillRect(c, 8, 24, 19, 27, 4);
  fillRect(c, 9, 22, 18, 24, 5);
  fillRect(c, 9, 1, 18, 3, 4);
  fillRect(c, 11, 0, 16, 1, 5);
  // Glass body + inner lit column.
  fillRect(c, 9, 4, 18, 22, 3);
  fillRect(c, 11, 3, 16, 22, 4);
  fillRect(c, 12, 4, 15, 21, 6);

  // Two slow blobs that swap ends each frame.
  const aY = frame === 0 ? 17 : 7;
  const bY = frame === 0 ? 8 : 17;
  fillEllipse(c, 13, aY, 3, 4, 10);
  fillEllipse(c, 13, aY, 2, 3, 12);
  dot(c, 12, aY - 1, 13);
  fillEllipse(c, 14, bY, 2, 3, 9);
  dot(c, 14, bY, 11);
  // A tiny drifting droplet.
  dot(c, 13, frame === 0 ? 12 : 13, 12);

  // Glass shading: lit left edge, dark right edge.
  for (let y = 4; y <= 21; y++) {
    c.set(11, y, 5);
    c.set(16, y, 2);
  }

  strokeRect(c, 9, 3, 18, 22, 1);
  c.set(9, 3, 1);
  c.set(18, 3, 1);

  return c;
}

// ---------------------------------------------------------------------------
// TRINKET: Bonsai
// ---------------------------------------------------------------------------

function buildBonsai(frame: number): PixelCanvas {
  const c = PixelCanvas.create(TW, TH);

  // Pot.
  fillRect(c, 7, 20, 20, 25, 7);
  fillRect(c, 6, 18, 21, 20, 8);
  fillRect(c, 7, 25, 20, 26, 6);
  for (let x = 7; x <= 20; x++) c.set(x, 20, 9);
  c.set(7, 22, 6);
  c.set(20, 22, 6);
  strokeRect(c, 6, 18, 21, 26, 1);

  // Trunk (leans on frame 1) + one low branch.
  const lean = frame === 1 ? 1 : 0;
  thickLine(c, 13, 18, 13 + lean, 11, 3, 6);
  thickLine(c, 13 + lean, 11, 16 + lean * 2, 4, 2, 6);
  thickLine(c, 13, 15, 8, 11, 2, 6);

  // Foliage clumps.
  const cx = 16 + lean;
  fillEllipse(c, cx, 6, 8, 4, 9);
  fillEllipse(c, cx - 7, 8, 4, 4, 8);
  fillEllipse(c, cx + 5, 8, 4, 3, 8);
  fillEllipse(c, 8, 11, 4, 3, 8);
  // Highlights + a glint (a falling leaf on frame 1).
  fillEllipse(c, cx - 1, 4, 4, 1, 11);
  dot(c, cx - 2, 3, 12);
  dot(c, cx + 3, 4, 12);
  dot(c, cx - 6, 9, 13);
  if (frame === 0) dot(c, cx + 5, 5, 14);
  else dot(c, cx - 8, 14, 14);

  return c;
}

// ---------------------------------------------------------------------------
// TRINKET: Gift Box
// ---------------------------------------------------------------------------

function buildGiftBox(frame: number): PixelCanvas {
  const c = PixelCanvas.create(TW, TH);

  // Box body + lid.
  fillRect(c, 3, 11, 24, 25, 7);
  fillRect(c, 3, 8, 24, 12, 8);
  fillRect(c, 3, 8, 24, 9, 9);
  fillRect(c, 3, 23, 24, 25, 5);
  for (let y = 11; y <= 25; y++) c.set(3, y, 8);
  strokeRect(c, 3, 8, 24, 25, 1);
  strokeRect(c, 3, 11, 24, 11, 1);

  // Ribbon cross.
  for (let y = 8; y <= 25; y++) {
    c.set(13, y, 11);
    c.set(14, y, 10);
  }
  for (let x = 3; x <= 24; x++) {
    c.set(x, 15, 11);
    c.set(x, 16, 10);
  }
  for (let y = 8; y <= 25; y += 2) c.set(13, y, 12);

  // Bow on top (animated).
  if (frame === 0) {
    fillEllipse(c, 9, 6, 4, 3, 10);
    fillEllipse(c, 18, 6, 4, 3, 10);
    fillCircle(c, 13, 6, 2, 12);
    dot(c, 14, 6, 12);
    dot(c, 9, 7, 8);
    dot(c, 18, 7, 8);
  } else {
    fillEllipse(c, 8, 4, 4, 3, 10);
    fillEllipse(c, 19, 4, 4, 3, 10);
    fillCircle(c, 13, 6, 2, 12);
    dot(c, 14, 6, 12);
    dot(c, 13, 2, 14); // sparkle
  }

  return c;
}

// ---------------------------------------------------------------------------
// TRINKET: Trophy Shelf
// ---------------------------------------------------------------------------

function buildTrophyShelf(frame: number): PixelCanvas {
  const c = PixelCanvas.create(TW, TH);

  // Shelf plank.
  fillRect(c, 0, 20, 27, 24, 6);
  fillRect(c, 0, 20, 27, 20, 7);
  fillRect(c, 0, 24, 27, 25, 5);
  strokeRect(c, 0, 20, 27, 25, 1);

  // Two cups: [centerX, cupTopY].
  for (const [tx, cupTop] of [
    [7, 8],
    [20, 5],
  ] as const) {
    const cupBot = 16;
    fillEllipse(c, tx, cupBot - 1, 4, 3, 9);
    fillRect(c, tx - 4, cupTop, tx + 4, cupBot - 1, 9);
    fillRect(c, tx - 3, cupTop, tx + 3, cupTop + 2, 11); // lit rim
    // Handles.
    c.set(tx - 5, cupTop + 1, 8);
    c.set(tx + 5, cupTop + 1, 8);
    c.set(tx - 6, cupTop + 2, 8);
    c.set(tx + 6, cupTop + 2, 8);
    c.set(tx - 6, cupTop + 3, 8);
    c.set(tx + 6, cupTop + 3, 8);
    // Stem + base.
    fillRect(c, tx - 1, cupBot, tx + 1, cupBot + 2, 8);
    fillRect(c, tx - 3, cupBot + 3, tx + 3, cupBot + 3, 9);
    strokeRect(c, tx - 4, cupTop, tx + 4, cupBot - 1, 1);
    strokeEllipse(c, tx, cupBot - 1, 4, 3, 1);
    dot(c, tx - 2, cupTop + 1, 14); // shine
  }

  // Twinkle above each cup.
  if (frame === 0) {
    dot(c, 7, 5, 13);
    dot(c, 20, 2, 13);
  } else {
    for (const [sx, sy] of [
      [7, 5],
      [20, 2],
    ] as const) {
      dot(c, sx, sy, 14);
      dot(c, sx - 1, sy, 12);
      dot(c, sx + 1, sy, 12);
      dot(c, sx, sy - 1, 12);
      dot(c, sx, sy + 1, 12);
    }
  }

  return c;
}

// ---------------------------------------------------------------------------
// Trinket builder dispatch
// ---------------------------------------------------------------------------

function buildTrinket(id: string, frame: number): PixelCanvas {
  switch (id) {
    case 'trinket-bouncy-ball':
      return buildBouncyBall(frame);
    case 'trinket-cushion':
      return buildCushion(frame);
    case 'trinket-lava-lamp':
      return buildLavaLamp(frame);
    case 'trinket-bonsai':
      return buildBonsai(frame);
    case 'trinket-gift-box':
      return buildGiftBox(frame);
    case 'trinket-trophy-shelf':
      return buildTrophyShelf(frame);
    default:
      throw new Error(`Unknown trinket: ${id}`);
  }
}

// ---------------------------------------------------------------------------
// Exported sprite arrays
// ---------------------------------------------------------------------------

/** Sprite ids for all habitats (additive-only — never remove or renumber). */
const HABITAT_IDS: readonly string[] = [
  'habitat-terminal-den',
  'habitat-meadow',
  'habitat-rooftop-night',
  'habitat-beach-cove',
  'habitat-forest-glade',
  'habitat-snowpeak',
  'habitat-desert-dunes',
  'habitat-crimson-mars',
  'habitat-europa-ice',
  'habitat-lunar-base',
  'habitat-nebula-drift',
  'habitat-starship-deck',
];

/** Trinket sprite ids (starter set — additive-only). */
const TRINKET_IDS: readonly string[] = [
  'trinket-bouncy-ball',
  'trinket-cushion',
  'trinket-lava-lamp',
  'trinket-bonsai',
  'trinket-gift-box',
  'trinket-trophy-shelf',
];

/** All habitat background sprites (128x96, 2 frames, animated). */
export const habitatSprites = HABITAT_IDS.map((id) => {
  const f0 = buildHabitat(id, 0);
  const f1 = buildHabitat(id, 1);
  return buildSprite(id, [f0, f1], 4); // 4fps subtle ambient animation
});

/** All trinket sprites (28x28, 2 frames). */
export const trinketSprites = TRINKET_IDS.map((id) => {
  const f0 = buildTrinket(id, 0);
  const f1 = buildTrinket(id, 1);
  return buildSprite(id, [f0, f1], 4);
});

/** Habitats + trinkets together (scene layer). */
export const sceneSprites = [...habitatSprites, ...trinketSprites];
