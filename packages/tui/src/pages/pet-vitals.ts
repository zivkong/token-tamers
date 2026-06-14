/**
 * Pet vitals panel — the section between the game canvas and the menu.
 *
 * Four rows, one per blank-spaced slot, deliberately free of evolution hints:
 *
 *   PWR ▓▓▓░ 12   SPD ▓▓░ 9    WIS ▓▓▓▓ 15   GRT ▓▓░ 11
 *
 *   Charge ▕████░░░░░░░░▏ 84.2M / 200M  +6% molt ↑
 *
 *   Diet   Aether 72% · Cipher 28%              last roll: C→B 38%
 *
 *   Progress ▕███░░░░░░░░▏ 16.7%
 *
 * The Charge row is the growth meter: the open window's raw tokens fill toward a
 * 200M "full" cap (segmented by the diet's House tints), and the molt-boost
 * preview is the REAL capped vitality bonus the engine will apply at the molt
 * (`vitalityBonus`). Everything else is a pure function of GameState; without a
 * live readout (golden tests) the Charge row shows an empty/awaiting state.
 */

import { hexToRgb, mix, type Rgb } from '../terminal/ansi';
import { VITALITY_FULL_TOKENS, vitalityBonus } from '@token-tamers/core';
import type { FrameBuffer } from '../render/buffer';
import { BAR_EMPTY, drawMeter } from '../components';
import { houseTint } from '../helpers/lookup';
import { renderGradeOddsLine } from '../helpers/status';
import type { RenderContext } from './types';
import type { SceneRect } from '../render/layout';

const FULL = String.fromCodePoint(0x2588); // █
const LIGHT = String.fromCodePoint(0x2591); // ░

const LABEL: Rgb = { r: 122, g: 132, b: 158 };
const VALUE: Rgb = { r: 222, g: 228, b: 240 };
const MUTED: Rgb = { r: 120, g: 126, b: 146 };
const UNKNOWN_TINT: Rgb = { r: 96, g: 102, b: 122 };
const CHARGE_FILL: Rgb = { r: 240, g: 196, b: 80 };

/** Per-stat bar reference (≈ half the 240 stage budget) so bars show headroom. */
const STAT_BAR_MAX = 120;
/** Below this width we drop to compact single-letter / shorter labels. */
const NARROW = 64;

/** Draw the vitals panel: stats / charge / diet (blank-spaced). */
export function renderVitals(ctx: RenderContext, panel: SceneRect): void {
  drawStatsRow(ctx, panel, panel.y);
  drawChargeRow(ctx, panel, panel.y + 2);
  drawDietRow(ctx, panel, panel.y + 4);
}

// ---------------------------------------------------------------------------
// Rows.
// ---------------------------------------------------------------------------

/** Row 1 — the four stat bars (normalized to a fixed cap so empty track shows). */
function drawStatsRow(ctx: RenderContext, panel: SceneRect, y: number): void {
  const { buf, pack, state } = ctx;
  const s = state.pet.stats;
  const cells: Array<[string, number]> = [
    ['PWR', s.pwr],
    ['SPD', s.spd],
    ['WIS', s.wis],
    ['GRT', s.grt],
  ];
  const fill = mix(hexToRgb(houseTint(pack, state.pet.house)), VALUE, 0.15);
  const cellW = Math.floor(panel.cols / cells.length);
  const narrow = panel.cols < NARROW;
  const labelW = narrow ? 1 : 3;

  cells.forEach(([name, val], i) => {
    const cx = panel.x + i * cellW + 1;
    const label = narrow ? (name[0] ?? '') : name;
    buf.text(cx, y, label, LABEL, null);
    const valStr = String(val).padStart(2);
    const barX = cx + labelW + 1;
    const barW = Math.max(2, cellW - labelW - valStr.length - 3);
    drawMeter(buf, { x: barX, y, w: barW }, val / STAT_BAR_MAX, fill);
    buf.text(barX + barW + 1, y, valStr, VALUE, null);
  });
}

/**
 * Row 2 — the growth charge meter: open-window tokens toward 200M, segmented by
 * diet, with the real capped molt-boost preview. Token counts only.
 */
function drawChargeRow(ctx: RenderContext, panel: SceneRect, y: number): void {
  const { buf } = ctx;
  const narrow = panel.cols < NARROW;
  buf.text(panel.x + 1, y, narrow ? 'Feed' : 'Charge', LABEL, null);
  const barX = panel.x + (narrow ? 6 : 8);
  const barW = narrow ? 8 : 12;

  const tokens = ctx.live?.windowTokens ?? 0;
  const frac = tokens / VITALITY_FULL_TOKENS;
  drawChargeBar(buf, { x: barX, y, w: barW }, frac, dietBreakdown(ctx));

  const textX = barX + barW + 2;
  const avail = panel.x + panel.cols - 1 - textX;
  if (!ctx.live) {
    buf.text(textX, y, 'feed your session'.slice(0, Math.max(0, avail)), MUTED, null);
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
// Bars + helpers.
// ---------------------------------------------------------------------------

/** Charge bar: fill toward 200M, the filled part tinted by the diet mix. */
function drawChargeBar(
  buf: FrameBuffer,
  at: { x: number; y: number; w: number },
  frac: number,
  diet: DietSegment[],
): void {
  const f = frac < 0 ? 0 : frac > 1 ? 1 : frac;
  const filled = Math.round(f * at.w);
  let i = 0;
  for (const seg of diet) {
    const cells = Math.round(seg.frac * filled);
    for (let k = 0; k < cells && i < filled; k++) {
      buf.set(at.x + i++, at.y, { ch: FULL, fg: seg.tint, bg: null });
    }
  }
  while (i < filled) buf.set(at.x + i++, at.y, { ch: FULL, fg: CHARGE_FILL, bg: null });
  while (i < at.w) buf.set(at.x + i++, at.y, { ch: LIGHT, fg: BAR_EMPTY, bg: null });
}

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
