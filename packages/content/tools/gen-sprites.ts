/**
 * Sprite pack orchestrator for the Token Tamers v1 content pack.
 *
 * Composes per-line design modules into a single sprites.json. Each design
 * module owns one art domain and exports an array of `SpriteDef`s:
 *   - tools/designs/aether.ts  -> aetherSprites  (Aether line + the egg)
 *   - tools/designs/cipher.ts  -> cipherSprites  (Cipher line)
 *   - tools/designs/scenes.ts  -> sceneSprites   (habitats + trinkets)
 *
 * This file stays a thin assembler: emission order is fixed (egg, Aether,
 * Cipher, habitats, trinkets) so the output is stable across runs, and it MUST
 * keep producing a valid sprites.json at every commit. The design modules are
 * currently STUBS re-emitting the v1 placeholder grids; artists replace those
 * module bodies (using tools/sprite-lib.ts) without touching this orchestrator.
 *
 * Determinism: design modules use only the seeded LCG (sprite-lib `lcg`) keyed
 * on sprite id — no Math.random / Date.now anywhere in the pipeline.
 *
 * Run with: pnpm tsx packages/content/tools/gen-sprites.ts
 * Output:   packages/content/content/sprites.json
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SpriteDef } from '@token-tamers/core';
import { aetherSprites } from './designs/aether';
import { bloomSprites } from './designs/bloom';
import { cipherSprites } from './designs/cipher';
import { fluxSprites } from './designs/flux';
import { forgeSprites } from './designs/forge';
import { sceneSprites } from './designs/scenes';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Assemble the full pack in a fixed, stable order. */
export function buildAllSprites(): SpriteDef[] {
  return [
    ...aetherSprites,
    ...cipherSprites,
    ...fluxSprites,
    ...forgeSprites,
    ...bloomSprites,
    ...sceneSprites,
  ];
}

function main(): void {
  const sprites = buildAllSprites();
  const outPath = join(__dirname, '../content/sprites.json');
  writeFileSync(outPath, JSON.stringify(sprites, null, 2));
  console.log(`Wrote ${sprites.length} sprites to ${outPath}`);
}

main();
