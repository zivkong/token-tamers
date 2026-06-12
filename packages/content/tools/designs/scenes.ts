/**
 * Scenery sprite designs — habitats (backgrounds) + trinkets (toys/objects).
 *
 * Each habitat is 96x48, 2-3 frames. Each trinket is 12x12, 2 frames.
 * All use palette-indexed ramp (0 = transparent). Habitats with a `palette`
 * field in habitats.json use those hex colors directly (multi-color).
 *
 * Palette index contract for multi-color habitats:
 *   1 = darkest shadow / deep background
 *   2 = deep shadow / outline
 *   3 = shadow / back-depth
 *   4 = mid-shadow / ground-dark
 *   5 = mid / distant color
 *   6 = mid-light
 *   7 = floor/ground dominant
 *   8 = foreground mid
 *   9 = light accent
 *  10 = bright highlight
 *  11 = sky/ceiling primary
 *  12 = cloud / bright surface
 *  13 = rim / near-white highlight
 *  14 = brightest solid
 *  15 = glint / twinkle (animated)
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

const HW = 96; // habitat width
const HH = 48; // habitat height

// ---------------------------------------------------------------------------
// REBUILD: Terminal Den — cozy hacker den
// Palette: warm lamp amber vs cool monitor cyan on dark walls.
// 1=very dark bg, 2=dark wall, 3=shadow, 4=desk wood, 5=monitor glow,
// 6=screen mid-cyan, 7=bright cyan text, 8=warm lamp amber, 9=lamp highlight,
// 10=desk top, 11=plant green, 12=bright screen, 13=near-white cyan, 14=white, 15=cursor
// ---------------------------------------------------------------------------

function buildTerminalDen(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  // Background wall — dark (index 2)
  fillRect(c, 0, 0, HW - 1, HH - 1, 2);

  // Subtle wall texture: slightly darker bands (index 1)
  for (let y = 0; y < 37; y += 6) {
    for (let x = 0; x < HW; x++) {
      if (c.get(x, y) === 2) c.set(x, y, 1);
    }
  }

  // Monitor frame bezel (index 3 = slightly lighter than wall)
  fillRect(c, 20, 3, 75, 33, 3);
  // Screen face (index 6 = mid cyan glow)
  fillRect(c, 23, 5, 72, 30, 6);
  // Screen inner glow zones — brighter center (index 7, 12)
  fillRect(c, 26, 7, 69, 28, 7);
  fillRect(c, 30, 9, 65, 26, 12);
  // Hottest center column region
  fillRect(c, 38, 9, 56, 15, 13);

  // CRT scanline pattern (alternating dim rows)
  for (let y = 8; y <= 29; y += 3) {
    for (let x = 24; x <= 71; x++) {
      const v = c.get(x, y);
      if (v >= 6 && v <= 13) c.set(x, y, Math.max(5, v - 2));
    }
  }

  // Terminal code lines — cyan text bars (index 7/12)
  const codeLines = [
    { y: 12, x0: 31, len: 20 },
    { y: 15, x0: 31, len: 14 },
    { y: 18, x0: 31, len: 26 },
    { y: 21, x0: 31, len: 10 },
    { y: 24, x0: 31, len: 18 },
    { y: 27, x0: 31, len: 22 },
  ];
  for (const ln of codeLines) {
    for (let x = ln.x0; x < ln.x0 + ln.len; x++) {
      c.set(x, ln.y, 7);
      if ((x - ln.x0) % 5 === 4) c.set(x, ln.y, 6); // word gap
    }
    // Indented second sub-line (dim)
    if (ln.y + 1 < 30) {
      for (let x = ln.x0 + 2; x < ln.x0 + 8; x++) c.set(x, ln.y + 1, 6);
    }
  }

  // Cursor blink on frame 1
  if (frame === 1) {
    fillRect(c, 31, 27, 33, 28, 15);
  }

  // Screen edge glow halo
  for (let y = 5; y <= 30; y++) {
    c.set(22, y, 5);
    c.set(73, y, 5);
  }
  for (let x = 22; x <= 73; x++) {
    c.set(x, 5, 5);
    c.set(x, 30, 5);
  }

  // Monitor stand
  fillRect(c, 44, 33, 50, 36, 3);
  fillRect(c, 40, 36, 53, 37, 4);

  // Desk surface — warm wood (index 4/10)
  fillRect(c, 0, 37, HW - 1, 39, 4);
  for (let x = 0; x < HW; x++) c.set(x, 37, 10); // top edge highlight
  // Desk front face
  fillRect(c, 0, 40, HW - 1, HH - 1, 3);
  for (let x = 0; x < HW; x++) c.set(x, 40, 4); // front face top edge

  // Keyboard silhouette on desk
  fillRect(c, 26, 35, 64, 37, 3);
  strokeRect(c, 26, 35, 64, 37, 2);
  for (let kx = 29; kx <= 62; kx += 3) c.set(kx, 35, 4);
  for (let kx = 30; kx <= 61; kx += 3) c.set(kx, 36, 5);

  // Desk lamp — left side (warm amber, index 8/9)
  // Lamp base on desk
  fillRect(c, 5, 36, 8, 37, 4);
  // Arm
  line(c, 6, 36, 8, 32, 3);
  line(c, 8, 32, 12, 30, 3);
  // Lamp head cone
  fillEllipse(c, 10, 29, 5, 3, 8);
  fillEllipse(c, 10, 29, 3, 2, 9);
  dot(c, 10, 28, 14); // bright bulb
  // Warm lamp glow spill on desk
  for (let lx = 0; lx < 22; lx++) {
    const warmth = lx < 6 ? 8 : lx < 12 ? 4 : 3;
    c.set(lx, 38, warmth);
    if (lx < 16) c.set(lx, 39, lx < 8 ? 4 : 3);
  }

  // Potted plant — right side of desk (index 11 = green)
  fillRect(c, 78, 35, 84, 37, 8); // terracotta pot
  fillRect(c, 79, 34, 83, 35, 9);
  strokeRect(c, 78, 34, 84, 37, 2);
  fillEllipse(c, 81, 32, 3, 3, 11); // foliage
  fillEllipse(c, 79, 31, 2, 2, 11);
  fillEllipse(c, 83, 31, 2, 2, 11);
  dot(c, 81, 30, 13);
  if (frame === 0) dot(c, 79, 29, 15); // dew glint frame 0

  // Floating glyph dust near screen edges
  const glyphsL = [
    [5, 8],
    [8, 15],
    [6, 22],
    [11, 29],
    [3, 35],
    [14, 6],
  ] as const;
  const glyphsR = [
    [88, 7],
    [91, 14],
    [85, 21],
    [90, 28],
    [93, 11],
    [82, 23],
  ] as const;
  const glyphBright = frame === 0 ? 7 : 12;
  for (const [gx, gy] of [...glyphsL, ...glyphsR]) {
    c.set(gx, gy, glyphBright);
    c.set(gx + 1, gy, 5);
  }

  return c;
}

// ---------------------------------------------------------------------------
// REBUILD: Meadow — blue sky, white clouds, sun, layered hills, flowers
// Palette: 1=dark earth, 2=distant hill shadow, 3=back hill, 4=mid hill,
// 5=front ground dark, 6=grass mid, 7=grass light, 8=sky blue, 9=sky light,
// 10=cloud shadow, 11=cloud white, 12=sun halo, 13=sun yellow, 14=flower bright, 15=flower glint
// ---------------------------------------------------------------------------

function buildMeadow(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  // Sky gradient — bright blue (index 9 top, 8 mid, toward 6 near horizon)
  for (let y = 0; y < HH; y++) {
    const skyIdx = y < 6 ? 9 : y < 12 ? 9 : y < 20 ? 8 : y < 28 ? 8 : 7;
    for (let x = 0; x < HW; x++) c.set(x, y, skyIdx);
  }

  // Sun — upper left region (index 13/14 center, 12 halo)
  const sunX = 14;
  const sunY = 8;
  fillEllipse(c, sunX, sunY, 7, 7, 12); // outer halo
  fillEllipse(c, sunX, sunY, 5, 5, 13); // sun body
  fillEllipse(c, sunX, sunY, 3, 3, 14); // hot core
  dot(c, sunX - 1, sunY - 1, 14); // glint

  // Light rays from sun (very subtle, 1-2 px streaks)
  for (let i = 0; i < 5; i++) {
    const angle = i * 0.5 + 0.2;
    const rx = Math.round(sunX + Math.cos(angle) * 9);
    const ry = Math.round(sunY + Math.sin(angle) * 9);
    dot(c, rx, ry, 12);
    dot(c, Math.round(sunX + Math.cos(angle) * 11), Math.round(sunY + Math.sin(angle) * 11), 9);
  }

  // Back hill silhouette (index 3)
  for (let x = 0; x < HW; x++) {
    const h = 22 + Math.round(3 * Math.sin(x * 0.06 + 0.4));
    for (let y = h; y < HH; y++) c.set(x, y, 3);
    c.set(x, h, 4); // crest lighter
    if (h > 1) c.set(x, h - 1, 7); // sky-lit fringe
  }

  // Mid hill (index 4)
  for (let x = 0; x < HW; x++) {
    const h = 28 + Math.round(5 * Math.sin(x * 0.05 + 0.8));
    for (let y = h; y < HH; y++) c.set(x, y, 4);
    c.set(x, h, 6);
    if (h > 1) c.set(x, h - 1, 7);
  }

  // Front ground (index 5/6/7)
  for (let x = 0; x < HW; x++) {
    const h = 36 + Math.round(2 * Math.sin(x * 0.07 + 2.1));
    for (let y = h; y < HH; y++) c.set(x, y, 5);
    c.set(x, h, 7);
    if (h + 1 < HH) c.set(x, h + 1, 6);
  }

  // Ground texture scatter
  const rng = lcg(hashStr('habitat-meadow'));
  for (let i = 0; i < 25; i++) {
    const gx = rng.int(HW);
    const gy = 39 + rng.int(8);
    if (c.get(gx, gy) === 5) c.set(gx, gy, 6);
  }

  // Clouds — drifting slightly between frames (index 11/10)
  const c1dx = frame === 1 ? 1 : 0;
  const c1x = 48 + c1dx;
  const c1y = 8;
  fillEllipse(c, c1x, c1y, 11, 5, 10); // cloud base shadow
  fillEllipse(c, c1x + 7, c1y + 1, 7, 4, 10);
  fillEllipse(c, c1x - 6, c1y + 1, 6, 4, 10);
  fillEllipse(c, c1x, c1y, 9, 4, 11); // bright cloud
  fillEllipse(c, c1x + 6, c1y, 6, 3, 11);
  fillEllipse(c, c1x - 4, c1y, 5, 3, 11);
  fillEllipse(c, c1x, c1y - 1, 6, 2, 14); // bright top
  // Cloud shadow underside
  for (let x = c1x - 11; x <= c1x + 14; x++) {
    if (c.get(x, c1y + 5) === 10) c.set(x, c1y + 5, 9);
  }

  // Small cloud right side
  const c2dx = frame === 1 ? -1 : 0;
  const c2x = 80 + c2dx;
  const c2y = 12;
  fillEllipse(c, c2x, c2y, 7, 4, 10);
  fillEllipse(c, c2x, c2y, 6, 3, 11);
  fillEllipse(c, c2x + 4, c2y - 1, 4, 3, 11);
  dot(c, c2x - 2, c2y - 2, 14);

  // Flowers — bright dots on front ground (index 14/15)
  const flowers = [
    [4, 40],
    [13, 39],
    [22, 41],
    [35, 40],
    [61, 41],
    [72, 40],
    [83, 39],
    [90, 41],
    [8, 43],
    [30, 42],
    [55, 44],
    [78, 43],
    [42, 41],
    [66, 40],
    [18, 43],
  ] as const;
  for (const [fx, fy] of flowers) {
    const bright = frame === 0 ? 14 : 15;
    c.set(fx, fy, bright);
    c.set(fx - 1, fy, 13);
    c.set(fx + 1, fy, 13);
    c.set(fx, fy - 1, 13);
  }

  // Distant tree silhouettes at far edges (index 2)
  const trees = [
    { x: 0, y: 21, rx: 3, ry: 4 },
    { x: 7, y: 19, rx: 4, ry: 5 },
    { x: 88, y: 21, rx: 3, ry: 4 },
    { x: 94, y: 19, rx: 4, ry: 5 },
  ];
  for (const { x, y, rx, ry } of trees) {
    fillEllipse(c, x, y, rx, ry, 2);
    fillRect(c, x - 1, y + ry - 1, x + 1, y + ry + 2, 2); // trunk
  }

  return c;
}

// ---------------------------------------------------------------------------
// REBUILD: Rooftop Night — deep blue night, warm moon, amber windows
// Palette: 1=black sky top, 2=deep night, 3=midnight blue, 4=city silhouette far,
// 5=city silhouette near, 6=rooftop concrete, 7=ledge highlight, 8=window amber dim,
// 9=window amber bright, 10=moon halo, 11=moon body, 12=moon bright, 13=star dim, 14=star bright, 15=star twinkle
// ---------------------------------------------------------------------------

function buildRooftopNight(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  // Night sky gradient
  for (let y = 0; y < HH; y++) {
    const idx = y < 6 ? 1 : y < 14 ? 2 : y < 22 ? 3 : y < 30 ? 2 : 3;
    for (let x = 0; x < HW; x++) c.set(x, y, idx);
  }

  // Horizon city glow (warm light pollution, index 6)
  for (let x = 0; x < HW; x++) {
    c.set(x, 26, 6);
    c.set(x, 27, 3);
  }

  // Dim stars (index 13)
  const dimStars = [
    [3, 2],
    [9, 5],
    [18, 3],
    [28, 6],
    [37, 2],
    [45, 4],
    [56, 6],
    [64, 3],
    [73, 5],
    [81, 2],
    [89, 6],
    [12, 9],
    [33, 8],
    [60, 10],
    [5, 14],
    [22, 11],
    [50, 13],
    [85, 12],
    [42, 16],
    [15, 17],
    [88, 18],
    [10, 22],
    [48, 21],
  ] as const;
  for (const [sx, sy] of dimStars) c.set(sx, sy, 13);

  // Medium stars with cross halo (index 14)
  const medStars = [
    [7, 4],
    [24, 2],
    [41, 6],
    [58, 3],
    [75, 5],
    [15, 8],
    [48, 9],
    [83, 7],
    [30, 12],
  ] as const;
  for (const [sx, sy] of medStars) {
    c.set(sx, sy, 14);
    c.set(sx - 1, sy, 13);
    c.set(sx + 1, sy, 13);
    c.set(sx, sy - 1, 13);
    c.set(sx, sy + 1, 13);
  }

  // Bright twinkle stars (animate)
  const brightStars = [
    [20, 4],
    [52, 2],
    [79, 6],
    [35, 10],
    [63, 8],
    [11, 15],
  ] as const;
  for (const [sx, sy] of brightStars) {
    const bright = frame === 0 ? 15 : 14;
    const dim = frame === 0 ? 14 : 13;
    c.set(sx, sy, bright);
    c.set(sx - 1, sy, dim);
    c.set(sx + 1, sy, dim);
    c.set(sx, sy - 1, dim);
    c.set(sx, sy + 1, dim);
  }

  // Crescent Moon (upper-right, index 11/12)
  const moonCx = 76;
  const moonCy = 10;
  const moonR = 9;
  fillEllipse(c, moonCx, moonCy, moonR, moonR, 10); // halo
  fillEllipse(c, moonCx, moonCy, moonR - 1, moonR - 1, 11); // body
  fillEllipse(c, moonCx, moonCy, moonR - 3, moonR - 3, 12); // bright
  fillEllipse(c, moonCx + 1, moonCy - 1, 3, 3, 12); // hot spot
  // Crescent cut with sky color
  fillEllipse(c, moonCx - 5, moonCy - 4, moonR - 1, moonR - 1, 3);
  // Moon texture
  c.set(moonCx + 3, moonCy + 3, 10);
  c.set(moonCx + 5, moonCy + 2, 11);
  // Moon glow rings
  strokeEllipse(c, moonCx, moonCy, moonR + 3, moonR + 3, 10);
  strokeEllipse(c, moonCx, moonCy, moonR + 5, moonR + 5, 3);

  // Far city silhouette (index 4)
  const farBuildings = [
    { x: 0, w: 9, h: 13 },
    { x: 8, w: 5, h: 9 },
    { x: 12, w: 11, h: 17 },
    { x: 22, w: 7, h: 11 },
    { x: 28, w: 13, h: 21 },
    { x: 40, w: 6, h: 13 },
    { x: 45, w: 8, h: 9 },
    { x: 52, w: 12, h: 19 },
    { x: 63, w: 7, h: 13 },
    { x: 69, w: 10, h: 11 },
    { x: 78, w: 7, h: 17 },
    { x: 84, w: 9, h: 8 },
    { x: 92, w: 4, h: 14 },
  ];
  for (const { x, w, h } of farBuildings) {
    const topY = HH - 10 - h;
    fillRect(c, x, topY, x + w - 1, HH - 11, 4);
    for (let bx = x; bx < x + w; bx++) c.set(bx, topY, 3);
  }

  // Near city silhouette (index 5)
  const nearBuildings = [
    { x: 0, w: 6, h: 11 },
    { x: 5, w: 9, h: 15 },
    { x: 13, w: 5, h: 9 },
    { x: 17, w: 12, h: 18 },
    { x: 28, w: 7, h: 13 },
    { x: 34, w: 11, h: 17 },
    { x: 44, w: 5, h: 11 },
    { x: 48, w: 9, h: 15 },
    { x: 56, w: 7, h: 10 },
    { x: 62, w: 12, h: 18 },
    { x: 73, w: 6, h: 11 },
    { x: 78, w: 5, h: 9 },
    { x: 82, w: 11, h: 13 },
    { x: 92, w: 4, h: 8 },
  ];
  for (const { x, w, h } of nearBuildings) {
    const topY = HH - 10 - h;
    fillRect(c, x, topY, x + w - 1, HH - 11, 5);
    for (let bx = x; bx < x + w; bx++) c.set(bx, topY, 4);
  }

  // Window lights — amber glow (index 8/9)
  const farWins = [
    [2, 32],
    [5, 28],
    [14, 26],
    [16, 30],
    [24, 30],
    [31, 22],
    [33, 27],
    [35, 31],
    [42, 28],
    [47, 30],
    [54, 24],
    [57, 29],
    [65, 28],
    [71, 28],
    [80, 24],
    [86, 28],
  ] as const;
  for (const [wx, wy] of farWins) {
    if (c.get(wx, wy) >= 4) {
      c.set(wx, wy, 8);
      if (wx + 1 < HW && c.get(wx + 1, wy) >= 4) c.set(wx + 1, wy, 8);
    }
  }
  const nearWins = [
    [7, 28],
    [10, 24],
    [11, 30],
    [19, 22],
    [22, 26],
    [25, 29],
    [36, 20],
    [38, 24],
    [40, 28],
    [49, 22],
    [52, 27],
    [64, 20],
    [66, 24],
    [68, 28],
    [83, 22],
    [86, 26],
    [88, 28],
  ] as const;
  for (const [wx, wy] of nearWins) {
    if (c.get(wx, wy) >= 4) {
      const lit = frame === 0 ? 9 : 8;
      c.set(wx, wy, lit);
      if (wx + 1 < HW && c.get(wx + 1, wy) >= 4) c.set(wx + 1, wy, lit - 1);
    }
  }

  // Ground strip
  fillRect(c, 0, HH - 10, HW - 1, HH - 1, 5);
  for (let x = 0; x < HW; x++) c.set(x, HH - 10, 6);

  // Rooftop ledge foreground
  fillRect(c, 0, HH - 9, 16, HH - 1, 6);
  fillRect(c, 0, HH - 9, 16, HH - 8, 7);
  fillRect(c, 0, HH - 5, 16, HH - 1, 5);
  for (let x = 0; x <= 16; x++) c.set(x, HH - 9, 7);
  for (let x = 3; x <= 13; x += 4) {
    c.set(x, HH - 8, 5);
    c.set(x, HH - 7, 5);
  }
  fillRect(c, HW - 17, HH - 9, HW - 1, HH - 1, 6);
  fillRect(c, HW - 17, HH - 9, HW - 1, HH - 8, 7);
  fillRect(c, HW - 17, HH - 5, HW - 1, HH - 1, 5);
  for (let x = HW - 17; x < HW; x++) c.set(x, HH - 9, 7);
  for (let x = HW - 14; x <= HW - 4; x += 4) {
    c.set(x, HH - 8, 5);
    c.set(x, HH - 7, 5);
  }

  return c;
}

// ---------------------------------------------------------------------------
// NEW: Beach Cove — turquoise sea, sand floor, palm, sunset sky
// Palette: 1=deep ocean, 2=ocean mid, 3=ocean shallow, 4=sand shadow,
// 5=sand mid, 6=sand light, 7=sky peach, 8=sky orange, 9=sky warm pink,
// 10=cloud rose, 11=sun orange, 12=sun yellow, 13=foam white, 14=palm green, 15=sparkle
// ---------------------------------------------------------------------------

function buildBeachCove(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  // Sunset sky gradient (warm orange/peach top, rose near horizon)
  for (let y = 0; y < HH; y++) {
    const skyIdx = y < 6 ? 12 : y < 12 ? 11 : y < 18 ? 9 : y < 24 ? 8 : 7;
    for (let x = 0; x < HW; x++) c.set(x, y, skyIdx);
  }

  // Sun disc (upper right area)
  const sunX = 78;
  const sunY = 10;
  fillEllipse(c, sunX, sunY, 8, 8, 10); // glow
  fillEllipse(c, sunX, sunY, 6, 6, 11); // body
  fillEllipse(c, sunX, sunY, 4, 4, 12); // core
  dot(c, sunX - 1, sunY - 1, 13); // glint

  // Sunset horizon glow band
  for (let x = 0; x < HW; x++) {
    c.set(x, 22, 11);
    c.set(x, 23, 8);
    c.set(x, 24, 7);
  }

  // Cloud wisps
  const c1dx = frame === 1 ? 1 : 0;
  fillEllipse(c, 30 + c1dx, 9, 8, 3, 10);
  fillEllipse(c, 36 + c1dx, 8, 6, 3, 10);
  fillEllipse(c, 24 + c1dx, 10, 5, 2, 9);
  // Cloud highlights
  for (let x = 24 + c1dx; x <= 42 + c1dx; x++) {
    if (c.get(x, 7) === 10) c.set(x, 7, 13);
  }

  // Ocean — three depth bands
  // Far ocean (index 2 = mid blue-teal)
  for (let x = 0; x < HW; x++) {
    for (let y = 25; y < 33; y++) c.set(x, y, 2);
  }
  // Mid ocean (index 3 = lighter turquoise)
  for (let x = 0; x < HW; x++) {
    for (let y = 33; y < 38; y++) c.set(x, y, 3);
  }

  // Wave lines — alternating foam (frame-animated)
  const waveY1 = frame === 0 ? 27 : 28;
  const waveY2 = frame === 0 ? 31 : 30;
  for (let x = 4; x < HW - 4; x += 8) {
    c.set(x, waveY1, 13);
    c.set(x + 1, waveY1, 13);
    c.set(x + 2, waveY1 + 1, 13);
  }
  for (let x = 8; x < HW - 8; x += 10) {
    c.set(x, waveY2, 13);
    c.set(x + 1, waveY2, 13);
  }

  // Sun reflection on water
  for (let y = 25; y < 38; y++) {
    const col = c.get(sunX, y);
    if (col >= 1 && col <= 3) {
      c.set(sunX - 1, y, 11);
      c.set(sunX, y, 12);
      c.set(sunX + 1, y, 11);
    }
  }

  // Sandy beach floor — bottom 10 rows
  for (let x = 0; x < HW; x++) {
    for (let y = 38; y < HH; y++) c.set(x, y, 5);
  }
  // Sand highlight row
  for (let x = 0; x < HW; x++) c.set(x, 38, 6);
  // Sand wet zone near water edge
  for (let x = 0; x < HW; x++) {
    c.set(x, 37, 4);
    c.set(x, 36, 3);
  }
  // Sand texture scatter
  const rng = lcg(hashStr('habitat-beach-cove'));
  for (let i = 0; i < 30; i++) {
    const gx = rng.int(HW);
    const gy = 40 + rng.int(7);
    if (c.get(gx, gy) === 5) c.set(gx, gy, 6);
  }
  // Pebble dots
  for (let i = 0; i < 10; i++) {
    const gx = rng.int(HW);
    const gy = 41 + rng.int(5);
    c.set(gx, gy, 4);
  }

  // Palm tree silhouette — left side
  // Trunk (index 14)
  line(c, 8, 37, 10, 24, 14);
  // Fronds
  line(c, 10, 24, 0, 18, 14);
  line(c, 10, 24, 4, 16, 14);
  line(c, 10, 24, 14, 15, 14);
  line(c, 10, 24, 20, 17, 14);
  line(c, 10, 24, 22, 20, 14);
  // Coconuts
  dot(c, 10, 25, 8);
  dot(c, 11, 26, 8);
  dot(c, 9, 26, 8);

  // Seashells on beach (bright accent dots)
  const shells = [
    [20, 42],
    [35, 44],
    [52, 41],
    [68, 43],
    [82, 42],
    [90, 45],
  ] as const;
  for (const [sx, sy] of shells) {
    c.set(sx, sy, 13);
    c.set(sx + 1, sy, 6);
  }
  // Sparkles on water frame 0
  if (frame === 0) {
    dot(c, 40, 29, 15);
    dot(c, 62, 27, 15);
    dot(c, 84, 31, 15);
  }

  return c;
}

// ---------------------------------------------------------------------------
// NEW: Forest Glade — layered green canopy, god-rays, mossy floor, fireflies
// Palette: 1=deep forest shadow, 2=bark brown, 3=deep canopy, 4=mid canopy,
// 5=canopy highlight, 6=forest floor dark, 7=moss green, 8=moss highlight,
// 9=sky through leaves, 10=god-ray glow, 11=bark highlight, 12=leaf light,
// 13=bright leaf, 14=firefly glow, 15=firefly hot
// ---------------------------------------------------------------------------

function buildForestGlade(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  // Background forest floor/shadow base
  fillRect(c, 0, 0, HW - 1, HH - 1, 1);

  // Sky glimpses through canopy — small patches (index 9)
  const skyPatches = [
    { x: 30, y: 3, rx: 8, ry: 4 },
    { x: 55, y: 5, rx: 6, ry: 3 },
    { x: 70, y: 2, rx: 5, ry: 3 },
    { x: 15, y: 6, rx: 4, ry: 3 },
  ];
  for (const { x, y, rx, ry } of skyPatches) {
    fillEllipse(c, x, y, rx, ry, 9);
    fillEllipse(c, x, y, rx - 2, ry - 1, 10); // brighter center
  }

  // God-rays (diagonal light beams from sky patches, index 10/9)
  const rays = [
    { sx: 30, sy: 7, angle: 0.3, len: 18 },
    { sx: 55, sy: 8, angle: 0.5, len: 15 },
    { sx: 15, sy: 9, angle: 0.6, len: 12 },
  ];
  for (const { sx, sy, angle, len } of rays) {
    for (let d = 0; d < len; d++) {
      const rx = Math.round(sx + Math.sin(angle) * d);
      const ry = sy + d;
      if (ry < HH && rx >= 0 && rx < HW) {
        const col = c.get(rx, ry);
        if (col <= 3) c.set(rx, ry, d < 6 ? 10 : 9);
        if (rx + 1 < HW && c.get(rx + 1, ry) <= 2) c.set(rx + 1, ry, 9);
      }
    }
  }

  // Back canopy layer — top of scene (index 3)
  for (let x = 0; x < HW; x++) {
    const h = 8 + Math.round(5 * Math.sin(x * 0.08 + 0.5));
    for (let y = 0; y < h; y++) if (c.get(x, y) === 1) c.set(x, y, 3);
  }

  // Mid canopy (index 4)
  for (let x = 0; x < HW; x++) {
    const h = 14 + Math.round(6 * Math.sin(x * 0.07 + 1.2));
    for (let y = 0; y < h; y++) {
      if (c.get(x, y) <= 1) c.set(x, y, 4);
    }
  }

  // Canopy highlight fringe (index 5/12 on lit canopy edges)
  for (let x = 0; x < HW; x++) {
    // Find the bottom edge of mid canopy
    for (let y = 0; y < 25; y++) {
      if (c.get(x, y) >= 3 && c.get(x, y + 1) <= 1) {
        c.set(x, y, 5);
        if (y + 1 < HH) c.set(x, y + 1, 12);
        break;
      }
    }
  }

  // Tree trunks left + right (index 2/11)
  for (const tx of [5, 18, 80, 92]) {
    for (let y = 10; y < 38; y++) {
      c.set(tx, y, 2);
      c.set(tx + 1, y, 11);
      c.set(tx + 2, y, 2);
    }
    // Root flares at base
    fillEllipse(c, tx + 1, 37, 4, 2, 2);
  }

  // Forest floor — mossy ground (index 6/7/8)
  for (let x = 0; x < HW; x++) {
    for (let y = 38; y < HH; y++) c.set(x, y, 6);
  }
  for (let x = 0; x < HW; x++) {
    c.set(x, 38, 7); // moss surface
    c.set(x, 39, 8); // moss highlight band
  }
  // Moss texture
  const rng = lcg(hashStr('habitat-forest-glade'));
  for (let i = 0; i < 30; i++) {
    const gx = rng.int(HW);
    const gy = 40 + rng.int(7);
    if (c.get(gx, gy) === 6) c.set(gx, gy, 7);
  }
  // Mushroom dots
  for (let i = 0; i < 6; i++) {
    const gx = rng.int(HW - 4) + 2;
    const gy = 40 + rng.int(6);
    c.set(gx, gy, 10);
    c.set(gx, gy - 1, 14);
  }

  // Foreground branch silhouettes (index 2) at screen edges
  line(c, 0, 20, 10, 28, 2);
  line(c, 0, 18, 8, 24, 2);
  line(c, HW - 1, 18, HW - 8, 24, 2);
  line(c, HW - 1, 22, HW - 10, 30, 2);

  // Fireflies — bright dots that shift position between frames (index 14/15)
  const fireflies0 = [
    [22, 32],
    [40, 25],
    [58, 28],
    [71, 33],
    [85, 26],
  ] as const;
  const fireflies1 = [
    [24, 30],
    [41, 27],
    [57, 26],
    [72, 31],
    [86, 28],
  ] as const;
  const flies = frame === 0 ? fireflies0 : fireflies1;
  for (const [fx, fy] of flies) {
    dot(c, fx, fy, 15);
    dot(c, fx - 1, fy, 14);
    dot(c, fx + 1, fy, 14);
    dot(c, fx, fy - 1, 14);
  }

  return c;
}

// ---------------------------------------------------------------------------
// NEW: Snowpeak — pale blue ice peaks, aurora band, snow floor
// Palette: 1=deep night, 2=dark sky, 3=aurora teal, 4=aurora green,
// 5=aurora violet, 6=distant peak shadow, 7=near peak mid, 8=snow shadow,
// 9=snow mid, 10=snow bright, 11=ice glint, 12=aurora pink, 13=star, 14=near-white ice, 15=sparkle
// ---------------------------------------------------------------------------

function buildSnowpeak(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  // Night sky (deep indigo-black)
  fillRect(c, 0, 0, HW - 1, HH - 1, 2);
  // Darker at very top
  for (let x = 0; x < HW; x++) {
    for (let y = 0; y < 8; y++) c.set(x, y, 1);
  }

  // Stars
  const stars = [
    [4, 3],
    [12, 2],
    [25, 4],
    [38, 1],
    [50, 5],
    [62, 2],
    [74, 4],
    [88, 3],
    [8, 7],
    [30, 6],
    [55, 8],
    [80, 7],
    [18, 5],
    [44, 3],
    [68, 6],
    [92, 4],
  ] as const;
  for (const [sx, sy] of stars) c.set(sx, sy, 13);
  // Bright stars
  dot(c, 20, 3, 15);
  dot(c, 60, 4, 15);
  dot(c, 85, 2, frame === 0 ? 15 : 13);

  // Aurora band — horizontal ribbons of color (index 3/4/5/12)
  const auroraY = 10;
  for (let x = 0; x < HW; x++) {
    const phase = x * 0.05 + (frame === 1 ? 0.3 : 0);
    const ripple = Math.sin(phase) * 2;
    const y = Math.round(auroraY + ripple);
    c.set(x, y, 4); // green core
    c.set(x, y + 1, 3); // teal fringe
    c.set(x, y + 2, 3);
    c.set(x, y - 1, 5); // violet top
    c.set(x, y + 3, 12); // pink bottom fringe
    // Extra width for richness
    if (x % 3 === 0) c.set(x, y + 4, 12);
    if (x % 4 === 1) c.set(x, y - 2, 5);
  }

  // Distant mountain peaks (index 6)
  for (let x = 0; x < HW; x++) {
    const peak1 = 30 - Math.round(12 * Math.max(0, 1 - Math.abs(x - 25) / 20));
    const peak2 = 30 - Math.round(15 * Math.max(0, 1 - Math.abs(x - 70) / 25));
    const h = Math.min(peak1, peak2);
    for (let y = h; y < HH; y++) {
      if (c.get(x, y) <= 2 || c.get(x, y) > 5) c.set(x, y, 6);
    }
    if (c.get(x, h) === 6) c.set(x, h, 8); // peak crest snow
  }

  // Near mountain peaks (index 7/9/10)
  for (let x = 0; x < HW; x++) {
    const peak1 = 36 - Math.round(18 * Math.max(0, 1 - Math.abs(x - 15) / 18));
    const peak2 = 36 - Math.round(20 * Math.max(0, 1 - Math.abs(x - 50) / 22));
    const peak3 = 36 - Math.round(16 * Math.max(0, 1 - Math.abs(x - 82) / 16));
    const h = Math.min(peak1, Math.min(peak2, peak3));
    for (let y = h; y < HH; y++) {
      if (c.get(x, y) === 6 || c.get(x, y) <= 2 || c.get(x, y) > 7) c.set(x, y, 7);
    }
    if (c.get(x, h) === 7) c.set(x, h, 10); // snow cap
    if (h + 1 < HH && c.get(x, h + 1) === 7) c.set(x, h + 1, 9);
    // Snow face: left-facing snow highlights
    if (x > 0 && c.get(x, h) === 10 && c.get(x - 1, h) <= 2) c.set(x, h, 14);
  }

  // Snow floor — bottom zone (index 9/10/14)
  for (let x = 0; x < HW; x++) {
    for (let y = 39; y < HH; y++) c.set(x, y, 9);
  }
  for (let x = 0; x < HW; x++) c.set(x, 39, 10); // surface
  for (let x = 0; x < HW; x++) c.set(x, 40, 10);
  // Snow surface texture
  const rng = lcg(hashStr('habitat-snowpeak'));
  for (let i = 0; i < 20; i++) {
    const gx = rng.int(HW);
    const gy = 41 + rng.int(6);
    if (c.get(gx, gy) === 9) c.set(gx, gy, 8);
  }
  // Ice crystals on surface
  const crystalX = [10, 22, 38, 55, 70, 85] as const;
  for (const cx of crystalX) {
    c.set(cx, 39, frame === 0 ? 15 : 14);
    c.set(cx + 1, 39, 11);
  }

  return c;
}

// ---------------------------------------------------------------------------
// NEW: Desert Dunes — orange/pink dusk sky, dune layers, cactus, sand floor
// Palette: 1=deep shadow, 2=dune shadow, 3=dune mid, 4=sand warm, 5=sand light,
// 6=sky pink, 7=sky orange, 8=sky peach, 9=sun halo, 10=sun body, 11=cactus green,
// 12=bright sand, 13=sky bright, 14=cloud highlight, 15=star/sparkle
// ---------------------------------------------------------------------------

function buildDesertDunes(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  // Dusk sky — deep orange/pink
  for (let y = 0; y < HH; y++) {
    const skyIdx = y < 6 ? 13 : y < 12 ? 10 : y < 18 ? 9 : y < 24 ? 8 : y < 30 ? 7 : 6;
    for (let x = 0; x < HW; x++) c.set(x, y, skyIdx);
  }

  // Setting sun (index 10/9/13) near horizon center
  fillEllipse(c, 48, 26, 9, 9, 9); // glow
  fillEllipse(c, 48, 26, 7, 7, 10); // body
  // Sun cut by horizon
  for (let x = 0; x < HW; x++) {
    if (c.get(x, 28) === 10 || c.get(x, 28) === 9) c.set(x, 28, 7);
    if (c.get(x, 29) >= 9) c.set(x, 29, 6);
    if (c.get(x, 30) >= 6) c.set(x, 30, 6);
  }

  // Wispy high clouds
  const c1x = frame === 0 ? 20 : 21;
  fillEllipse(c, c1x, 8, 10, 2, 7);
  fillEllipse(c, c1x + 8, 7, 8, 2, 8);
  // Cloud edges
  for (let x = c1x - 10; x < c1x + 18; x++) {
    if (c.get(x, 6) === 7) c.set(x, 6, 14);
  }

  // Distant dune layer (index 2)
  for (let x = 0; x < HW; x++) {
    const h = 28 + Math.round(5 * Math.sin(x * 0.04 + 0.5));
    for (let y = h; y < HH; y++) {
      if (c.get(x, y) >= 6) c.set(x, y, 2);
    }
    if (c.get(x, h) === 2) c.set(x, h, 3);
  }

  // Near dune layer (index 3/4)
  for (let x = 0; x < HW; x++) {
    const h = 33 + Math.round(7 * Math.sin(x * 0.05 + 1.5));
    for (let y = h; y < HH; y++) c.set(x, y, 3);
    c.set(x, h, 4);
    if (h > 0) c.set(x, h - 1, 5);
  }

  // Sand floor — bottom zone (index 4/5/12)
  for (let x = 0; x < HW; x++) {
    for (let y = 39; y < HH; y++) c.set(x, y, 4);
  }
  for (let x = 0; x < HW; x++) {
    c.set(x, 39, 12); // bright surface
    c.set(x, 40, 5);
  }
  // Sand ripple texture
  const rng = lcg(hashStr('habitat-desert-dunes'));
  for (let i = 0; i < 8; i++) {
    const startX = rng.int(HW - 20);
    const y = 42 + rng.int(4);
    for (let xi = 0; xi < 12; xi++) c.set(startX + xi, y, 5);
  }

  // Cactus silhouette — right side (index 11)
  // Main trunk
  fillRect(c, 82, 28, 84, 38, 11);
  // Arms
  fillRect(c, 78, 32, 82, 33, 11);
  fillRect(c, 78, 30, 79, 33, 11);
  fillRect(c, 84, 34, 88, 35, 11);
  fillRect(c, 87, 32, 88, 35, 11);
  // Thorns
  dot(c, 83, 27, 1);
  dot(c, 77, 30, 1);
  dot(c, 88, 32, 1);
  // Cactus highlight (lit left edge)
  for (let y = 28; y <= 38; y++) {
    if (c.get(82, y) === 11) c.set(82, y, 12);
  }

  // A few rocks at base of dunes
  fillEllipse(c, 20, 43, 3, 2, 2);
  fillEllipse(c, 60, 44, 4, 2, 2);
  dot(c, 21, 42, 1);
  dot(c, 61, 43, 1);

  // Stars peeking at top (dusk)
  if (frame === 0) {
    dot(c, 15, 3, 15);
    dot(c, 70, 4, 15);
    dot(c, 88, 2, 14);
  } else {
    dot(c, 15, 3, 14);
    dot(c, 70, 4, 15);
    dot(c, 88, 2, 13);
  }

  return c;
}

// ---------------------------------------------------------------------------
// NEW: Crimson Mars — butterscotch sky, red rock strata, twin moons, regolith floor
// Palette: 1=dark rock shadow, 2=deep rust, 3=rock shadow, 4=rock mid-red,
// 5=rock stratum light, 6=sky tan, 7=sky butterscotch, 8=sky pale, 9=dust haze,
// 10=moon 1 body, 11=moon 1 bright, 12=moon 2 dim, 13=regolith light, 14=dust highlight, 15=horizon glow
// ---------------------------------------------------------------------------

function buildCrimsonMars(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  // Butterscotch/amber sky
  for (let y = 0; y < HH; y++) {
    const skyIdx = y < 8 ? 8 : y < 15 ? 7 : y < 22 ? 7 : y < 28 ? 6 : 6;
    for (let x = 0; x < HW; x++) c.set(x, y, skyIdx);
  }

  // Dust haze band near horizon (index 9)
  for (let x = 0; x < HW; x++) {
    c.set(x, 25, 9);
    c.set(x, 26, 9);
    c.set(x, 27, 6);
  }

  // Twin moons
  // Moon 1 — larger, upper right (index 10/11)
  fillEllipse(c, 74, 8, 6, 6, 10);
  fillEllipse(c, 74, 8, 4, 4, 11);
  dot(c, 72, 7, 11);
  // Moon 2 — smaller, upper left (index 12)
  fillEllipse(c, 20, 12, 3, 3, 12);
  fillEllipse(c, 20, 12, 2, 2, 11);
  // Moon 1 crescent cut
  fillEllipse(c, 71, 6, 5, 5, 7);

  // Rock strata — layered horizontal bands (index 2/3/4/5)
  // Distant mesa
  for (let x = 0; x < HW; x++) {
    const h1 = 24 + Math.round(4 * Math.sin(x * 0.04 + 0.3));
    for (let y = h1; y < HH; y++) {
      if (c.get(x, y) >= 6) c.set(x, y, 2);
    }
    if (c.get(x, h1) === 2) c.set(x, h1, 3);
  }
  // Mid rock layer
  for (let x = 0; x < HW; x++) {
    const h2 = 30 + Math.round(6 * Math.sin(x * 0.05 + 1.0));
    for (let y = h2; y < HH; y++) c.set(x, y, 3);
    c.set(x, h2, 4);
    if (h2 + 1 < HH) c.set(x, h2 + 1, 5);
  }
  // Strata horizontal lines within rock layers
  for (let y = 28; y < 38; y += 3) {
    for (let x = 0; x < HW; x++) {
      if (c.get(x, y) === 3) c.set(x, y, 4);
    }
  }
  for (let y = 28; y < 38; y += 5) {
    for (let x = 0; x < HW; x++) {
      if (c.get(x, y) === 3) c.set(x, y, 2);
    }
  }

  // Regolith floor (index 4/5/13)
  for (let x = 0; x < HW; x++) {
    for (let y = 39; y < HH; y++) c.set(x, y, 4);
  }
  for (let x = 0; x < HW; x++) c.set(x, 39, 13); // surface bright
  for (let x = 0; x < HW; x++) c.set(x, 40, 5);
  // Pebble scatter
  const rng = lcg(hashStr('habitat-crimson-mars'));
  for (let i = 0; i < 25; i++) {
    const gx = rng.int(HW);
    const gy = 42 + rng.int(5);
    c.set(gx, gy, rng.chance(0.5) ? 3 : 2);
  }

  // Horizon glow (dust backlit by distant sun)
  if (frame === 1) {
    for (let x = 0; x < HW; x++) {
      const cur = c.get(x, 26);
      if (cur === 9) c.set(x, 26, 15);
    }
  } else {
    for (let x = 0; x < HW; x++) {
      if (c.get(x, 26) === 9) c.set(x, 26, 14);
    }
  }

  // Rocky outcrops
  fillEllipse(c, 12, 42, 5, 3, 2);
  dot(c, 10, 40, 1);
  dot(c, 14, 40, 3);
  fillEllipse(c, 86, 41, 4, 3, 2);
  dot(c, 88, 39, 3);

  return c;
}

// ---------------------------------------------------------------------------
// NEW: Europa Ice — Jupiter looming in black sky, teal ice plain, cracks
// Palette: 1=black space, 2=deep space, 3=Jupiter shadow, 4=Jupiter band dark,
// 5=Jupiter band mid, 6=Jupiter band light, 7=Jupiter highlight, 8=ice deep shadow,
// 9=ice crack blue, 10=ice surface mid, 11=ice bright, 12=ice glint, 13=Jupiter limb,
// 14=near-white ice surface, 15=sparkle/glint
// ---------------------------------------------------------------------------

function buildEuropaIce(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  // Black space background
  fillRect(c, 0, 0, HW - 1, HH - 1, 1);

  // Stars (sparse — Jupiter washes most out)
  const stars = [
    [5, 4],
    [15, 2],
    [78, 3],
    [88, 6],
    [90, 2],
    [3, 8],
  ] as const;
  for (const [sx, sy] of stars) c.set(sx, sy, 13);

  // Jupiter — huge planet filling much of upper sky
  const jx = 52;
  const jy = 14;
  const jrx = 38;
  const jry = 26;
  fillEllipse(c, jx, jy, jrx, jry, 5); // base mid

  // Jupiter bands (horizontal stripes)
  for (let y = jy - jry; y <= jy + jry; y++) {
    const dist = Math.abs(y - jy);
    const hw = Math.round(jrx * Math.sqrt(Math.max(0, 1 - (dist * dist) / (jry * jry))));
    if (hw <= 0) continue;
    const band = Math.floor(((y - (jy - jry)) / (2 * jry)) * 8);
    const col = band % 2 === 0 ? 4 : band % 3 === 0 ? 6 : 5;
    for (let x = jx - hw; x <= jx + hw; x++) c.set(x, y, col);
  }

  // Jupiter limb highlights
  strokeEllipse(c, jx, jy, jrx, jry, 3);
  // Lit edge (light comes from off-scene)
  for (let y = jy - jry; y <= jy + jry; y++) {
    const dist = Math.abs(y - jy);
    const hw = Math.round(jrx * Math.sqrt(Math.max(0, 1 - (dist * dist) / (jry * jry))));
    if (hw <= 0) continue;
    if (c.get(jx - hw, y) >= 3) c.set(jx - hw, y, 7); // left lit edge
    if (c.get(jx - hw + 1, y) >= 3) c.set(jx - hw + 1, y, 6);
  }
  // The Great Red Spot (a rough oval)
  fillEllipse(c, jx + 8, jy + 4, 6, 4, 4);
  fillEllipse(c, jx + 8, jy + 4, 4, 3, 3);
  dot(c, jx + 8, jy + 4, 13);

  // Europa's ice horizon cuts across Jupiter disc (ground blocks Jupiter lower half)
  // Ice surface starts at y=32 — blank that from Jupiter data below horizon
  for (let y = 33; y < HH; y++) {
    for (let x = 0; x < HW; x++) {
      c.set(x, y, 10); // ice surface
    }
  }

  // Ice surface with cracks (index 9 = crack blue)
  // Main crack network
  const cracks = [
    { x0: 0, y0: 36, x1: 30, y1: 40 },
    { x0: 20, y0: 33, x1: 55, y1: 38 },
    { x0: 45, y0: 35, x1: 80, y1: 42 },
    { x0: 60, y0: 34, x1: 95, y1: 39 },
    { x0: 10, y0: 40, x1: 40, y1: 44 },
    { x0: 55, y0: 40, x1: 90, y1: 45 },
  ];
  for (const { x0, y0, x1, y1 } of cracks) {
    line(c, x0, y0, x1, y1, 9);
    // Crack shadow (darker, index 8)
    line(c, x0 + 1, y0, x1 + 1, y1, 8);
  }

  // Surface brightness variation
  for (let x = 0; x < HW; x++) {
    for (let y = 33; y < HH; y++) {
      if (c.get(x, y) === 10) {
        // Panels of ice between cracks
        if ((x + y) % 7 < 2) c.set(x, y, 11);
      }
    }
  }

  // Ice surface top row (brightest)
  for (let x = 0; x < HW; x++) {
    if (c.get(x, 33) >= 8) c.set(x, 33, 11);
    if (c.get(x, 34) >= 8) c.set(x, 34, 12);
  }

  // Glinting ice crystals (frame-animated)
  const crystals = [
    [8, 35],
    [24, 38],
    [42, 33],
    [62, 36],
    [78, 40],
    [90, 34],
  ] as const;
  for (const [cx, cy] of crystals) {
    c.set(cx, cy, frame === 0 ? 15 : 14);
    c.set(cx + 1, cy, 12);
  }

  // Jupiter glow on ice (soft reflection)
  for (let x = 20; x <= 80; x++) {
    if (c.get(x, 33) < 15) c.set(x, 33, 13);
  }

  return c;
}

// ---------------------------------------------------------------------------
// NEW: Lunar Base — grey moonscape, Earth-rise, dome structures, metal deck
// Palette: 1=black space, 2=regolith shadow, 3=regolith dark, 4=regolith mid,
// 5=regolith light, 6=dome structure, 7=dome highlight, 8=deck metal, 9=deck highlight,
// 10=Earth blue, 11=Earth green, 12=Earth white cloud, 13=Earth highlight, 14=star, 15=light beacon
// ---------------------------------------------------------------------------

function buildLunarBase(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  // Black space
  fillRect(c, 0, 0, HW - 1, HH - 1, 1);

  // Stars
  const stars = [
    [5, 3],
    [14, 6],
    [22, 2],
    [35, 5],
    [42, 8],
    [58, 3],
    [66, 7],
    [78, 4],
    [86, 2],
    [93, 6],
    [9, 10],
    [50, 9],
    [72, 11],
  ] as const;
  for (const [sx, sy] of stars) c.set(sx, sy, 14);
  // Twinkle
  dot(c, 30, 4, frame === 0 ? 15 : 14);
  dot(c, 60, 6, frame === 1 ? 15 : 14);

  // Earth-rise — upper left (index 10/11/12/13)
  const ex = 16;
  const ey = 12;
  const er = 10;
  fillEllipse(c, ex, ey, er, er, 10); // ocean blue
  // Continental blobs
  fillEllipse(c, ex - 3, ey - 2, 4, 3, 11); // landmass 1
  fillEllipse(c, ex + 2, ey + 1, 3, 3, 11); // landmass 2
  fillEllipse(c, ex, ey - 4, 5, 2, 11); // continent top
  // Cloud streaks
  fillEllipse(c, ex - 2, ey + 3, 4, 2, 12);
  fillEllipse(c, ex + 3, ey - 1, 3, 1, 12);
  // Limb highlight
  strokeEllipse(c, ex, ey, er, er, 2);
  for (let y2 = ey - er; y2 <= ey + er; y2++) {
    const dist = Math.abs(y2 - ey);
    const hw = Math.round(er * Math.sqrt(Math.max(0, 1 - (dist * dist) / (er * er))));
    if (hw <= 0) continue;
    if (c.get(ex - hw, y2) >= 10) c.set(ex - hw, y2, 13);
  }

  // Lunar horizon (index 3)
  for (let x = 0; x < HW; x++) {
    const h = 33 + Math.round(2 * Math.sin(x * 0.04 + 0.5));
    for (let y = h; y < HH; y++) c.set(x, y, 3);
    c.set(x, h, 4); // surface top
  }

  // Distant crater rims
  strokeEllipse(c, 30, 33, 12, 4, 4);
  strokeEllipse(c, 72, 34, 8, 3, 4);
  fillEllipse(c, 30, 34, 10, 3, 2);
  fillEllipse(c, 72, 35, 6, 2, 2);

  // Dome structures (index 6/7)
  // Main dome left
  fillEllipse(c, 22, 31, 12, 6, 6);
  strokeEllipse(c, 22, 31, 12, 6, 2);
  // Dome highlight
  fillEllipse(c, 20, 28, 5, 3, 7);
  dot(c, 19, 27, 14);
  // Dome window
  fillEllipse(c, 22, 31, 4, 3, 7);

  // Secondary dome right
  fillEllipse(c, 78, 32, 9, 5, 6);
  strokeEllipse(c, 78, 32, 9, 5, 2);
  fillEllipse(c, 76, 30, 4, 2, 7);
  dot(c, 75, 29, 14);

  // Connecting tunnel between domes
  fillRect(c, 34, 33, 60, 35, 6);
  for (let x = 34; x <= 60; x++) c.set(x, 33, 7);
  strokeRect(c, 34, 33, 60, 35, 2);

  // Metal deck floor (index 8/9)
  for (let x = 0; x < HW; x++) {
    for (let y = 39; y < HH; y++) c.set(x, y, 8);
  }
  for (let x = 0; x < HW; x++) c.set(x, 39, 9); // deck surface
  // Deck grid lines
  for (let x = 0; x < HW; x += 8) {
    for (let y = 40; y < HH; y++) c.set(x, y, 7);
  }
  for (let y = 40; y < HH; y += 6) {
    for (let x = 0; x < HW; x++) c.set(x, y, 7);
  }

  // Beacon lights on domes (animated)
  dot(c, 22, 25, frame === 0 ? 15 : 6);
  dot(c, 78, 27, frame === 1 ? 15 : 6);

  return c;
}

// ---------------------------------------------------------------------------
// NEW: Nebula Drift — violet/teal/rose nebula clouds, dense starfield, asteroid floor
// Palette: 1=deep void, 2=space shadow, 3=nebula violet deep, 4=nebula violet mid,
// 5=nebula teal, 6=nebula rose, 7=nebula pink, 8=nebula bright, 9=dense star field,
// 10=bright nebula core, 11=star cluster, 12=asteroid rock, 13=asteroid highlight,
// 14=bright star, 15=sparkle
// ---------------------------------------------------------------------------

function buildNebulaDrift(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  // Deep void background
  fillRect(c, 0, 0, HW - 1, HH - 1, 1);

  // Dense starfield scatter
  const rng = lcg(hashStr('habitat-nebula-drift'));
  for (let i = 0; i < 80; i++) {
    const sx = rng.int(HW);
    const sy = rng.int(40);
    c.set(sx, sy, rng.chance(0.3) ? 9 : 2);
  }
  // Bright stars
  const brightStars = [
    [8, 4],
    [20, 2],
    [36, 7],
    [52, 3],
    [65, 8],
    [80, 2],
    [88, 5],
    [14, 10],
  ] as const;
  for (const [sx, sy] of brightStars) c.set(sx, sy, 11);
  // Twinkling
  dot(c, 30, 5, frame === 0 ? 15 : 14);
  dot(c, 70, 3, frame === 1 ? 15 : 14);

  // Nebula clouds — layered colored blobs
  // Violet cloud (index 3/4)
  fillEllipse(c, 20, 15, 16, 10, 3);
  fillEllipse(c, 28, 12, 14, 8, 4);
  fillEllipse(c, 14, 18, 10, 6, 3);

  // Teal cloud (index 5)
  fillEllipse(c, 60, 10, 18, 12, 5);
  fillEllipse(c, 72, 8, 12, 8, 5);
  fillEllipse(c, 52, 14, 10, 7, 5);

  // Rose/pink cloud (index 6/7)
  fillEllipse(c, 40, 20, 14, 9, 6);
  fillEllipse(c, 48, 16, 10, 7, 7);
  fillEllipse(c, 34, 24, 8, 6, 6);

  // Bright nebula core — center (index 8/10)
  fillEllipse(c, 45, 15, 8, 5, 8);
  fillEllipse(c, 45, 15, 5, 3, 10);
  dot(c, 44, 14, 14);

  // Frame drift: subtle shift between frames
  if (frame === 1) {
    // Highlight edges slightly different
    dot(c, 28, 11, 8);
    dot(c, 60, 9, 8);
    dot(c, 40, 19, 8);
  }

  // Nebula over-star (dim stars through nebula)
  for (let i = 0; i < 30; i++) {
    const sx = rng.int(HW);
    const sy = rng.int(32);
    if (c.get(sx, sy) > 1) continue; // don't overwrite nebula
    c.set(sx, sy, 2);
  }

  // Asteroid floor — rocky ground at bottom (index 12/13)
  for (let x = 0; x < HW; x++) {
    const h = 39 + Math.round(2 * Math.sin(x * 0.09 + 0.7));
    for (let y = h; y < HH; y++) c.set(x, y, 12);
    c.set(x, h, 13); // lit surface
  }
  // Rock chunks
  fillEllipse(c, 15, 42, 6, 3, 12);
  fillEllipse(c, 15, 41, 4, 2, 13);
  fillEllipse(c, 50, 43, 7, 3, 12);
  fillEllipse(c, 50, 42, 5, 2, 13);
  fillEllipse(c, 82, 41, 5, 3, 12);
  fillEllipse(c, 82, 40, 3, 2, 13);
  // Mineral veins
  dot(c, 16, 42, 10);
  dot(c, 52, 43, 10);
  dot(c, 83, 41, 10);

  return c;
}

// ---------------------------------------------------------------------------
// NEW: Starship Deck — observation deck, huge window, streaking stars, deck floor
// Palette: 1=deep space black, 2=space shadow, 3=star streak far, 4=star streak mid,
// 5=star streak bright, 6=window frame dark, 7=window frame metal, 8=deck surface,
// 9=deck highlight, 10=console glow, 11=instrument light, 12=window center bright,
// 13=console warm, 14=metal rim, 15=indicator light
// ---------------------------------------------------------------------------

function buildStarshipDeck(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  // The window onto space — fills most of the upper area
  // Space void
  fillRect(c, 0, 0, HW - 1, HH - 1, 1);

  // Star streaks — horizontal motion blur effect (index 3/4/5)
  const rng = lcg(hashStr('habitat-starship-deck'));
  for (let i = 0; i < 40; i++) {
    const sy = rng.int(30);
    const sx = rng.int(HW - 20);
    const len = 3 + rng.int(15);
    const bright = rng.chance(0.25) ? 5 : rng.chance(0.5) ? 4 : 3;
    for (let dx = 0; dx < len; dx++) {
      const x = sx + dx;
      if (x < HW) c.set(x, sy, bright);
    }
    // Taper
    if (sx + len < HW) c.set(sx + len, sy, 2);
    if (sx > 0) c.set(sx - 1, sy, 2);
  }

  // Frame-animated additional streaks (new streaks appear frame 1)
  if (frame === 1) {
    for (let i = 0; i < 8; i++) {
      const sy = rng.int(28);
      const sx = rng.int(60);
      const len = 4 + rng.int(12);
      for (let dx = 0; dx < len; dx++) {
        if (sx + dx < HW) c.set(sx + dx, sy, 5);
      }
    }
  }

  // Window frame — thick border
  // Top window border
  fillRect(c, 0, 0, HW - 1, 2, 6);
  // Side borders
  fillRect(c, 0, 0, 3, 32, 6);
  fillRect(c, HW - 4, 0, HW - 1, 32, 6);
  // Window sill/bottom edge
  fillRect(c, 0, 30, HW - 1, 33, 7);
  for (let x = 0; x < HW; x++) c.set(x, 30, 14); // top rim highlight
  // Window frame inner metal highlights
  for (let y = 0; y < 30; y++) {
    c.set(3, y, 7); // inner left
    c.set(HW - 5, y, 7); // inner right
  }
  // Window pane divider (center vertical strut)
  fillRect(c, 46, 0, 49, 32, 7);
  for (let y = 0; y < 30; y++) {
    c.set(47, y, 14);
  }

  // Observation deck floor (index 8/9)
  for (let x = 0; x < HW; x++) {
    for (let y = 34; y < HH; y++) c.set(x, y, 8);
  }
  for (let x = 0; x < HW; x++) c.set(x, 34, 9); // deck surface
  // Deck tile lines
  for (let x = 0; x < HW; x += 12) {
    for (let y = 35; y < HH; y++) c.set(x, y, 7);
  }
  for (let y = 38; y < HH; y += 4) {
    for (let x = 0; x < HW; x++) c.set(x, y, 7);
  }

  // Control consoles on each side (index 10/11/13)
  // Left console
  fillRect(c, 2, 33, 18, 36, 10);
  fillRect(c, 2, 33, 18, 34, 13); // top face
  strokeRect(c, 2, 33, 18, 36, 6);
  // Console indicators
  dot(c, 6, 34, 15);
  dot(c, 10, 34, frame === 0 ? 15 : 11);
  dot(c, 14, 34, 11);
  // Screen glow
  fillRect(c, 4, 35, 10, 36, 11);

  // Right console
  fillRect(c, HW - 19, 33, HW - 3, 36, 10);
  fillRect(c, HW - 19, 33, HW - 3, 34, 13);
  strokeRect(c, HW - 19, 33, HW - 3, 36, 6);
  dot(c, HW - 15, 34, 11);
  dot(c, HW - 11, 34, frame === 1 ? 15 : 11);
  dot(c, HW - 7, 34, 15);
  fillRect(c, HW - 12, 35, HW - 6, 36, 11);

  // Ambient glow from window onto floor
  for (let x = 4; x < HW - 4; x++) {
    if (c.get(x, 34) === 9) c.set(x, 34, 12);
  }

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

// ---------------------------------------------------------------------------
// TRINKET: Bouncy Ball
// ---------------------------------------------------------------------------

function buildBouncyBall(frame: number): PixelCanvas {
  const c = PixelCanvas.create(12, 12);

  if (frame === 0) {
    const cx = 6;
    const cy = 6;
    fillEllipse(c, cx, cy, 4, 4, 7);
    fillEllipse(c, cx, cy, 3, 3, 9);
    fillEllipse(c, cx - 1, cy, 2, 3, 6);
    dot(c, cx - 1, cy - 2, 13);
    dot(c, cx - 2, cy - 1, 14);
    dot(c, cx + 2, cy + 2, 5);
    strokeEllipse(c, cx, cy, 4, 4, 1);
  } else {
    const cx = 6;
    const cy = 8;
    fillEllipse(c, cx, cy, 5, 3, 7);
    fillEllipse(c, cx, cy, 4, 2, 9);
    fillEllipse(c, cx - 1, cy, 2, 1, 6);
    dot(c, cx - 1, cy - 1, 13);
    dot(c, cx - 2, cy - 1, 14);
    dot(c, cx + 2, cy + 1, 5);
    strokeEllipse(c, cx, cy, 5, 3, 1);
    fillEllipse(c, cx, 11, 3, 1, 3);
  }

  return c;
}

// ---------------------------------------------------------------------------
// TRINKET: Cushion
// ---------------------------------------------------------------------------

function buildCushion(frame: number): PixelCanvas {
  const c = PixelCanvas.create(12, 12);

  if (frame === 0) {
    fillRect(c, 2, 3, 9, 9, 8);
    fillRect(c, 3, 2, 8, 10, 7);
    fillRect(c, 3, 2, 8, 3, 10);
    fillRect(c, 3, 8, 8, 10, 5);
    for (let y = 3; y <= 9; y++) {
      c.set(2, y, 6);
      c.set(9, y, 6);
    }
    for (let x = 3; x <= 8; x++) c.set(x, 6, 6);
    for (let y = 3; y <= 9; y++) c.set(5, y, 6);
    dot(c, 2, 1, 11);
    dot(c, 9, 1, 11);
    dot(c, 1, 2, 10);
    dot(c, 10, 2, 10);
    dot(c, 2, 10, 9);
    dot(c, 9, 10, 9);
    dot(c, 1, 9, 8);
    dot(c, 10, 9, 8);
    strokeRect(c, 2, 2, 9, 10, 1);
  } else {
    fillRect(c, 1, 5, 10, 9, 8);
    fillRect(c, 2, 4, 9, 10, 7);
    fillRect(c, 2, 4, 9, 5, 10);
    fillRect(c, 2, 8, 9, 10, 5);
    for (let y = 5; y <= 9; y++) {
      c.set(1, y, 6);
      c.set(10, y, 6);
    }
    for (let x = 2; x <= 9; x++) c.set(x, 7, 6);
    for (let y = 5; y <= 9; y++) c.set(5, y, 6);
    dot(c, 1, 3, 11);
    dot(c, 10, 3, 11);
    dot(c, 0, 4, 10);
    dot(c, 11, 4, 10);
    dot(c, 1, 11, 9);
    dot(c, 10, 11, 9);
    strokeRect(c, 1, 4, 10, 10, 1);
  }

  return c;
}

// ---------------------------------------------------------------------------
// TRINKET: Lava Lamp
// ---------------------------------------------------------------------------

function buildLavaLamp(frame: number): PixelCanvas {
  const c = PixelCanvas.create(12, 12);

  fillRect(c, 4, 1, 7, 10, 3);
  fillRect(c, 3, 9, 8, 11, 4);
  fillRect(c, 4, 0, 7, 1, 4);
  fillRect(c, 5, 9, 6, 9, 5);
  fillRect(c, 5, 2, 6, 8, 4);

  const blobY = frame === 0 ? 3 : 7;
  fillEllipse(c, 5, blobY, 2, 2, 10);
  fillEllipse(c, 5, blobY, 1, 1, 12);
  dot(c, 4, blobY - 1, 13);

  const blob2Y = frame === 0 ? 7 : 3;
  fillEllipse(c, 5, blob2Y, 1, 1, 8);
  dot(c, 6, blob2Y, 9);

  for (let y = 1; y <= 9; y++) {
    if (c.get(4, y) >= 3) c.set(4, y, Math.min(c.get(4, y) + 1, 6));
  }
  for (let y = 1; y <= 9; y++) {
    if (c.get(7, y) >= 3) c.set(7, y, 2);
  }

  strokeRect(c, 3, 0, 8, 11, 1);
  c.set(4, 0, 1);
  c.set(7, 0, 1);

  return c;
}

// ---------------------------------------------------------------------------
// TRINKET: Bonsai
// ---------------------------------------------------------------------------

function buildBonsai(frame: number): PixelCanvas {
  const c = PixelCanvas.create(12, 12);

  fillRect(c, 3, 8, 8, 11, 7);
  fillRect(c, 2, 7, 9, 8, 8);
  fillRect(c, 3, 11, 8, 11, 6);
  for (let x = 3; x <= 8; x++) c.set(x, 8, 9);
  c.set(3, 9, 6);
  c.set(8, 9, 6);
  strokeRect(c, 2, 7, 9, 11, 1);

  const lean = frame === 1 ? 1 : 0;
  thickLine(c, 5, 7, 5 + lean, 4, 5, 1);
  thickLine(c, 5 + lean, 4, 6 + lean * 2, 1, 4, 1);

  const cx = 6 + lean;
  fillEllipse(c, cx, 3, 4, 2, 9);
  fillEllipse(c, cx - 3, 4, 2, 2, 8);
  fillEllipse(c, cx + 3, 4, 2, 2, 8);
  fillEllipse(c, cx, 2, 2, 1, 11);
  dot(c, cx - 1, 1, 12);
  if (frame === 0) dot(c, cx + 2, 2, 13);

  return c;
}

// ---------------------------------------------------------------------------
// TRINKET: Gift Box
// ---------------------------------------------------------------------------

function buildGiftBox(frame: number): PixelCanvas {
  const c = PixelCanvas.create(12, 12);

  fillRect(c, 1, 5, 10, 11, 7);
  fillRect(c, 1, 3, 10, 5, 8);
  fillRect(c, 1, 3, 10, 4, 9);
  fillRect(c, 1, 9, 10, 11, 5);
  for (let y = 5; y <= 11; y++) c.set(1, y, 8);
  strokeRect(c, 1, 3, 10, 11, 1);
  strokeRect(c, 1, 5, 10, 5, 1);

  for (let y = 3; y <= 11; y++) {
    c.set(5, y, 11);
    c.set(6, y, 10);
  }
  for (let x = 1; x <= 10; x++) {
    c.set(x, 7, 11);
    c.set(x, 8, 10);
  }
  for (let y = 3; y <= 11; y += 2) c.set(5, y, 12);

  if (frame === 0) {
    fillEllipse(c, 3, 2, 2, 2, 10);
    fillEllipse(c, 8, 2, 2, 2, 10);
    fillCircle(c, 5, 2, 1, 12);
    dot(c, 6, 2, 12);
    dot(c, 3, 3, 8);
    dot(c, 8, 3, 8);
  } else {
    fillEllipse(c, 2, 1, 2, 2, 10);
    fillEllipse(c, 9, 1, 2, 2, 10);
    fillCircle(c, 5, 2, 1, 12);
    dot(c, 6, 2, 12);
    dot(c, 1, 2, 9);
    dot(c, 10, 2, 9);
    dot(c, 2, 3, 8);
    dot(c, 9, 3, 8);
  }

  return c;
}

// ---------------------------------------------------------------------------
// TRINKET: Trophy Shelf
// ---------------------------------------------------------------------------

function buildTrophyShelf(frame: number): PixelCanvas {
  const c = PixelCanvas.create(12, 12);

  fillRect(c, 0, 8, 11, 10, 6);
  fillRect(c, 0, 8, 11, 8, 7);
  fillRect(c, 0, 10, 11, 11, 5);
  strokeRect(c, 0, 8, 11, 11, 1);

  fillEllipse(c, 3, 5, 2, 3, 9);
  fillEllipse(c, 3, 4, 1, 2, 11);
  fillRect(c, 2, 7, 3, 7, 8);
  fillRect(c, 1, 8, 4, 8, 9);
  dot(c, 0, 5, 8);
  dot(c, 5, 5, 8);
  strokeEllipse(c, 3, 5, 2, 3, 1);

  fillEllipse(c, 8, 4, 2, 3, 9);
  fillEllipse(c, 8, 3, 1, 2, 11);
  fillRect(c, 7, 7, 8, 7, 8);
  fillRect(c, 6, 8, 9, 8, 9);
  dot(c, 5, 4, 8);
  dot(c, 10, 4, 8);
  strokeEllipse(c, 8, 4, 2, 3, 1);

  if (frame === 0) {
    dot(c, 3, 2, 13);
    dot(c, 8, 1, 13);
  } else {
    dot(c, 3, 2, 14);
    dot(c, 2, 2, 12);
    dot(c, 4, 2, 12);
    dot(c, 3, 1, 12);
    dot(c, 3, 3, 12);
    dot(c, 8, 1, 14);
    dot(c, 7, 1, 12);
    dot(c, 9, 1, 12);
    dot(c, 8, 0, 12);
    dot(c, 8, 2, 12);
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

/** Sprite ids for all habitats (3 original + 9 new). */
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

/** Trinket sprite ids (starter set). */
const TRINKET_IDS: readonly string[] = [
  'trinket-bouncy-ball',
  'trinket-cushion',
  'trinket-lava-lamp',
  'trinket-bonsai',
  'trinket-gift-box',
  'trinket-trophy-shelf',
];

/** All habitat background sprites (96x48, 2 frames, animated). */
export const habitatSprites = HABITAT_IDS.map((id) => {
  const f0 = buildHabitat(id, 0);
  const f1 = buildHabitat(id, 1);
  return buildSprite(id, [f0, f1], 4); // 4fps subtle ambient animation
});

/** All trinket sprites (12x12, 2 frames). */
export const trinketSprites = TRINKET_IDS.map((id) => {
  const f0 = buildTrinket(id, 0);
  const f1 = buildTrinket(id, 1);
  return buildSprite(id, [f0, f1], 4);
});

/** Habitats + trinkets together (scene layer). */
export const sceneSprites = [...habitatSprites, ...trinketSprites];
