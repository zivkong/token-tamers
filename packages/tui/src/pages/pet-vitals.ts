/**
 * Pet vitals panel — the section between the game canvas and the menu.
 *
 * Four rows, one per blank-spaced slot, deliberately free of evolution hints:
 *
 *   ◆ PWR: 12 | ↯ SPD: 9 | ✦ WIS: 15 | ▣ GRT: 11
 *
 *   Food   ▕████▒▒▒▒▒▒▒▒▏ 84.2M / 200M  +6% molt ↑
 *
 *   Diet   Aether 72% · Cipher 28%              last roll: C→B 38%
 *
 *   Progress ▕███░░░░░░░░▏ 16.7%
 *
 * The Food row is the growth meter: the open window's raw tokens fill toward a
 * 200M "full" cap (segmented by the diet's House tints), and the molt-boost
 * preview is the REAL capped vitality bonus the engine will apply at the molt
 * (`vitalityBonus`). Everything else is a pure function of GameState; without a
 * live readout (golden tests) the Food row shows an empty/awaiting state.
 */

import { hexToRgb, mix, type Rgb } from '../terminal/ansi';
import { VITALITY_FULL_TOKENS, vitalityBonus } from '@token-tamers/core';
import { drawSegmentedMeter } from '../components';
import { houseTint } from '../helpers/lookup';
import { renderGradeOddsLine } from '../helpers/status';
import type { FrameBuffer } from '../render/buffer';
import type { RenderContext } from './types';
import type { SceneRect } from '../render/layout';

const LABEL: Rgb = { r: 122, g: 132, b: 158 };
const VALUE: Rgb = { r: 222, g: 228, b: 240 };
const MUTED: Rgb = { r: 120, g: 126, b: 146 };
const UNKNOWN_TINT: Rgb = { r: 96, g: 102, b: 122 };
const FOOD_FILL: Rgb = { r: 240, g: 196, b: 80 };

/** Below this width we drop to compact labels. */
const NARROW = 64;

/** Per-stat icon (by codepoint to survive encoding): PWR ◆ · SPD ↯ · WIS ✦ · GRT ▣. */
const STAT_ICON = {
  PWR: String.fromCodePoint(0x25c6),
  SPD: String.fromCodePoint(0x21af),
  WIS: String.fromCodePoint(0x2726),
  GRT: String.fromCodePoint(0x25a3),
} as const;

/** Draw the vitals panel: stats / food / diet (blank-spaced). */
export function renderVitals(ctx: RenderContext, panel: SceneRect): void {
  drawStatsRow(ctx, panel, panel.y);
  drawFoodRow(ctx, panel, panel.y + 2);
  drawDietRow(ctx, panel, panel.y + 4);
}

// ---------------------------------------------------------------------------
// Rows.
// ---------------------------------------------------------------------------

/**
 * Row 1 — the four stats as plain readouts (no bar; stats are a fixed budget,
 * not progress), spread evenly across the FULL width: `◆ PWR: 12` … `▣ GRT: 11`,
 * first flush-left and last flush-right (space-between). Drops icons to a compact
 * `PWR 12` form when the full form can't fit, and still spreads it.
 */
function drawStatsRow(ctx: RenderContext, panel: SceneRect, y: number): void {
  const { buf, pack, state } = ctx;
  const s = state.pet.stats;
  const accent = mix(hexToRgb(houseTint(pack, state.pet.house)), VALUE, 0.1);
  const stats: Array<[string, number]> = [
    ['PWR', s.pwr],
    ['SPD', s.spd],
    ['WIS', s.wis],
    ['GRT', s.grt],
  ];
  const x0 = panel.x + 1;
  const available = panel.cols - 2;

  // Prefer the full `icon NAME: value` form; fall back to compact `NAME value`.
  let segs = stats.map(([nm, v]) => statParts(nm, v, accent, true));
  if (totalLen(segs) > available) segs = stats.map(([nm, v]) => statParts(nm, v, accent, false));

  const slack = available - totalLen(segs);
  if (slack >= 0) {
    drawJustified(buf, x0, y, segs, slack);
  } else {
    // Below even the compact width: left-pack and let it clip.
    let cx = x0;
    for (const seg of segs) {
      drawParts(buf, cx, y, seg);
      cx += partsLen(seg) + 1;
    }
  }
}

interface TextPart {
  text: string;
  color: Rgb;
}

/** Build one stat readout as colored parts (full `◆ NAME: v` or compact `NAME v`). */
function statParts(name: string, val: number, accent: Rgb, icons: boolean): TextPart[] {
  if (icons) {
    return [
      { text: `${STAT_ICON[name as keyof typeof STAT_ICON]} `, color: accent },
      { text: `${name}:`, color: LABEL },
      { text: ` ${val}`, color: VALUE },
    ];
  }
  return [
    { text: `${name} `, color: LABEL },
    { text: `${val}`, color: VALUE },
  ];
}

function partsLen(parts: readonly TextPart[]): number {
  return parts.reduce((n, p) => n + [...p.text].length, 0);
}

function totalLen(segs: ReadonlyArray<readonly TextPart[]>): number {
  return segs.reduce((n, s) => n + partsLen(s), 0);
}

function drawParts(buf: FrameBuffer, x: number, y: number, parts: readonly TextPart[]): void {
  let cx = x;
  for (const p of parts) {
    buf.text(cx, y, p.text, p.color, null);
    cx += [...p.text].length;
  }
}

/** Place segments space-between across the width: first at x0, last flush-right. */
function drawJustified(
  buf: FrameBuffer,
  x0: number,
  y: number,
  segs: ReadonlyArray<readonly TextPart[]>,
  slack: number,
): void {
  const gaps = segs.length - 1;
  let prev = 0;
  segs.forEach((seg, i) => {
    const x = x0 + prev + (gaps > 0 ? Math.round((slack * i) / gaps) : 0);
    drawParts(buf, x, y, seg);
    prev += partsLen(seg);
  });
}

/**
 * Row 2 — the growth FOOD meter: open-window tokens toward 200M, segmented by
 * diet, with the real capped molt-boost preview. Token counts only. (`Food` =
 * how much you've eaten this session; the `Diet` row below = what you've eaten.)
 */
function drawFoodRow(ctx: RenderContext, panel: SceneRect, y: number): void {
  const { buf } = ctx;
  const narrow = panel.cols < NARROW;
  buf.text(panel.x + 1, y, 'Food', LABEL, null);
  const barX = panel.x + 6;
  const barW = narrow ? 8 : 12;

  const tokens = ctx.live?.windowTokens ?? 0;
  const frac = tokens / VITALITY_FULL_TOKENS;
  // The filled portion is tinted by the diet mix; the rest is the standard track.
  const segments = dietBreakdown(ctx).map((d) => ({ frac: d.frac, color: d.tint }));
  drawSegmentedMeter(buf, { x: barX, y, w: barW }, frac, segments, FOOD_FILL);

  const textX = barX + barW + 2;
  const avail = panel.x + panel.cols - 1 - textX;
  if (!ctx.live) {
    buf.text(textX, y, 'no food yet'.slice(0, Math.max(0, avail)), MUTED, null);
    return;
  }
  const bonusPct = Math.round(vitalityBonus(tokens) * 100);
  const arrow = bonusPct > 0 ? ' ↑' : '';
  const text = `${fmtTokens(tokens)} / 200M  +${bonusPct}% molt${arrow}`;
  if (avail > 0) buf.text(textX, y, text.slice(0, avail), bonusPct > 0 ? VALUE : MUTED, null);
}

/** Row 3 — diet composition legend + the grade-roll odds (transparency). */
function drawDietRow(ctx: RenderContext, panel: SceneRect, y: number): void {
  const { buf, state } = ctx;
  const narrow = panel.cols < NARROW;
  buf.text(panel.x + 1, y, 'Diet', LABEL, null);
  const legendX = panel.x + 6;

  // Grade-roll odds stay visible (transparency invariant), right-aligned.
  const odds = renderGradeOddsLine(state);
  const oddsX = panel.x + panel.cols - odds.length - 1;
  if (!narrow) buf.text(oddsX, y, odds, MUTED, null);

  const diet = dietBreakdown(ctx);
  const rightLimit = narrow ? panel.x + panel.cols - 1 : oddsX - 1;
  if (diet.length === 0) {
    buf.text(legendX, y, 'no intake yet', MUTED, null);
    return;
  }
  const legend = diet
    .slice(0, 3)
    .map((d) => `${narrow ? d.name.slice(0, 1) : d.name} ${Math.round(d.frac * 100)}%`)
    .join(narrow ? ' ' : ' · ');
  const avail = rightLimit - legendX;
  if (avail > 0) buf.text(legendX, y, legend.slice(0, avail), VALUE, null);
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

interface DietSegment {
  name: string;
  tint: Rgb;
  frac: number;
}

/** Resolve the pet's diet genes into named, tinted, normalized segments. */
function dietBreakdown(ctx: RenderContext): DietSegment[] {
  const genes = Object.entries(ctx.state.pet.dietGenes).filter(([, v]) => v > 0);
  const total = genes.reduce((sum, [, v]) => sum + v, 0);
  if (total <= 0) return [];
  return genes
    .map(([geneId, essence]) => {
      const rule = ctx.pack.models.find((m) => m.geneId === geneId);
      return {
        name: rule ? capitalize(rule.house) : '???',
        tint: rule ? hexToRgb(rule.tint) : UNKNOWN_TINT,
        frac: essence / total,
      };
    })
    .sort((a, b) => b.frac - a.frac);
}

function capitalize(s: string): string {
  return s.length === 0 ? s : `${s[0]?.toUpperCase()}${s.slice(1)}`;
}

/** Compact token count: 84_200_000 → '84.2M', 24_300 → '24.3k'. */
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}
