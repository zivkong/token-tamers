/**
 * ponytail: demo-only shell launcher for README captures. Lives at the package
 * root (outside `src`, so it's excluded from typecheck/build) because it needs
 * the workspace `@token-tamers/*` packages resolved from apps/cli/node_modules.
 *
 * It reads your REAL saved state, then redirects the data dir to a throwaway temp
 * copy so the showcase mutation (S-grade apex Aurelion, full Dex, everything
 * unlocked) and the shell's on-exit persist can NEVER touch ~/.tokentamers. It
 * then runs the interactive shell straight from that state — NO catch-up, ingest,
 * or advance, so what you seed is exactly what renders. Run under a recorder:
 *   pnpm --filter token-tamers exec tsx demo-shell.ts [page]
 */
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createEngine, type EngineConfig } from '@token-tamers/core';
import { contentPackV1 } from '@token-tamers/content';
import { loadConfig, loadState, dataDir, setDataDirForTesting } from './src/stores';
import { launchShell } from './src/commands/shell';

const config = loadConfig();
const saved = loadState();
if (!config || !saved) {
  console.error('No initialized state — run `tt init` first.');
  process.exit(1);
}

// Redirect ALL store reads/writes to a throwaway dir, pre-seeded with the real
// config + settings so the look (color, sub-cell density) matches. The real
// ~/.tokentamers is never written again from here on.
const realDir = dataDir();
const demoDir = '/tmp/tt-demo-data';
rmSync(demoDir, { recursive: true, force: true });
mkdirSync(demoDir, { recursive: true });
for (const f of ['config.json', 'settings.json']) {
  try {
    cpSync(join(realDir, f), join(demoDir, f));
  } catch {
    // settings.json may not exist; defaults are fine.
  }
}
setDataDirForTesting(demoDir);

const pet = saved.pet as Record<string, unknown>;
pet.speciesId = 'aurelion';
pet.house = 'aether';
pet.stage = 'apex';
pet.grade = 'S';
pet.stats = { pwr: 88, spd: 84, wis: 96, grt: 80 };
pet.dormant = false;
pet.calibrating = false;

// Light up the whole world for the showcase pages.
const s = saved as Record<string, unknown>;
s.dexOwned = contentPackV1.species.map((sp) => sp.id);
s.habitatsUnlocked = contentPackV1.habitats.map((h) => h.id);
s.trinketsUnlocked = contentPackV1.trinkets.map((t) => t.id);
s.selectedHabitat = 'rooftop-night';
s.selectedTrinkets = ['crown', 'laurel-wreath'];

const engineConfig: EngineConfig = {
  adapters: config.adapters,
  cycle: config.cycle,
  salt: config.salt,
};
const engine = createEngine(contentPackV1, engineConfig, saved);

const initialPage = (process.argv[2] as never) || undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
await launchShell({ config, engine } as any, { noColor: false, initialPage });
