/**
 * Pet vitals panel — the LIVE section between the game canvas and the menu.
 *
 * Four live rows on consecutive lines (the Stats readout lives up in the header
 * band — identity, not live signs — drawn via the exported `drawStatsRow`):
 *
 *   Food   ▕████▒▒▒▒▒▒▒▒▏ 84.2M / 200M  +6% molt ↑
 *   Diet   ▕██████▒▒▒▒▒▒▏ Aether 72% · Cipher 28%
 *   Grow   ▕████▒▒▒▒▒▒▒▒▏ Evolved · 4h 59m 12s
 *   Odds   B → A 38% · Reborn 2d 4h 9m 12s
 *
 * The three bars share ONE geometry (`barGeom`) so Food, Diet and Growth line up
 * at every width. They read as distinct motions: Food GROWS toward the 200M
 * vitality cap and resets each window (single tint, owns the `+N% molt` preview);
 * Diet is ALWAYS FULL and only its House-tinted proportions drift over the pet's
 * life; Growth fills toward the next evolution's eligibility and resets each time
 * the pet evolves. The Growth row names the current STAGE and counts down to the
 * next molt (`ctx.live.secsToMolt`); at Apex it becomes the clickable "Reborn Now"
 * button (counting down to the weekly rebirth). The Odds row shows the live
 * current→next grade forecast (`ctx.live.nextGrade`, computed by the host; see
 * core's `gradeOdds`), grade-tinted, with the published base odds as the
 * deterministic fallback, followed inline by the `Reborn <countdown>` to the next
 * weekly rebirth (`ctx.live.secsToRebirth`) — the deadline for the grade to keep
 * rolling. The Grow stage timing + the Odds reborn countdown are present only live
 * (golden frames without `live` omit them).
 */

import { mix, type Rgb } from '../terminal/ansi';
import {
  gradeOdds,
  growthProgress,
  VITALITY_FULL_TOKENS,
  vitalityBonus,
  type Grade,
  type House,
  type Stage,
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
/** Apex "Reborn Now" button accent (warm amber UI chrome — off the grade/House ladders). */
const REBORN: Rgb = { r: 240, g: 176, b: 96 };
/** Armed-confirm / warning accent for the Reborn button (a caution red, UI chrome only). */
const WARN: Rgb = { r: 232, g: 116, b: 116 };

/** Stage → player-facing name shown on the Growth row (egg = the design's "Mote"). */
const STAGE_LABEL: Record<Stage, string> = {
  egg: 'Mote',
  sprite: 'Sprite',
  rookie: 'Rookie',
  evolved: 'Evolved',
  prime: 'Prime',
  apex: 'Apex',
};

/** Mid dot between a stage/button label and its countdown (by codepoint to survive encoding). */
const DOT = String.fromCodePoint(0x00b7);

/**
 * Live countdown ticking down to the SECOND (the host recomputes `secsTo*` every
 * frame, so this updates each second). Leading zero units are dropped, but seconds
 * are always shown so the readout visibly ticks: 187752→'2d 4h 9m 12s',
 * 17952→'4h 59m 12s', 158→'2m 38s', 9→'9s'.
 */
function fmtCountdown(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (d > 0 || h > 0) parts.push(`${h}h`);
  if (d > 0 || h > 0 || m > 0) parts.push(`${m}m`);
  parts.push(`${s % 60}s`);
  return parts.join(' ');
}

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
 * Row 4 — the GROWTH row: a maturation meter (fills toward the next evolution's
 * eligibility, same geometry as Food/Diet) labelled with the current STAGE and a
 * countdown to the next molt (`Evolved · 4h 59m`). At Apex the row becomes the
 * clickable "Reborn Now" button counting down to the weekly rebirth. The bar fill
 * reads `core.growthProgress(state)` (deterministic); the countdown comes from
 * `ctx.live.secsToMolt`/`secsToRebirth`, so golden frames (no live) show the stage
 * name / button label alone.
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
  if (avail <= 0) return;

  if (state.pet.stage === 'apex') {
    drawRebornButton(ctx, textX, y, avail);
    return;
  }
  const label = STAGE_LABEL[state.pet.stage];
  const secs = ctx.live?.secsToMolt;
  const text = secs != null ? `${label} ${DOT} ${fmtCountdown(secs)}` : label;
  buf.text(textX, y, text.slice(0, avail), VALUE, null);
}

/**
 * The Apex "Reborn Now" button on the Growth row: a clickable control that forces
 * an early rebirth. Shows a countdown to the automatic weekly rebirth
 * (`ctx.live.secsToRebirth`); once armed (a non-S first press, see shell-input) it
 * flips to a caution-tinted "Confirm Rebirth?" prompt. Registers the
 * `pet:reborn-now` hit region so a mouse click triggers the same flow as Enter.
 */
function drawRebornButton(ctx: RenderContext, x: number, y: number, avail: number): void {
  const { buf } = ctx;
  const armed = ctx.ui.rebornArmed === true;
  const secs = ctx.live?.secsToRebirth;
  const cd = !armed && secs != null ? ` ${DOT} ${fmtCountdown(secs)}` : '';
  const text = `${armed ? 'Confirm Rebirth?' : 'Reborn Now'}${cd}`.slice(0, avail);
  buf.text(x, y, text, armed ? WARN : REBORN, null);
  ctx.hits.add('pet:reborn-now', x, y, [...text].length, 1);
}

/**
 * Row 5 — the ODDS forecast: the LIVE current→next grade roll (the only transition
 * that can actually fire next), grade-tinted, followed INLINE by a `Reborn
 * <countdown>` to the next weekly rebirth (`ctx.live.secsToRebirth`) — the deadline
 * for that roll to still land before the pet re-eggs. Uses the host's
 * `ctx.live.nextGrade`; with no live readout it falls back to the published base
 * odds (`gradeOdds(state)`) so golden frames stay deterministic. At the S cap it
 * shows the apex state instead of a roll (and no countdown).
 */
function drawOddsRow(ctx: RenderContext, panel: SceneRect, y: number): void {
  const { buf, state } = ctx;
  buf.text(panel.x + 1, y, 'Odds', LABEL, null);
  const x = panel.x + CONTENT_X;
  const avail = panel.x + panel.cols - 1 - x;

  const odds = ctx.live?.nextGrade !== undefined ? ctx.live.nextGrade : gradeOdds(state);
  const parts = oddsParts(odds);
  drawPartsClipped(buf, parts, { x, y, avail });

  // A muted `Reborn <countdown>` to the next weekly rebirth, INLINE right after the
  // odds — the deadline for this grade to still roll up before the pet re-eggs. Live
  // only (the host's `secsToRebirth`); golden frames without it omit the countdown,
  // as does the S-cap apex state (odds === null). Clipped to the row's remaining width.
  const secs = ctx.live?.secsToRebirth;
  if (odds && secs != null) {
    const used = partsLen(parts);
    const remaining = avail - used;
    if (remaining > 0) {
      const text = ` ${DOT} Reborn ${fmtCountdown(secs)}`;
      buf.text(x + used, y, text.slice(0, remaining), MUTED, null);
    }
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
