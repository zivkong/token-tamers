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

/** Lay nodes out by tier (apex at the top of the sky, sprite/egg at the bottom). */
function placeNodes(nodes: HouseNode[], rect: Rect): Placed[] {
  if (nodes.length === 0) return [];
  let minTier = Infinity;
  let maxTier = -Infinity;
  for (const n of nodes) {
    if (n.tier < minTier) minTier = n.tier;
    if (n.tier > maxTier) maxTier = n.tier;
  }
  const span = Math.max(1, maxTier - minTier);
  const byTier = new Map<number, HouseNode[]>();
  for (const n of nodes) {
    const list = byTier.get(n.tier) ?? [];
    list.push(n);
    byTier.set(n.tier, list);
  }
  const indexOf = new Map(nodes.map((n, i) => [n.speciesId, i]));
  const out: Placed[] = [];
  for (const [tier, tierNodes] of byTier) {
    const ry = rect.y + Math.round(((maxTier - tier) * (rect.h - 1)) / span);
    tierNodes.forEach((node, i) => {
      const rx = rect.x + Math.round(((i + 1) * rect.w) / (tierNodes.length + 1));
      out.push({ node, idx: indexOf.get(node.speciesId) ?? 0, x: rx, y: ry });
    });
  }
  return out;
}

/** Faint dotted lineage line from each node down to its in-House parents. */
function drawLines(ctx: RenderContext, placed: Placed[], house: House): void {
  const { buf } = ctx;
  const dim = mix(houseColor(house), SKY, 0.5);
  const posById = new Map(placed.map((p) => [p.node.speciesId, p]));
  for (const p of placed) {
    for (const parentId of p.node.parents) {
      const par = posById.get(parentId);
      if (par) drawDots(buf, p, par, dim);
    }
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
  if (nodes.length === 0) {
    ctx.buf.text(
      rect.x + 2,
      rect.y + Math.floor(rect.h / 2),
      'No stars in this sky yet.',
      DIM,
      null,
    );
    return;
  }
  const placed = placeNodes(nodes, rect);
  drawLines(ctx, placed, house);
  for (const p of placed) drawStar(ctx, p, p.idx === selected);
  // The shared origin seed, anchored at the foot of every sky.
  const seedY = rect.y + rect.h - 1;
  ctx.buf.text(rect.x + 1, seedY, '✦ from the Mote', mix(houseColor(house), SKY, 0.3), null);
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
