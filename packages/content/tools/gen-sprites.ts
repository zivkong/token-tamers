/**
 * Deterministic placeholder sprite generator for Token Tamers v1 content pack.
 *
 * Approach:
 *  - All grids are generated algorithmically from a seed derived from the sprite id.
 *  - No Math.random() — a simple deterministic LCG keyed on a string hash is used.
 *  - Every pet sprite is 24x24 pixels, 2 idle frames, palette indices 1–7 + 0 transparent.
 *  - Index 1 = 1px outline (dark border), indices 2–7 = body fill / shading.
 *  - Aether species: wispy/cloud silhouette shapes (oval blobs, soft edges).
 *  - Cipher species: angular/geometric shapes (hexagonal/diamond bodies).
 *  - Mote (egg): small ellipse.
 *  - Habitats: 96x36 sparse background grids.
 *  - Trinkets: 8x8 grids.
 *
 * Run with: pnpm tsx packages/content/tools/gen-sprites.ts
 * Output: packages/content/content/sprites.json
 *
 * TODO art pass: replace these placeholder grids with hand-crafted sprites before
 * release. The format (SpriteDef with palette-indexed frames) is production-ready.
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Deterministic LCG (no Math.random)
// ---------------------------------------------------------------------------
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}

function makeLcg(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ---------------------------------------------------------------------------
// Shape helpers
// ---------------------------------------------------------------------------

/** Fill a grid cell if inside an ellipse centered at (cx,cy) with radii (rx,ry). */
function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = x - cx;
  const dy = y - cy;
  return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
}

/** Fill a grid cell if inside a diamond centered at (cx,cy) with radii (rx,ry). */
function inDiamond(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  return Math.abs(x - cx) / rx + Math.abs(y - cy) / ry <= 1;
}

/** Fill a grid cell if inside a hexagon centered at (cx,cy) with radius r. */
function inHex(x: number, y: number, cx: number, cy: number, r: number): boolean {
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  return dx <= r * 0.866 && dy <= r && 0.5 * dx + dy <= r;
}

// ---------------------------------------------------------------------------
// Pet sprite generation (24x24)
// ---------------------------------------------------------------------------

type ShapeKind = 'wispy' | 'angular';

interface SpriteFramePair {
  id: string;
  width: number;
  height: number;
  frames: number[][][];
  fps: number;
}

function emptyGrid(w: number, h: number): number[][] {
  return Array.from({ length: h }, () => Array(w).fill(0) as number[]);
}

function cloneGrid(g: number[][]): number[][] {
  return g.map((row) => [...row]);
}

function outline(grid: number[][], w: number, h: number): void {
  // Set border pixels of filled cells to index 1 (dark outline)
  const filled = (x: number, y: number): boolean =>
    x >= 0 && x < w && y >= 0 && y < h && (grid[y]?.[x] ?? 0) > 0;

  const isBorder = (x: number, y: number): boolean => {
    if (!filled(x, y)) return false;
    return !filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1);
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isBorder(x, y)) {
        grid[y]![x] = 1;
      }
    }
  }
}

function generatePetSprite(id: string, shape: ShapeKind, stage: string): SpriteFramePair {
  const W = 24,
    H = 24;
  const rng = makeLcg(hashStr(id));
  const cx = 12,
    cy = 12;

  // Stage-based size scaling
  const stageScale: Record<string, number> = {
    egg: 0.5,
    sprite: 0.6,
    rookie: 0.65,
    evolved: 0.75,
    prime: 0.85,
    apex: 0.95,
  };
  const scale = stageScale[stage] ?? 0.7;

  // Frame 1 — base
  const base = emptyGrid(W, H);

  if (shape === 'wispy') {
    const rx = Math.round(8 * scale);
    const ry = Math.round(9 * scale);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (inEllipse(x, y, cx, cy - 1, rx, ry)) {
          // Shading: center lighter (index 4), outer darker (index 2/3)
          const dist = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy + 1) / ry) ** 2);
          base[y]![x] = dist < 0.4 ? 5 : dist < 0.65 ? 4 : dist < 0.85 ? 3 : 2;
        }
      }
    }
    // Add a small accent blob (wing-like protrusions)
    const wingRx = Math.round(4 * scale);
    const wingRy = Math.round(3 * scale);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (base[y]![x] === 0) {
          if (
            inEllipse(x, y, cx - Math.round(7 * scale), cy + 1, wingRx, wingRy) ||
            inEllipse(x, y, cx + Math.round(7 * scale), cy + 1, wingRx, wingRy)
          ) {
            base[y]![x] = 6;
          }
        }
      }
    }
    // "Eyes" — index 7 (bright accent)
    const eyeY = cy - Math.round(3 * scale);
    const eyeOff = Math.round(3 * scale);
    if (eyeY >= 0 && eyeY < H) {
      if (cx - eyeOff >= 0) base[eyeY]![cx - eyeOff] = 7;
      if (cx + eyeOff < W) base[eyeY]![cx + eyeOff] = 7;
    }
  } else {
    // Angular / cipher shapes: hexagon body with diamond accent
    const r = Math.round(8 * scale);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (inHex(x, y, cx, cy, r)) {
          const dist = Math.max(Math.abs(x - cx) / r, Math.abs(y - cy) / r);
          base[y]![x] = dist < 0.3 ? 5 : dist < 0.55 ? 4 : dist < 0.75 ? 3 : 2;
        }
      }
    }
    // Diamond accent on top
    const dr = Math.round(4 * scale);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (base[y]![x] === 0 && inDiamond(x, y, cx, cy - Math.round(6 * scale), dr, dr)) {
          base[y]![x] = 6;
        }
      }
    }
    // Glyph-dots (eyes / data nodes) — index 7
    const eyeY = cy - Math.round(2 * scale);
    const eyeOff = Math.round(2 * scale);
    if (eyeY >= 0 && eyeY < H) {
      if (cx - eyeOff >= 0) base[eyeY]![cx - eyeOff] = 7;
      if (cx + eyeOff < W) base[eyeY]![cx + eyeOff] = 7;
    }
  }

  outline(base, W, H);

  // Frame 2 — subtle shift (pulse/flicker)
  const frame2 = cloneGrid(base);
  const shiftCnt = Math.round(rng() * 4) + 2;
  for (let i = 0; i < shiftCnt; i++) {
    const x = Math.floor(rng() * W);
    const y = Math.floor(rng() * H);
    if ((frame2[y]?.[x] ?? 0) > 1) {
      const orig = frame2[y]![x]!;
      frame2[y]![x] = orig === 5 ? 6 : orig === 6 ? 5 : orig;
    }
  }

  return { id, width: W, height: H, frames: [base, frame2], fps: 2 };
}

// ---------------------------------------------------------------------------
// Habitat sprite generation (96x36)
// ---------------------------------------------------------------------------

function generateHabitatSprite(id: string, style: string): SpriteFramePair {
  const W = 96,
    H = 36;
  const rng = makeLcg(hashStr(id));
  const grid = emptyGrid(W, H);

  if (style === 'terminal') {
    // Solid background with sparse "terminal glow" dots
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        grid[y]![x] = 2; // base fill
      }
    }
    // Sparse bright pixels — terminal phosphor dots
    const dotCount = 40;
    for (let i = 0; i < dotCount; i++) {
      const x = Math.floor(rng() * W);
      const y = Math.floor(rng() * H);
      grid[y]![x] = 5;
    }
    // Horizontal scanlines
    for (let y = 2; y < H; y += 4) {
      for (let x = 0; x < W; x++) {
        if (grid[y]![x] === 2) grid[y]![x] = 3;
      }
    }
  } else if (style === 'meadow') {
    // Sky (top half) + ground (bottom half)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        grid[y]![x] = y < H / 2 ? 4 : 3;
      }
    }
    // Horizon line
    const horizY = Math.floor(H / 2);
    for (let x = 0; x < W; x++) grid[horizY]![x] = 2;
    // Grass tufts
    const tuftCount = 15;
    for (let i = 0; i < tuftCount; i++) {
      const tx = Math.floor(rng() * (W - 4)) + 2;
      const ty = horizY + 1;
      grid[ty]![tx] = 5;
      if (tx + 1 < W) grid[ty]![tx + 1] = 5;
      if (ty - 1 >= 0) grid[ty - 1]![tx] = 6;
    }
    // Clouds (sparse ellipses at index 7 on sky)
    for (let ci = 0; ci < 3; ci++) {
      const ccx = Math.floor(rng() * (W - 12)) + 6;
      const ccy = Math.floor(rng() * (horizY - 4)) + 2;
      for (let y = 0; y < horizY; y++) {
        for (let x = 0; x < W; x++) {
          if (inEllipse(x, y, ccx, ccy, 6, 3)) grid[y]![x] = 7;
        }
      }
    }
  } else {
    // Rooftop night: dark background with stars
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        grid[y]![x] = 1; // dark
      }
    }
    // City silhouette at bottom
    for (let bx = 0; bx < W; bx += Math.floor(rng() * 6) + 4) {
      const bh = Math.floor(rng() * 8) + 4;
      for (let by = H - bh; by < H; by++) {
        for (let bw = 0; bw < Math.floor(rng() * 6) + 3 && bx + bw < W; bw++) {
          grid[by]![bx + bw] = 2;
        }
      }
    }
    // Stars
    for (let i = 0; i < 30; i++) {
      const sx = Math.floor(rng() * W);
      const sy = Math.floor(rng() * (H - 10));
      grid[sy]![sx] = 7;
    }
    // Moon
    const mx = Math.floor(rng() * 20) + 10;
    const my = Math.floor(rng() * 6) + 3;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (inEllipse(x, y, mx, my, 5, 5)) grid[y]![x] = 6;
      }
    }
  }

  return { id, width: W, height: H, frames: [grid], fps: 1 };
}

// ---------------------------------------------------------------------------
// Trinket sprite generation (8x8)
// ---------------------------------------------------------------------------

function generateTrinketSprite(id: string): SpriteFramePair {
  const W = 8,
    H = 8;
  const rng = makeLcg(hashStr(id));
  const grid = emptyGrid(W, H);

  // Each trinket gets a distinct small icon based on id hash
  const variant = hashStr(id) % 6;
  const cx = 4,
    cy = 4;

  if (variant === 0) {
    // Ball — circle
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) if (inEllipse(x, y, cx, cy, 3, 3)) grid[y]![x] = variant + 2;
    grid[2]![5] = 7; // highlight
  } else if (variant === 1) {
    // Cushion — flat rectangle
    for (let y = 2; y < 6; y++) for (let x = 1; x < 7; x++) grid[y]![x] = 3;
    for (let x = 1; x < 7; x++) {
      grid[2]![x] = 4;
      grid[5]![x] = 2;
    }
    grid[3]![3] = 6;
    grid[3]![4] = 6;
  } else if (variant === 2) {
    // Lava lamp — tall oval
    for (let y = 1; y < 7; y++)
      for (let x = 2; x < 6; x++) if (inEllipse(x, y, 4, 4, 2, 3)) grid[y]![x] = 4;
    grid[2]![3] = 6;
    grid[2]![4] = 6;
    grid[1]![4] = 7;
    grid[5]![3] = 3;
    grid[6]![4] = 3;
  } else if (variant === 3) {
    // Bonsai — triangle + trunk
    for (let y = 1; y < 5; y++)
      for (let x = 1; x < 7; x++) if (Math.abs(x - 4) <= 3 - y) grid[y]![x] = 5;
    grid[5]![3] = 2;
    grid[5]![4] = 2;
    grid[6]![3] = 2;
    grid[6]![4] = 2;
    grid[7]![2] = 3;
    grid[7]![3] = 3;
    grid[7]![4] = 3;
    grid[7]![5] = 3;
  } else if (variant === 4) {
    // Gift box — square with ribbon
    for (let y = 2; y < 7; y++) for (let x = 1; x < 7; x++) grid[y]![x] = 4;
    for (let x = 1; x < 7; x++) grid[2]![x] = 2;
    for (let y = 2; y < 7; y++) grid[y]![3] = 2;
    grid[2]![3] = 7;
    grid[2]![4] = 7;
  } else {
    // Trophy — star/cup shape
    for (let x = 2; x < 6; x++) {
      grid[1]![x] = 6;
      grid[2]![x] = 6;
      grid[3]![x] = 6;
    }
    grid[1]![1] = 5;
    grid[1]![6] = 5;
    grid[2]![1] = 5;
    grid[2]![6] = 5;
    grid[3]![2] = 5;
    grid[3]![5] = 5;
    grid[4]![3] = 4;
    grid[4]![4] = 4;
    grid[5]![2] = 3;
    grid[5]![3] = 3;
    grid[5]![4] = 3;
    grid[5]![5] = 3;
    for (let x = 1; x < 7; x++) grid[6]![x] = 2;
    grid[3]![3] = 7;
    grid[3]![4] = 7; // shine
  }

  // Ensure unique pixel variants per id
  const tweakX = Math.floor(rng() * W);
  const tweakY = Math.floor(rng() * H);
  if ((grid[tweakY]?.[tweakX] ?? 0) > 1) grid[tweakY]![tweakX] = 7;

  outline(grid, W, H);

  return { id, width: W, height: H, frames: [grid], fps: 1 };
}

// ---------------------------------------------------------------------------
// Main: generate all sprites
// ---------------------------------------------------------------------------

interface SpriteDef {
  id: string;
  width: number;
  height: number;
  frames: number[][][];
  fps: number;
}

const sprites: SpriteDef[] = [];

// Mote (egg)
sprites.push(generatePetSprite('sprite-mote', 'wispy', 'egg'));

// Aether line
sprites.push(generatePetSprite('sprite-wisp', 'wispy', 'sprite'));
sprites.push(generatePetSprite('sprite-aetherling', 'wispy', 'rookie'));
sprites.push(generatePetSprite('sprite-murmur', 'wispy', 'rookie'));
sprites.push(generatePetSprite('sprite-oraclet', 'wispy', 'evolved'));
sprites.push(generatePetSprite('sprite-cirrux', 'wispy', 'evolved'));
sprites.push(generatePetSprite('sprite-nimbusk', 'wispy', 'evolved'));
sprites.push(generatePetSprite('sprite-seraphix', 'wispy', 'prime'));
sprites.push(generatePetSprite('sprite-thoughtwarden', 'wispy', 'prime'));
sprites.push(generatePetSprite('sprite-halcyore', 'wispy', 'prime'));
sprites.push(generatePetSprite('sprite-aurelion', 'wispy', 'apex'));
sprites.push(generatePetSprite('sprite-mindspire', 'wispy', 'apex'));

// Cipher line
sprites.push(generatePetSprite('sprite-glyphit', 'angular', 'sprite'));
sprites.push(generatePetSprite('sprite-cipherling', 'angular', 'rookie'));
sprites.push(generatePetSprite('sprite-bitfang', 'angular', 'rookie'));
sprites.push(generatePetSprite('sprite-runeclaw', 'angular', 'evolved'));
sprites.push(generatePetSprite('sprite-vectorix', 'angular', 'evolved'));
sprites.push(generatePetSprite('sprite-glyphound', 'angular', 'evolved'));
sprites.push(generatePetSprite('sprite-cryptarch', 'angular', 'prime'));
sprites.push(generatePetSprite('sprite-matrixion', 'angular', 'prime'));
sprites.push(generatePetSprite('sprite-sigilus', 'angular', 'prime'));
sprites.push(generatePetSprite('sprite-enigmax', 'angular', 'apex'));
sprites.push(generatePetSprite('sprite-keystrix', 'angular', 'apex'));

// Habitats
sprites.push(generateHabitatSprite('habitat-terminal-den', 'terminal'));
sprites.push(generateHabitatSprite('habitat-meadow', 'meadow'));
sprites.push(generateHabitatSprite('habitat-rooftop-night', 'rooftop'));

// Trinkets
sprites.push(generateTrinketSprite('trinket-bouncy-ball'));
sprites.push(generateTrinketSprite('trinket-cushion'));
sprites.push(generateTrinketSprite('trinket-lava-lamp'));
sprites.push(generateTrinketSprite('trinket-bonsai'));
sprites.push(generateTrinketSprite('trinket-gift-box'));
sprites.push(generateTrinketSprite('trinket-trophy-shelf'));

const outPath = join(__dirname, '../content/sprites.json');
writeFileSync(outPath, JSON.stringify(sprites, null, 2));
console.log(`Wrote ${sprites.length} sprites to ${outPath}`);
