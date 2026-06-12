/**
 * Pet page: habitat backdrop + the pet sprite in an idle loop, a name/stage/
 * grade badge, and the last grade-roll odds line.
 */

import { hexToRgb, mix, type Rgb } from '../terminal/ansi';
import { buildPalette, drawSprite, auraOverlay, GRADE_ACCENT, GRADE_BADGE } from '../render/sprite';
import { findHabitat, findSpecies, findSprite, houseTint } from '../helpers/lookup';
import { renderGradeOddsLine } from '../helpers/status';
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
    drawSprite(buf, sprite, pal, { x: px, y: py, frame, mode });

    // S-grade particle aura.
    if (pet.grade === 'S') {
      for (const a of auraOverlay(spriteCellW, spriteCellH, frame)) {
        buf.set(px + a.x, py + a.y, { ch: a.ch, fg: BRIGHT, bg: null });
      }
    }
  }

  // Title strip: name + grade-colored badge left, lineage info right.
  const name = species?.name ?? '???';
  const badge = `[${pet.grade}]${GRADE_BADGE[pet.grade]}`;
  const stageLabel = pet.calibrating ? 'calibrating' : pet.stage;
  buf.text(canvasX + 1, canvasY, name, BRIGHT, null);
  buf.text(canvasX + 1 + name.length + 1, canvasY, badge, GRADE_ACCENT[pet.grade], null);
  buf.text(canvasX + 1 + name.length + badge.length + 2, canvasY, stageLabel, DIM, null);
  const info = `gen ${pet.generation} · molt ${pet.moltCount}`;
  buf.text(canvasX + canvasCols - info.length - 1, canvasY, info, DIM, null);

  // Identity line: pattern + traits, dimmed under the title.
  const identity = [
    pet.pattern ? `${pet.pattern[0]?.toUpperCase()}${pet.pattern.slice(1)} pattern` : null,
    pet.traits.length > 0 ? pet.traits.join(' · ') : null,
  ]
    .filter(Boolean)
    .join('  ✦  ');
  if (identity) buf.text(canvasX + 1, canvasY + 1, identity, DIM, null);

  // Bottom strip: grade-roll odds left, home habitat right.
  const odds = renderGradeOddsLine(state);
  buf.text(canvasX + 1, canvasY + canvasRows - 1, odds, DIM, null);
  const habitatDef = findHabitat(pack, state.selectedHabitat);
  if (habitatDef) {
    const home = `⌂ ${habitatDef.name}`;
    buf.text(canvasX + canvasCols - home.length - 1, canvasY + canvasRows - 1, home, DIM, null);
  }

  // The whole pet area is a clickable region (e.g. to pet it; no-op for MVP).
  ctx.hits.add('pet:canvas', canvasX, canvasY, canvasCols, canvasRows);
}

function drawBackdrop(ctx: RenderContext): void {
  const { buf, layout, state, pack, mode, frame } = ctx;
  const { canvasX, canvasY, canvasCols, canvasRows } = layout;

  const habitat = findHabitat(pack, state.selectedHabitat);
  const habSprite = habitat ? findSprite(pack, habitat.spriteId) : undefined;
  if (habSprite) {
    // Habitats carry their own scene tint (palette indirection — the scene
    // picks its hue, not the pet). Static 16-color ladder, slightly dimmed so
    // the backdrop never upstages the pet; slow frame steps twinkle the scene.
    const tint = habitat?.tint ?? rgbHex(mix(hexToRgb(houseTint(pack, state.pet.house)), DIM, 0.6));
    const pal = buildPalette(tint, 'A', 0).map((c) =>
      c ? mix(c, { r: 8, g: 10, b: 18 }, 0.18) : c,
    );
    // Center the backdrop sprite.
    const w = habSprite.width;
    const h = Math.ceil(habSprite.height / 2);
    const bx = canvasX + Math.floor((canvasCols - w) / 2);
    const by = canvasY + Math.floor((canvasRows - h) / 2);
    drawSprite(buf, habSprite, pal, {
      x: bx,
      y: by,
      frame: Math.floor(frame / 8),
      mode,
      clip: { x: canvasX, y: canvasY, w: canvasCols, h: canvasRows },
    });
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
