/**
 * Renders the animated README hero: the REAL TUI shell (pet page, rooftop-night
 * habitat, S-grade Aurum pet with traveling shimmer + particle aura, menu bar)
 * captured over a full animation loop and encoded as a GIF.
 *
 * Run from the repo root:  pnpm tsx apps/cli/tools/render-readme-gif.ts
 * Requires: ImageMagick (`magick`) and `ffmpeg` on PATH (dev-machine tool only).
 * Output:   docs/assets/readme-shell.gif
 *
 * Pipeline per frame: renderFrame() -> cell grid -> SVG (half-blocks drawn as
 * crisp rects, text run-coalesced) -> magick rasterize -> ffmpeg GIF encode.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GameState } from '@token-tamers/core';
import { contentPackV1 } from '@token-tamers/content';
import { shellFrameToSvg } from './frame-svg';

// --- demo state: S-grade Aurum apex, Vigil pattern, at home on the rooftop ------

const state: GameState = {
  schemaVersion: 1,
  pet: {
    speciesId: 'aurelion',
    stage: 'apex',
    house: 'aether',
    grade: 'S',
    traits: ['marathoner', 'nightshade', 'deepdiver'],
    pattern: 'vigil',
    rhythmVariant: 'nocturne',
    stats: { pwr: 26, spd: 28, wis: 41, grt: 25 },
    moltCount: 23,
    generation: 7,
    hatchedAt: 0,
    dormant: false,
    calibrating: false,
    dietGenes: { 'gene-claude': 1 },
    mutations: [],
    lastGradeRoll: { from: 'A', to: 'S', chance: 0.052, succeeded: true },
  },
  dexOwned: ['mote', 'wisp', 'aetherling', 'oraclet', 'cirrux', 'seraphix', 'aurelion'],
  archive: [],
  achievementsEarned: {},
  habitatsUnlocked: ['terminal-den', 'rooftop-night'],
  trinketsUnlocked: ['lava-lamp'],
  selectedHabitat: 'rooftop-night',
  selectedTrinkets: ['lava-lamp'],
  baselines: { 'claude-code': { meanWindowTokens: 1, windowsObserved: 40 } },
  rngState: 1,
  simulatedTo: 0,
  lineage: [],
};

// --- render parameters ------------------------------------------------------------

const COLS = 118;
const ROWS = 36;
// One full wander cycle (pet.ts CYCLE = 144): idle -> walk right -> hop ->
// walk left -> play beside the trinket. The sin-based shimmer/glint/twinkle are
// seamless at any frame count, so 144 loops cleanly while showing Aurelion
// WANDERING the rooftop rather than standing still.
const FRAMES = 144;
const FPS = 12;

const frameToSvg = (frame: number): string =>
  shellFrameToSvg({
    page: 'pet',
    state,
    pack: contentPackV1,
    frame,
    cols: COLS,
    rows: ROWS,
    completionPct: 38.4,
    flash: 'GRADESHIFT! Aurelion ascends to [S] Aurum ✦',
  });

// --- rasterize + encode -------------------------------------------------------------

const tmp = mkdtempSync(join(tmpdir(), 'tt-readme-gif-'));
for (let f = 0; f < FRAMES; f++) {
  const svgPath = join(tmp, `frame-${String(f).padStart(3, '0')}.svg`);
  writeFileSync(svgPath, frameToSvg(f));
  execFileSync('magick', [svgPath, svgPath.replace(/\.svg$/, '.png')]);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '../../../docs/assets');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, 'readme-shell.gif');
execFileSync('ffmpeg', [
  '-y',
  '-framerate',
  String(FPS),
  '-i',
  join(tmp, 'frame-%03d.png'),
  '-vf',
  'split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=none',
  '-loop',
  '0',
  out,
]);
rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${out} (${FRAMES} frames @ ${FPS}fps)`);
