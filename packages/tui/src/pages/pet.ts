/**
 * Pet page: habitat backdrop + the pet sprite in an idle loop, a name/stage/
 * grade badge, and the last grade-roll odds line.
 */

import { hexToRgb, mix, type Rgb } from '../ansi';
import { buildPalette, drawSprite, auraOverlay, GRADE_BADGE } from '../sprite';
import { findSpecies, findSprite, habitatSpriteId, houseTint } from '../lookup';
import { renderGradeOddsLine } from '../status';
import type { RenderContext } from './types';

const DIM: Rgb = { r: 90, g: 96, b: 120 };
const BRIGHT: Rgb = { r: 230, g: 235, b: 245 };

export function renderPetPage(ctx: RenderContext): void {
  const { buf, layout, state, pack, mode, frame } = ctx;
  const { canvasX, canvasY, canvasCols, canvasRows } = layout;
  const pet = state.pet;

  // Backdrop: habitat sprite tiled/centered if present, else a soft gradient.
  drawBackdrop(ctx);

  // Pet sprite, centered in the canvas.
  const species = findSpecies(pack, pet.speciesId);
  const sprite = species ? findSprite(pack, species.spriteId) : undefined;
  if (sprite) {
    const tint = houseTint(pack, pet.house);
    const pal = buildPalette(tint, pet.grade, frame);
    const spriteCellW = sprite.width;
    const spriteCellH = Math.ceil(sprite.height / 2);
    const px = canvasX + Math.floor((canvasCols - spriteCellW) / 2);
    // Idle bob: drift up/down 1 cell on a slow cycle.
    const bob = Math.sin(frame * 0.2) > 0.5 ? -1 : 0;
    const py = canvasY + Math.floor((canvasRows - spriteCellH) / 2) + bob;
    drawSprite(buf, sprite, px, py, pal, { frame, mode });

    // S-grade particle aura.
    if (pet.grade === 'S') {
      for (const a of auraOverlay(spriteCellW, spriteCellH, frame)) {
        buf.set(px + a.x, py + a.y, { ch: a.ch, fg: BRIGHT, bg: null });
      }
    }
  }

  // Badge line: name [G]glyph at the top of the canvas.
  const name = species?.name ?? '???';
  const badge = GRADE_BADGE[pet.grade];
  const stageLabel = pet.calibrating ? 'calibrating' : pet.stage;
  const title = `${name}  [${pet.grade}]${badge}  ${stageLabel}`;
  buf.text(canvasX + 1, canvasY, title, BRIGHT, null);

  // Odds line at the bottom of the canvas.
  const odds = renderGradeOddsLine(state);
  buf.text(canvasX + 1, canvasY + canvasRows - 1, odds, DIM, null);

  // The whole pet area is a clickable region (e.g. to pet it; no-op for MVP).
  ctx.hits.add('pet:canvas', canvasX, canvasY, canvasCols, canvasRows);
}

function drawBackdrop(ctx: RenderContext): void {
  const { buf, layout, state, pack, mode, frame } = ctx;
  const { canvasX, canvasY, canvasCols, canvasRows } = layout;

  const habId = habitatSpriteId(pack, state.selectedHabitat);
  const habSprite = habId ? findSprite(pack, habId) : undefined;
  if (habSprite) {
    // Habitats use a neutral palette derived from the pet's house tint, dimmed
    // to sit behind the pet. Always a flat (C) ladder so it never upstages it.
    const tint = houseTint(pack, state.pet.house);
    const dimmedTint = rgbHex(mix(hexToRgb(tint), DIM, 0.6));
    const pal = buildPalette(dimmedTint, 'C', frame);
    // Center the backdrop sprite.
    const w = habSprite.width;
    const h = Math.ceil(habSprite.height / 2);
    const bx = canvasX + Math.floor((canvasCols - w) / 2);
    const by = canvasY + Math.floor((canvasRows - h) / 2);
    drawSprite(buf, habSprite, bx, by, pal, { frame: 0, mode });
    return;
  }

  // Fallback: a subtle vertical gradient floor.
  for (let y = 0; y < canvasRows; y++) {
    const t = y / Math.max(1, canvasRows - 1);
    const bg = mix({ r: 18, g: 20, b: 30 }, { r: 30, g: 34, b: 50 }, t);
    for (let x = 0; x < canvasCols; x++) {
      buf.set(canvasX + x, canvasY + y, { ch: ' ', fg: null, bg });
    }
  }
}

function rgbHex(c: Rgb): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}
