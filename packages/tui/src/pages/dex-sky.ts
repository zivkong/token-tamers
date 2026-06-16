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
import { buildPalette, drawSprite, GRADE_ACCENT, GRADE_BADGE } from '../render/sprite';
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
      const s = seed(house, node.num);
      const jitterX = Math.round(((s % 100) / 100 - 0.5) * slot * 0.55);
      const jitterY = (Math.floor(s / 100) % 3) - 1;
      const x = clamp(
        Math.round(rect.x + (i + 1) * slot) + sway + jitterX,
        rect.x + 1,
        rect.x + rect.w - 2,
      );
      const y = clamp(baseRow + jitterY, top, bottom);
      out.push({ node, idx: indexOf.get(node.speciesId) ?? 0, x, y });
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

/** A single star: grade-glow badge if owned, dim "?" if not; highlight if selected. */
function drawStar(ctx: RenderContext, p: Placed, selected: boolean): void {
  const { buf, hits } = ctx;
  const { node } = p;
  const glyph = node.owned && node.grade ? GRADE_BADGE[node.grade] : '?';
  let fg: Rgb =
    node.owned && node.grade ? GRADE_ACCENT[node.grade] : node.legend ? LEGEND_GOLD : LOCKED_STAR;
  if (selected) fg = mix(fg, { r: 255, g: 255, b: 255 }, 0.4);
  const bg = selected ? SELECT_BG : null;
  if (selected) buf.set(p.x - 1, p.y, { ch: ' ', fg: null, bg });
  buf.textBold(p.x, p.y, glyph, fg, bg);
  if (selected) buf.set(p.x + 1, p.y, { ch: ' ', fg: null, bg });
  // Name under owned stars when there's a row to spare (the field-guide read).
  if (node.owned && p.y + 1 < ctx.layout.canvasRows - 1) {
    const label = node.name.slice(0, 9);
    buf.text(p.x - Math.floor(label.length / 2), p.y + 1, label, selected ? TEXT : DIM, null);
  }
  hits.add(`dex:star:${p.idx}`, p.x - 1, p.y, 3, 1);
}

/** Render one House's sky into `rect`. Returns nothing; draws + registers hits. */
export function renderSky(
  ctx: RenderContext,
  rect: Rect,
  nodes: HouseNode[],
  selected: number,
  house: House,
): void {
  // The shared origin — every line descends to the Mote at the foot of the sky.
  const moteX = rect.x + Math.floor(rect.w / 2);
  const moteY = rect.y + rect.h - 1;
  if (nodes.length === 0) {
    ctx.buf.text(
      rect.x + 2,
      rect.y + Math.floor(rect.h / 2),
      'No stars in this sky yet.',
      DIM,
      null,
    );
    drawMote(ctx, moteX, moteY, house);
    return;
  }
  const placed = placeNodes(nodes, rect, house);
  drawLines(ctx, placed, house);
  // Root stars (the sprites) trail down to the Mote.
  const seedColor = mix(houseColor(house), SKY, 0.4);
  for (const p of placed) {
    if (p.node.parents.length === 0)
      drawDots(ctx.buf, { x: p.x, y: p.y }, { x: moteX, y: moteY }, seedColor);
  }
  for (const p of placed) drawStar(ctx, p, p.idx === selected);
  drawMote(ctx, moteX, moteY, house);
}

/** The shared origin star: a ✦ seed + label at the foot of every sky. */
function drawMote(ctx: RenderContext, x: number, y: number, house: House): void {
  ctx.buf.textBold(x, y, '✦', mix(houseColor(house), { r: 255, g: 255, b: 255 }, 0.35), null);
  ctx.buf.text(x + 2, y, 'Mote', DIM, null);
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
): void {
  const { buf, frame, mode } = ctx;
  const rows = Math.min(6, Math.max(3, rect.h - 6));
  const top = rect.y + 1;
  const cx = rect.x + Math.floor(rect.w / 2);
  if (node?.owned) {
    const sprite = findSprite(ctx.pack, findSpecies(ctx.pack, node.speciesId)?.spriteId ?? '');
    if (sprite) {
      const scale = rows / Math.max(1, Math.ceil(sprite.height / 2));
      const destW = Math.max(1, Math.round(sprite.width * scale));
      const pal = buildPalette(houseTint(house), node.grade ?? 'C', frame);
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
export function renderFocusRail(
  ctx: RenderContext,
  rect: Rect,
  node: HouseNode | undefined,
  house: House,
): void {
  const { buf } = ctx;
  for (let i = 0; i < rect.h; i++) buf.set(rect.x, rect.y + i, { ch: '│', fg: RULE, bg: null });
  const ix = rect.x + 2;
  drawRailIcon(ctx, { ...rect, x: ix, w: rect.w - 3 }, node, house);
  const metaY = rect.y + Math.min(6, Math.max(3, rect.h - 6)) + 2;
  if (!node) {
    buf.textBold(ix, metaY, '???', SEALED, null);
    return;
  }
  if (node.owned && node.grade) {
    buf.textBold(
      ix,
      metaY,
      `${node.name} ${GRADE_BADGE[node.grade]}`,
      GRADE_ACCENT[node.grade],
      null,
    );
  } else {
    buf.textBold(
      ix,
      metaY,
      node.legend ? '??? ✦' : '???',
      node.legend ? LEGEND_GOLD : SEALED,
      null,
    );
  }
  buf.text(ix, metaY + 1, `${titleCase(house)} · ${HOUSE_KINGDOM[house]}`, DIM, null);
  buf.text(ix, metaY + 2, `Dex #${String(node.num).padStart(3, '0')}`, DIM, null);
  drawRailRecord(ctx, ix, metaY + 3, node);
}

/** Stage + stats + readiness for an owned star; the locked hint otherwise. */
function drawRailRecord(ctx: RenderContext, x: number, y: number, node: HouseNode): void {
  const { buf } = ctx;
  if (!node.owned) {
    buf.text(x, y, node.legend ? 'A legend sleeps here.' : 'Undiscovered — raise it', DIM, null);
    buf.text(x, y + 1, node.legend ? '' : 'to a molt to reveal.', DIM, null);
    return;
  }
  const best = ctx.state.dexRecords.find((r) => r.speciesId === node.speciesId)?.top[0];
  buf.text(x, y, `${titleCase(node.stage)}`, TEXT, null);
  if (best) {
    buf.text(x, y + 1, statLine(best.stats), TEXT, null);
    if (isBattleReady(best)) buf.text(x, y + 2, '✦ Battle-ready', READY, null);
    else buf.text(x, y + 2, `▢ Sealed → ${titleCase(BATTLE_READY_STAGE)}`, SEALED, null);
  }
  buf.text(x, y + 3, '⏎ open', DIM, null);
}
