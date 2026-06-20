/**
 * Feats page: the pack's achievements, split into category TABS (Ascension,
 * Bloodline, Instincts, …) the way the Dex splits Houses. `←→` switches category,
 * `↑↓` scrolls the active category's list. Earned Feats show their name,
 * description, and what they unlocked; unearned ones hide the name as `???` and
 * surface the description as a how-to-unlock hint. The header completion stays the
 * whole-Season earned/total; the footer shows the active category's own tally.
 */

import { achievementRewards, type AchievementDef, type ContentPack } from '@token-tamers/core';
import type { Rgb } from '../terminal/ansi';
import {
  clampScroll,
  drawPageFooter,
  drawPageHeader,
  drawTabStrip,
  pageBodyBottom,
} from '../components';
import type { RenderContext } from './types';

const TEXT: Rgb = { r: 214, g: 220, b: 234 };
const DIM: Rgb = { r: 96, g: 100, b: 120 };
const DONE: Rgb = { r: 120, g: 210, b: 140 };
const REWARD: Rgb = { r: 255, g: 224, b: 130 };
const SELECT_BG: Rgb = { r: 40, g: 48, b: 78 };

/** First body column the name starts at; the description follows after `NAME_W`. */
const NAME_X = 4;
const NAME_W = 22;

/** A Feat category tab: a content-`category` id and its player-facing creative name. */
export interface FeatCategory {
  id: string;
  name: string;
}

/**
 * The canonical category order + creative names. A Feat's content `category` maps
 * to one of these; anything missing/unknown falls to the catch-all "Sundry" tab.
 * Lives here (UI taxonomy), like DEX_HOUSES — content only tags the `category` id.
 */
const ALL_CATEGORIES: readonly FeatCategory[] = [
  { id: 'ascension', name: 'Ascension' }, // stages climbed + grade milestones
  { id: 'bloodline', name: 'Bloodline' }, // lineage, dormancy, House mastery
  { id: 'instincts', name: 'Instincts' }, // traits + locked patterns
  { id: 'wanderlust', name: 'Wanderlust' }, // Dex coverage + habitats earned
  { id: 'tribute', name: 'Tribute' }, // lifetime-token offerings
  { id: 'warpath', name: 'Warpath' }, // battle valor
];
const SUNDRY: FeatCategory = { id: '', name: 'Sundry' };

/** The bucket id a Feat belongs to (its `category` if known, else '' → Sundry). */
function bucketOf(a: AchievementDef): string {
  return ALL_CATEGORIES.some((c) => c.id === a.category) ? a.category! : '';
}

/** Category tabs that actually appear in the pack, canonical order, + Sundry if any. */
export function featCategories(pack: ContentPack): FeatCategory[] {
  const present = new Set(pack.achievements.map(bucketOf));
  const out = ALL_CATEGORIES.filter((c) => present.has(c.id));
  if (present.has('')) out.push(SUNDRY);
  return out.length ? out : [SUNDRY];
}

/** The Feats in one category (by bucket id), in pack order. */
export function achievementsInCategory(pack: ContentPack, catId: string): AchievementDef[] {
  return pack.achievements.filter((a) => bucketOf(a) === catId);
}

/** Clamp a (possibly undefined) tab index into the page's category range. */
export function clampFeatTab(pack: ContentPack, tab: number | undefined): number {
  const n = featCategories(pack).length;
  return Math.max(0, Math.min(n - 1, tab ?? 0));
}

/** Human label for what an earned achievement unlocked, or '' for none. Joins
 *  multiple rewards with ' · ' so a title + habitat both show. */
function rewardLabel(def: AchievementDef, pack: ContentPack): string {
  return achievementRewards(def)
    .map((r) => {
      if (r.kind === 'habitat') return pack.habitats.find((h) => h.id === r.id)?.name ?? r.id;
      if (r.kind === 'trinket') return pack.trinkets.find((t) => t.id === r.id)?.name ?? r.id;
      if (r.kind === 'title') return r.name;
      return r.id;
    })
    .join(' · ');
}

function isEarned(ctx: RenderContext, id: string): boolean {
  return ctx.state.achievementsEarned[id] !== undefined;
}

export function renderAchievementsPage(ctx: RenderContext): void {
  const { buf, layout, pack, ui } = ctx;
  const { canvasX, canvasCols } = layout;
  const total = pack.achievements.length;
  const earnedAll = pack.achievements.filter((a) => isEarned(ctx, a.id)).length;
  const pct = total > 0 ? (earnedAll / total) * 100 : 0;

  const headerTop = drawPageHeader(ctx, {
    icon: '★',
    title: 'Feats',
    completion: { count: `${earnedAll}/${total}`, pct },
  });

  if (total === 0) {
    buf.text(canvasX + 1, headerTop, 'No achievements in this Season yet.', DIM, null);
    drawPageFooter(ctx, '0 achievements');
    return;
  }

  // Category tabs (like the Dex House skies); the active one filters the list.
  const cats = featCategories(pack);
  const tab = clampFeatTab(pack, ui.tab);
  ui.tab = tab;
  drawTabStrip(ctx, headerTop, {
    labels: cats.map((c) => c.name),
    active: tab,
    activeColor: REWARD,
    hitPrefix: 'feats:tab',
  });

  const cat = cats[tab]!;
  const list = achievementsInCategory(pack, cat.id);
  const selected = Math.max(0, Math.min(list.length - 1, ui.selected));
  ui.selected = selected;

  const top = headerTop + 2; // tab row + a gap, mirroring the Dex sky
  const visible = pageBodyBottom(layout) - top;
  const scroll = clampScroll(ui.scroll, selected, visible, list.length);
  ui.scroll = scroll;

  const clip = (s: string, budget: number): string => [...s].slice(0, Math.max(0, budget)).join('');

  for (let i = 0; i < visible; i++) {
    const idx = scroll + i;
    if (idx >= list.length) break;
    const def = list[idx];
    if (!def) continue;
    const y = top + i;
    const sel = idx === selected;
    const earned = isEarned(ctx, def.id);
    const bg = sel ? SELECT_BG : null;
    if (sel)
      for (let x = 0; x < canvasCols; x++) buf.set(canvasX + x, y, { ch: ' ', fg: null, bg });

    buf.text(canvasX + 1, y, earned ? '✓' : '·', earned ? DONE : DIM, bg);
    const name = earned ? def.name : '???';
    buf.text(canvasX + NAME_X, y, clip(name, NAME_W - 1), earned ? TEXT : DIM, bg);

    // Earned: the description (+ what it unlocked). Locked: the same description
    // serves as the how-to-unlock hint.
    const reward = earned ? rewardLabel(def, pack) : '';
    const detail = reward ? `${def.description}  · unlocks ${reward}` : def.description;
    const descX = canvasX + NAME_X + NAME_W;
    buf.text(descX, y, clip(detail, canvasCols - (NAME_X + NAME_W) - 1), DIM, bg);
    if (reward) {
      const head = `${def.description}  · unlocks `;
      buf.text(descX + [...clip(head, canvasCols)].length, y, clip(reward, 16), REWARD, bg);
    }
  }

  const earnedInCat = list.filter((a) => isEarned(ctx, a.id)).length;
  drawPageFooter(ctx, `${cat.name}  ${earnedInCat}/${list.length}  ·  ←→ category  ·  ↑↓ scroll`);
}
