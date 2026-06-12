/**
 * Pet page: a habitat backdrop and a wandering pet driven entirely by the frame
 * counter (golden-test safe), plus the name/stage/grade badge, identity line,
 * grade-roll odds and home-habitat strips.
 *
 * The pet is no longer statically centered: it runs a deterministic wander loop
 * (idle -> walk right -> hop -> walk left -> play beside a trinket) whose every
 * frame is a pure function of the frame counter, so golden snapshots stay
 * reproducible. See `petPlacement` for the cycle math.
 */

import { hexToRgb, mix, type Rgb } from '../terminal/ansi';
import {
  buildPalette,
  drawSprite,
  paletteFromHexes,
  auraOverlay,
  GRADE_ACCENT,
  GRADE_BADGE,
  type AnimBank,
  type Palette,
} from '../render/sprite';
import { findHabitat, findSpecies, findSprite, houseTint } from '../helpers/lookup';
import { renderGradeOddsLine } from '../helpers/status';
import type { RenderContext } from './types';
import type { ContentPack, SpriteDef } from '@token-tamers/core';

const DIM: Rgb = { r: 90, g: 96, b: 120 };
const BRIGHT: Rgb = { r: 230, g: 235, b: 245 };

// ---------------------------------------------------------------------------
// Wander cycle — a pure function of the frame counter.
// ---------------------------------------------------------------------------

/** Total frames in one full wander cycle. */
export const CYCLE = 144;
/** Per-phase frame budgets; they sum to CYCLE. */
const IDLE_LEN = 24;
const WALK_LEN = 40;
const JUMP_LEN = 16;
// The final play segment (24 frames) runs from PLAY_AT to the end of the cycle.
/** Phase start offsets within the cycle. */
const WALK_R_AT = IDLE_LEN; // 24
const JUMP_AT = WALK_R_AT + WALK_LEN; // 64
const WALK_L_AT = JUMP_AT + JUMP_LEN; // 80
const PLAY_AT = WALK_L_AT + WALK_LEN; // 120 -> play runs 120..143 (24 frames)
/** Inset (cells) from the canvas edges that bounds the wander path. */
const EDGE_INSET = 8;
/** Peak hop height in cells. */
const HOP_CELLS = 2;
/**
 * Pixel row of the scene floor line within a 48px-tall habitat. Every habitat
 * scene lays its ground strip starting at `HH - 10` (= pixel row 38), so the
 * pet's feet rest on cell-row `floor(38 / 2)` = 19 of the backdrop. Anchoring to
 * this — not the canvas bottom — keeps the pet standing ON the floor instead of
 * floating mid-sky or clipping the scene's lower border.
 */
const SCENE_FLOOR_PX = 38;
/** Habitat backdrop pixel height (matches scenes.ts HH). */
const HABITAT_PX_H = 48;

export interface WanderGeometry {
  /** Left/top cell of the canvas region. */
  canvasX: number;
  canvasY: number;
  canvasCols: number;
  canvasRows: number;
  /** Pet sprite footprint in cells. */
  spriteCols: number;
  spriteRows: number;
  /**
   * Cell-row the pet's FEET (sprite bottom) must rest on — the habitat's floor
   * line. The pet's top-left y is then `floorY - (spriteRows - 1)`.
   */
  floorY: number;
}

export interface WanderState {
  /** Top-left cell to draw the pet at. */
  px: number;
  py: number;
  /** Animation bank to draw the pet from. */
  anim: AnimBank;
  /** Mirror the pet horizontally (facing left). */
  flipX: boolean;
  /** True during the play segment — the trinket is shown at its floor anchor. */
  playing: boolean;
  /** Floor cell the pet stands beside when playing (trinket anchor). */
  trinketX: number;
}

/** Linear interpolation clamped to [a,b] by t in [0,1]. */
function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * Math.max(0, Math.min(1, t)));
}

/**
 * Pure placement of the pet for a given frame. Position, bank and facing are a
 * deterministic function of `frame % CYCLE` and the geometry — no clock, no RNG.
 *
 *   idle (24)  -> stand at the left bound
 *   walk R (40) -> stride to the right bound (walk bank)
 *   hop (16)   -> a 1-2 cell hop in place (jump bank)
 *   walk L (40) -> stride back to the play spot (walk bank, flipX)
 *   play (24)  -> bob beside the trinket anchor (play bank)
 *
 * `mobile` is false for pre-hatch stages (the egg): a legless egg never walks,
 * hops, or plays — it sits centered on the floor and only breathes via its idle
 * sprite frames. Locomoting an egg across the canvas reads as jitter.
 */
export function petPlacement(frame: number, geo: WanderGeometry, mobile = true): WanderState {
  const f = ((frame % CYCLE) + CYCLE) % CYCLE;
  // Top-left y so the sprite's bottom row lands on the scene floor line.
  const groundY = geo.floorY - (geo.spriteRows - 1);
  const leftX = geo.canvasX + EDGE_INSET;
  const rightX = geo.canvasX + geo.canvasCols - EDGE_INSET - geo.spriteCols;
  // The play spot sits left-of-center; the trinket anchors just to the pet's right.
  const playX = geo.canvasX + Math.floor((geo.canvasCols - geo.spriteCols) / 2) - 4;
  const trinketX = playX + geo.spriteCols + 1;

  if (!mobile) {
    // Stationary: centered on the floor, idle frames only (no wander, no hop).
    const centerX = geo.canvasX + Math.floor((geo.canvasCols - geo.spriteCols) / 2);
    return { px: centerX, py: groundY, anim: 'idle', flipX: false, playing: false, trinketX };
  }

  if (f < WALK_R_AT) {
    return { px: leftX, py: groundY, anim: 'idle', flipX: false, playing: false, trinketX };
  }
  if (f < JUMP_AT) {
    const t = (f - WALK_R_AT) / WALK_LEN;
    return {
      px: lerp(leftX, rightX, t),
      py: groundY,
      anim: 'walk',
      flipX: false,
      playing: false,
      trinketX,
    };
  }
  if (f < WALK_L_AT) {
    const t = (f - JUMP_AT) / JUMP_LEN;
    const hop = Math.round(Math.sin(t * Math.PI) * HOP_CELLS);
    return { px: rightX, py: groundY - hop, anim: 'jump', flipX: false, playing: false, trinketX };
  }
  if (f < PLAY_AT) {
    const t = (f - WALK_L_AT) / WALK_LEN;
    return {
      px: lerp(rightX, playX, t),
      py: groundY,
      anim: 'walk',
      flipX: true,
      playing: false,
      trinketX,
    };
  }
  return { px: playX, py: groundY, anim: 'play', flipX: true, playing: true, trinketX };
}

// ---------------------------------------------------------------------------
// Page render.
// ---------------------------------------------------------------------------

export function renderPetPage(ctx: RenderContext): void {
  const { layout, state, pack } = ctx;
  const { canvasX, canvasY, canvasCols, canvasRows } = layout;
  const pet = state.pet;

  drawBackdrop(ctx);

  const species = findSpecies(pack, pet.speciesId);
  const sprite = species ? findSprite(pack, species.spriteId) : undefined;
  if (sprite) {
    drawWanderingPet(ctx, sprite);
  }

  drawTitleStrip(ctx, species?.name ?? '???');
  drawIdentityStrip(ctx);
  drawBottomStrip(ctx);

  // The whole pet area is a clickable region (e.g. to pet it; no-op for MVP).
  ctx.hits.add('pet:canvas', canvasX, canvasY, canvasCols, canvasRows);
}

/** Draw the pet (and, during play, its trinket + S aura) along the wander path. */
function drawWanderingPet(ctx: RenderContext, sprite: SpriteDef): void {
  const { buf, layout, state, pack, mode, frame } = ctx;
  const { canvasX, canvasY, canvasCols, canvasRows } = layout;
  const pet = state.pet;

  const spriteCols = sprite.width;
  const spriteRows = Math.ceil(sprite.height / 2);
  const geo: WanderGeometry = {
    canvasX,
    canvasY,
    canvasCols,
    canvasRows,
    spriteCols,
    spriteRows,
    floorY: sceneFloorRow(ctx),
  };
  // The egg is pre-hatch and legless: keep it stationary (no wander/hop/play).
  const w = petPlacement(frame, geo, pet.stage !== 'egg');

  // Trinket drawn at its floor anchor during the play segment.
  if (w.playing) {
    drawPlayTrinket(ctx, w.trinketX, geo);
  }

  const tint = houseTint(pack, pet.house);
  const pal = buildPalette(tint, pet.grade, frame);
  const clip = { x: canvasX, y: canvasY, w: canvasCols, h: canvasRows };
  drawSprite(buf, sprite, pal, {
    x: w.px,
    y: w.py,
    frame,
    mode,
    anim: w.anim,
    flipX: w.flipX,
    clip,
  });

  // S-grade particle aura follows the pet.
  if (pet.grade === 'S') {
    for (const a of auraOverlay(spriteCols, spriteRows, frame)) {
      buf.set(w.px + a.x, w.py + a.y, { ch: a.ch, fg: BRIGHT, bg: null });
    }
  }
}

/**
 * Cell-row of the habitat floor line (where the pet's feet rest). The backdrop
 * is drawn CENTERED in the canvas, so the floor is inside the backdrop — not at
 * the canvas bottom. We mirror `drawBackdrop`'s vertical placement and add the
 * scene's floor row. Falls back to a sensible canvas-relative line when there is
 * no habitat sprite (the gradient fallback fills the whole canvas).
 */
function sceneFloorRow(ctx: RenderContext): number {
  const { layout, state, pack } = ctx;
  const { canvasY, canvasRows } = layout;
  const habitat = findHabitat(pack, state.selectedHabitat);
  const habSprite = habitat ? findSprite(pack, habitat.spriteId) : undefined;
  if (!habSprite) {
    // No backdrop: stand near the canvas bottom with a small margin.
    return canvasY + canvasRows - 4;
  }
  const h = Math.ceil(habSprite.height / 2);
  const by = canvasY + Math.floor((canvasRows - h) / 2);
  return by + Math.floor((SCENE_FLOOR_PX * h) / HABITAT_PX_H);
}

/** Draw the selected trinket at the floor anchor beside the play spot. */
function drawPlayTrinket(ctx: RenderContext, trinketX: number, geo: WanderGeometry): void {
  const { buf, state, pack, mode, frame } = ctx;
  const trinketId = state.selectedTrinkets[0];
  if (!trinketId) return;
  const def = pack.trinkets.find((t) => t.id === trinketId);
  const sprite = def ? findSprite(pack, def.spriteId) : undefined;
  if (!sprite) return;

  const rows = Math.ceil(sprite.height / 2);
  // Bottom-align the trinket on the same floor line as the pet's feet.
  const ty = geo.floorY - (rows - 1);
  const pal = buildPalette('#9aa0b5', 'B', frame);
  drawSprite(buf, sprite, pal, {
    x: trinketX,
    y: ty,
    frame,
    mode,
    clip: { x: geo.canvasX, y: geo.canvasY, w: geo.canvasCols, h: geo.canvasRows },
  });
}

// ---------------------------------------------------------------------------
// Strips (unchanged in spirit; extracted for clarity).
// ---------------------------------------------------------------------------

function drawTitleStrip(ctx: RenderContext, name: string): void {
  const { buf, layout, state } = ctx;
  const { canvasX, canvasY, canvasCols } = layout;
  const pet = state.pet;
  const badge = `[${pet.grade}]${GRADE_BADGE[pet.grade]}`;
  const stageLabel = pet.calibrating ? 'calibrating' : pet.stage;
  buf.text(canvasX + 1, canvasY, name, BRIGHT, null);
  buf.text(canvasX + 1 + name.length + 1, canvasY, badge, GRADE_ACCENT[pet.grade], null);
  buf.text(canvasX + 1 + name.length + badge.length + 2, canvasY, stageLabel, DIM, null);
  const info = `gen ${pet.generation} · molt ${pet.moltCount}`;
  buf.text(canvasX + canvasCols - info.length - 1, canvasY, info, DIM, null);
}

function drawIdentityStrip(ctx: RenderContext): void {
  const { buf, layout, state } = ctx;
  const { canvasX, canvasY } = layout;
  const pet = state.pet;
  const identity = [
    pet.pattern ? `${pet.pattern[0]?.toUpperCase()}${pet.pattern.slice(1)} pattern` : null,
    pet.traits.length > 0 ? pet.traits.join(' · ') : null,
  ]
    .filter(Boolean)
    .join('  ✦  ');
  if (identity) buf.text(canvasX + 1, canvasY + 1, identity, DIM, null);
}

function drawBottomStrip(ctx: RenderContext): void {
  const { buf, layout, state, pack } = ctx;
  const { canvasX, canvasY, canvasCols, canvasRows } = layout;
  const odds = renderGradeOddsLine(state);
  buf.text(canvasX + 1, canvasY + canvasRows - 1, odds, DIM, null);
  const habitatDef = findHabitat(pack, state.selectedHabitat);
  if (habitatDef) {
    const home = `⌂ ${habitatDef.name}`;
    buf.text(canvasX + canvasCols - home.length - 1, canvasY + canvasRows - 1, home, DIM, null);
  }
}

// ---------------------------------------------------------------------------
// Backdrop.
// ---------------------------------------------------------------------------

function drawBackdrop(ctx: RenderContext): void {
  const { buf, layout, state, pack, mode, frame } = ctx;
  const { canvasX, canvasY, canvasCols, canvasRows } = layout;

  const habitat = findHabitat(pack, state.selectedHabitat);
  const habSprite = habitat ? findSprite(pack, habitat.spriteId) : undefined;
  if (habSprite) {
    const pal = backdropPalette(pack, state, habitat?.palette, habitat?.tint);
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

  drawFallbackGradient(ctx);
}

/**
 * Resolve the backdrop palette. When the habitat ships its own `palette` we map
 * indices directly to those exact hexes — NO grade ladder, no dimming, so the
 * scene owns its colors. Otherwise we fall back to the dimmed tint ramp.
 */
function backdropPalette(
  pack: ContentPack,
  state: RenderContext['state'],
  palette: string[] | undefined,
  tintHex: string | undefined,
): Palette {
  if (palette && palette.length > 0) {
    return paletteFromHexes(palette);
  }
  const tint = tintHex ?? rgbHex(mix(hexToRgb(houseTint(pack, state.pet.house)), DIM, 0.6));
  return buildPalette(tint, 'A', 0).map((c) => (c ? mix(c, { r: 8, g: 10, b: 18 }, 0.18) : c));
}

function drawFallbackGradient(ctx: RenderContext): void {
  const { buf, layout } = ctx;
  const { canvasX, canvasY, canvasCols, canvasRows } = layout;
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
