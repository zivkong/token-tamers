/**
 * Dex page — a constellation field guide. Each House is a "sky": its evolution
 * tree drawn as glow-dot stars (owned species glow in their best grade; unseen
 * ones are dim "?" points) joined by faint lineage lines, apex at the top down to
 * the sprite/egg rooted in the shared Mote. A focus rail shows the selected
 * star's real sprite + identity (or a square "?" tile when undiscovered).
 *
 * `←→` pans between Houses, `↑↓` walks the stars, `⏎`/click opens the detail.
 * Layout/draw lives in `dex-sky.ts`; this file owns the node model + the page
 * scaffold. Pure given (state, pack, ui, frame) so golden frames stay stable.
 */

import { drawPageFooter, drawPageHeader, drawTabStrip, pageBodyBottom } from '../components';
import { houseColor } from '../helpers/lookup';
import { GRADE_ORDER, type Grade, type House, type Stage } from '@token-tamers/core';
import type { RenderContext } from './types';
import { renderFocusRail, renderSky, RAIL_MIN_COLS, type Rect } from './dex-sky';

/** Canonical House order across the Dex skies (Wild last — it holds the Mote). */
export const DEX_HOUSES: House[] = ['aether', 'cipher', 'flux', 'forge', 'wild'];

const STAGE_TIER: Record<Stage, number> = {
  egg: 0,
  sprite: 1,
  rookie: 2,
  evolved: 3,
  prime: 4,
  apex: 5,
};

/** One star in a House sky: a species slot, owned or not. */
export interface HouseNode {
  speciesId: string;
  name: string;
  num: number;
  stage: Stage;
  /** 0 (egg) … 5 (apex) — drives the vertical band in the sky. */
  tier: number;
  owned: boolean;
  /** Highest recorded grade (incl. the live pet), or null when unseen. */
  grade: Grade | null;
  /** Reserved "special" slot → the ornate gold tile. Dormant in Season 0. */
  legend: boolean;
  /** In-House parent species ids (those that evolve INTO this node). */
  parents: string[];
}

function maxGrade(a: Grade | null, b: Grade | null): Grade | null {
  if (a === null) return b;
  if (b === null) return a;
  return GRADE_ORDER.indexOf(a) >= GRADE_ORDER.indexOf(b) ? a : b;
}

function bestGradeFor(ctx: RenderContext, speciesId: string): Grade | null {
  const record = ctx.state.dexRecords.find((r) => r.speciesId === speciesId);
  let best = record?.top[0]?.grade ?? null;
  if (ctx.state.pet.speciesId === speciesId) best = maxGrade(best, ctx.state.pet.grade);
  return best;
}

/**
 * Whether a species is a reserved "legend" slot (the ornate gold tile). No
 * obtainable Season 0 species is special, so this is always false today — the
 * gold tile is wired but dormant until a later Season surfaces such slots
 * (kept here, not in content, to honor the spoiler rule).
 */
function isLegendSpecies(): boolean {
  return false;
}

/** Clamp a House index into range (no wrap; the shell wraps when panning). */
export function clampHouse(index: number): number {
  if (index < 0) return 0;
  if (index >= DEX_HOUSES.length) return DEX_HOUSES.length - 1;
  return index;
}

/** Build one House's ordered star list (tier asc, then Dex num). Pure. */
export function buildHouseNodes(ctx: RenderContext, houseIndex: number): HouseNode[] {
  const house = DEX_HOUSES[clampHouse(houseIndex)]!;
  const owned = new Set(ctx.state.dexOwned);
  // The egg (Mote) is the shared origin — selectable at the foot of EVERY sky,
  // so it's added once per House; the House's own stars are sprite-and-up.
  const inHouse = ctx.pack.species.filter((s) => s.house === house && s.stage !== 'egg');
  const parentsOf = new Map<string, string[]>();
  for (const sp of inHouse) {
    for (const ev of sp.evolvesTo) {
      const list = parentsOf.get(ev.species) ?? [];
      if (!list.includes(sp.id)) list.push(sp.id);
      parentsOf.set(ev.species, list);
    }
  }
  const moteSp = ctx.pack.species.find((s) => s.stage === 'egg');
  const moteId = moteSp?.id ?? 'mote';
  const nodes: HouseNode[] = inHouse.map((sp) => {
    const isOwned = owned.has(sp.id);
    const inParents = parentsOf.get(sp.id) ?? [];
    return {
      speciesId: sp.id,
      name: sp.name,
      num: sp.num,
      stage: sp.stage,
      tier: STAGE_TIER[sp.stage],
      owned: isOwned,
      grade: isOwned ? bestGradeFor(ctx, sp.id) : null,
      legend: isLegendSpecies(),
      // Root stars (the sprites) descend from the shared Mote.
      parents: inParents.length ? inParents : [moteId],
    };
  });
  nodes.push({
    speciesId: moteId,
    name: moteSp?.name ?? 'Mote',
    num: moteSp?.num ?? 0,
    stage: 'egg',
    tier: 0,
    owned: moteSp ? owned.has(moteSp.id) : false,
    grade: moteSp ? bestGradeFor(ctx, moteSp.id) : null,
    legend: false,
    parents: [],
  });
  nodes.sort((a, b) => a.tier - b.tier || a.num - b.num);
  return nodes;
}

/** Node count for a House — the selection range the shell clamps against. */
export function houseNodeCount(ctx: RenderContext, houseIndex: number): number {
  return buildHouseNodes(ctx, houseIndex).length;
}

/** The House tab labels (Title-Case), in canonical Dex order. */
function houseTabLabels(): string[] {
  return DEX_HOUSES.map((h) => h[0]!.toUpperCase() + h.slice(1));
}

export function renderDexPage(ctx: RenderContext): void {
  const { layout, ui, pack } = ctx;
  const { canvasX, canvasCols } = layout;
  const houseIndex = clampHouse(ui.house ?? 0);
  ui.house = houseIndex;
  const house = DEX_HOUSES[houseIndex]!;
  const nodes = buildHouseNodes(ctx, houseIndex);
  const selected = nodes.length ? Math.max(0, Math.min(nodes.length - 1, ui.selected)) : 0;
  ui.selected = selected;

  const ownedTotal = new Set(ctx.state.dexOwned).size;
  const bodyY = drawPageHeader(ctx, {
    icon: '☰',
    title: 'Dex',
    completion: { count: `${ownedTotal}/${pack.dexTotal}`, pct: ctx.completion.dex },
  });
  drawTabStrip(ctx, bodyY, {
    labels: houseTabLabels(),
    active: houseIndex,
    activeColor: houseColor(house),
    hitPrefix: 'dex:house',
  });

  const skyTop = bodyY + 2;
  const bodyBottom = pageBodyBottom(layout);
  const railW =
    canvasCols >= RAIL_MIN_COLS ? Math.min(32, Math.max(24, Math.floor(canvasCols * 0.34))) : 0;
  const skyW = canvasCols - railW;
  const skyRect: Rect = { x: canvasX, y: skyTop, w: Math.max(1, skyW - 1), h: bodyBottom - skyTop };
  renderSky(ctx, skyRect, nodes, selected, house);
  if (railW > 0) {
    const railRect: Rect = { x: canvasX + skyW, y: skyTop, w: railW, h: bodyBottom - skyTop };
    renderFocusRail(ctx, railRect, nodes[selected], house);
  }

  const ownedInHouse = nodes.filter((n) => n.owned).length;
  const label = house[0]!.toUpperCase() + house.slice(1);
  drawPageFooter(
    ctx,
    `${label}  ${ownedInHouse}/${nodes.length}  ·  ←→ house  ·  ↑↓ star  ·  ⏎ open`,
  );
}
