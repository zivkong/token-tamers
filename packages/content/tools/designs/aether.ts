/**
 * Aether line sprite designs (House: Aether — wispy/cloud, WIS-leaning).
 *
 * Full art-pass implementation. Each species is individually composed from
 * sprite-lib.ts primitives — no shared template with param tweaks. All sprites
 * use the full 1..15 ramp (1 = outline, 2..12 = body shading ramp, 13/14 = rim
 * light, 15 = animated glint) so they render beautifully at every grade.
 *
 * Pipeline per sprite:
 *   fillEllipse / bezier / fillPolygon (body mass, only LEFT half where bilateral)
 *   -> mirrorX  (bilateral symmetry)
 *   -> shade    (upper-left directional dithered gradient)
 *   -> rimLight (index 13/14 lit-edge pop)
 *   -> outline  (1px index-1 silhouette, LAST solid op)
 *   -> sparkle / glyphStamp (index-15 glint decals)
 *   -> eye pixels (outline dot + glint highlight)
 *   -> build frames (bob, blink or wisp-twinkle)
 *
 * Stage sizes (even width and height, half-block safe):
 *   egg  28x28, sprite  32x32, rookie 34x34,
 *   evolved 40x40, prime 44x44, apex 48x48.
 *
 * Determinism: seeded LCG (hashStr(id)) — no Math.random / Date.now.
 */

import type { SpriteDef } from '@token-tamers/core';
import {
  PixelCanvas,
  buildSprite,
  fillEllipse,
  fillRect,
  fillPolygon,
  strokeEllipse,
  bezier,
  thickLine,
  mirrorX,
  shade,
  rimLight,
  outline,
  scatter,
  bobFrame,
  diamond,
  glyphStamp,
  hashStr,
  lcg,
  OUTLINE,
  RIM_LO,
  RIM_HI,
  GLINT,
} from '../sprite-lib';

// ---------------------------------------------------------------------------
// Egg: sprite-mote (28x28) — universal dormant orb
// ---------------------------------------------------------------------------

export function buildMote(): SpriteDef {
  const W = 28;
  const H = 28;
  const cx = 14;
  const cy = 14;

  const c = PixelCanvas.create(W, H);

  // Outer orb — large soft ellipse
  fillEllipse(c, cx, cy, 11, 11, 8);
  // Inner glow core
  fillEllipse(c, cx, cy - 1, 7, 7, 10);
  // Bright center kernel
  fillEllipse(c, cx, cy - 1, 3, 3, 12);

  // Dormant swirl mark — left half of a crescent arc using bezier
  bezier(c, cx - 4, cy + 1, cx - 6, cy - 4, cx, cy - 6, 5, 1, 1);
  bezier(c, cx, cy - 6, cx + 3, cy - 5, cx + 4, cy - 2, 5, 1, 1);

  shade(c, { dir: 'upper-left', bands: 9, lo: 4, hi: 12, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // Glint sparkles in orbit — tiny dots placed at fixed angles
  // (LCG seeded but positions are fixed — deterministic layout)
  lcg(hashStr('sprite-mote')); // advance seed for future use; positions are fixed below
  // Four cardinal orbit positions
  c.set(cx + 12, cy - 2, GLINT);
  c.set(cx - 2, cy - 12, GLINT);
  c.set(cx - 11, cy + 4, GLINT);
  c.set(cx + 4, cy + 11, GLINT);

  // Central eye-like swirl glint
  c.set(cx, cy - 1, GLINT);

  // Frame 2: sparkle orbit shifts slightly (bob + glint twinkle)
  const f2 = bobFrame(c, 1);
  // Move one glint to alternate position
  f2.set(cx + 12, cy - 2, 0);
  f2.set(cx + 11, cy - 4, GLINT);
  f2.set(cx - 2, cy - 12, 0);
  f2.set(cx - 4, cy - 11, GLINT);

  return buildSprite('sprite-mote', [c, f2], 2);
}

// ---------------------------------------------------------------------------
// Sprite stage: sprite-wisp (32x32) — candle-flame spirit, teardrop body
// ---------------------------------------------------------------------------

export function buildWisp(): SpriteDef {
  const W = 32;
  const H = 32;
  const cx = 16;

  const c = PixelCanvas.create(W, H);

  // Teardrop body: wide base ellipse that tapers upward
  // Body bottom — wide flame base
  fillEllipse(c, cx, 22, 8, 7, 8);
  // Body mid-torso
  fillEllipse(c, cx, 17, 6, 6, 9);
  // Head / upper flame
  fillEllipse(c, cx, 12, 5, 6, 9);
  // Flame tip (tapered)
  fillEllipse(c, cx, 7, 3, 4, 8);
  fillEllipse(c, cx, 5, 2, 3, 7);

  // Curled tail-wick left half only (will mirror)
  bezier(c, cx - 2, 26, cx - 6, 30, cx - 10, 29, 7, 2, 1);
  bezier(c, cx - 10, 29, cx - 13, 27, cx - 11, 24, 6, 1, 1);

  mirrorX(c);

  // Shade with upper-left lighting (flame lit from above-left)
  shade(c, { dir: 'upper-left', bands: 10, lo: 3, hi: 12, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // Eyes: dark pupils with glint highlight
  // Left eye
  c.set(cx - 3, 13, OUTLINE);
  c.set(cx - 2, 12, OUTLINE);
  c.set(cx - 2, 13, OUTLINE);
  c.set(cx - 2, 11, GLINT); // eye sparkle
  // Right eye (mirrored)
  c.set(cx + 3, 13, OUTLINE);
  c.set(cx + 2, 12, OUTLINE);
  c.set(cx + 2, 13, OUTLINE);
  c.set(cx + 2, 11, GLINT);

  // Glint on flame tip
  c.set(cx, 4, GLINT);

  // Frame 2: bob up 1px + blink eyes
  const bobbed = bobFrame(c, -1);
  // Clear eyes and draw blink lines
  bobbed.set(cx - 3, 13, 8);
  bobbed.set(cx - 2, 12, OUTLINE);
  bobbed.set(cx - 2, 13, 8);
  bobbed.set(cx - 2, 11, 8);
  bobbed.set(cx + 3, 13, 8);
  bobbed.set(cx + 2, 12, OUTLINE);
  bobbed.set(cx + 2, 13, 8);
  bobbed.set(cx + 2, 11, 8);

  // Frame 3: bob down 1px + tip glint brightens
  const bobbedDown = bobFrame(c, 1);

  return buildSprite('sprite-wisp', [c, bobbed, bobbedDown], 3);
}

// ---------------------------------------------------------------------------
// Rookie: sprite-aetherling (34x34) — small cloud sprite with stubby arms
// ---------------------------------------------------------------------------

export function buildAetherling(): SpriteDef {
  const W = 34;
  const H = 34;
  const cx = 17;

  const c = PixelCanvas.create(W, H);

  // Unified cloud body — one large soft shape, head merging into body
  // Body/torso mass
  fillEllipse(c, cx, 22, 10, 8, 8);
  // Head merges seamlessly into body (overlapping ellipses)
  fillEllipse(c, cx, 15, 9, 9, 9);
  // Connector band between head and body (fill the gap)
  fillEllipse(c, cx, 19, 7, 5, 8);

  // Crown cloud puffs — three lobes, taller arrangement
  fillEllipse(c, cx, 8, 5, 5, 8);
  fillEllipse(c, cx - 4, 10, 4, 4, 7);
  fillEllipse(c, cx + 4, 10, 4, 4, 7);

  // Left stubby arm — cloud-puff hand
  fillEllipse(c, cx - 10, 21, 4, 3, 7);
  fillEllipse(c, cx - 13, 23, 3, 3, 6);

  mirrorX(c);

  shade(c, { dir: 'upper-left', bands: 9, lo: 3, hi: 12, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // Halo wisp ring — drawn after outline so it sits on top
  for (let x = cx - 7; x <= cx + 7; x++) {
    const dx = x - cx;
    const dy = Math.round(Math.sqrt(Math.max(0, 4 - (dx * dx * 4) / 49)));
    const y1 = 4 - dy;
    const y2 = 4 + dy;
    if (y1 >= 0 && y1 < H) c.set(x, y1, 6);
    if (y2 >= 0 && y2 < H && y2 !== y1) c.set(x, y2, 6);
  }

  // Eyes — bright dot-glint eyes
  c.set(cx - 3, 14, OUTLINE);
  c.set(cx - 3, 15, OUTLINE);
  c.set(cx - 2, 14, GLINT);
  c.set(cx + 3, 14, OUTLINE);
  c.set(cx + 3, 15, OUTLINE);
  c.set(cx + 2, 14, GLINT);

  // Halo glints
  c.set(cx - 5, 4, GLINT);
  c.set(cx + 5, 4, GLINT);
  c.set(cx, 2, GLINT);

  // Frame 2: bob up + halo glint shifts
  const f2 = bobFrame(c, -1);
  f2.set(cx - 5, 3, GLINT);
  f2.set(cx + 5, 3, GLINT);
  f2.set(cx - 5, 4, 0);
  f2.set(cx + 5, 4, 0);

  // Frame 3: blink
  const f3 = c.clone();
  // Collapse eyes to a closed line
  f3.set(cx - 3, 14, 8);
  f3.set(cx - 2, 14, OUTLINE);
  f3.set(cx - 3, 15, 8);
  f3.set(cx + 3, 14, 8);
  f3.set(cx + 2, 14, OUTLINE);
  f3.set(cx + 3, 15, 8);

  return buildSprite('sprite-aetherling', [c, f2, f3], 3);
}

// ---------------------------------------------------------------------------
// Rookie: sprite-murmur (34x34) — hooded whisper-ghost, trailing ribbon edges
// ---------------------------------------------------------------------------

export function buildMurmur(): SpriteDef {
  const W = 34;
  const H = 34;
  const cx = 17;

  const c = PixelCanvas.create(W, H);

  // Ghost body — tall tapered ellipse
  fillEllipse(c, cx, 18, 9, 13, 8);
  // Head/hood bulge
  fillEllipse(c, cx, 10, 8, 7, 9);
  // Hood peak overhang — polygon triangle on left half
  fillPolygon(
    c,
    [[cx - 9, 11] as [number, number], [cx, 4] as [number, number], [cx, 11] as [number, number]],
    7,
  );

  // Trailing ribbon left edge — bezier curves flowing down-left
  bezier(c, cx - 9, 22, cx - 13, 25, cx - 10, 30, 6, 2, 1);
  bezier(c, cx - 6, 27, cx - 9, 31, cx - 7, 33, 6, 1, 1);

  mirrorX(c);

  shade(c, { dir: 'upper-left', bands: 9, lo: 3, hi: 11, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // Shadowed eyes — set deep inside hood (indices slightly darker to look hidden)
  c.set(cx - 3, 11, OUTLINE);
  c.set(cx + 3, 11, OUTLINE);
  c.set(cx - 2, 12, OUTLINE);
  c.set(cx + 2, 12, OUTLINE);
  // Faint glint suggests presence
  c.set(cx - 3, 10, GLINT);
  c.set(cx + 3, 10, GLINT);

  // Whisper glyph mark on chest — small rune stamp
  const runeMap = [
    [0, 1, 0],
    [1, 0, 1],
    [0, 1, 0],
  ];
  glyphStamp(c, cx - 1, 18, runeMap, GLINT);

  // Frame 2: ribbon sway — shift bottom slightly, bob up
  const f2 = bobFrame(c, -1);

  // Frame 3: bob down
  const f3 = bobFrame(c, 1);

  return buildSprite('sprite-murmur', [c, f2, f3], 3);
}

// ---------------------------------------------------------------------------
// Evolved: sprite-oraclet (40x40) — floating one-eye oracle in orbiting ring
// ---------------------------------------------------------------------------

export function buildOraclet(): SpriteDef {
  const W = 40;
  const H = 40;
  const cx = 20;
  const cy = 20;

  const c = PixelCanvas.create(W, H);

  // Main body orb — slightly squashed sphere
  fillEllipse(c, cx, cy - 2, 13, 12, 8);
  // Inner glow
  fillEllipse(c, cx, cy - 2, 9, 9, 10);
  // Core
  fillEllipse(c, cx, cy - 2, 5, 5, 11);

  // Orbiting ring — stroke ellipse (horizontal, slightly tilted effect via taller Y)
  strokeEllipse(c, cx, cy + 3, 16, 4, 6);
  // Second ring pass for thickness
  strokeEllipse(c, cx, cy + 3, 15, 3, 7);

  // Ring gems — left side only (will mirror)
  c.set(cx - 15, cy + 3, GLINT);
  c.set(cx - 16, cy + 3, GLINT);

  mirrorX(c);

  shade(c, { dir: 'upper-left', bands: 10, lo: 3, hi: 12, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // The single great eye — large iris
  fillEllipse(c, cx, cy - 2, 5, 4, 3); // pupil dark
  fillEllipse(c, cx, cy - 2, 3, 2, 5); // iris mid
  c.set(cx, cy - 2, OUTLINE); // pupil core
  // Iris rim light
  c.set(cx - 4, cy - 4, GLINT);
  c.set(cx - 3, cy - 5, GLINT);
  // Eyelid shape — thin arc above/below
  thickLine(c, cx - 5, cy - 6, cx + 5, cy - 6, OUTLINE, 1);
  thickLine(c, cx - 5, cy + 2, cx + 5, cy + 2, OUTLINE, 1);

  // Ring glints
  c.set(cx + 15, cy + 3, GLINT);

  // Frame 2: bob + ring rotation simulation (shift ring glints)
  const f2 = bobFrame(c, -1);
  f2.set(cx + 15, cy + 2, GLINT);
  f2.set(cx + 15, cy + 3, 0);
  f2.set(cx - 15, cy + 2, GLINT);
  f2.set(cx - 15, cy + 3, 0);

  // Frame 3: bob down + glint on opposite ring points
  const f3 = bobFrame(c, 1);
  f3.set(cx, cy + 7, GLINT);

  return buildSprite('sprite-oraclet', [c, f2, f3], 3);
}

// ---------------------------------------------------------------------------
// Evolved: sprite-cirrux (40x40) — serpentine cirrus-cloud dragonling
// ---------------------------------------------------------------------------

export function buildCirrux(): SpriteDef {
  const W = 40;
  const H = 40;
  const cx = 20;

  const c = PixelCanvas.create(W, H);

  // S-curve serpentine body — series of overlapping ellipses forming a snake shape
  // Tail end (bottom-left)
  fillEllipse(c, 8, 36, 4, 3, 7);
  // Lower body curve sweeping right
  fillEllipse(c, 13, 33, 5, 4, 8);
  fillEllipse(c, 18, 30, 6, 5, 8);
  // Mid body at center
  fillEllipse(c, cx, 26, 7, 6, 9);
  // Upper body curving left
  fillEllipse(c, 18, 21, 6, 5, 9);
  fillEllipse(c, 15, 16, 5, 5, 8);
  // Neck
  fillEllipse(c, 16, 12, 5, 5, 9);
  // Head (larger, facing right-ish)
  fillEllipse(c, 20, 9, 8, 7, 10);
  // Snout
  fillEllipse(c, 26, 10, 4, 3, 9);

  // Wispy wing frills — left side only (bezier arcs)
  bezier(c, 13, 22, 4, 16, 3, 9, 6, 2, 1);
  bezier(c, 3, 9, 2, 6, 7, 4, 5, 1, 1);

  // Tail tip wisps
  bezier(c, 6, 36, 2, 38, 1, 35, 6, 1, 1);

  // NO mirrorX for this creature — asymmetric S-curve is the point

  shade(c, { dir: 'upper-left', bands: 10, lo: 3, hi: 12, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // Eye on head — right side of head
  c.set(24, 8, OUTLINE);
  c.set(25, 8, OUTLINE);
  c.set(24, 9, OUTLINE);
  c.set(23, 7, GLINT);

  // Nostril
  c.set(27, 11, OUTLINE);

  // Cloud puff detail on back
  c.set(17, 14, GLINT);
  c.set(14, 18, GLINT);

  // Frame 2: gentle body wave (shift tail slightly)
  const f2 = c.clone();
  // Shift lower body pixels down 1 row to simulate undulation
  for (let x = 5; x <= 18; x++) {
    const v = f2.get(x, 34);
    if (v > 0) {
      f2.set(x, 35, v);
      f2.set(x, 34, 0);
    }
  }

  // Frame 3: bob up 1 + glint twinkle
  const f3 = bobFrame(c, -1);
  f3.set(17, 13, GLINT);
  f3.set(14, 17, GLINT);

  return buildSprite('sprite-cirrux', [c, f2, f3], 3);
}

// ---------------------------------------------------------------------------
// Evolved: sprite-nimbusk (40x40) — storm-cloud beast with condensed-vapor tusks
// ---------------------------------------------------------------------------

export function buildNimbusk(): SpriteDef {
  const W = 40;
  const H = 40;
  const cx = 20;

  const c = PixelCanvas.create(W, H);

  // Massive cloud-beast body — low-slung heavy mass
  fillEllipse(c, cx, 24, 14, 10, 7);
  // Neck and head — wide brutish head on short neck
  fillEllipse(c, cx, 16, 11, 8, 8);
  // Top brow ridge / storm-cloud crown puffs
  fillEllipse(c, cx - 5, 10, 5, 4, 7);
  fillEllipse(c, cx + 5, 10, 5, 4, 7);
  fillEllipse(c, cx, 9, 4, 4, 8);
  // Cloud underbelly tendrils (lower)
  fillEllipse(c, cx - 8, 31, 4, 3, 6);
  fillEllipse(c, cx + 8, 31, 4, 3, 6);

  // Tusk — left side only, condensed vapor tusk juts down-left from jaw
  bezier(c, cx - 7, 21, cx - 10, 25, cx - 14, 26, 6, 3, 2);
  bezier(c, cx - 14, 26, cx - 17, 26, cx - 16, 22, 5, 2, 1);

  mirrorX(c);

  shade(c, { dir: 'upper-left', bands: 10, lo: 3, hi: 11, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // Eyes — small fierce eyes under brow
  c.set(cx - 5, 15, OUTLINE);
  c.set(cx - 4, 15, OUTLINE);
  c.set(cx - 5, 16, OUTLINE);
  c.set(cx - 3, 14, GLINT);
  c.set(cx + 5, 15, OUTLINE);
  c.set(cx + 4, 15, OUTLINE);
  c.set(cx + 5, 16, OUTLINE);
  c.set(cx + 3, 14, GLINT);

  // Lightning spark mark on chest
  const boltMap = [
    [0, 0, 1],
    [0, 1, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  glyphStamp(c, cx - 1, 20, boltMap, GLINT);

  // Frame 2: heavy stomp bob
  const f2 = bobFrame(c, 1);

  // Frame 3: bob up + lightning flicker
  const f3 = bobFrame(c, -1);
  // Extra lightning glint
  f3.set(cx + 1, 20, GLINT);
  f3.set(cx - 1, 22, GLINT);

  return buildSprite('sprite-nimbusk', [c, f2, f3], 3);
}

// ---------------------------------------------------------------------------
// Prime: sprite-seraphix (44x44) — twin-winged seraph, layered feather-wisps
// ---------------------------------------------------------------------------

export function buildSeraphix(): SpriteDef {
  const W = 44;
  const H = 44;
  const cx = 22;

  const c = PixelCanvas.create(W, H);

  // Core body — slender torso
  fillEllipse(c, cx, 28, 6, 10, 9);
  // Head — noble round head
  fillEllipse(c, cx, 16, 7, 7, 10);
  // Neck connector
  fillEllipse(c, cx, 22, 4, 5, 9);

  // LEFT wing — layered feather-wisps (draw left side only, will mirror)
  // Outer wing span
  bezier(c, cx - 4, 20, cx - 15, 12, cx - 18, 22, 7, 3, 2);
  // Mid wing layer
  bezier(c, cx - 4, 22, cx - 14, 16, cx - 16, 24, 6, 2, 1);
  // Inner feather layer
  bezier(c, cx - 4, 24, cx - 12, 20, cx - 13, 28, 5, 2, 1);
  // Wing base fill connecting to body
  fillEllipse(c, cx - 8, 23, 6, 5, 8);

  // Upper second wing set (smaller, above first wings)
  bezier(c, cx - 3, 17, cx - 10, 9, cx - 14, 14, 7, 2, 1);
  bezier(c, cx - 3, 18, cx - 9, 11, cx - 12, 16, 6, 1, 1);

  mirrorX(c);

  // Lower wispy trailing tail feathers — symmetric
  bezier(c, cx - 5, 36, cx - 8, 40, cx - 4, 43, 6, 2, 1);
  bezier(c, cx + 5, 36, cx + 8, 40, cx + 4, 43, 6, 2, 1);
  c.set(cx, 37, 7);
  c.set(cx, 38, 7);
  c.set(cx, 39, 6);

  shade(c, { dir: 'upper-left', bands: 10, lo: 3, hi: 12, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // Eyes — serene, slightly large
  c.set(cx - 3, 15, OUTLINE);
  c.set(cx - 3, 16, OUTLINE);
  c.set(cx - 2, 15, OUTLINE);
  c.set(cx - 2, 14, GLINT);
  c.set(cx + 3, 15, OUTLINE);
  c.set(cx + 3, 16, OUTLINE);
  c.set(cx + 2, 15, OUTLINE);
  c.set(cx + 2, 14, GLINT);

  // Halo above head
  strokeEllipse(c, cx, 9, 7, 2, 6);
  c.set(cx, 7, GLINT);
  c.set(cx - 5, 9, GLINT);
  c.set(cx + 5, 9, GLINT);

  // Wing feather glints
  scatter(c, lcg(hashStr('sprite-seraphix')), 4, GLINT, {
    x0: cx - 18,
    y0: 9,
    x1: cx - 4,
    y1: 28,
  });

  // Frame 2: wing spread bob upward
  const f2 = bobFrame(c, -1);
  // Frame 3: wing lower bob + tail wisp shift
  const f3 = bobFrame(c, 1);

  return buildSprite('sprite-seraphix', [c, f2, f3], 3);
}

// ---------------------------------------------------------------------------
// Prime: sprite-thoughtwarden (44x44) — armored sentinel with mind-gem core
// ---------------------------------------------------------------------------

export function buildThoughtwarden(): SpriteDef {
  const W = 44;
  const H = 44;
  const cx = 22;

  const c = PixelCanvas.create(W, H);

  // Armored body — broad shouldered rectangular mass
  fillPolygon(
    c,
    [
      [cx - 10, 16] as [number, number],
      [cx + 10, 16] as [number, number],
      [cx + 9, 36] as [number, number],
      [cx - 9, 36] as [number, number],
    ],
    8,
  );

  // Shoulder pauldrons (left only, mirror later)
  fillEllipse(c, cx - 12, 18, 5, 4, 7);
  fillEllipse(c, cx - 14, 20, 4, 3, 6);

  // Helmet/head — angular fortress dome
  fillPolygon(
    c,
    [
      [cx - 8, 9] as [number, number],
      [cx + 8, 9] as [number, number],
      [cx + 10, 16] as [number, number],
      [cx - 10, 16] as [number, number],
    ],
    9,
  );
  // Helmet peak
  fillPolygon(
    c,
    [
      [cx - 4, 5] as [number, number],
      [cx + 4, 5] as [number, number],
      [cx + 8, 9] as [number, number],
      [cx - 8, 9] as [number, number],
    ],
    10,
  );

  // Left arm (gauntlet)
  fillEllipse(c, cx - 13, 26, 4, 7, 7);
  fillEllipse(c, cx - 13, 32, 3, 3, 6);

  mirrorX(c);

  shade(c, { dir: 'upper-left', bands: 10, lo: 3, hi: 12, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // Glowing mind-gem on chest center — prominent feature
  diamond(c, cx, 24, 3, 11); // outer gem
  diamond(c, cx, 24, 2, 13); // mid gem
  diamond(c, cx, 24, 1, GLINT); // inner core shines
  c.set(cx, 24, GLINT);

  // Visor eye-slit
  thickLine(c, cx - 5, 12, cx + 5, 12, OUTLINE, 1);
  c.set(cx - 4, 12, GLINT);
  c.set(cx + 4, 12, GLINT);

  // Armor engravings on chest (left half, mirrored)
  thickLine(c, cx - 8, 20, cx - 2, 20, 4, 1);
  thickLine(c, cx - 8, 28, cx - 2, 28, 4, 1);

  // Frame 2: gem pulses brighter
  const f2 = c.clone();
  f2.set(cx - 1, 23, GLINT);
  f2.set(cx + 1, 23, GLINT);
  f2.set(cx - 1, 25, GLINT);
  f2.set(cx + 1, 25, GLINT);

  // Frame 3: sentinel sway (bob up)
  const f3 = bobFrame(c, -1);

  return buildSprite('sprite-thoughtwarden', [c, f2, f3], 3);
}

// ---------------------------------------------------------------------------
// Prime: sprite-halcyore (44x44) — serene long-tailed sky-bird, crest plume
// ---------------------------------------------------------------------------

export function buildHalcyore(): SpriteDef {
  const W = 44;
  const H = 44;
  const cx = 22;

  const c = PixelCanvas.create(W, H);

  // ── BODY: plump upright bird body ──────────────────────────────────────
  // Lower body / belly
  fillEllipse(c, cx, 30, 8, 9, 8);
  // Upper body / breast (puffed)
  fillEllipse(c, cx, 23, 9, 8, 10);
  // Neck (narrow connector)
  fillEllipse(c, cx, 17, 5, 4, 9);

  // ── HEAD: rounded bird head slightly offset right for alertness ─────────
  fillEllipse(c, cx + 1, 12, 7, 6, 10);

  // ── BEAK: sharp downward-pointing beak on right side ────────────────────
  fillPolygon(
    c,
    [
      [cx + 5, 11] as [number, number],
      [cx + 8, 14] as [number, number],
      [cx + 5, 14] as [number, number],
    ],
    9,
  );
  // Beak lower mandible
  fillPolygon(
    c,
    [
      [cx + 5, 14] as [number, number],
      [cx + 8, 14] as [number, number],
      [cx + 6, 16] as [number, number],
    ],
    8,
  );

  // ── CREST PLUME: tall elegant feather fan from crown (left of center) ───
  bezier(c, cx - 1, 7, cx - 3, 1, cx, -2, 9, 2, 1); // main plume
  bezier(c, cx - 3, 7, cx - 6, 0, cx - 4, -3, 8, 1, 1); // secondary plume
  bezier(c, cx + 1, 7, cx, 1, cx + 3, -1, 8, 1, 1); // tertiary plume

  // ── WINGS: folded against body, left side only ──────────────────────────
  bezier(c, cx - 7, 21, cx - 16, 19, cx - 17, 28, 7, 3, 2);
  bezier(c, cx - 7, 24, cx - 15, 23, cx - 15, 32, 6, 2, 2);
  fillEllipse(c, cx - 11, 26, 6, 5, 8);
  // Wing tip feathers
  bezier(c, cx - 13, 28, cx - 18, 30, cx - 16, 36, 6, 2, 1);

  mirrorX(c);

  // ── TAIL: long elegant streaming feathers (after mirror, symmetric) ──────
  // Left stream
  bezier(c, cx - 4, 37, cx - 8, 40, cx - 5, 43, 7, 2, 1);
  bezier(c, cx - 7, 37, cx - 12, 41, cx - 9, 44, 7, 2, 1);
  // Right stream
  bezier(c, cx + 4, 37, cx + 8, 40, cx + 5, 43, 7, 2, 1);
  bezier(c, cx + 7, 37, cx + 12, 41, cx + 9, 44, 7, 2, 1);
  // Central tail feather (thicker)
  bezier(c, cx, 37, cx, 42, cx + 1, 44, 8, 2, 1);

  // ── LEGS: short sturdy perching legs ────────────────────────────────────
  fillRect(c, cx - 5, 37, cx - 4, 41, 7);
  fillRect(c, cx + 4, 37, cx + 5, 41, 7);
  // Feet
  fillPolygon(
    c,
    [
      [cx - 7, 41] as [number, number],
      [cx - 3, 41] as [number, number],
      [cx - 4, 43] as [number, number],
    ],
    7,
  );
  fillPolygon(
    c,
    [
      [cx + 7, 41] as [number, number],
      [cx + 3, 41] as [number, number],
      [cx + 4, 43] as [number, number],
    ],
    7,
  );

  shade(c, { dir: 'upper-left', bands: 10, lo: 3, hi: 12, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // ── EYE: bright intelligent circle on right side of head ─────────────────
  c.set(cx + 3, 11, OUTLINE);
  c.set(cx + 4, 11, OUTLINE);
  c.set(cx + 3, 12, OUTLINE);
  c.set(cx + 4, 12, OUTLINE);
  c.set(cx + 3, 10, GLINT); // eye sparkle

  // ── CREST PLUME GLINTS ────────────────────────────────────────────────────
  c.set(cx, 1, GLINT);
  c.set(cx - 3, 0, GLINT);
  c.set(cx + 3, 0, GLINT);

  // ── TAIL TIP GLINTS ───────────────────────────────────────────────────────
  c.set(cx - 5, 43, GLINT);
  c.set(cx + 5, 43, GLINT);
  c.set(cx - 9, 43, GLINT);
  c.set(cx + 9, 43, GLINT);

  // Frame 2: soaring bob upward — tail trails slightly
  const f2 = bobFrame(c, -1);
  f2.set(cx, 0, GLINT);
  f2.set(cx - 4, -1, 0);

  // Frame 3: bob down — crest sway alternate
  const f3 = bobFrame(c, 1);
  f3.set(cx - 1, 1, GLINT);
  f3.set(cx - 4, 0, GLINT);

  return buildSprite('sprite-halcyore', [c, f2, f3], 3);
}

// ---------------------------------------------------------------------------
// Apex: sprite-aurelion (48x48) — radiant leonine apex, flowing mane of light
// ---------------------------------------------------------------------------

export function buildAurelion(): SpriteDef {
  const W = 48;
  const H = 48;
  const cx = 24;

  const c = PixelCanvas.create(W, H);

  // ── BODY: proud upright lion, seated, facing viewer ──────────────────────
  // Haunches / lower body (wide seated base)
  fillEllipse(c, cx, 38, 13, 8, 8);
  // Torso — narrower above haunches
  fillEllipse(c, cx, 30, 11, 8, 9);
  // Broad leonine chest
  fillEllipse(c, cx, 23, 10, 7, 10);

  // ── HEAD: large, noble, centered ─────────────────────────────────────────
  // Main head ellipse
  fillEllipse(c, cx, 14, 9, 8, 10);
  // Cheek jowls (wider face) — left side only
  fillEllipse(c, cx - 6, 17, 5, 4, 9);
  // Snout / muzzle protrusion
  fillEllipse(c, cx, 19, 5, 4, 10);
  // Brow / forehead ridge
  fillEllipse(c, cx, 10, 7, 4, 9);

  // ── MANE: radiant ring of light-wisps around the head ────────────────────
  // Inner mane close-in (large filled ring segment, left side only)
  fillEllipse(c, cx - 9, 14, 7, 10, 8); // left inner mane lobe
  fillEllipse(c, cx - 11, 10, 6, 6, 7); // upper-left mane puff
  fillEllipse(c, cx - 8, 6, 5, 5, 8); // top-left mane wisp
  fillEllipse(c, cx - 5, 4, 4, 4, 7); // top mane crown

  // Flowing mane tendrils — bezier wisps left side
  bezier(c, cx - 10, 8, cx - 17, 2, cx - 15, 10, 7, 2, 1); // top wisp
  bezier(c, cx - 12, 13, cx - 20, 8, cx - 20, 18, 7, 2, 1); // side wisp
  bezier(c, cx - 11, 18, cx - 19, 16, cx - 18, 26, 6, 2, 1); // lower mane flow
  bezier(c, cx - 9, 22, cx - 17, 22, cx - 15, 30, 6, 2, 1); // mane shoulder flow

  // ── FRONT PAWS: symmetrical pair flanking center ─────────────────────────
  fillEllipse(c, cx - 7, 43, 5, 4, 8); // left paw pad
  // Toes
  c.set(cx - 9, 45, 7);
  c.set(cx - 8, 46, 7);
  c.set(cx - 7, 46, 7);
  c.set(cx - 6, 46, 7);
  c.set(cx - 5, 45, 7);

  mirrorX(c);

  // ── TAIL: sweeping arc right after mirror ─────────────────────────────────
  bezier(c, cx + 12, 36, cx + 20, 30, cx + 24, 22, 7, 3, 2);
  bezier(c, cx + 24, 22, cx + 26, 16, cx + 22, 12, 6, 2, 1);
  // Tail tuft — plume of light
  fillEllipse(c, cx + 22, 10, 5, 5, 8);
  bezier(c, cx + 22, 7, cx + 25, 3, cx + 20, 2, 7, 2, 1);

  // ── SHADING ───────────────────────────────────────────────────────────────
  shade(c, { dir: 'upper-left', bands: 12, lo: 3, hi: 12, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // ── FACE DETAILS ──────────────────────────────────────────────────────────
  // Fierce almond-shaped eyes with strong glint
  // Left eye
  c.set(cx - 5, 13, OUTLINE);
  c.set(cx - 4, 12, OUTLINE);
  c.set(cx - 4, 13, OUTLINE);
  c.set(cx - 3, 13, OUTLINE);
  c.set(cx - 4, 11, GLINT);
  c.set(cx - 5, 11, GLINT);
  // Right eye
  c.set(cx + 5, 13, OUTLINE);
  c.set(cx + 4, 12, OUTLINE);
  c.set(cx + 4, 13, OUTLINE);
  c.set(cx + 3, 13, OUTLINE);
  c.set(cx + 4, 11, GLINT);
  c.set(cx + 5, 11, GLINT);
  // Nose triangle
  c.set(cx - 1, 20, OUTLINE);
  c.set(cx, 19, OUTLINE);
  c.set(cx + 1, 20, OUTLINE);
  c.set(cx, 20, OUTLINE);
  // Mouth line
  thickLine(c, cx - 2, 21, cx + 2, 21, OUTLINE, 1);

  // ── MANE GLINTS: scattered radiant light points ───────────────────────────
  // Systematically place glints through the mane (left side — mane pixels exist there)
  const maneGlints: Array<[number, number]> = [
    [cx - 16, 3],
    [cx - 13, 2],
    [cx - 10, 4],
    [cx - 18, 9],
    [cx - 14, 6],
    [cx - 19, 14],
    [cx - 17, 18],
    [cx - 16, 24],
    [cx - 14, 28],
  ];
  for (const [gx, gy] of maneGlints) {
    if (c.get(gx, gy) > 0) c.set(gx, gy, GLINT);
  }
  // Mirror mane glints right side
  for (const [gx, gy] of maneGlints) {
    const rx = W - 1 - gx;
    if (c.get(rx, gy) > 0) c.set(rx, gy, GLINT);
  }

  // Tail tuft glint
  c.set(cx + 22, 8, GLINT);
  c.set(cx + 21, 4, GLINT);

  // ── AURA CROWN: radiant halo above head ───────────────────────────────────
  // Draw a faint crown ring — use RIM_LO to make it visible but lighter than outline
  strokeEllipse(c, cx, 7, 11, 3, RIM_LO);
  c.set(cx, 4, GLINT);
  c.set(cx - 8, 6, GLINT);
  c.set(cx + 8, 6, GLINT);
  c.set(cx - 4, 4, GLINT);
  c.set(cx + 4, 4, GLINT);

  // Frame 2: proud bob upward + mane shimmer surge
  const f2 = bobFrame(c, -1);
  f2.set(cx - 17, 4, GLINT);
  f2.set(cx + 17, 4, GLINT);
  f2.set(cx - 20, 13, GLINT);
  f2.set(cx + 20, 13, GLINT);
  f2.set(cx, 3, GLINT);

  // Frame 3: bob down (weight shift) + aura pulse radiates
  const f3 = bobFrame(c, 1);
  f3.set(cx - 9, 5, GLINT);
  f3.set(cx + 9, 5, GLINT);
  f3.set(cx - 13, 4, GLINT);
  f3.set(cx + 13, 4, GLINT);

  return buildSprite('sprite-aurelion', [c, f2, f3], 3);
}

// ---------------------------------------------------------------------------
// Apex: sprite-mindspire (48x48) — crystalline spire-being, fractal crown
// ---------------------------------------------------------------------------

export function buildMindspire(): SpriteDef {
  const W = 48;
  const H = 48;
  const cx = 24;

  const c = PixelCanvas.create(W, H);

  // Crystal spire body — tall narrow diamond lattice shape
  fillPolygon(
    c,
    [
      [cx, 4] as [number, number],
      [cx + 8, 14] as [number, number],
      [cx + 10, 26] as [number, number],
      [cx + 8, 36] as [number, number],
      [cx, 38] as [number, number],
      [cx - 8, 36] as [number, number],
      [cx - 10, 26] as [number, number],
      [cx - 8, 14] as [number, number],
    ],
    8,
  );

  // Crystal facets (inner light planes)
  fillPolygon(
    c,
    [
      [cx, 6] as [number, number],
      [cx + 6, 14] as [number, number],
      [cx + 7, 26] as [number, number],
      [cx, 10] as [number, number],
    ],
    11,
  );
  fillPolygon(
    c,
    [
      [cx, 6] as [number, number],
      [cx - 6, 14] as [number, number],
      [cx - 7, 26] as [number, number],
      [cx, 10] as [number, number],
    ],
    10,
  );

  // Base / roots — small floating crystal platform
  fillEllipse(c, cx, 40, 10, 3, 7);
  fillEllipse(c, cx, 40, 7, 2, 9);

  // Floating shards — left side (will mirror)
  fillPolygon(
    c,
    [
      [cx - 13, 18] as [number, number],
      [cx - 15, 22] as [number, number],
      [cx - 11, 24] as [number, number],
      [cx - 10, 19] as [number, number],
    ],
    9,
  );
  fillPolygon(
    c,
    [
      [cx - 15, 30] as [number, number],
      [cx - 17, 34] as [number, number],
      [cx - 13, 35] as [number, number],
      [cx - 12, 31] as [number, number],
    ],
    8,
  );

  mirrorX(c);

  // Fractal crown — tiered spire tips radiating upward from apex
  // Second tier spires (left side)
  fillPolygon(
    c,
    [
      [cx - 5, 4] as [number, number],
      [cx - 3, 7] as [number, number],
      [cx - 7, 8] as [number, number],
    ],
    10,
  );
  fillPolygon(
    c,
    [
      [cx - 3, 2] as [number, number],
      [cx - 1, 5] as [number, number],
      [cx - 5, 5] as [number, number],
    ],
    11,
  );
  // Right side (by hand since crown is near apex, mirror would overlap)
  fillPolygon(
    c,
    [
      [cx + 5, 4] as [number, number],
      [cx + 3, 7] as [number, number],
      [cx + 7, 8] as [number, number],
    ],
    10,
  );
  fillPolygon(
    c,
    [
      [cx + 3, 2] as [number, number],
      [cx + 1, 5] as [number, number],
      [cx + 5, 5] as [number, number],
    ],
    11,
  );
  // Top crown apex
  c.set(cx, 1, RIM_HI);
  c.set(cx - 1, 2, RIM_LO);
  c.set(cx + 1, 2, RIM_LO);

  shade(c, { dir: 'upper-left', bands: 11, lo: 3, hi: 12, dither: true });
  rimLight(c, 'upper-left');
  outline(c);

  // Crystal face — eye-like refractive core
  fillEllipse(c, cx, 22, 4, 3, 4); // face facet
  fillEllipse(c, cx, 22, 2, 2, 12); // eye glow
  c.set(cx, 22, GLINT);
  c.set(cx - 1, 21, GLINT);
  c.set(cx + 1, 21, GLINT);

  // Fractal glints along spire edges
  c.set(cx, 4, GLINT);
  c.set(cx, 12, GLINT);
  c.set(cx, 20, GLINT);
  c.set(cx - 8, 14, GLINT);
  c.set(cx + 8, 14, GLINT);
  c.set(cx - 10, 26, GLINT);
  c.set(cx + 10, 26, GLINT);

  // Shard glints
  c.set(cx - 13, 20, GLINT);
  c.set(cx + 13, 20, GLINT);
  c.set(cx - 15, 33, GLINT);
  c.set(cx + 15, 33, GLINT);

  // Platform glints
  c.set(cx - 5, 40, GLINT);
  c.set(cx + 5, 40, GLINT);

  // Frame 2: floating rise (bob up) + shard orbit shift
  const f2 = bobFrame(c, -2);
  // Shards drift slightly
  f2.set(cx - 14, 18, GLINT);
  f2.set(cx + 14, 18, GLINT);
  f2.set(cx - 16, 30, GLINT);
  f2.set(cx + 16, 30, GLINT);

  // Frame 3: bob down + crystal pulse
  const f3 = bobFrame(c, 1);
  f3.set(cx, 3, GLINT);
  f3.set(cx - 2, 3, GLINT);
  f3.set(cx + 2, 3, GLINT);

  return buildSprite('sprite-mindspire', [c, f2, f3], 3);
}

// ---------------------------------------------------------------------------
// Export — all Aether-line sprites
// ---------------------------------------------------------------------------

/** All Aether-line sprites (egg + species). */
export const aetherSprites: SpriteDef[] = [
  buildMote(),
  buildWisp(),
  buildAetherling(),
  buildMurmur(),
  buildOraclet(),
  buildCirrux(),
  buildNimbusk(),
  buildSeraphix(),
  buildThoughtwarden(),
  buildHalcyore(),
  buildAurelion(),
  buildMindspire(),
];
