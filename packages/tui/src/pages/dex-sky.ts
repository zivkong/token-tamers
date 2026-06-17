/**
 * Constellation rendering for the Dex: the star "sky" (one House's evolution tree
 * as glow-dot stars joined by faint lineage lines) and the focus rail (the
 * selected star's real sprite + meta, or a square "?" tile when undiscovered).
 *
 * The two color maps stay disjoint (renderer law): GRADE_ACCENT carries rarity
 * (the star's glow), houseColor carries identity (the lineage lines). Pure draw
 * given (nodes, selection, frame) so golden frames stay deterministic.
 */

import {
  BATTLE_READY_STAGE,
  isBattleReady,
  type DexSnapshot,
  type House,
} from '@token-tamers/core';
import { mix, type Rgb } from '../terminal/ansi';
import { pageBodyBottom } from '../components';
import {
  buildPalette,
  drawSprite,
  subcellRows,
  subcellCols,
  GRADE_ACCENT,
  GRADE_BADGE,
} from '../render/sprite';
import { QMARK_TILE, LOCKED_PALETTE, legendPalette } from '../render/tiles';
import { findSpecies, findSprite, houseColor, houseTint } from '../helpers/lookup';
import type { HouseNode } from './dex';
import type { RenderContext } from './types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Below this canvas width the focus rail is dropped (the sky takes the full width). */
export const RAIL_MIN_COLS = 58;

const SKY: Rgb = { r: 9, g: 12, b: 20 };
const LOCKED_STAR: Rgb = { r: 92, g: 98, b: 122 };
const SELECT_BG: Rgb = { r: 40, g: 48, b: 78 };
const RULE: Rgb = { r: 52, g: 58, b: 80 };
const TEXT: Rgb = { r: 214, g: 220, b: 234 };
const DIM: Rgb = { r: 120, g: 126, b: 146 };
const READY: Rgb = { r: 74, g: 222, b: 128 };
const SEALED: Rgb = { r: 150, g: 152, b: 160 };
const LEGEND_GOLD: Rgb = { r: 251, g: 191, b: 36 };
const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const MOTE_STAR: Rgb = { r: 236, g: 230, b: 208 };

/** A small palette of dim hues for the decorative background starfield. */
const FIELD_COLORS: Rgb[] = [
  { r: 130, g: 150, b: 210 }, // pale blue
  { r: 210, g: 210, b: 235 }, // white
  { r: 210, g: 180, b: 110 }, // faint gold
  { r: 130, g: 205, b: 205 }, // cyan
  { r: 205, g: 140, b: 180 }, // rose
];
const FIELD_GLYPHS = ['·', '˚', '.', '⋆'] as const;

const HOUSE_KINGDOM: Record<House, string> = {
  aether: 'Sky Court',
  cipher: 'Crag Beasts',
  flux: 'Tide Runners',
  forge: 'Iron Brood',
  wild: 'The Bloom',
};

function titleCase(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

// ─── Sky ─────────────────────────────────────────────────────────────────────

interface Placed {
  node: HouseNode;
  idx: number;
  x: number;
  y: number;
}

/**
 * Deterministic per-House seed (FNV-style over the House name + a salt). Drives
 * each sky's distinct star pattern — same House always lays out identically, so
 * golden frames stay stable; different Houses diverge.
 */
function seed(house: string, salt: number): number {
  let h = Math.imul(salt + 1, 2654435761) >>> 0;
  for (let i = 0; i < house.length; i++) h = Math.imul(h ^ house.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Lay the stars out by tier (apex at the top, sprite just above the Mote at the
 * foot), but give each House its OWN pattern: a per-House spine "sway" (a sine
 * bend keyed off the House) plus a per-star twinkle (a seeded x/y nudge). The
 * bottom two rows are reserved for the shared Mote anchor.
 */
function placeNodes(nodes: HouseNode[], rect: Rect, house: string): Placed[] {
  if (nodes.length === 0) return [];
  let minTier = Infinity;
  let maxTier = -Infinity;
  for (const n of nodes) {
    if (n.tier < minTier) minTier = n.tier;
    if (n.tier > maxTier) maxTier = n.tier;
  }
  const span = Math.max(1, maxTier - minTier);
  const top = rect.y;
  const bottom = Math.max(top + 1, rect.y + rect.h - 3); // reserve the foot for the Mote
  const phase = (seed(house, 0) % 628) / 100; // 0..2π, the House's spine bend
  const byTier = new Map<number, HouseNode[]>();
  for (const n of nodes) {
    const list = byTier.get(n.tier) ?? [];
    list.push(n);
    byTier.set(n.tier, list);
  }
  const indexOf = new Map(nodes.map((n, i) => [n.speciesId, i]));
  const out: Placed[] = [];
  for (const [tier, tierNodes] of byTier) {
    const baseRow = top + Math.round(((maxTier - tier) * (bottom - top)) / span);
    const sway = Math.round(Math.sin(tier * 0.95 + phase) * rect.w * 0.1);
    const slot = rect.w / (tierNodes.length + 1);
    tierNodes.forEach((node, i) => {
      const idx = indexOf.get(node.speciesId) ?? 0;
      // The Mote anchors dead-center at the very foot — no sway/jitter.
      if (node.stage === 'egg') {
        out.push({ node, idx, x: rect.x + Math.floor(rect.w / 2), y: rect.y + rect.h - 1 });
        return;
      }
      const s = seed(house, node.num);
      const jitterX = Math.round(((s % 100) / 100 - 0.5) * slot * 0.55);
      const jitterY = (Math.floor(s / 100) % 3) - 1;
      const x = clamp(
        Math.round(rect.x + (i + 1) * slot) + sway + jitterX,
        rect.x + 1,
        rect.x + rect.w - 2,
      );
      const y = clamp(baseRow + jitterY, top, bottom);
      out.push({ node, idx, x, y });
    });
  }
  return out;
}

/**
 * One faint dotted lineage line from each star down to its NEAREST in-House
 * parent — a single clean spine per node keeps the sky readable (the full
 * multi-parent branching lives in the detail view), not a dense web.
 */
function drawLines(ctx: RenderContext, placed: Placed[], house: House): void {
  const { buf } = ctx;
  const dim = mix(houseColor(house), SKY, 0.5);
  const posById = new Map(placed.map((p) => [p.node.speciesId, p]));
  for (const p of placed) {
    let nearest: Placed | undefined;
    let best = Infinity;
    for (const parentId of p.node.parents) {
      const par = posById.get(parentId);
      if (!par) continue;
      const d = Math.hypot(par.x - p.x, par.y - p.y);
      if (d < best) {
        best = d;
        nearest = par;
      }
    }
    if (nearest) drawDots(buf, p, nearest, dim);
  }
}

interface Pt {
  x: number;
  y: number;
}

function drawDots(buf: RenderContext['buf'], a: Pt, b: Pt, color: Rgb): void {
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  for (let s = 1; s < steps; s++) {
    const x = Math.round(a.x + ((b.x - a.x) * s) / steps);
    const y = Math.round(a.y + ((b.y - a.y) * s) / steps);
    if (buf.get(x, y).ch === ' ') {
      buf.set(x, y, { ch: '·', fg: color, bg: null });
    }
  }
}

/** Base color of a star by state (egg origin / owned grade glow / legend / locked). */
function starColor(node: HouseNode): Rgb {
  if (node.stage === 'egg') return MOTE_STAR;
  if (node.owned && node.grade) return GRADE_ACCENT[node.grade];
  return node.legend ? LEGEND_GOLD : LOCKED_STAR;
}

/** A single star: grade-glow badge if owned, ✦ for the Mote, dim "?" if unseen. */
function drawStar(ctx: RenderContext, p: Placed, selected: boolean): void {
  const { buf, hits, frame, mode } = ctx;
  const { node } = p;
  const bright = node.stage === 'egg' || node.owned;
  const glyph =
    node.stage === 'egg' ? '✦' : node.owned && node.grade ? GRADE_BADGE[node.grade] : '?';
  let fg = starColor(node);
  // Shine: bright stars twinkle on a per-star phase (a no-op in --no-color).
  if (bright && mode !== 'none') {
    const tw = (Math.sin(frame * 0.3 + node.num) + 1) / 2;
    fg = mix(fg, WHITE, 0.12 + tw * 0.32);
  }
  if (selected) fg = mix(fg, WHITE, 0.4);
  const bg = selected ? SELECT_BG : null;
  if (selected) buf.set(p.x - 1, p.y, { ch: ' ', fg: null, bg });
  buf.textBold(p.x, p.y, glyph, fg, bg);
  if (selected) buf.set(p.x + 1, p.y, { ch: ' ', fg: null, bg });
  drawStarLabel(ctx, p, selected);
  if (selected) drawSelectAura(ctx, p);
  hits.add(`dex:star:${p.idx}`, p.x - 1, p.y, 3, 1);
}

/** The Mote's label sits beside it; an owned star's name sits on the row below. */
function drawStarLabel(ctx: RenderContext, p: Placed, selected: boolean): void {
  const { buf } = ctx;
  const { node } = p;
  const fg = selected ? TEXT : DIM;
  if (node.stage === 'egg') {
    buf.text(p.x + 2, p.y, 'Mote', fg, null);
    return;
  }
  if (node.owned && p.y + 1 < pageBodyBottom(ctx.layout)) {
    const label = node.name.slice(0, 9);
    buf.text(p.x - Math.floor(label.length / 2), p.y + 1, label, fg, null);
  }
}

/** A twinkling sparkle aura around the selected star (color modes only). */
function drawSelectAura(ctx: RenderContext, p: Placed): void {
  if (ctx.mode === 'none') return;
  const { buf, frame } = ctx;
  const spots = [
    { x: p.x - 2, y: p.y },
    { x: p.x + 2, y: p.y },
    { x: p.x, y: p.y - 1 },
  ];
  spots.forEach((s, i) => {
    if ((frame + i) % 3 !== 0) return;
    if (buf.get(s.x, s.y).ch !== ' ') return;
    buf.text(
      s.x,
      s.y,
      FIELD_GLYPHS[(frame + i) % FIELD_GLYPHS.length]!,
      mix(WHITE, SKY, 0.2),
      null,
    );
  });
}

/**
 * A sparse, multi-hued, twinkling background starfield drawn into the sky's
 * voids. Pure decoration, so it's color-modes-only (skipped in --no-color, which
 * keeps golden frames clean) and only ever fills already-empty cells.
 */
function drawStarfield(ctx: RenderContext, rect: Rect): void {
  if (ctx.mode === 'none') return;
  const { buf, frame } = ctx;
  const count = Math.floor((rect.w * rect.h) / 32);
  for (let i = 0; i < count; i++) {
    const s = seed('starfield', i * 7 + 1);
    const x = rect.x + (s % Math.max(1, rect.w));
    const y = rect.y + (Math.floor(s / 131) % Math.max(1, rect.h));
    if ((frame + (s % 11)) % 11 < 2) continue; // brief blink-off
    if (buf.get(x, y).ch !== ' ') continue;
    const color = FIELD_COLORS[s % FIELD_COLORS.length]!;
    const lit = (Math.sin(frame * 0.2 + i) + 1) / 2;
    buf.set(x, y, {
      ch: FIELD_GLYPHS[(s >>> 4) % FIELD_GLYPHS.length]!,
      fg: mix(color, SKY, 0.45 + lit * 0.25),
      bg: null,
    });
  }
}

/** Render one House's sky into `rect`. Returns nothing; draws + registers hits. */
export function renderSky(
  ctx: RenderContext,
  rect: Rect,
  nodes: HouseNode[],
  selected: number,
  house: House,
): void {
  const placed = placeNodes(nodes, rect, house);
  // No discovered/known species beyond the Mote → a gentle hint above the origin.
  if (!placed.some((p) => p.node.stage !== 'egg')) {
    ctx.buf.text(
      rect.x + 2,
      rect.y + Math.floor(rect.h / 2),
      'No stars in this sky yet.',
      DIM,
      null,
    );
  }
  drawLines(ctx, placed, house);
  for (const p of placed) drawStar(ctx, p, p.idx === selected);
  drawStarfield(ctx, rect);
}

// ─── Focus rail ────────────────────────────────────────────────────────────

function statLine(s: DexSnapshot['stats']): string {
  const p = (n: number) => String(n).padStart(3);
  return `${p(s.pwr)}/${p(s.spd)}/${p(s.wis)}/${p(s.grt)}`;
}

/** Draw the selected star's sprite (owned) or a square "?" tile (locked/legend). */
function drawRailIcon(
  ctx: RenderContext,
  rect: Rect,
  node: HouseNode | undefined,
  house: House,
  rows: number,
): void {
  const { buf, frame, mode } = ctx;
  const top = rect.y + 1;
  const cx = rect.x + Math.floor(rect.w / 2);
  if (node?.owned) {
    const sprite = findSprite(ctx.pack, findSpecies(ctx.pack, node.speciesId)?.spriteId ?? '');
    if (sprite) {
      const scale = rows / Math.max(1, subcellRows(sprite.height));
      const destW = Math.max(1, Math.round(subcellCols(sprite.width) * scale));
      const pal = buildPalette(
        houseTint(house),
        node.grade ?? 'C',
        frame,
        findSpecies(ctx.pack, node.speciesId)?.accent,
      );
      drawSprite(buf, sprite, pal, {
        x: cx - Math.floor(destW / 2),
        y: top,
        destW,
        destH: rows,
        frame,
        mode,
      });
    }
    return;
  }
  // Undiscovered: the square "?" tile (gold + aura for a reserved legend slot).
  const legend = node?.legend ?? false;
  const pal = legend ? legendPalette(frame) : LOCKED_PALETTE;
  const scale = rows / 8; // QMARK_TILE is 16px tall = 8 cell rows native.
  const destW = Math.max(1, Math.round(16 * scale));
  const left = cx - Math.floor(destW / 2);
  drawSprite(buf, QMARK_TILE, pal, { x: left, y: top, destW, destH: rows, frame, mode });
  if (legend) drawLegendAura(ctx, left, top, destW, rows);
}

/** Sparkle aura that marks a reserved legend tile (twinkles deterministically). */
function drawLegendAura(ctx: RenderContext, x: number, y: number, w: number, h: number): void {
  const spots = [
    { x: x - 1, y, c: '✦' },
    { x: x + w, y: y + 1, c: '·' },
    { x: x + Math.floor(w / 2), y: y - 1, c: '˚' },
    { x: x + w, y: y + h - 1, c: '✦' },
  ];
  spots.forEach((s, i) => {
    if ((ctx.frame + i) % 3 === 0) ctx.buf.text(s.x, s.y, s.c, LEGEND_GOLD, null);
  });
}

/** The right-hand focus rail: icon + the selected species' identity & records. */
/** A focus-rail text line in priority order (drawn top-down while it fits). */
interface RailLine {
  text: string;
  color: Rgb;
  bold?: boolean;
}

/** Sprite footprint (rows) the rail icon gets at a given rail height — shrinks,
 *  then drops to 0, on a short rail so the text lines below it stay visible. */
function iconRowsFor(railH: number): number {
  return railH >= 11 ? 6 : railH >= 8 ? 3 : 0;
}

export function renderFocusRail(
  ctx: RenderContext,
  rect: Rect,
  node: HouseNode | undefined,
  house: House,
): void {
  const { buf } = ctx;
  for (let i = 0; i < rect.h; i++) buf.set(rect.x, rect.y + i, { ch: '│', fg: RULE, bg: null });
  const ix = rect.x + 2;
  const iconRows = iconRowsFor(rect.h);
  const metaY = rect.y + (iconRows > 0 ? iconRows + 1 : 1);
  if (node?.stage === 'egg') {
    drawMoteRail(ctx, { ...rect, x: ix, w: rect.w - 3 }, node, house, metaY);
    return;
  }
  if (iconRows > 0) drawRailIcon(ctx, { ...rect, x: ix, w: rect.w - 3 }, node, house, iconRows);
  // Priority order: identity → stage → battle-ready (the only eligibility cue on
  // the Dex) → stats → secondary house/Dex#/open. Drawn top-down while rows fit,
  // so a short rail keeps the IMPORTANT lines and sheds the secondary ones.
  const lines = node ? railLines(ctx, node, house) : [{ text: '???', color: SEALED, bold: true }];
  const bottom = pageBodyBottom(ctx.layout);
  let y = metaY;
  for (const ln of lines) {
    if (y >= bottom) break;
    if (ln.text) {
      if (ln.bold) buf.textBold(ix, y, ln.text, ln.color, null);
      else buf.text(ix, y, ln.text, ln.color, null);
    }
    y += 1;
  }
}

/** The focus-rail lines for a non-egg star, most-important first. */
function railLines(ctx: RenderContext, node: HouseNode, house: House): RailLine[] {
  const houseLine = { text: `${titleCase(house)} · ${HOUSE_KINGDOM[house]}`, color: DIM };
  const dexLine = { text: `Dex #${String(node.num).padStart(3, '0')}`, color: DIM };
  if (!(node.owned && node.grade)) {
    const title = node.legend ? '??? ✦' : '???';
    const hint = node.legend ? 'A legend sleeps here.' : 'Undiscovered — raise it to a molt.';
    return [
      { text: title, color: node.legend ? LEGEND_GOLD : SEALED, bold: true },
      houseLine,
      dexLine,
      { text: hint, color: DIM },
    ];
  }
  const best = ctx.state.dexRecords.find((r) => r.speciesId === node.speciesId)?.top[0];
  const grade = node.grade!;
  const lines: RailLine[] = [
    { text: `${node.name} ${GRADE_BADGE[grade]}`, color: GRADE_ACCENT[grade], bold: true },
    { text: titleCase(node.stage), color: TEXT },
  ];
  if (best) {
    const ready = isBattleReady(best);
    const tag = ready ? '✦ Battle-ready' : `▢ Sealed → ${titleCase(BATTLE_READY_STAGE)}`;
    lines.push(
      { text: tag, color: ready ? READY : SEALED },
      { text: statLine(best.stats), color: TEXT },
    );
  }
  lines.push(houseLine, dexLine, { text: '⏎ open', color: DIM });
  return lines;
}

/** The Mote focus panel: its sprite (tinted to the sky) + origin copy. */
function drawMoteRail(
  ctx: RenderContext,
  rect: Rect,
  node: HouseNode,
  house: House,
  metaY: number,
): void {
  const { buf, frame, mode } = ctx;
  const rows = Math.min(6, Math.max(3, rect.h - 6));
  const cx = rect.x + Math.floor(rect.w / 2);
  const sprite = findSprite(ctx.pack, findSpecies(ctx.pack, node.speciesId)?.spriteId ?? '');
  if (sprite) {
    const scale = rows / Math.max(1, subcellRows(sprite.height));
    const destW = Math.max(1, Math.round(subcellCols(sprite.width) * scale));
    const accent = findSpecies(ctx.pack, node.speciesId)?.accent;
    drawSprite(buf, sprite, buildPalette(houseTint(house), 'B', frame, accent), {
      x: cx - Math.floor(destW / 2),
      y: rect.y + 1,
      destW,
      destH: rows,
      frame,
      mode,
    });
  } else {
    buf.textBold(cx, rect.y + 1 + Math.floor(rows / 2), '✦', MOTE_STAR, null);
  }
  // Origin copy, drawn top-down only while each line stays within the page body.
  const bottom = pageBodyBottom(ctx.layout);
  const lore = ['The shared origin —', 'every tamer begins', 'here, then commits', 'to a House.'];
  if (metaY < bottom) buf.textBold(rect.x, metaY, 'Mote ✦', MOTE_STAR, null);
  lore.forEach((t, i) => {
    if (metaY + 1 + i < bottom) buf.text(rect.x, metaY + 1 + i, t, DIM, null);
  });
}
