/**
 * Scenery sprite designs — habitats (backgrounds) + trinkets (toys/objects).
 *
 * Each habitat is 96x48, 2 frames. Each trinket is 12x12, 2 frames.
 * All use palette-indexed ramp (0 = transparent, 1 = darkest outline, 14 =
 * lightest rim, 15 = animated glint). Deterministic: seeded LCG only.
 *
 * Index usage note: habitats fill every pixel (no transparency). For the
 * "wild" tint at grade B (8-color palette), indices >7 clamp to the last
 * entry. So we keep all scenery indices in 2..12 for richness across grades,
 * knowing grade C collapses to 4 tones and grade B to 8.
 */

import type { SpriteDef } from '@token-tamers/core';
import {
  PixelCanvas,
  buildSprite,
  fillRect,
  fillEllipse,
  fillCircle,
  strokeEllipse,
  strokeRect,
  dot,
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
// HABITAT: Terminal Den
// ---------------------------------------------------------------------------
// A cozy dark CRT-glow den: desk silhouette at bottom, phosphor-green
// scanline bands, floating glyph dust, a glowing monitor gradient.
// Center is left calm (pet renders on top); detail at edges/bottom.
// ---------------------------------------------------------------------------

function buildTerminalDen(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  // ── Background wall: even dark fill (index 3 = below mid ramp) ─────────
  fillRect(c, 0, 0, HW - 1, HH - 1, 3);

  // ── Scanline bands: subtle alternating (index 3/4) for CRT phosphor feel
  for (let y = 0; y < HH - 10; y++) {
    const even = Math.floor(y / 3) % 2 === 0;
    for (let x = 0; x < HW; x++) {
      c.set(x, y, even ? 3 : 4);
    }
  }

  // ── Monitor: large screen centered-ish, upper area ─────────────────────
  // Monitor frame/bezel (index 2 = dark)
  fillRect(c, 20, 3, 75, 32, 2);
  // Screen face (index 5 = mid-light phosphor glow)
  fillRect(c, 23, 5, 72, 29, 5);
  // Inner screen gradient: brighter center
  fillRect(c, 26, 7, 69, 27, 6);
  fillRect(c, 29, 9, 66, 25, 7);
  fillRect(c, 32, 11, 63, 23, 8);
  // Brightest zone center top
  fillRect(c, 36, 11, 59, 14, 9);

  // Scanlines ON the screen (subtle dark bands, index 6)
  for (let y = 8; y <= 28; y += 3) {
    for (let x = 24; x <= 71; x++) {
      if (c.get(x, y) < 8) c.set(x, y, 6);
    }
  }

  // ── Code lines on screen: terminal text simulation ──
  // Bright phosphor-green text bars (index 10-11)
  const textLines = [
    { y: 13, x0: 34, len: 22 },
    { y: 16, x0: 34, len: 16 },
    { y: 19, x0: 34, len: 28 },
    { y: 22, x0: 34, len: 12 },
    { y: 25, x0: 34, len: 20 },
  ];
  for (const line of textLines) {
    for (let x = line.x0; x < line.x0 + line.len; x++) {
      c.set(x, line.y, 11);
      // Word gaps every 4-5 chars
      if ((x - line.x0) % 5 === 4) c.set(x, line.y, 8);
    }
  }

  // Cursor blink: frame 1 shows a bright block cursor
  if (frame === 1) {
    fillRect(c, 34, 25, 36, 26, 12);
  }

  // ── Screen glow (bloom halo around monitor edges) ──
  for (let y = 4; y <= 30; y++) {
    c.set(22, y, 4);
    c.set(73, y, 4);
  }
  for (let x = 22; x <= 73; x++) {
    c.set(x, 4, 4);
    c.set(x, 30, 4);
  }

  // ── Monitor stand ──
  fillRect(c, 44, 32, 50, 36, 3);
  fillRect(c, 41, 36, 53, 37, 3);
  c.set(44, 32, 2);
  c.set(50, 32, 2);
  c.set(44, 36, 2);
  c.set(50, 36, 2);

  // ── Desk surface ──────────────────────────────────────────────────────
  // Top surface (index 4 = medium dark wood/metal)
  fillRect(c, 0, 37, HW - 1, 39, 4);
  // Top edge highlight line
  for (let x = 0; x < HW; x++) c.set(x, 37, 5);
  // Desk front face (index 2 = darker)
  fillRect(c, 0, 40, HW - 1, HH - 1, 2);
  // Desk front face mid-highlight
  for (let x = 0; x < HW; x++) c.set(x, 40, 3);

  // ── Keyboard silhouette ──
  fillRect(c, 26, 35, 64, 37, 3);
  strokeRect(c, 26, 35, 64, 37, 2);
  // Key dots
  for (let kx = 29; kx <= 62; kx += 3) c.set(kx, 35, 4);
  for (let kx = 30; kx <= 61; kx += 3) c.set(kx, 36, 5);

  // ── Floating glyph dust: tiny rune pixels near screen edge ─────────────
  // Left side runes
  const glyphsL = [
    [5, 7],
    [8, 14],
    [6, 21],
    [11, 28],
    [7, 35],
    [14, 5],
    [3, 18],
  ];
  // Right side runes
  const glyphsR = [
    [88, 6],
    [91, 13],
    [85, 20],
    [90, 27],
    [86, 34],
    [93, 10],
    [82, 22],
  ];
  const glyphBright = frame === 0 ? 7 : 9;
  for (const [gx, gy] of [...glyphsL, ...glyphsR]) {
    c.set(gx!, gy!, glyphBright);
    c.set(gx! + 1, gy!, glyphBright - 1);
  }

  // ── Desk lamp (left side) ─────────────────────────────────────────────
  // Lamp head
  fillEllipse(c, 9, 34, 5, 3, 6);
  fillEllipse(c, 9, 34, 3, 2, 8);
  dot(c, 8, 33, 10); // bright lamp bulb
  // Lamp arm
  dot(c, 10, 35, 4);
  dot(c, 11, 36, 4);
  // Glow cone (spills onto desk surface)
  for (let lx = 0; lx < 18; lx++) {
    const alpha = lx < 8 ? 5 : lx < 14 ? 4 : 3;
    c.set(lx, 37, alpha);
  }

  // ── Small potted plant (right side of desk) ──
  // Pot
  fillRect(c, 78, 35, 84, 37, 5);
  fillRect(c, 79, 34, 83, 35, 6);
  strokeRect(c, 78, 34, 84, 37, 2);
  // Leaves (two puffs)
  fillEllipse(c, 81, 32, 3, 2, 8);
  fillEllipse(c, 79, 31, 2, 2, 7);
  fillEllipse(c, 83, 31, 2, 2, 7);
  dot(c, 81, 30, 9);
  dot(c, 79, 30, 9);
  dot(c, 83, 30, 9);

  return c;
}

// ---------------------------------------------------------------------------
// HABITAT: Meadow
// ---------------------------------------------------------------------------
// Layered day scene: sky gradient bands, two cloud puffs, rolling hill
// silhouettes (3 depth bands), flower pixel clusters, light rays.
// Center is calm for the pet; details at edges and bottom.
//
// Index strategy to look great at every grade:
//   Sky     = 11..14 (lightest — renders as near-white/pale at B, gold at S)
//   Clouds  = 13..14 (brightest white puffs)
//   Back hills = 5..6 (mid-dark — visible contrast against sky at all grades)
//   Mid hills  = 6..8 (medium)
//   Front ground = 7..9 (slightly lighter than hills = visual depth)
//   Flowers = 12..13 (bright accent dots)
// ---------------------------------------------------------------------------

function buildMeadow(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  // ── Sky fill: high indices = light (near-white at B, gold at S) ────────
  // Gradient: very bright (14) at top → medium-bright (11) near horizon.
  for (let y = 0; y < HH; y++) {
    const skyIdx = y < 8 ? 14 : y < 16 ? 13 : y < 24 ? 12 : y < 30 ? 11 : 11;
    for (let x = 0; x < HW; x++) c.set(x, y, skyIdx);
  }

  // ── Light rays: diagonal brighter streaks from upper-left ──
  for (let i = 0; i < 4; i++) {
    const startX = 2 + i * 11;
    for (let dy = 0; dy < 20; dy++) {
      const rx = startX + Math.floor(dy * 0.3);
      if (rx < HW) {
        const cur = c.get(rx, dy);
        if (cur < 14) c.set(rx, dy, cur + 1);
      }
    }
  }

  // ── Back hill silhouette (index 3 = base = medium tint, visible at B) ─
  for (let x = 0; x < HW; x++) {
    const h = 22 + Math.round(3 * Math.sin(x * 0.06));
    for (let y = h; y < HH; y++) c.set(x, y, 3);
  }
  // Back hill crest — lighter fringe against sky
  for (let x = 0; x < HW; x++) {
    const h = 22 + Math.round(3 * Math.sin(x * 0.06));
    c.set(x, h, 5);
    if (h > 0) c.set(x, h - 1, 8);
  }

  // ── Mid hill (index 4 = light) ────────────────────────────────────────
  for (let x = 0; x < HW; x++) {
    const h = 28 + Math.round(5 * Math.sin(x * 0.05 + 0.8));
    for (let y = h; y < HH; y++) c.set(x, y, 4);
  }
  // Mid hill crest
  for (let x = 0; x < HW; x++) {
    const h = 28 + Math.round(5 * Math.sin(x * 0.05 + 0.8));
    c.set(x, h, 6);
    if (h > 0) c.set(x, h - 1, 8);
  }

  // ── Front ground (index 5 — slightly brighter/closer) ────────────────
  for (let x = 0; x < HW; x++) {
    const h = 36 + Math.round(2 * Math.sin(x * 0.07 + 2.1));
    for (let y = h; y < HH; y++) c.set(x, y, 5);
  }
  // Front ground crest
  for (let x = 0; x < HW; x++) {
    const h = 36 + Math.round(2 * Math.sin(x * 0.07 + 2.1));
    c.set(x, h, 7);
    if (h + 1 < HH) c.set(x, h + 1, 6);
  }
  // Ground texture variation
  const rng = lcg(hashStr('habitat-meadow'));
  for (let i = 0; i < 20; i++) {
    const gx = rng.int(HW);
    const gy = 39 + rng.int(9);
    if (c.get(gx, gy) === 5) c.set(gx, gy, 4);
  }

  // ── Clouds: always near-white (index 13-14) ───────────────────────────
  // Cloud 1: left, high in sky
  const c1dx = frame === 1 ? 1 : 0;
  const c1x = 14 + c1dx;
  const c1y = 7;
  fillEllipse(c, c1x, c1y, 9, 4, 13);
  fillEllipse(c, c1x + 6, c1y + 1, 6, 3, 13);
  fillEllipse(c, c1x - 5, c1y + 1, 5, 3, 12);
  fillEllipse(c, c1x, c1y, 6, 2, 14);
  for (let x = c1x - 9; x <= c1x + 12; x++) {
    if (c.get(x, c1y + 4) === 13) c.set(x, c1y + 4, 10);
  }

  // Cloud 2: right side
  const c2dx = frame === 1 ? -1 : 0;
  const c2x = 74 + c2dx;
  const c2y = 10;
  fillEllipse(c, c2x, c2y, 10, 5, 13);
  fillEllipse(c, c2x + 8, c2y + 1, 7, 4, 13);
  fillEllipse(c, c2x - 6, c2y + 1, 6, 4, 12);
  fillEllipse(c, c2x, c2y, 7, 3, 14);
  for (let x = c2x - 10; x <= c2x + 18; x++) {
    if (c.get(x, c2y + 5) === 13) c.set(x, c2y + 5, 10);
  }

  // ── Flowers: bright accent dots on front ground (index 12-13) ─────────
  const flowers = [
    [4, 40],
    [13, 39],
    [22, 41],
    [35, 40],
    [48, 39],
    [61, 41],
    [72, 40],
    [83, 39],
    [90, 41],
    [8, 43],
    [30, 42],
    [55, 44],
    [78, 43],
    [42, 41],
  ];
  for (const [fx, fy] of flowers) {
    const bright = frame === 0 ? 13 : 12;
    c.set(fx!, fy!, bright);
    c.set(fx! - 1, fy!, bright - 1);
    c.set(fx! + 1, fy!, bright - 1);
    c.set(fx!, fy! - 1, bright - 1);
    c.set(fx!, fy! + 1, bright - 2);
  }

  // ── Tree silhouettes: dark (index 2) for maximum contrast at B ────────
  const trees = [
    { x: 0, y: 21, r: 3 },
    { x: 7, y: 20, r: 4 },
    { x: 88, y: 21, r: 3 },
    { x: 94, y: 20, r: 4 },
  ];
  for (const { x, y, r } of trees) {
    fillEllipse(c, x, y, r, r, 2);
    dot(c, x, y + r, 2);
  }

  return c;
}

// ---------------------------------------------------------------------------
// HABITAT: Rooftop Night — THE README SCENE
// ---------------------------------------------------------------------------
// Deep night gradient sky, large glowing crescent moon with halo, star
// clusters of varied brightness, layered city skyline (2 depth bands) with
// lit windows, rooftop ledge in foreground corners.
// ---------------------------------------------------------------------------

function buildRooftopNight(frame: number): PixelCanvas {
  const c = PixelCanvas.create(HW, HH);

  // ── Night sky gradient: near-black at top → deep blue at horizon ──────
  for (let y = 0; y < HH; y++) {
    // Index 2 (darkest) at top, rising to 4 near city skyline
    const idx = y < 8 ? 2 : y < 18 ? 3 : y < 27 ? 4 : y < 35 ? 3 : 3;
    for (let x = 0; x < HW; x++) c.set(x, y, idx);
  }

  // ── Horizon glow (warmth of city lights bleeding upward) ──
  for (let x = 0; x < HW; x++) {
    c.set(x, 26, 5);
    c.set(x, 27, 4);
  }

  // ── Stars — three tiers ───────────────────────────────────────────────
  // Tier 1: dim specks (index 5-6)
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
    [94, 4],
    [12, 9],
    [33, 8],
    [60, 10],
    [77, 8],
    [5, 14],
    [22, 11],
    [50, 13],
    [85, 12],
    [42, 16],
    [67, 15],
    [15, 17],
    [40, 7],
    [55, 14],
    [70, 19],
    [25, 20],
    [88, 18],
    [10, 22],
    [48, 21],
  ];
  for (const [sx, sy] of dimStars) c.set(sx!, sy!, 5);

  // Tier 2: medium cross stars (index 7-8)
  const medStars = [
    [7, 4],
    [24, 2],
    [41, 6],
    [58, 3],
    [75, 5],
    [91, 2],
    [15, 8],
    [48, 9],
    [83, 7],
    [30, 12],
    [69, 11],
    [20, 16],
  ];
  for (const [sx, sy] of medStars) {
    c.set(sx!, sy!, 8);
    c.set(sx! - 1, sy!, 6);
    c.set(sx! + 1, sy!, 6);
    c.set(sx!, sy! - 1, 6);
    c.set(sx!, sy! + 1, 6);
  }

  // Tier 3: bright twinkle stars (animate between frames)
  const brightStars = [
    [20, 4],
    [52, 2],
    [79, 6],
    [35, 10],
    [63, 8],
    [11, 15],
    [44, 17],
  ];
  for (const [sx, sy] of brightStars) {
    const bright = frame === 0 ? 13 : 12;
    const dim = frame === 0 ? 9 : 8;
    c.set(sx!, sy!, bright);
    c.set(sx! - 1, sy!, dim);
    c.set(sx! + 1, sy!, dim);
    c.set(sx!, sy! - 1, dim);
    c.set(sx!, sy! + 1, dim);
    if (frame === 0) {
      c.set(sx! - 1, sy! - 1, 7);
      c.set(sx! + 1, sy! + 1, 7);
    }
  }

  // ── Crescent Moon: upper-right quadrant ──────────────────────────────
  const moonCx = 76;
  const moonCy = 10;
  const moonR = 9;

  // Full disc (bright outer ring)
  fillEllipse(c, moonCx, moonCy, moonR, moonR, 11);
  // Brighter interior
  fillEllipse(c, moonCx, moonCy, moonR - 2, moonR - 2, 12);
  // Brightest center
  fillEllipse(c, moonCx, moonCy, moonR - 4, moonR - 4, 13);
  // Near-white hot spot
  fillEllipse(c, moonCx + 1, moonCy - 1, 3, 3, 14);

  // Crescent cut (occlude with sky color offset upper-left)
  fillEllipse(c, moonCx - 5, moonCy - 4, moonR - 1, moonR - 1, 3);

  // Moon surface texture (subtle craters)
  c.set(moonCx + 3, moonCy + 3, 9);
  c.set(moonCx + 5, moonCy + 2, 10);
  c.set(moonCx + 4, moonCy + 5, 9);

  // ── Moon halo: soft radial glow rings ──
  strokeEllipse(c, moonCx, moonCy, moonR + 3, moonR + 3, 5);
  strokeEllipse(c, moonCx, moonCy, moonR + 5, moonR + 5, 4);
  // Soft fill in halo zone (only over sky pixels)
  for (let y = moonCy - moonR - 7; y <= moonCy + moonR + 7; y++) {
    for (let x = moonCx - moonR - 7; x <= moonCx + moonR + 7; x++) {
      const dist = Math.hypot(x - moonCx, y - moonCy);
      if (dist > moonR + 1 && dist < moonR + 7) {
        const cur = c.get(x, y);
        if (cur >= 2 && cur <= 5) {
          const glow = dist < moonR + 3 ? 5 : dist < moonR + 5 ? 4 : 3;
          c.set(x, y, glow);
        }
      }
    }
  }

  // ── Far city skyline (index 3 — barely visible silhouette) ───────────
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
    fillRect(c, x, topY, x + w - 1, HH - 11, 3);
    // Roof line at top
    for (let bx = x; bx < x + w; bx++) c.set(bx, topY, 4);
  }

  // ── Near city skyline (index 4 — more visible, slightly lit) ─────────
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
    fillRect(c, x, topY, x + w - 1, HH - 11, 4);
    // Subtle darker top edge
    for (let bx = x; bx < x + w; bx++) c.set(bx, topY, 3);
  }

  // ── Lit windows in far buildings (index 7-8 = amber warmth) ──────────
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
    [1, 26],
    [54, 28],
    [95, 26],
  ];
  for (const [wx, wy] of farWins) {
    if (c.get(wx!, wy!) >= 3) {
      c.set(wx!, wy!, 7);
      if (wx! + 1 < HW && c.get(wx! + 1, wy!) >= 3) c.set(wx! + 1, wy!, 6);
    }
  }

  // ── Lit windows in near buildings (index 9-10 = brighter) ────────────
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
    [5, 32],
    [8, 34],
    [21, 34],
    [50, 32],
  ];
  for (const [wx, wy] of nearWins) {
    if (c.get(wx!, wy!) >= 3) {
      // Some windows flicker between frames
      const lit = frame === 0 ? 10 : 9;
      c.set(wx!, wy!, lit);
      if (wx! + 1 < HW && c.get(wx! + 1, wy!) >= 3) c.set(wx! + 1, wy!, lit - 1);
    }
  }

  // ── Extra bright windows (a few extra-bright ones, animate) ──────────
  const brightWins = [
    [24, 24],
    [52, 24],
    [67, 22],
    [86, 20],
  ];
  for (const [wx, wy] of brightWins) {
    if (c.get(wx!, wy!) >= 3) {
      c.set(wx!, wy!, frame === 0 ? 12 : 11);
    }
  }

  // ── Building antenna details ──
  // Antennas on two tallest buildings
  const antennaAt = [34, 19]; // near building at x=34, top y≈HH-10-17=21
  c.set(antennaAt[0]!, antennaAt[1]! - 1, 3);
  c.set(antennaAt[0]!, antennaAt[1]! - 2, 4);
  c.set(antennaAt[0]! + 1, antennaAt[1]! - 1, 3);
  const antennaAt2 = [66, 20];
  c.set(antennaAt2[0]!, antennaAt2[1]! - 1, 3);
  c.set(antennaAt2[0]!, antennaAt2[1]! - 2, 4);

  // ── Ground strip (ground level below buildings) ──
  fillRect(c, 0, HH - 10, HW - 1, HH - 1, 3);
  // Ground top highlight
  for (let x = 0; x < HW; x++) c.set(x, HH - 10, 4);

  // ── Rooftop ledge (foreground — both bottom corners) ─────────────────
  // Left ledge
  fillRect(c, 0, HH - 9, 16, HH - 1, 5);
  // Ledge top surface brighter
  fillRect(c, 0, HH - 9, 16, HH - 8, 6);
  // Ledge front face darker
  fillRect(c, 0, HH - 5, 16, HH - 1, 4);
  // Ledge top edge highlight
  for (let x = 0; x <= 16; x++) c.set(x, HH - 9, 7);
  // Ledge side bricks/joints
  for (let x = 3; x <= 13; x += 4) {
    c.set(x, HH - 8, 4);
    c.set(x, HH - 7, 4);
  }

  // Right ledge
  fillRect(c, HW - 17, HH - 9, HW - 1, HH - 1, 5);
  fillRect(c, HW - 17, HH - 9, HW - 1, HH - 8, 6);
  fillRect(c, HW - 17, HH - 5, HW - 1, HH - 1, 4);
  for (let x = HW - 17; x < HW; x++) c.set(x, HH - 9, 7);
  for (let x = HW - 14; x <= HW - 4; x += 4) {
    c.set(x, HH - 8, 4);
    c.set(x, HH - 7, 4);
  }

  // ── Railing posts on ledges ──
  for (let px = 2; px <= 14; px += 5) {
    c.set(px, HH - 10, 4);
    c.set(px, HH - 11, 4);
  }
  for (let px = HW - 15; px <= HW - 3; px += 5) {
    c.set(px, HH - 10, 4);
    c.set(px, HH - 11, 4);
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
    default:
      throw new Error(`Unknown habitat: ${id}`);
  }
}

// ---------------------------------------------------------------------------
// TRINKET: Bouncy Ball
// ---------------------------------------------------------------------------
// A shiny round rubber ball with specular highlight. Frame 0 = resting at
// center, frame 1 = squished mid-bounce (wider + compressed).
// ---------------------------------------------------------------------------

function buildBouncyBall(frame: number): PixelCanvas {
  const c = PixelCanvas.create(12, 12);

  if (frame === 0) {
    const cx = 6;
    const cy = 6;
    fillEllipse(c, cx, cy, 4, 4, 7); // body
    fillEllipse(c, cx, cy, 3, 3, 9); // inner lighter
    fillEllipse(c, cx - 1, cy, 2, 3, 6); // shadow side
    dot(c, cx - 1, cy - 2, 13); // specular highlight
    dot(c, cx - 2, cy - 1, 14); // bright glint
    dot(c, cx + 2, cy + 2, 5); // shadow dot
    strokeEllipse(c, cx, cy, 4, 4, 1);
  } else {
    // Squished mid-bounce: wider, shorter
    const cx = 6;
    const cy = 8;
    fillEllipse(c, cx, cy, 5, 3, 7);
    fillEllipse(c, cx, cy, 4, 2, 9);
    fillEllipse(c, cx - 1, cy, 2, 1, 6);
    dot(c, cx - 1, cy - 1, 13);
    dot(c, cx - 2, cy - 1, 14);
    dot(c, cx + 2, cy + 1, 5);
    strokeEllipse(c, cx, cy, 5, 3, 1);
    // Shadow on ground
    fillEllipse(c, cx, 11, 3, 1, 3);
  }

  return c;
}

// ---------------------------------------------------------------------------
// TRINKET: Cushion
// ---------------------------------------------------------------------------
// A plump floor cushion with decorative cross-stitch and corner tassels.
// Frame 0 = full puffy, frame 1 = squished (pet sitting on it).
// ---------------------------------------------------------------------------

function buildCushion(frame: number): PixelCanvas {
  const c = PixelCanvas.create(12, 12);

  if (frame === 0) {
    // Body
    fillRect(c, 2, 3, 9, 9, 8);
    fillRect(c, 3, 2, 8, 10, 7);
    // Top highlight band
    fillRect(c, 3, 2, 8, 3, 10);
    // Bottom shadow
    fillRect(c, 3, 8, 8, 10, 5);
    // Side shadows
    for (let y = 3; y <= 9; y++) {
      c.set(2, y, 6);
      c.set(9, y, 6);
    }
    // Cross-stitch seam
    for (let x = 3; x <= 8; x++) c.set(x, 6, 6);
    for (let y = 3; y <= 9; y++) c.set(5, y, 6);
    // Corner tassels
    dot(c, 2, 1, 11);
    dot(c, 9, 1, 11);
    dot(c, 1, 2, 10);
    dot(c, 10, 2, 10);
    dot(c, 2, 10, 9);
    dot(c, 9, 10, 9);
    dot(c, 1, 9, 8);
    dot(c, 10, 9, 8);
    // Outline
    strokeRect(c, 2, 2, 9, 10, 1);
  } else {
    // Squished: same but shifted down and less tall
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
    // Tassels pushed outward by compression
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
// Tall glass bottle with a glowing wax blob inside. Frame 0 = blob near top,
// frame 1 = blob sinks toward bottom. Two blobs trade positions.
// ---------------------------------------------------------------------------

function buildLavaLamp(frame: number): PixelCanvas {
  const c = PixelCanvas.create(12, 12);

  // Glass body (dark translucent look)
  fillRect(c, 4, 1, 7, 10, 3);
  // Glass base (wider base cap)
  fillRect(c, 3, 9, 8, 11, 4);
  // Glass top cap
  fillRect(c, 4, 0, 7, 1, 4);
  // Inner glow from the lamp base (index 5)
  fillRect(c, 5, 9, 6, 9, 5);

  // Glass inner translucent zone (brighter due to blob glow)
  fillRect(c, 5, 2, 6, 8, 4);

  // Large blob position
  const blobY = frame === 0 ? 3 : 7;
  // Blob outer (index 10)
  fillEllipse(c, 5, blobY, 2, 2, 10);
  // Blob inner bright (index 12)
  fillEllipse(c, 5, blobY, 1, 1, 12);
  // Blob glint
  dot(c, 4, blobY - 1, 13);

  // Small blob (opposite end)
  const blob2Y = frame === 0 ? 7 : 3;
  fillEllipse(c, 5, blob2Y, 1, 1, 8);
  dot(c, 6, blob2Y, 9);

  // Glass edge rim-light (left side brighter)
  for (let y = 1; y <= 9; y++) {
    if (c.get(4, y) >= 3) c.set(4, y, Math.min(c.get(4, y) + 1, 6));
  }
  // Glass right shadow
  for (let y = 1; y <= 9; y++) {
    if (c.get(7, y) >= 3) c.set(7, y, 2);
  }

  // Outline
  strokeRect(c, 3, 0, 8, 11, 1);
  c.set(4, 0, 1);
  c.set(7, 0, 1);

  return c;
}

// ---------------------------------------------------------------------------
// TRINKET: Bonsai
// ---------------------------------------------------------------------------
// Terracotta pot + curved trunk + layered canopy puffs. Frame 0 = calm,
// frame 1 = slight wind lean (canopy shifts right 1px).
// ---------------------------------------------------------------------------

function buildBonsai(frame: number): PixelCanvas {
  const c = PixelCanvas.create(12, 12);

  // ── Pot ──
  fillRect(c, 3, 8, 8, 11, 7); // pot body
  fillRect(c, 2, 7, 9, 8, 8); // pot rim
  fillRect(c, 3, 11, 8, 11, 6); // base saucer
  // Pot highlight
  for (let x = 3; x <= 8; x++) c.set(x, 8, 9);
  // Pot shadow edges
  c.set(3, 9, 6);
  c.set(8, 9, 6);
  strokeRect(c, 2, 7, 9, 11, 1);

  // ── Trunk ──
  const lean = frame === 1 ? 1 : 0;
  thickLine(c, 5, 7, 5 + lean, 4, 5, 1);
  thickLine(c, 5 + lean, 4, 6 + lean * 2, 1, 4, 1);

  // ── Canopy puffs ──
  const cx = 6 + lean;
  fillEllipse(c, cx, 3, 4, 2, 9);
  fillEllipse(c, cx - 3, 4, 2, 2, 8);
  fillEllipse(c, cx + 3, 4, 2, 2, 8);
  // Top bright cluster
  fillEllipse(c, cx, 2, 2, 1, 11);
  dot(c, cx - 1, 1, 12); // morning dew glint
  if (frame === 0) dot(c, cx + 2, 2, 13);

  return c;
}

// ---------------------------------------------------------------------------
// TRINKET: Gift Box
// ---------------------------------------------------------------------------
// Wrapped gift with ribbon + bow. Frame 0 = calm bow, frame 1 = bow loops
// flutter outward (like a slight breeze).
// ---------------------------------------------------------------------------

function buildGiftBox(frame: number): PixelCanvas {
  const c = PixelCanvas.create(12, 12);

  // Box body
  fillRect(c, 1, 5, 10, 11, 7);
  // Lid
  fillRect(c, 1, 3, 10, 5, 8);
  // Lid highlight (top face brighter)
  fillRect(c, 1, 3, 10, 4, 9);
  // Box shadow on bottom
  fillRect(c, 1, 9, 10, 11, 5);
  // Box left highlight strip
  for (let y = 5; y <= 11; y++) c.set(1, y, 8);
  // Outline
  strokeRect(c, 1, 3, 10, 11, 1);
  strokeRect(c, 1, 5, 10, 5, 1); // lid divider line

  // Ribbon (vertical band, index 11)
  for (let y = 3; y <= 11; y++) {
    c.set(5, y, 11);
    c.set(6, y, 10);
  }
  // Ribbon (horizontal band, index 11)
  for (let x = 1; x <= 10; x++) {
    c.set(x, 7, 11);
    c.set(x, 8, 10);
  }
  // Ribbon highlights
  for (let y = 3; y <= 11; y += 2) c.set(5, y, 12);

  // Bow on top
  if (frame === 0) {
    fillEllipse(c, 3, 2, 2, 2, 10);
    fillEllipse(c, 8, 2, 2, 2, 10);
    fillCircle(c, 5, 2, 1, 12);
    dot(c, 6, 2, 12);
    dot(c, 3, 3, 8);
    dot(c, 8, 3, 8);
  } else {
    // Flutter outward
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
// Wooden shelf with two tiny trophies (left shorter, right taller). Frame 1
// adds twinkling glint crosses on the trophy cups.
// ---------------------------------------------------------------------------

function buildTrophyShelf(frame: number): PixelCanvas {
  const c = PixelCanvas.create(12, 12);

  // ── Shelf plank ──
  fillRect(c, 0, 8, 11, 10, 6); // shelf body
  fillRect(c, 0, 8, 11, 8, 7); // top highlight
  fillRect(c, 0, 10, 11, 11, 5); // underside
  strokeRect(c, 0, 8, 11, 11, 1);

  // ── Left trophy (shorter) ──
  // Cup
  fillEllipse(c, 3, 5, 2, 3, 9);
  fillEllipse(c, 3, 4, 1, 2, 11); // inner glow
  // Stem
  fillRect(c, 2, 7, 3, 7, 8);
  // Base
  fillRect(c, 1, 8, 4, 8, 9);
  // Handles
  dot(c, 0, 5, 8);
  dot(c, 5, 5, 8);
  // Cup rim
  strokeEllipse(c, 3, 5, 2, 3, 1);

  // ── Right trophy (taller) ──
  fillEllipse(c, 8, 4, 2, 3, 9);
  fillEllipse(c, 8, 3, 1, 2, 11);
  fillRect(c, 7, 7, 8, 7, 8);
  fillRect(c, 6, 8, 9, 8, 9);
  dot(c, 5, 4, 8);
  dot(c, 10, 4, 8);
  strokeEllipse(c, 8, 4, 2, 3, 1);

  // ── Trophy stars / glints ──
  if (frame === 0) {
    dot(c, 3, 2, 13); // star above left
    dot(c, 8, 1, 13); // star above right
  } else {
    // Cross-shaped twinkle
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

/** Sprite ids for the starter habitat set. */
const HABITAT_IDS: readonly string[] = [
  'habitat-terminal-den',
  'habitat-meadow',
  'habitat-rooftop-night',
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
export const habitatSprites: SpriteDef[] = HABITAT_IDS.map((id) => {
  const f0 = buildHabitat(id, 0);
  const f1 = buildHabitat(id, 1);
  return buildSprite(id, [f0, f1], 4); // 4fps subtle ambient animation
});

/** All trinket sprites (12x12, 2 frames). */
export const trinketSprites: SpriteDef[] = TRINKET_IDS.map((id) => {
  const f0 = buildTrinket(id, 0);
  const f1 = buildTrinket(id, 1);
  return buildSprite(id, [f0, f1], 4);
});

/** Habitats + trinkets together (scene layer). */
export const sceneSprites: SpriteDef[] = [...habitatSprites, ...trinketSprites];
