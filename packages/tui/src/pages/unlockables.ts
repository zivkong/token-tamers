/**
 * Loot page: the pack's collectibles, split into Habitats / Trinkets TABS the way
 * the Dex splits Houses. `←→` switches tab, `↑↓` walks the active tab's list.
 * Unlocked items show their name (with an `equipped` marker on the active one);
 * locked ones show `???`. Selecting an unlocked row equips it; selecting the
 * already-active one again unequips it. The header completion stays the whole
 * unlocked/total; the footer shows the active tab's own tally.
 */

import type { ContentPack, GameState } from '@token-tamers/core';
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
const ACTIVE: Rgb = { r: 120, g: 210, b: 140 };
const ACCENT: Rgb = { r: 130, g: 190, b: 230 };
const SELECT_BG: Rgb = { r: 40, g: 48, b: 78 };

/** One equippable collectible row. The list is habitats then trinkets. */
export interface UnlockItem {
  kind: 'habitat' | 'trinket';
  id: string;
  name: string;
  unlocked: boolean;
  active: boolean;
}

/** The Loot tabs (one per collectible kind), in display order. */
export const LOOT_TABS: ReadonlyArray<{ kind: UnlockItem['kind']; name: string }> = [
  { kind: 'habitat', name: 'Habitats' },
  { kind: 'trinket', name: 'Trinkets' },
];

/**
 * The flat, selectable list of collectibles: all habitats, then all trinkets, in
 * pack order. Shared by the page render and the shell's input handler so
 * selection indices and clicks resolve to the same items.
 */
export function buildUnlockItems(pack: ContentPack, state: GameState): UnlockItem[] {
  const habitats: UnlockItem[] = pack.habitats.map((h) => ({
    kind: 'habitat',
    id: h.id,
    name: h.name,
    unlocked: state.habitatsUnlocked.includes(h.id),
    active: state.selectedHabitat === h.id,
  }));
  const trinkets: UnlockItem[] = pack.trinkets.map((t) => ({
    kind: 'trinket',
    id: t.id,
    name: t.name,
    unlocked: state.trinketsUnlocked.includes(t.id),
    active: state.selectedTrinkets.includes(t.id),
  }));
  return [...habitats, ...trinkets];
}

/** Clamp a (possibly undefined) tab index into the Loot tab range. */
export function clampLootTab(tab: number | undefined): number {
  return Math.max(0, Math.min(LOOT_TABS.length - 1, tab ?? 0));
}

/** The collectibles on one tab (its kind), in pack order. Shared by render + shell. */
export function unlockItemsForTab(pack: ContentPack, state: GameState, tab: number): UnlockItem[] {
  const kind = LOOT_TABS[clampLootTab(tab)]!.kind;
  return buildUnlockItems(pack, state).filter((it) => it.kind === kind);
}

export function renderUnlockablesPage(ctx: RenderContext): void {
  const { buf, hits, layout, state, pack, ui } = ctx;
  const { canvasX, canvasCols } = layout;
  const allItems = buildUnlockItems(pack, state);
  const unlockedAll = allItems.filter((it) => it.unlocked).length;
  const pct = allItems.length > 0 ? (unlockedAll / allItems.length) * 100 : 0;

  const headerTop = drawPageHeader(ctx, {
    icon: '◈',
    title: 'Loot',
    completion: { count: `${unlockedAll}/${allItems.length}`, pct },
  });

  if (allItems.length === 0) {
    buf.text(canvasX + 1, headerTop, 'No habitats or trinkets in this Season yet.', DIM, null);
    drawPageFooter(ctx, '0 unlockables');
    return;
  }

  const tab = clampLootTab(ui.tab);
  ui.tab = tab;
  drawTabStrip(ctx, headerTop, {
    labels: LOOT_TABS.map((t) => t.name),
    active: tab,
    activeColor: ACCENT,
    hitPrefix: 'loot:tab',
  });

  const items = unlockItemsForTab(pack, state, tab);
  const selected = Math.max(0, Math.min(Math.max(0, items.length - 1), ui.selected));
  ui.selected = selected;

  const top = headerTop + 2; // tab row + a gap, mirroring the Dex sky
  const visible = pageBodyBottom(layout) - top;
  const scroll = clampScroll(ui.scroll, selected, visible, items.length);
  ui.scroll = scroll;

  const clip = (s: string, budget: number): string => [...s].slice(0, Math.max(0, budget)).join('');

  for (let i = 0; i < visible; i++) {
    const idx = scroll + i;
    if (idx >= items.length) break;
    const it = items[idx];
    if (!it) continue;
    const y = top + i;
    const sel = idx === selected;
    const bg = sel ? SELECT_BG : null;
    if (sel)
      for (let x = 0; x < canvasCols; x++) buf.set(canvasX + x, y, { ch: ' ', fg: null, bg });

    buf.text(canvasX + 1, y, sel ? '›' : ' ', TEXT, bg);
    const label = it.unlocked ? it.name : '???';
    buf.text(canvasX + 3, y, clip(label, canvasCols - 20), it.unlocked ? TEXT : DIM, bg);
    if (it.active) buf.text(canvasX + canvasCols - 12, y, '● equipped', ACTIVE, bg);
    hits.add(`unlock:item:${idx}`, canvasX, y, canvasCols, 1);
  }

  const unlockedInTab = items.filter((it) => it.unlocked).length;
  drawPageFooter(
    ctx,
    `${LOOT_TABS[tab]!.name}  ${unlockedInTab}/${items.length}  ·  ←→ tab  ·  ↑↓ select  ·  enter equip`,
  );
}
