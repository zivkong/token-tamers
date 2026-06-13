/**
 * Pet vitals panel — the section between the game canvas and the menu.
 *
 * Stat / feeding / diet rows separated by blank spacer rows, deliberately free
 * of any evolution/stage hints (those stay a mystery — see pet.ts):
 *
 *   PWR ████░ 12   SPD ███░░ 9   WIS █████ 15   GRT ███░░ 11
 *
 *   Feeding ▕███████░░░▏ this window 24.3k tok · 1.3× baseline ↑   fed 6 windows
 *
 *   Diet    ▕██████░░░░▏ Aether 70% · Cipher 30%            last roll: C→B 38%
 *
 * The feeding row is REAL-TIME: it reads `ctx.live` (the engine's open window),
 * so token usage visibly feeds the pet and previews the next molt's odds. The
 * rest is a pure function of GameState; without `ctx.live` (golden tests) the
 * feeding row falls back to a static baseline summary, keeping frames stable.
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

/** Draw the vitals panel into `panel`: stats / (gap) / feeding / (gap) / diet. */
export function renderVitals(ctx: RenderContext, panel: SceneRect): void {
  drawStatsRow(ctx, panel, panel.y);
  drawFeedingRow(ctx, panel, panel.y + 2);
  drawDietRow(ctx, panel, panel.y + 4);
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

/**
 * Row 2 — REAL-TIME feeding: the open window's tokens vs the pet's baseline
 * appetite. The gauge climbs as usage lands; passing the baseline (1×) means the
 * next molt rolls grade at better odds. Falls back to a static baseline summary
 * when no live readout is available (golden tests).
 */
function drawFeedingRow(ctx: RenderContext, panel: SceneRect, y: number): void {
  const { buf, state } = ctx;
  const live = ctx.live;
  const fill = mix(hexToRgb(houseTint(ctx.pack, state.pet.house)), VALUE, 0.15);

  buf.text(panel.x + 1, y, 'Feeding', LABEL, null);
  const gaugeX = panel.x + 9;

  // Right edge: lifetime feedings (windows the pet has closed).
  const windows = live ? live.windowsObserved : consumptionSummary(state).windows;
  const right = `fed ${windows} window${windows === 1 ? '' : 's'}`;
  const rightX = panel.x + panel.cols - right.length - 1;
  buf.text(rightX, y, right, MUTED, null);

  if (!live) {
    const { windows: w, avgTokens } = consumptionSummary(state);
    const text =
      w > 0 ? `~${fmtTokens(avgTokens)} essence/window baseline` : 'awaiting first usage';
    buf.text(gaugeX, y, text, MUTED, null);
    return;
  }

  const gaugeW = 12;
  const textX = gaugeX + gaugeW + 2;
  const avail = rightX - 1 - textX;
  if (live.baselineEssence > 0) {
    const ratio = live.windowEssence / live.baselineEssence;
    drawBar(buf, { x: gaugeX, y, w: gaugeW }, Math.min(1, ratio), fill);
    const arrow = ratio >= 1.05 ? ' ↑' : ratio < 0.95 ? ' ↓' : '';
    const text = `this window ${fmtTokens(live.windowTokens)} tok · ${ratio.toFixed(1)}× baseline${arrow}`;
    if (avail > 0) buf.text(textX, y, text.slice(0, avail), VALUE, null);
  } else {
    drawBar(buf, { x: gaugeX, y, w: gaugeW }, 0, fill);
    const text = `this window ${fmtTokens(live.windowTokens)} tok · building baseline…`;
    if (avail > 0) buf.text(textX, y, text.slice(0, avail), MUTED, null);
  }
}

/** Row 3 — diet composition (tinted stacked bar + legend) + grade-roll odds. */
function drawDietRow(ctx: RenderContext, panel: SceneRect, y: number): void {
  const { buf, state } = ctx;
  buf.text(panel.x + 1, y, 'Diet', LABEL, null);
  const barX = panel.x + 9;

  // Grade-roll odds stay visible (transparency invariant), right-aligned.
  const odds = renderGradeOddsLine(state);
  const oddsX = panel.x + panel.cols - odds.length - 1;
  buf.text(oddsX, y, odds, MUTED, null);

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

  const legendX = barX + barW + 2;
  const legend = diet
    .slice(0, 3)
    .map((s) => `${s.name} ${Math.round(s.frac * 100)}%`)
    .join(' · ');
  const avail = oddsX - 1 - legendX;
  if (avail > 0) buf.text(legendX, y, legend.slice(0, avail), VALUE, null);
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
