/**
 * UI design loop: render any shell page to a PNG so layout/spacing/color work
 * can be reviewed visually.
 *
 *   pnpm tsx apps/cli/tools/render-page-preview.ts <pet|dex|archive> <out.png>
 *     [--cols 118] [--rows 36] [--frame 12] [--selected 2] [--flash]
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GameState } from '@token-tamers/core';
import type { PageId } from '@token-tamers/tui';
import { contentPackV1 } from '@token-tamers/content';
import { shellFrameToSvg } from './frame-svg';

const args = process.argv.slice(2);
const page = (args[0] ?? 'pet') as PageId;
const out = args[1] ?? `/tmp/tt-page-${page}.png`;
const flag = (name: string, dflt: number): number => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : dflt;
};

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
  dexOwned: ['mote', 'wisp', 'aetherling', 'murmur', 'oraclet', 'cirrux', 'seraphix', 'aurelion'],
  archive: [
    {
      speciesId: 'wisp',
      grade: 'B',
      stats: { pwr: 21, spd: 24, wis: 33, grt: 22 },
      generation: 2,
      contentVersion: 1,
      recordedAt: 1000,
    },
    {
      speciesId: 'seraphix',
      grade: 'A',
      stats: { pwr: 24, spd: 26, wis: 36, grt: 24 },
      generation: 5,
      contentVersion: 1,
      recordedAt: 2000,
    },
    {
      speciesId: 'aurelion',
      grade: 'S',
      stats: { pwr: 26, spd: 28, wis: 41, grt: 25 },
      generation: 7,
      contentVersion: 1,
      recordedAt: 3000,
    },
  ],
  achievementsEarned: { 'first-molt': 1, 'stage-apex': 2, 'grade-s': 3 },
  habitatsUnlocked: ['terminal-den', 'rooftop-night'],
  trinketsUnlocked: ['lava-lamp'],
  selectedHabitat: 'rooftop-night',
  selectedTrinkets: ['lava-lamp'],
  baselines: { 'claude-code': { meanWindowTokens: 1, windowsObserved: 40 } },
  rngState: 1,
  simulatedTo: 0,
  lineage: [],
};

const svg = shellFrameToSvg({
  page,
  state,
  pack: contentPackV1,
  frame: flag('frame', 12),
  cols: flag('cols', 118),
  rows: flag('rows', 36),
  completionPct: 38.4,
  flash: args.includes('--flash') ? 'GRADESHIFT! Aurelion ascends to [S] Aurum' : null,
  selected: flag('selected', 2),
});

const tmp = mkdtempSync(join(tmpdir(), 'tt-page-'));
const svgPath = join(tmp, 'page.svg');
writeFileSync(svgPath, svg);
execFileSync('magick', [svgPath, out]);
rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${out}`);
