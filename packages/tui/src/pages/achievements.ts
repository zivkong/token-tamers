/**
 * Achievements page: every achievement in the pack, one row each. Earned ones
 * show their name, description, and what they unlocked; unearned ones hide the
 * name as `???` and surface the description as a how-to-unlock hint. A scrollable
 * list scoped to the current Season's roster (`pack.achievements`).
 */

import { achievementRewards, type AchievementDef, type ContentPack } from '@token-tamers/core';
import type { Rgb } from '../terminal/ansi';
import { clampScroll, drawPageFooter, drawPageHeader, pageBodyBottom } from '../components';
import type { RenderContext } from './types';

const TEXT: Rgb = { r: 214, g: 220, b: 234 };
const DIM: Rgb = { r: 96, g: 100, b: 120 };
const DONE: Rgb = { r: 120, g: 210, b: 140 };
const REWARD: Rgb = { r: 255, g: 224, b: 130 };
const SELECT_BG: Rgb = { r: 40, g: 48, b: 78 };

/** First body column the name starts at; the description follows after `NAME_W`. */
const NAME_X = 4;
const NAME_W = 22;

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

export function renderAchievementsPage(ctx: RenderContext): void {
  const { buf, layout, state, pack, ui } = ctx;
  const { canvasX, canvasCols } = layout;
  const all = pack.achievements;
  const earnedCount = all.filter((a) => state.achievementsEarned[a.id] !== undefined).length;
  const pct = all.length > 0 ? (earnedCount / all.length) * 100 : 0;

  const top = drawPageHeader(ctx, {
    icon: '★',
    title: 'Feats',
    completion: { count: `${earnedCount}/${all.length}`, pct },
  });

  if (all.length === 0) {
    buf.text(canvasX + 1, top, 'No achievements in this Season yet.', DIM, null);
    drawPageFooter(ctx, '0 achievements');
    return;
  }

  const visible = pageBodyBottom(layout) - top;
  const scroll = clampScroll(ui.scroll, ui.selected, visible, all.length);
  ui.scroll = scroll;

  const clip = (s: string, budget: number): string => [...s].slice(0, Math.max(0, budget)).join('');

  for (let i = 0; i < visible; i++) {
    const idx = scroll + i;
    if (idx >= all.length) break;
    const def = all[idx];
    if (!def) continue;
    const y = top + i;
    const selected = idx === ui.selected;
    const earned = state.achievementsEarned[def.id] !== undefined;
    const bg = selected ? SELECT_BG : null;
    if (selected) {
      for (let x = 0; x < canvasCols; x++) buf.set(canvasX + x, y, { ch: ' ', fg: null, bg });
    }

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
      // Re-tint just the reward tail so the unlock stands out.
      const head = `${def.description}  · unlocks `;
      buf.text(descX + [...clip(head, canvasCols)].length, y, clip(reward, 16), REWARD, bg);
    }
  }

  drawPageFooter(ctx, `${earnedCount}/${all.length} earned  ·  ↑↓ scroll`);
}
