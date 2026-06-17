/**
 * Pet vitals panel — the LIVE section between the game canvas and the menu.
 *
 * Four live rows on consecutive lines (the Stats readout lives up in the header
 * band — identity, not live signs — drawn via the exported `drawStatsRow`):
 *
 *   Food   ▕████▒▒▒▒▒▒▒▒▏ 84.2M / 200M  +6% molt ↑
 *   Diet   ▕██████▒▒▒▒▒▒▏ Aether 72% · Cipher 28%
 *   Grow   ▕████▒▒▒▒▒▒▒▒▏ maturing
 *   Odds   B → A 38%                          rolls at next molt
 *
 * The three bars share ONE geometry (`barGeom`) so Food, Diet and Growth line up
 * at every width. They read as distinct motions: Food GROWS toward the 200M
 * vitality cap and resets each window (single tint, owns the `+N% molt` preview);
 * Diet is ALWAYS FULL and only its House-tinted proportions drift over the pet's
 * life; Growth fills toward the next evolution's eligibility and resets each time
 * the pet evolves. Growth is DELIBERATELY ABSTRACT — a bar plus a one-word state,
 * never the stage name, molt counts, or the next form (the evolution-mystery
 * rule, amended to allow this "it IS progressing" cue). The Odds row shows just
 * the live current→next grade forecast (`ctx.live.nextGrade`, computed by the
 * host; see core's `gradeOdds`), grade-tinted, with the published base odds as
 * the deterministic fallback when there is no live readout (golden tests).
 */

import { mix, type Rgb } from '../terminal/ansi';
import {
  gradeOdds,
  growthProgress,
  VITALITY_FULL_TOKENS,
  vitalityBonus,
  type Grade,
  type House,
} from '@token-tamers/core';
import { drawMeter, drawSegmentedMeter } from '../components';
import { houseColor } from '../helpers/lookup';
import { GRADE_ACCENT, GRADE_BADGE } from '../render/sprite';
import type { FrameBuffer } from '../render/buffer';
import type { RenderContext } from './types';
import type { SceneRect } from '../render/layout';

const LABEL: Rgb = { r: 122, g: 132, b: 158 };
const VALUE: Rgb = { r: 222, g: 228, b: 240 };
const MUTED: Rgb = { r: 120, g: 126, b: 146 };
const UNKNOWN_TINT: Rgb = { r: 96, g: 102, b: 122 };
const FOOD_FILL: Rgb = { r: 240, g: 196, b: 80 };
/**
 * Growth bar tint — a muted teal chosen to sit OFF both signalling ladders: it is
 * not a grade color (C grey · B green · A violet · S gold) so it never reads as
 * rarity, and not a House color, so the maturation cue stays a neutral progress
 * meter. (The `Growth` label disambiguates it from the gold Food bar.)
 */
const GROWTH_FILL: Rgb = { r: 96, g: 200, b: 178 };

/** → between grades on the Odds row (by codepoint to survive encoding). */
const ARROW = String.fromCodePoint(0x2192);

/** Below this width we drop to compact labels. */
const NARROW = 64;

/** Column where every bar / readout starts (after the 5-cell label gutter). */
const CONTENT_X = 6;

/** Shared bar geometry so the Food and Diet bars are identical at every width. */
function barGeom(
  panel: SceneRect,
  y: number,
  narrow: boolean,
): { x: number; y: number; w: number } {
  return { x: panel.x + CONTENT_X, y, w: narrow ? 8 : 12 };
}

/** Per-stat icon (by codepoint to survive encoding): PWR ◆ · SPD ↯ · WIS ✦ · GRT ▣. */
const STAT_ICON = {
  PWR: String.fromCodePoint(0x25c6),
  SPD: String.fromCodePoint(0x21af),
  WIS: String.fromCodePoint(0x2726),
  GRT: String.fromCodePoint(0x25a3),
} as const;

/** Draw the live vitals panel: food / diet / growth / odds on consecutive rows. */
export function renderVitals(ctx: RenderContext, panel: SceneRect): void {
  drawFoodRow(ctx, panel, panel.y);
  drawDietRow(ctx, panel, panel.y + 1);
  drawGrowthRow(ctx, panel, panel.y + 2);
  drawOddsRow(ctx, panel, panel.y + 3);
}

// ---------------------------------------------------------------------------
// Rows.
// ---------------------------------------------------------------------------

/**
 * The four stats as plain readouts (no bar; stats are a fixed budget, not
 * progress), spread evenly across the FULL width: `◆ PWR: 12` … `▣ GRT: 11`,
 * first flush-left and last flush-right (space-between). Drops icons to a compact
 * `PWR 12` form when the full form can't fit, and still spreads it.
 *
 * Lives in the pet HEADER band (identity, beside the name) — not the live vitals
 * panel — so `bg` is the caller's band background (the header fill); the icons
 * carry the pet's House tint to read as identity. `rect` is the band to spread
 * across (header or any full-width rect).
 */
export function drawStatsRow(
  ctx: RenderContext,
  rect: SceneRect,
  y: number,
  bg: Rgb | null = null,
): void {
  const { buf, state } = ctx;
  const s = state.pet.stats;
  const accent = mix(houseColor(state.pet.house), VALUE, 0.1);
  const stats: Array<[string, number]> = [
    ['PWR', s.pwr],
    ['SPD', s.spd],
    ['WIS', s.wis],
    ['GRT', s.grt],
  ];
  const x0 = rect.x + 1;
  const available = rect.cols - 2;

  // Prefer the full `icon NAME: value` form; fall back to compact `NAME value`.
  // Reserve a minimum 1-col gap between stats so an exact fit never merges them
  // (e.g. `PWR: 12↯ SPD`).
  const minGaps = stats.length - 1;
  let segs = stats.map(([nm, v]) => statParts(nm, v, accent, true));
  if (totalLen(segs) + minGaps > available) {
    segs = stats.map(([nm, v]) => statParts(nm, v, accent, false));
  }

  const slack = available - totalLen(segs);
  if (slack >= minGaps) {
    drawJustified(buf, segs, { x0, y, slack, bg });
  } else {
    // Below even the compact width: left-pack but only draw a stat that fits
    // WHOLE — stop at the first that would overflow, so the player never sees a
    // stat label without its value (and nothing leaks past the chrome edge).
    const right = x0 + available;
    let cx = x0;
    for (const seg of segs) {
      const segLen = partsLen(seg);
      if (cx + segLen > right) break;
      drawParts(buf, cx, y, seg, bg);
      cx += segLen + 1;
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

function drawParts(
  buf: FrameBuffer,
  x: number,
  y: number,
  parts: readonly TextPart[],
  bg: Rgb | null = null,
): void {
  let cx = x;
  for (const p of parts) {
    buf.text(cx, y, p.text, p.color, bg);
    cx += [...p.text].length;
  }
}

/** Like `drawParts` but stops once `avail` cells are used (clips, never overflows). */
function drawPartsClipped(
  buf: FrameBuffer,
  parts: readonly TextPart[],
  opts: { x: number; y: number; avail: number; bg?: Rgb | null },
): void {
  let used = 0;
  for (const p of parts) {
    for (const ch of [...p.text]) {
      if (used >= opts.avail) return;
      buf.text(opts.x + used, opts.y, ch, p.color, opts.bg ?? null);
      used += 1;
    }
  }
}

interface JustifyOpts {
  x0: number;
  y: number;
  slack: number;
  bg: Rgb | null;
}

/** Place segments space-between across the width: first at x0, last flush-right. */
function drawJustified(
  buf: FrameBuffer,
  segs: ReadonlyArray<readonly TextPart[]>,
  opts: JustifyOpts,
): void {
  const { x0, y, slack, bg } = opts;
  const gaps = segs.length - 1;
  let prev = 0;
  segs.forEach((seg, i) => {
    const x = x0 + prev + (gaps > 0 ? Math.round((slack * i) / gaps) : 0);
    drawParts(buf, x, y, seg, bg);
    prev += partsLen(seg);
  });
}

/**
 * Row 2 — the growth FOOD meter: the open window's raw tokens fill toward the
 * 200M vitality cap, single-tinted (the Diet row owns the House colors), with the
 * REAL capped molt-boost preview. Token counts only. (`Food` = how much you've
 * eaten this session; the `Diet` row below = what you've eaten over your life.)
 */
function drawFoodRow(ctx: RenderContext, panel: SceneRect, y: number): void {
  const { buf } = ctx;
  const narrow = panel.cols < NARROW;
  buf.text(panel.x + 1, y, 'Food', LABEL, null);
  const bar = barGeom(panel, y, narrow);

  const tokens = ctx.live?.windowTokens ?? 0;
  drawMeter(buf, bar, tokens / VITALITY_FULL_TOKENS, FOOD_FILL);

  const textX = bar.x + bar.w + 2;
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

/**
 * Row 3 — the DIET composition bar: an always-full strip tinted by the pet's
 * lifetime House shares (same geometry as Food), plus a House-name legend. The
 * bar never empties — only its proportions drift as intake accumulates.
 */
function drawDietRow(ctx: RenderContext, panel: SceneRect, y: number): void {
  const { buf } = ctx;
  const narrow = panel.cols < NARROW;
  buf.text(panel.x + 1, y, 'Diet', LABEL, null);
  const bar = barGeom(panel, y, narrow);
  const textX = bar.x + bar.w + 2;
  const avail = panel.x + panel.cols - 1 - textX;

  const diet = dietBreakdown(ctx);
  if (diet.length === 0) {
    drawMeter(buf, bar, 0, UNKNOWN_TINT);
    buf.text(textX, y, 'no intake yet'.slice(0, Math.max(0, avail)), MUTED, null);
    return;
  }
  // Always 100% full: the House shares ARE the bar (composition, not progress).
  const segments = diet.map((d) => ({ frac: d.frac, color: d.tint }));
  drawSegmentedMeter(buf, bar, 1, segments, diet[0]!.tint);

  const legend = diet
    .slice(0, 3)
    .map((d) => `${narrow ? d.name.slice(0, 4) : d.name} ${Math.round(d.frac * 100)}%`)
    .join(narrow ? ' · ' : ' · ');
  if (avail > 0) buf.text(textX, y, legend.slice(0, avail), VALUE, null);
}

/**
 * Row 4 — the GROWTH cue: an abstract maturation meter that fills toward the next
 * evolution's eligibility (same geometry as Food/Diet) and resets when the pet
 * evolves. Deliberately spoiler-free — a bar plus ONE state word, never the stage
 * name, molt counts, or the next form (the evolution-mystery rule). Reads only
 * `core.growthProgress(state)`, so it is fully deterministic in golden frames.
 */
function drawGrowthRow(ctx: RenderContext, panel: SceneRect, y: number): void {
  const { buf, state } = ctx;
  const narrow = panel.cols < NARROW;
  // 4-char label to match Food/Diet/Odds and clear the bar gutter (CONTENT_X).
  buf.text(panel.x + 1, y, 'Grow', LABEL, null);
  const bar = barGeom(panel, y, narrow);

  const g = growthProgress(state);
  drawMeter(buf, bar, g.frac, g.terminal ? FOOD_FILL : GROWTH_FILL);

  const textX = bar.x + bar.w + 2;
  const avail = panel.x + panel.cols - 1 - textX;
  const word = growthWord(g);
  const tone = g.terminal ? VALUE : MUTED;
  if (avail > 0) buf.text(textX, y, word.slice(0, avail), tone, null);
}

/** The one abstract state word for the Growth row (no stage/count/next-form leak). */
function growthWord(g: ReturnType<typeof growthProgress>): string {
  if (g.incubating) return 'incubating';
  if (g.terminal) return 'fully grown';
  if (g.matured) return 'cresting';
  return 'maturing';
}

/**
 * Row 5 — the ODDS forecast: just the LIVE current→next grade roll (the only
 * transition that can actually fire next), grade-tinted. Uses the host's
 * `ctx.live.nextGrade`; with no live readout it falls back to the published base
 * odds (`gradeOdds(state)`) so golden frames stay deterministic. At the S cap it
 * shows the apex state instead of a roll.
 */
function drawOddsRow(ctx: RenderContext, panel: SceneRect, y: number): void {
  const { buf, state } = ctx;
  buf.text(panel.x + 1, y, 'Odds', LABEL, null);
  const x = panel.x + CONTENT_X;
  const avail = panel.x + panel.cols - 1 - x;

  const odds = ctx.live?.nextGrade !== undefined ? ctx.live.nextGrade : gradeOdds(state);
  const parts = oddsParts(odds);
  drawPartsClipped(buf, parts, { x, y, avail });

  // A muted "rolls at next molt" hint, right-aligned whenever it geometrically
  // fits (the gap check below is the real guard — no redundant NARROW gate, which
  // hid the hint on chrome columns where it actually fit).
  if (odds) {
    const hint = 'rolls at next molt';
    const hintX = panel.x + panel.cols - hint.length - 1;
    if (hintX > x + partsLen(parts) + 1) buf.text(hintX, y, hint, MUTED, null);
  }
}

/** Build the Odds row as grade-tinted parts: `from → to NN%`, or the apex state. */
function oddsParts(
  odds: { from: Grade; to: Grade; chance: number; capped: boolean } | null,
): TextPart[] {
  if (odds === null) {
    return [
      { text: 'S', color: GRADE_ACCENT.S },
      { text: ` ${GRADE_BADGE.S}  apex — no further rolls`, color: MUTED },
    ];
  }
  const pct = Math.round(odds.chance * 100);
  const parts: TextPart[] = [
    { text: odds.from, color: GRADE_ACCENT[odds.from] },
    { text: ` ${ARROW} `, color: MUTED },
    { text: odds.to, color: GRADE_ACCENT[odds.to] },
    { text: ` ${pct}%`, color: MUTED },
  ];
  if (odds.capped) parts.push({ text: ' (capped)', color: MUTED });
  return parts;
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

interface DietSegment {
  name: string;
  tint: Rgb;
  frac: number;
}

/**
 * Resolve the pet's diet genes into per-HOUSE normalized segments: genes are
 * grouped by their House and colored by the canonical `houseColor`, so the bar
 * reads as House shares (one segment per House), not per-gene.
 */
function dietBreakdown(ctx: RenderContext): DietSegment[] {
  const byHouse = new Map<House, number>();
  let total = 0;
  for (const [geneId, essence] of Object.entries(ctx.state.pet.dietGenes)) {
    if (essence <= 0) continue;
    const rule = ctx.pack.models.find((m) => m.geneId === geneId);
    const house: House = rule ? rule.house : 'wild';
    byHouse.set(house, (byHouse.get(house) ?? 0) + essence);
    total += essence;
  }
  if (total <= 0) return [];
  return [...byHouse.entries()]
    .map(([house, essence]) => ({
      name: house === 'wild' ? '???' : capitalize(house),
      tint: houseColor(house),
      frac: essence / total,
    }))
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
