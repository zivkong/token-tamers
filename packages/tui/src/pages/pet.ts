/**
 * Pet page: a habitat backdrop and a wandering pet driven entirely by the frame
 * counter (golden-test safe), plus the name/stage/grade badge, identity line,
 * grade-roll odds and home-habitat strips.
 *
 * The pet is not statically centered: it runs a deterministic, non-repeating
 * organic wander — pausing to idle / sit / look around / hop / play, then
 * strolling to the next random spot — whose every frame is a pure function of
 * the frame counter, so golden snapshots stay reproducible. See `petPlacement`.
 */

import { mix, type Rgb } from '../terminal/ansi';
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
import { findHabitat, findSpecies, findSprite, houseColor, houseTint } from '../helpers/lookup';
import { petSections, type SceneRect } from '../render/layout';
import { drawDivider, drawMarquee } from '../components';
import { drawStatsRow, renderVitals } from './pet-vitals';
import type { RenderContext } from './types';
import type { SpriteDef } from '@token-tamers/core';

const DIM: Rgb = { r: 90, g: 96, b: 120 };
const BRIGHT: Rgb = { r: 230, g: 235, b: 245 };
/** Subtle band background that sets the header section off the scene. */
const HEADER_BG: Rgb = { r: 18, g: 21, b: 31 };
/** Amber ribbon for the opt-in "update available" ticker (matches the flash toast). */
const TICKER_FG: Rgb = { r: 255, g: 232, b: 160 };
const TICKER_BG: Rgb = { r: 60, g: 48, b: 14 };

// ---------------------------------------------------------------------------
// Organic wander — a deterministic value-noise walk.
//
// The path is a pure function of the frame counter (golden-snapshot safe) yet
// effectively never repeats. Position is driven by per-NODE random anchors and
// per-node dwell behaviors, both derived from an integer hash of the node
// index: at each node the pet pauses (idle / sit / look around / hop / play),
// then strolls to the next random anchor with an eased gait. Because anchor(i)
// varies with `i` forever and nothing chains off earlier nodes, placement is
// O(1) per frame and never retraces the old fixed 5-beat loop.
// ---------------------------------------------------------------------------

/** Frames a single node occupies — one dwell plus one stroll to the next anchor. */
const NODE_FRAMES = 54;
/**
 * A coarse multi-node window. Exported for consumers/tests that want "a few
 * behaviors' worth" of frames — the motion itself does NOT loop on this; the
 * pet's path never repeats (see the section comment above).
 */
export const CYCLE = NODE_FRAMES * 4;
/** Inset (cells) from the canvas edges that bounds the wander path. */
const EDGE_INSET = 8;
/** Peak hop height in cells. */
const HOP_CELLS = 2;
/** Distinct hash seeds keep position / behavior / dwell / hop-count independent. */
const SEED_X = 0x1f3d;
const SEED_BEHAVIOR = 0x2b9c;
const SEED_DWELL = 0x7c41;
const SEED_HOPS = 0x51e7;

/** What the pet does while paused at a node. */
type Dwell = 'idle' | 'sit' | 'look' | 'hop' | 'play';
/**
 * Pixel row of the scene floor line within a 48px-tall habitat. Every habitat
 * scene lays its ground strip starting at `HH - 10` (= pixel row 38), so the
 * pet's feet rest on cell-row `floor(38 / 2)` = 19 of the backdrop. Anchoring to
 * this — not the canvas bottom — keeps the pet standing ON the floor instead of
 * floating mid-sky or clipping the scene's lower border.
 */
// Floor line in the 96-px-tall (4:3) scene; ~79% down, matching the old 38/48
// proportion so the pet stands on the ground band of the taller habitat art.
const SCENE_FLOOR_PX = 76;
/** Habitat backdrop pixel height (matches scenes.ts HH; octant v2 = 4:3 128x96). */
const HABITAT_PX_H = 96;
/**
 * Habitat backdrop width in cells (= the 128-px scene, 1 px per column). The
 * backdrop is scaled to fill `scene.cols`, so `scene.cols / HABITAT_COLS` is the
 * background's scale factor — the pet and trinkets multiply by it too so they
 * stay proportionate to the scene at any terminal width.
 */
const HABITAT_COLS = 128;

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

/** Deterministic 32-bit integer hash -> [0, 1). No clock, no Math.random. */
function hash01(n: number, seed: number): number {
  let h = (Math.imul(n + 1, 0x9e3779b1) ^ Math.imul(seed + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0x1_0000_0000;
}

/**
 * Smootherstep (eases in AND out) so the pet decelerates to a near-stop at each
 * anchor instead of snapping — this is what reads as a natural gait.
 */
function smootherstep(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Floor-anchored x (float) the pet rests at for node `i`. */
function anchorX(i: number, leftX: number, rightX: number): number {
  if (rightX <= leftX) return leftX;
  return leftX + hash01(i, SEED_X) * (rightX - leftX);
}

/** The behavior the pet performs while dwelling at node `i`. */
function dwellBehavior(i: number): Dwell {
  const r = hash01(i, SEED_BEHAVIOR);
  if (r < 0.34) return 'idle';
  if (r < 0.52) return 'sit';
  if (r < 0.7) return 'look';
  if (r < 0.86) return 'hop';
  return 'play';
}

/**
 * Fraction of a node spent dwelling vs strolling. Varies by behavior so pacing
 * never feels metronomic — rests linger, restless idles move on quickly.
 */
function dwellFraction(behavior: Dwell, i: number): number {
  const j = hash01(i, SEED_DWELL);
  switch (behavior) {
    case 'sit':
      return 0.55 + j * 0.25;
    case 'play':
      return 0.5 + j * 0.2;
    case 'look':
      return 0.4 + j * 0.2;
    case 'hop':
      return 0.4 + j * 0.15;
    default:
      return 0.25 + j * 0.2;
  }
}

/** Inputs to a single dwell frame (grouped to honor max-params). */
interface DwellArgs {
  i: number;
  behavior: Dwell;
  /** 0..1 progress through the dwell. */
  phase: number;
  /** Float anchor x the pet rests at. */
  x: number;
  /** Next node's anchor — used to anticipate the upcoming stroll direction. */
  next: number;
  groundY: number;
  geo: WanderGeometry;
}

/**
 * Pure placement of the pet for a given frame — position, bank and facing are a
 * deterministic function of `frame` and the geometry (no clock, no RNG), via a
 * value-noise walk over per-node random anchors:
 *
 *   node i: dwell at anchor(i) [idle / sit / look / hop / play], then stroll to
 *           anchor(i+1) with an eased gait, facing the direction of travel.
 *
 * `mobile` is false for pre-hatch stages (the egg): a legless egg never walks,
 * hops, or plays — it sits centered on the floor and only breathes via its idle
 * sprite frames. Locomoting an egg across the canvas reads as jitter.
 */
export function petPlacement(frame: number, geo: WanderGeometry, mobile = true): WanderState {
  // Top-left y so the sprite's bottom row lands on the scene floor line.
  const groundY = geo.floorY - (geo.spriteRows - 1);
  const leftX = geo.canvasX + EDGE_INSET;
  const rightX = geo.canvasX + geo.canvasCols - EDGE_INSET - geo.spriteCols;

  if (!mobile) {
    // Stationary: centered on the floor, idle frames only (no wander, no hop).
    const centerX = geo.canvasX + Math.floor((geo.canvasCols - geo.spriteCols) / 2);
    return {
      px: centerX,
      py: groundY,
      anim: 'idle',
      flipX: false,
      playing: false,
      trinketX: centerX + geo.spriteCols + 1,
    };
  }

  const t = frame / NODE_FRAMES;
  const i = Math.floor(t);
  const local = t - i; // 0..1 within node i
  const here = anchorX(i, leftX, rightX);
  const next = anchorX(i + 1, leftX, rightX);
  const behavior = dwellBehavior(i);
  const dwell = dwellFraction(behavior, i);

  if (local < dwell) {
    const phase = dwell > 0 ? local / dwell : 0;
    return dwellState({ i, behavior, phase, x: here, next, groundY, geo });
  }

  // Strolling from `here` to `next` with an eased gait.
  const stroll = smootherstep((local - dwell) / (1 - dwell));
  const px = Math.round(here + (next - here) * stroll);
  return {
    px,
    py: groundY,
    anim: 'walk',
    flipX: next < here,
    playing: false,
    trinketX: px + geo.spriteCols + 1,
  };
}

/** Resolve a single frame of dwelling-at-a-node behavior. */
function dwellState(a: DwellArgs): WanderState {
  const px = Math.round(a.x);
  const trinketX = px + a.geo.spriteCols + 1;
  const faceNext = a.next < a.x; // anticipate the next stroll's direction
  switch (a.behavior) {
    case 'hop': {
      const hops = 1 + Math.floor(hash01(a.i, SEED_HOPS) * 2); // 1 or 2 bounces
      const arc = Math.abs(Math.sin(a.phase * Math.PI * hops));
      return {
        px,
        py: a.groundY - Math.round(arc * HOP_CELLS),
        anim: 'jump',
        flipX: faceNext,
        playing: false,
        trinketX,
      };
    }
    case 'play':
      // Face the toy, which sits just to the pet's right.
      return { px, py: a.groundY, anim: 'play', flipX: false, playing: true, trinketX };
    case 'look':
      // Glance one way, then the other, across the pause.
      return { px, py: a.groundY, anim: 'idle', flipX: a.phase >= 0.5, playing: false, trinketX };
    default:
      return { px, py: a.groundY, anim: 'idle', flipX: faceNext, playing: false, trinketX };
  }
}

// ---------------------------------------------------------------------------
// Page render.
// ---------------------------------------------------------------------------

export function renderPetPage(ctx: RenderContext): void {
  const { buf, layout, state, pack } = ctx;
  const pet = state.pet;
  const sec = petSections(layout);

  drawBackdrop(ctx, sec.scene);

  const species = findSpecies(pack, pet.speciesId);
  const sprite = species ? findSprite(pack, species.spriteId) : undefined;
  if (sprite) {
    drawWanderingPet(ctx, sprite, sec.scene);
  }

  drawHeaderBand(ctx, sec.header, species?.name ?? '???');

  // Opt-in update notice: a scrolling ribbon along the top of the scene, shown
  // only when an update was seen (info.updateAvailable). Undefined in golden
  // tests, so existing pet frames are unchanged.
  drawUpdateTicker(ctx, sec.scene);

  // Section dividers: header | scene | VITALS. (The "Menu" divider is global
  // chrome drawn by the frame, after the panel's bottom-padding gap.)
  drawDivider(buf, sec.dividerYs[0]);
  drawDivider(buf, sec.dividerYs[1], { label: 'VITALS' });

  renderVitals(ctx, sec.panel);

  // The whole scene is a clickable region (e.g. to pet it; no-op for MVP).
  ctx.hits.add('pet:canvas', sec.scene.x, sec.scene.y, sec.scene.cols, sec.scene.rows);
}

/**
 * Draw the opt-in "update available" ticker as a scrolling ribbon on the top
 * row of the scene. Only renders when the launch-time check surfaced a newer
 * version (`info.updateAvailable`); the wording adapts to the update mode —
 * `auto` has already downloaded it (restart to apply), otherwise it points the
 * player at `tt update`. Informational only (no hit region).
 */
function drawUpdateTicker(ctx: RenderContext, scene: SceneRect): void {
  const ver = ctx.info?.updateAvailable;
  if (!ver) return;
  const action =
    ctx.info?.updateMode === 'auto' ? 'restart tt to apply' : "run 'tt update' to upgrade";
  const text = `✦ Update available — ${ver} · ${action}`;
  drawMarquee(ctx.buf, {
    x: scene.x,
    y: scene.y,
    cols: scene.cols,
    text,
    frame: ctx.frame,
    fg: TICKER_FG,
    bg: TICKER_BG,
  });
}

/** The scale factor the backdrop is drawn at, so sprites match its proportions. */
function sceneScale(scene: SceneRect): number {
  return scene.cols / HABITAT_COLS;
}

/** Draw the pet (and, during play, its trinket + S aura) along the wander path. */
function drawWanderingPet(ctx: RenderContext, sprite: SpriteDef, scene: SceneRect): void {
  const { buf, state, mode, frame } = ctx;
  const pet = state.pet;

  // Scale the pet by the same factor as the backdrop so it stays proportionate
  // to the scene as the terminal width changes.
  const scale = sceneScale(scene);
  const spriteCols = Math.max(1, Math.round(sprite.width * scale));
  const spriteRows = Math.max(1, Math.round(Math.ceil(sprite.height / 2) * scale));
  const geo: WanderGeometry = {
    canvasX: scene.x,
    canvasY: scene.y,
    canvasCols: scene.cols,
    canvasRows: scene.rows,
    spriteCols,
    spriteRows,
    floorY: sceneFloorRow(scene),
  };
  // The egg is pre-hatch and legless: keep it stationary (no wander/hop/play).
  const w = petPlacement(frame, geo, pet.stage !== 'egg');

  // Trinket drawn at its floor anchor during the play segment.
  if (w.playing) {
    drawPlayTrinket(ctx, w.trinketX, geo, scale);
  }

  const tint = houseTint(pet.house);
  const accent = findSpecies(ctx.pack, pet.speciesId)?.accent;
  const pal = buildPalette(tint, pet.grade, frame, accent);
  const clip = { x: scene.x, y: scene.y, w: scene.cols, h: scene.rows };
  drawSprite(buf, sprite, pal, {
    x: w.px,
    y: w.py,
    destW: spriteCols,
    destH: spriteRows,
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
 * is scaled to FILL the scene region, so the floor line is the same fraction of
 * the scene height as in the native art (`SCENE_FLOOR_PX / HABITAT_PX_H`).
 * Falls back to a near-bottom line when there is no habitat sprite (the gradient
 * fallback fills the whole scene).
 */
function sceneFloorRow(scene: SceneRect): number {
  return scene.y + Math.floor((SCENE_FLOOR_PX * scene.rows) / HABITAT_PX_H);
}

/** Draw the selected trinket at the floor anchor beside the play spot. */
function drawPlayTrinket(
  ctx: RenderContext,
  trinketX: number,
  geo: WanderGeometry,
  scale: number,
): void {
  const { buf, state, pack, mode, frame } = ctx;
  const trinketId = state.selectedTrinkets[0];
  if (!trinketId) return;
  const def = pack.trinkets.find((t) => t.id === trinketId);
  const sprite = def ? findSprite(pack, def.spriteId) : undefined;
  if (!sprite) return;

  // Match the pet's scale so the toy stays proportionate to the scene.
  const cols = Math.max(1, Math.round(sprite.width * scale));
  const rows = Math.max(1, Math.round(Math.ceil(sprite.height / 2) * scale));
  // Bottom-align the trinket on the same floor line as the pet's feet.
  const ty = geo.floorY - (rows - 1);
  const pal = buildPalette('#9aa0b5', 'B', frame);
  drawSprite(buf, sprite, pal, {
    x: trinketX,
    y: ty,
    destW: cols,
    destH: rows,
    frame,
    mode,
    clip: { x: geo.canvasX, y: geo.canvasY, w: geo.canvasCols, h: geo.canvasRows },
  });
}

// ---------------------------------------------------------------------------
// Header band — name + grade + identity, full width. Intentionally carries NO
// evolution information (stage, molt count): evolution stays a mystery.
// ---------------------------------------------------------------------------

/** Top header band: name + grade (+ calibrating tag) and home habitat on row 0,
 *  pattern + traits on row 1. */
function drawHeaderBand(ctx: RenderContext, header: SceneRect, name: string): void {
  const { buf, state, pack } = ctx;
  const pet = state.pet;

  // Flat band background.
  for (let ry = 0; ry < header.rows; ry++) {
    for (let x = 0; x < header.cols; x++) {
      buf.set(header.x + x, header.y + ry, { ch: ' ', fg: null, bg: HEADER_BG });
    }
  }

  // Grade is conveyed by the name's COLOR + a trailing SYMBOL — no '[B]' text.
  // The whole name is rendered bold in the grade accent (green B, purple A, …).
  const title = `${name} ${GRADE_BADGE[pet.grade]}`;
  let x = header.x + 1;
  buf.textBold(x, header.y, title, GRADE_ACCENT[pet.grade], HEADER_BG);
  x += title.length + 1;
  // Keep the calibration cue (it is about data readiness, not evolution).
  if (pet.calibrating) buf.text(x, header.y, '· calibrating', DIM, HEADER_BG);

  // Right side: home habitat (no gen/molt — evolution is hidden).
  const habitatDef = findHabitat(pack, state.selectedHabitat);
  if (habitatDef) {
    const home = `⌂ ${habitatDef.name}`;
    buf.text(header.x + header.cols - home.length - 1, header.y, home, DIM, HEADER_BG);
  }

  if (header.rows > 1) {
    const identity = [
      pet.pattern ? `${pet.pattern[0]?.toUpperCase()}${pet.pattern.slice(1)} pattern` : null,
      pet.traits.length > 0 ? pet.traits.join(' · ') : null,
    ]
      .filter(Boolean)
      .join('  ✦  ');
    if (identity) buf.text(header.x + 1, header.y + 1, identity, DIM, HEADER_BG);
  }

  // Stats live HERE with identity (who the pet is — a fixed equal budget), kept
  // apart from the live Food/Diet/Odds panel. Drawn on the header band's bg.
  if (header.rows > 2) drawStatsRow(ctx, header, header.y + 2, HEADER_BG);
}

// ---------------------------------------------------------------------------
// Backdrop.
// ---------------------------------------------------------------------------

function drawBackdrop(ctx: RenderContext, scene: SceneRect): void {
  const { buf, state, pack, mode, frame } = ctx;

  const habitat = findHabitat(pack, state.selectedHabitat);
  const habSprite = habitat ? findSprite(pack, habitat.spriteId) : undefined;
  if (habSprite) {
    const pal = backdropPalette(state, habitat?.palette, habitat?.tint);
    // Scale the scene to FILL the full-width canvas (no side padding). The
    // habitat's native 4:1 cell aspect matches the scene rect's, so the scale
    // is uniform and undistorted.
    drawSprite(buf, habSprite, pal, {
      x: scene.x,
      y: scene.y,
      destW: scene.cols,
      destH: scene.rows,
      // The compositor advances the bank at the sprite's own fps, so the
      // backdrop no longer needs to pre-divide the counter to slow itself.
      frame,
      mode,
      clip: { x: scene.x, y: scene.y, w: scene.cols, h: scene.rows },
    });
    return;
  }

  drawFallbackGradient(ctx, scene);
}

/**
 * Resolve the backdrop palette. When the habitat ships its own `palette` we map
 * indices directly to those exact hexes — NO grade ladder, no dimming, so the
 * scene owns its colors. Otherwise we fall back to the dimmed tint ramp.
 */
function backdropPalette(
  state: RenderContext['state'],
  palette: string[] | undefined,
  tintHex: string | undefined,
): Palette {
  if (palette && palette.length > 0) {
    return paletteFromHexes(palette);
  }
  const tint = tintHex ?? rgbHex(mix(houseColor(state.pet.house), DIM, 0.6));
  return buildPalette(tint, 'A', 0).map((c) => (c ? mix(c, { r: 8, g: 10, b: 18 }, 0.18) : c));
}

function drawFallbackGradient(ctx: RenderContext, scene: SceneRect): void {
  const { buf } = ctx;
  for (let y = 0; y < scene.rows; y++) {
    const t = y / Math.max(1, scene.rows - 1);
    const bg = mix({ r: 18, g: 20, b: 30 }, { r: 30, g: 34, b: 50 }, t);
    for (let x = 0; x < scene.cols; x++) {
      buf.set(scene.x + x, scene.y + y, { ch: ' ', fg: null, bg });
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
