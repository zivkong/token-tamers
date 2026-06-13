/**
 * Pet vitals panel — the section between the game canvas and the menu.
 *
 * Three full-width rows, deliberately free of any evolution/stage hints (those
 * stay a mystery — see pet.ts):
 *
 *   STATS   PWR ████░ 12   SPD ███░░ 9   WIS █████ 15   GRT ███░░ 11
 *   Intake  ▕███████░░░▏  6 windows fed · ~24.3k/window      last roll: …
 *   Diet    ▕██████░░░░▏  aether 70% · cipher 30%
 *
 * Everything is a pure function of GameState (stats, token baselines, diet
 * genes) so golden frames stay deterministic.
 */

import { hexToRgb, mix, type Rgb } from '../terminal/ansi';
import type { FrameBuffer } from '../render/buffer';
import { houseTint } from '../helpers/lookup';
import { renderGradeOddsLine } from '../helpers/status';
import type { RenderContext } from './types';
import type { SceneRect } from '../render/layout';
import type { GameState } from '@token-tamers/core';

const FULL = String.fromCodePoint(0x2588); // █
const LIGHT = String.fromCodePoint(0x2591); // ░

const LABEL: Rgb = { r: 122, g: 132, b: 158 };
const VALUE: Rgb = { r: 222, g: 228, b: 240 };
const MUTED: Rgb = { r: 120, g: 126, b: 146 };
const BAR_EMPTY: Rgb = { r: 44, g: 50, b: 70 };
const UNKNOWN_TINT: Rgb = { r: 96, g: 102, b: 122 };

/** A "full" active-window intake used to scale the appetite gauge. */
const WINDOW_TOKENS_FULL = 150_000;

/** Draw the three-row vitals panel into `panel`. */
export function renderVitals(ctx: RenderContext, panel: SceneRect): void {
  drawStatsRow(ctx, panel, panel.y);
  drawIntakeRow(ctx, panel, panel.y + 1);
  drawDietRow(ctx, panel, panel.y + 2);
}

/** Row 1 — the four stat bars across the full width. */
function drawStatsRow(ctx: RenderContext, panel: SceneRect, y: number): void {
  const { buf, pack, state } = ctx;
  const s = state.pet.stats;
  const cells: Array<[string, number]> = [
    ['PWR', s.pwr],
    ['SPD', s.spd],
    ['WIS', s.wis],
    ['GRT', s.grt],
  ];
  const max = Math.max(1, ...cells.map(([, v]) => v));
  const fill = mix(hexToRgb(houseTint(pack, state.pet.house)), VALUE, 0.15);
  const cellW = Math.floor(panel.cols / cells.length);

  cells.forEach(([name, val], i) => {
    const cx = panel.x + i * cellW + 1;
    buf.text(cx, y, name, LABEL, null);
    const valStr = String(val).padStart(2);
    const barX = cx + 4;
    const barW = Math.max(3, cellW - 4 - valStr.length - 3);
    drawBar(buf, { x: barX, y, w: barW }, val / max, fill);
    buf.text(barX + barW + 1, y, valStr, VALUE, null);
  });
}

/** Row 2 — token-consumption appetite gauge + lifetime nourishment + odds. */
function drawIntakeRow(ctx: RenderContext, panel: SceneRect, y: number): void {
  const { buf, state } = ctx;
  const { windows, avgTokens } = consumptionSummary(state);
  const fill = mix(hexToRgb(houseTint(ctx.pack, state.pet.house)), VALUE, 0.15);

  buf.text(panel.x + 1, y, 'Intake', LABEL, null);

  // Reserve the right edge for the grade-roll odds (transparency invariant).
  const odds = renderGradeOddsLine(state);
  const oddsX = panel.x + panel.cols - odds.length - 1;
  buf.text(oddsX, y, odds, MUTED, null);

  const gaugeX = panel.x + 8;
  if (windows === 0) {
    buf.text(gaugeX, y, 'awaiting first usage', MUTED, null);
    return;
  }
  const gaugeW = 12;
  drawBar(buf, { x: gaugeX, y, w: gaugeW }, avgTokens / WINDOW_TOKENS_FULL, fill);
  // Fit the nourishment text in the gap between the gauge and the odds.
  const textX = gaugeX + gaugeW + 2;
  const avail = oddsX - 1 - textX;
  if (avail > 0) {
    const text = `${windows} window${windows === 1 ? '' : 's'} fed · ~${fmtTokens(avgTokens)}/window`;
    buf.text(textX, y, text.slice(0, avail), VALUE, null);
  }
}

/** Row 3 — the diet composition: a tinted stacked bar + a percentage legend. */
function drawDietRow(ctx: RenderContext, panel: SceneRect, y: number): void {
  const { buf } = ctx;
  buf.text(panel.x + 1, y, 'Diet', LABEL, null);
  const barX = panel.x + 8;

  const diet = dietBreakdown(ctx);
  if (diet.length === 0) {
    buf.text(barX, y, 'no intake recorded yet', MUTED, null);
    return;
  }

  const barW = 12;
  let bx = barX;
  for (const seg of diet) {
    const cells = Math.round(seg.frac * barW);
    for (let i = 0; i < cells && bx < barX + barW; i++) {
      buf.set(bx++, y, { ch: FULL, fg: seg.tint, bg: null });
    }
  }
  while (bx < barX + barW) buf.set(bx++, y, { ch: LIGHT, fg: BAR_EMPTY, bg: null });

  const legend = diet
    .slice(0, 3)
    .map((s) => `${s.name} ${Math.round(s.frac * 100)}%`)
    .join(' · ');
  buf.text(barX + barW + 2, y, legend, VALUE, null);
}

// ---------------------------------------------------------------------------
// Pure helpers.
// ---------------------------------------------------------------------------

/** Draw a `w`-cell bar at (x,y) filled to `frac` (0..1) with `fill`/empty colors. */
function drawBar(
  buf: FrameBuffer,
  at: { x: number; y: number; w: number },
  frac: number,
  fill: Rgb,
): void {
  const f = frac < 0 ? 0 : frac > 1 ? 1 : frac;
  const filled = Math.round(f * at.w);
  for (let i = 0; i < at.w; i++) {
    const on = i < filled;
    buf.set(at.x + i, at.y, { ch: on ? FULL : LIGHT, fg: on ? fill : BAR_EMPTY, bg: null });
  }
}

/** Aggregate the per-adapter token baselines into a single nourishment view. */
function consumptionSummary(state: GameState): { windows: number; avgTokens: number } {
  let windows = 0;
  let avgTokens = 0;
  for (const b of Object.values(state.baselines)) {
    windows = Math.max(windows, b.windowsObserved);
    avgTokens += b.meanWindowTokens;
  }
  return { windows, avgTokens };
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

/** Compact token count: 24300 → '24.3k', 1_500_000 → '1.5M'. */
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}
