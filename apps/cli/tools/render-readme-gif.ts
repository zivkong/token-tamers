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
import { FrameBuffer, HitRegistry, renderFrame, type Rgb } from '@token-tamers/tui';
import { contentPackV1 } from '@token-tamers/content';

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
const FRAMES = 63; // ~seamless loop for the sin-based shimmer/glint/twinkle
const FPS = 12;
const CW = 9;
const CH = 19;
const PAD = 16;
const BAR = 34;
const TERM_BG = '#0e1118';
const W = COLS * CW + PAD * 2;
const H = ROWS * CH + PAD * 2 + BAR;
const FONT =
  "ui-monospace,SFMono-Regular,Menlo,Monaco,'Apple Symbols','Arial Unicode MS',monospace";

const css = (c: Rgb | null, fallback: string): string =>
  c ? `rgb(${c.r},${c.g},${c.b})` : fallback;
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function frameToSvg(frame: number): string {
  const buf = new FrameBuffer(COLS, ROWS);
  const hits = new HitRegistry();
  renderFrame(buf, hits, {
    page: 'pet',
    state,
    pack: contentPackV1,
    mode: 'truecolor',
    frame,
    ui: { selected: 0, scroll: 0 },
    completionPct: 38.4,
    flash: 'GRADESHIFT! Aurelion ascends to [S] Aurum ✦',
  });

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="${W}" height="${H}" rx="12" fill="#161b26"/>`,
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="11" fill="none" stroke="#2c3445"/>`,
    `<circle cx="22" cy="${BAR / 2}" r="6" fill="#ff5f57"/>`,
    `<circle cx="42" cy="${BAR / 2}" r="6" fill="#febc2e"/>`,
    `<circle cx="62" cy="${BAR / 2}" r="6" fill="#28c840"/>`,
    `<text x="${W / 2}" y="${BAR / 2 + 4}" text-anchor="middle" font-family="${FONT}" font-size="12" fill="#8b93a7">tt — Token Tamers</text>`,
    `<rect x="${PAD - 6}" y="${BAR + PAD - 6}" width="${COLS * CW + 12}" height="${ROWS * CH + 12}" rx="6" fill="${TERM_BG}"/>`,
  ];
  const ox = PAD;
  const oy = BAR + PAD;

  // Pass 1: backgrounds; half-block cells become two crisp rects (no glyphs).
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = buf.get(x, y);
      const px = ox + x * CW;
      const py = oy + y * CH;
      if (cell.ch === '▀') {
        parts.push(
          `<rect x="${px}" y="${py}" width="${CW}" height="${CH / 2}" fill="${css(cell.fg, TERM_BG)}"/>`,
          `<rect x="${px}" y="${py + CH / 2}" width="${CW}" height="${CH / 2}" fill="${css(cell.bg, TERM_BG)}"/>`,
        );
      } else if (cell.bg) {
        parts.push(
          `<rect x="${px}" y="${py}" width="${CW}" height="${CH}" fill="${css(cell.bg, TERM_BG)}"/>`,
        );
      }
    }
  }

  // Pass 2: text runs, coalesced per row by color.
  for (let y = 0; y < ROWS; y++) {
    let start = -1;
    let fg = '';
    let text = '';
    const flush = () => {
      if (start >= 0 && text.trim().length > 0) {
        parts.push(
          `<text x="${ox + start * CW}" y="${oy + y * CH + CH - 5}" font-family="${FONT}" font-size="14" xml:space="preserve" textLength="${text.length * CW}" lengthAdjust="spacingAndGlyphs" fill="${fg}">${esc(text)}</text>`,
        );
      }
      start = -1;
      text = '';
    };
    for (let x = 0; x < COLS; x++) {
      const cell = buf.get(x, y);
      if (cell.ch === '▀') {
        flush();
        continue;
      }
      const color = css(cell.fg, '#c9d1e3');
      // Glyphs missing from magick's fontconfig fallback get lookalikes.
      const GLYPH_SUBS: Record<string, string> = {
        '☰': '≡',
        '◆': '♦',
        '⚙': '*',
        '★': '*',
        '✦': '+',
      };
      const ch = GLYPH_SUBS[cell.ch] ?? cell.ch;
      if (start >= 0 && color !== fg) flush();
      if (start < 0) {
        start = x;
        fg = color;
      }
      text += ch;
    }
    flush();
  }

  parts.push('</svg>');
  return parts.join('\n');
}

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
console.log(`wrote ${out} (${W}x${H}, ${FRAMES} frames @ ${FPS}fps)`);
