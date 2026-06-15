/**
 * preview-sprite — the visual feedback loop for sprite authoring.
 *
 * Renders sprites straight from the CURRENT generator output (the design
 * modules are imported directly, NOT sprites.json) so artists preview unsaved
 * work-in-progress. Each palette index is resolved to RGB via the real
 * @token-tamers/tui `buildPalette` + the species House tint (wild tint for
 * non-species sprites), then drawn as an 8x8 PNG block on a dark backdrop.
 *
 *   pnpm tsx packages/content/tools/preview-sprite.ts <sprite-id|ALL> <out.png> [--grade S] [--frame 0]
 *
 * Examples:
 *   pnpm tsx packages/content/tools/preview-sprite.ts sprite-wisp /tmp/wisp.png --grade S
 *   pnpm tsx packages/content/tools/preview-sprite.ts ALL /tmp/sheet.png
 *
 * PNG is produced dependency-free by writing a binary PPM (P6) and shelling out
 * to `magick` (ImageMagick, on PATH) to convert PPM -> PNG. No npm image deps.
 *
 * NOTE ON IMPORT BOUNDARY: packages/content/src must NOT import @token-tamers/tui.
 * This file lives under tools/ (dev-only, outside src/) where that ESLint
 * boundary rule does not apply — so importing the tui palette here is allowed.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';

import type { Grade, House, SpriteDef } from '@token-tamers/core';
// Dev-only tool: import the tui palette helpers from source directly. content's
// package.json does NOT depend on @token-tamers/tui (and src/ must never import
// it — import-boundary invariant), so we reach the source path explicitly here
// rather than via the package specifier. tsx resolves the .ts source.
import {
  buildPalette,
  paletteFromHexes,
  resolveIndex,
  type AnimBank,
  type Palette,
} from '../../tui/src/render/sprite';

import { aetherSprites } from './designs/aether';
import { cipherSprites } from './designs/cipher';
import { fluxSprites } from './designs/flux';
import { forgeSprites } from './designs/forge';
import { sceneSprites } from './designs/scenes';
import speciesRaw from '../content/species.json' with { type: 'json' };
import habitatsRaw from '../content/habitats.json' with { type: 'json' };

/** Anim banks shown in the contact sheet as horizontal strips. */
const ANIM_STRIP_BANKS: AnimBank[] = ['walk', 'jump', 'play'];

// ---------------------------------------------------------------------------
// Tint resolution (species -> House -> tint; wild for scenery/egg).
// ---------------------------------------------------------------------------

// Mirror of the renderer's canonical HOUSE_ACCENT (packages/tui helpers/lookup.ts);
// kept in sync by hand since content cannot import tui.
const HOUSE_TINT: Record<House, string> = {
  aether: '#38bdf8',
  cipher: '#f87171',
  flux: '#f472b6',
  forge: '#ff8c42',
  wild: '#9aa6c4',
};

interface SpeciesLike {
  spriteId: string;
  house: House | 'hybrid';
}
const SPRITE_HOUSE = new Map<string, House>();
for (const s of speciesRaw as SpeciesLike[]) {
  SPRITE_HOUSE.set(s.spriteId, s.house === 'hybrid' ? 'aether' : s.house);
}

interface HabitatLike {
  spriteId: string;
  tint?: string;
  palette?: string[];
}
/** Habitat sprite id -> its own scene palette (multi-color) when it ships one. */
const HABITAT_PALETTE = new Map<string, string[]>();
for (const h of habitatsRaw as HabitatLike[]) {
  if (h.palette && h.palette.length > 0) HABITAT_PALETTE.set(h.spriteId, h.palette);
}

function tintFor(spriteId: string): string {
  const house = SPRITE_HOUSE.get(spriteId);
  return HOUSE_TINT[house ?? 'wild'];
}

/**
 * The palette a sprite renders with: a habitat with its own `palette` uses those
 * exact hexes (no grade ladder); everything else uses the House-tint grade ramp.
 */
function paletteFor(spriteId: string, grade: Grade, frame: number): Palette {
  const scene = HABITAT_PALETTE.get(spriteId);
  if (scene) return paletteFromHexes(scene);
  return buildPalette(tintFor(spriteId), grade, frame);
}

/** Pick the frame list for an anim bank, falling back to the idle frames. */
function bankFrames(sprite: SpriteDef, bank: AnimBank): number[][][] {
  if (bank === 'idle') return sprite.frames;
  const banked = (sprite as Record<string, unknown>)[bank];
  return Array.isArray(banked) && banked.length > 0 ? (banked as number[][][]) : sprite.frames;
}

// ---------------------------------------------------------------------------
// Current generator output (imported directly so WIP previews without saving).
// ---------------------------------------------------------------------------

function allSprites(): SpriteDef[] {
  return [...aetherSprites, ...cipherSprites, ...fluxSprites, ...forgeSprites, ...sceneSprites];
}

// ---------------------------------------------------------------------------
// Tiny RGB raster + PPM encoder (P6, binary). magick converts it to PNG.
// ---------------------------------------------------------------------------

interface Rgb {
  r: number;
  g: number;
  b: number;
}
const BACKDROP: Rgb = { r: 18, g: 18, b: 24 };
const SEPARATOR: Rgb = { r: 60, g: 60, b: 80 };

class Raster {
  readonly width: number;
  readonly height: number;
  private readonly buf: Uint8Array;

  constructor(width: number, height: number, fill: Rgb = BACKDROP) {
    this.width = width;
    this.height = height;
    this.buf = new Uint8Array(width * height * 3);
    for (let i = 0; i < width * height; i++) {
      this.buf[i * 3] = fill.r;
      this.buf[i * 3 + 1] = fill.g;
      this.buf[i * 3 + 2] = fill.b;
    }
  }

  setPx(x: number, y: number, c: Rgb): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const i = (y * this.width + x) * 3;
    this.buf[i] = c.r;
    this.buf[i + 1] = c.g;
    this.buf[i + 2] = c.b;
  }

  /** Fill an axis-aligned block [x,x+w) x [y,y+h). */
  fillBlock(x: number, y: number, w: number, h: number, c: Rgb): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.setPx(xx, yy, c);
    }
  }

  /** Binary PPM (P6) bytes. */
  toPpm(): Buffer {
    const header = Buffer.from(`P6\n${this.width} ${this.height}\n255\n`, 'ascii');
    return Buffer.concat([header, Buffer.from(this.buf)]);
  }
}

/** Render one sprite's grid into the raster at (ox,oy), `scale` px per pixel. */
function blitSprite(
  raster: Raster,
  sprite: SpriteDef,
  pal: Palette,
  ox: number,
  oy: number,
  scale: number,
  frame: number,
  bank: AnimBank = 'idle',
): void {
  const frames = bankFrames(sprite, bank);
  const grid = frames[frame % frames.length] ?? frames[0] ?? [];
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y] ?? [];
    for (let x = 0; x < row.length; x++) {
      const idx = row[x] ?? 0;
      if (idx <= 0) continue; // transparent -> backdrop shows through
      const rgb = resolveIndex(pal, idx);
      if (!rgb) continue;
      raster.fillBlock(ox + x * scale, oy + y * scale, scale, scale, {
        r: Math.round(rgb.r),
        g: Math.round(rgb.g),
        b: Math.round(rgb.b),
      });
    }
  }
}

function writePng(raster: Raster, outPath: string): void {
  const tmpPpm = `${outPath}.ppm`;
  writeFileSync(tmpPpm, raster.toPpm());
  try {
    execFileSync('magick', [tmpPpm, outPath], { stdio: 'inherit' });
  } finally {
    try {
      unlinkSync(tmpPpm);
    } catch {
      // best-effort cleanup
    }
  }
}

// ---------------------------------------------------------------------------
// Single-sprite render.
// ---------------------------------------------------------------------------

const SCALE = 8; // default px per sprite pixel
const SMALL_SCALE = 16; // small sprites (<24px) blow up so they stay reviewable
const SMALL_THRESHOLD = 24; // a sprite narrower/shorter than this is "small"
const PAD = 8; // backdrop padding around a single sprite

/** Tiny sprites must be reviewable: double the scale below the threshold. */
function scaleFor(w: number, h: number): number {
  return Math.max(w, h) < SMALL_THRESHOLD ? SMALL_SCALE : SCALE;
}

function renderOne(
  sprite: SpriteDef,
  grade: Grade,
  frame: number,
  bank: AnimBank,
  outPath: string,
): void {
  const frames = bankFrames(sprite, bank);
  const grid = frames[frame % frames.length] ?? frames[0] ?? [];
  const w = grid[0]?.length ?? sprite.width;
  const h = grid.length || sprite.height;
  const scale = scaleFor(w, h);
  const raster = new Raster(w * scale + PAD * 2, h * scale + PAD * 2);
  const pal = paletteFor(sprite.id, grade, frame);
  blitSprite(raster, sprite, pal, PAD, PAD, scale, frame, bank);
  writePng(raster, outPath);
  console.log(
    `Rendered ${sprite.id} (${w}x${h}, grade ${grade}, anim ${bank}, frame ${frame}, ${scale}x) -> ${outPath}`,
  );
}

// ---------------------------------------------------------------------------
// Contact-sheet render (ALL).
// ---------------------------------------------------------------------------

const SHEET_SCALE = 4; // smaller blocks so the whole pack fits
const CELL_PAD = 6;
const SEP = 2; // separator bar thickness between cells
const STRIP_SCALE = 2; // anim-strip blocks (small, beneath the idle render)
const STRIP_GAP = 2; // gap between anim-strip frames

function maxDims(sprites: SpriteDef[]): { maxW: number; maxH: number } {
  let maxW = 0;
  let maxH = 0;
  for (const s of sprites) {
    const g = s.frames[0] ?? [];
    maxW = Math.max(maxW, g[0]?.length ?? s.width);
    maxH = Math.max(maxH, g.length || s.height);
  }
  return { maxW, maxH };
}

/** Height reserved under the idle render for the walk/jump/play strips. */
function stripBandHeight(maxH: number): number {
  // One row per bank: each strip is the sprite height at STRIP_SCALE.
  return ANIM_STRIP_BANKS.length * (maxH * STRIP_SCALE + STRIP_GAP);
}

/** Draw the walk/jump/play strips for one sprite under its idle render. */
function drawAnimStrips(
  raster: Raster,
  sprite: SpriteDef,
  grade: Grade,
  frame: number,
  ox: number,
  oy: number,
): void {
  const pal = paletteFor(sprite.id, grade, frame);
  let y = oy;
  for (const bank of ANIM_STRIP_BANKS) {
    const frames = bankFrames(sprite, bank);
    const has = sprite[bank] !== undefined;
    // Mark missing banks with a thin dim bar so the sheet still shows the slot.
    if (!has) {
      raster.fillBlock(ox, y, 8 * STRIP_SCALE, 2, SEPARATOR);
      y += (sprite.frames[0]?.length ?? sprite.height) * STRIP_SCALE + STRIP_GAP;
      continue;
    }
    let x = ox;
    for (let f = 0; f < frames.length; f++) {
      blitSprite(raster, sprite, pal, x, y, STRIP_SCALE, f, bank);
      x += (frames[f]?.[0]?.length ?? sprite.width) * STRIP_SCALE + STRIP_GAP;
    }
    y += (frames[0]?.length ?? sprite.height) * STRIP_SCALE + STRIP_GAP;
  }
}

function renderSheet(sprites: SpriteDef[], grade: Grade, frame: number, outPath: string): void {
  // Cell size = largest sprite (habitats are 96x36) so the grid is uniform.
  const { maxW, maxH } = maxDims(sprites);
  const stripBand = stripBandHeight(maxH);
  const cellW = maxW * SHEET_SCALE + CELL_PAD * 2;
  const cellH = maxH * SHEET_SCALE + CELL_PAD * 2 + 4 + stripBand; // +4 label bar
  const cols = Math.min(6, Math.ceil(Math.sqrt(sprites.length)));
  const rows = Math.ceil(sprites.length / cols);

  const raster = new Raster(cols * cellW + SEP, rows * cellH + SEP);

  // Separator grid.
  for (let cxi = 0; cxi <= cols; cxi++) {
    raster.fillBlock(cxi * cellW, 0, SEP, rows * cellH + SEP, SEPARATOR);
  }
  for (let cyi = 0; cyi <= rows; cyi++) {
    raster.fillBlock(0, cyi * cellH, cols * cellW + SEP, SEP, SEPARATOR);
  }

  console.log(`Contact sheet: ${sprites.length} sprites, ${cols}x${rows} grid, grade ${grade}`);
  console.log('Legend (cell index -> sprite id, tint); each cell shows idle + walk/jump/play:');
  sprites.forEach((sprite, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ox = col * cellW + SEP + CELL_PAD;
    const oy = row * cellH + SEP + CELL_PAD;
    const pal = paletteFor(sprite.id, grade, frame);
    blitSprite(raster, sprite, pal, ox, oy, SHEET_SCALE, frame);
    // A small tint-colored label bar under each sprite (no font rendering).
    const t = hexToRgb(tintFor(sprite.id));
    const labelY = oy + maxH * SHEET_SCALE + 2;
    raster.fillBlock(ox, labelY, maxW * SHEET_SCALE, 3, t);
    drawAnimStrips(raster, sprite, grade, frame, ox, labelY + 6);
    console.log(`  [${String(i).padStart(2)}] ${sprite.id} (${tintFor(sprite.id)})`);
  });

  writePng(raster, outPath);
  console.log(`Wrote contact sheet -> ${outPath}`);
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): {
  target: string;
  out: string;
  grade: Grade;
  frame: number;
  anim: AnimBank;
} {
  const positional: string[] = [];
  let grade: Grade = 'S';
  let frame = 0;
  let anim: AnimBank = 'idle';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--grade') {
      grade = (argv[++i] ?? 'S') as Grade;
    } else if (a === '--frame') {
      frame = Number(argv[++i] ?? 0) || 0;
    } else if (a === '--anim') {
      anim = (argv[++i] ?? 'idle') as AnimBank;
    } else if (a) {
      positional.push(a);
    }
  }
  const target = positional[0];
  const out = positional[1];
  if (!target || !out) {
    console.error(
      'Usage: preview-sprite.ts <sprite-id|ALL> <out.png> [--grade C|B|A|S] [--frame N] [--anim walk|jump|play]',
    );
    process.exit(1);
  }
  return { target, out, grade, frame, anim };
}

function main(): void {
  const { target, out, grade, frame, anim } = parseArgs(process.argv.slice(2));
  const sprites = allSprites();

  if (target.toUpperCase() === 'ALL') {
    renderSheet(sprites, grade, frame, out);
    return;
  }

  const sprite = sprites.find((s) => s.id === target);
  if (!sprite) {
    console.error(`Unknown sprite id '${target}'. Known ids:`);
    for (const s of sprites) console.error(`  ${s.id}`);
    process.exit(1);
  }
  renderOne(sprite, grade, frame, anim, out);
}

main();
