/**
 * Unlockables page: every habitat and trinket in the pack, one row each. Unlocked
 * ones show their name (with an `equipped` marker on the active one); locked ones
 * show `???` with no hint. Selecting an unlocked row equips it; selecting the
 * already-active one again unequips it (clears the slot). Habitats list first,
 * then trinkets, each under its own section title.
 */

import type { ContentPack, GameState } from '@token-tamers/core';
import type { Rgb } from '../terminal/ansi';
import { clampScroll, drawPageFooter, drawPageHeader, pageBodyBottom } from '../components';
import type { RenderContext } from './types';

const TEXT: Rgb = { r: 214, g: 220, b: 234 };
const DIM: Rgb = { r: 96, g: 100, b: 120 };
const ACTIVE: Rgb = { r: 120, g: 210, b: 140 };
const SELECT_BG: Rgb = { r: 40, g: 48, b: 78 };
const SECTION: Rgb = { r: 150, g: 162, b: 196 };

/** A visual row: either a section title or one selectable item (by its item index). */
type Row = { kind: 'title'; label: string } | { kind: 'item'; idx: number };

/** Interleave the flat item list with Habitats/Trinkets section titles for display. */
function buildRows(items: UnlockItem[]): Row[] {
  const rows: Row[] = [];
  let last: UnlockItem['kind'] | null = null;
  items.forEach((it, idx) => {
    if (it.kind !== last) {
      rows.push({ kind: 'title', label: it.kind === 'habitat' ? 'Habitats' : 'Trinkets' });
      last = it.kind;
    }
    rows.push({ kind: 'item', idx });
  });
  return rows;
}

/** One equippable collectible row. The selectable list is habitats then trinkets. */
export interface UnlockItem {
  kind: 'habitat' | 'trinket';
  id: string;
  name: string;
  unlocked: boolean;
  active: boolean;
}

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

export function renderUnlockablesPage(ctx: RenderContext): void {
  const { buf, hits, layout, state, pack, ui } = ctx;
  const { canvasX, canvasCols } = layout;
  const items = buildUnlockItems(pack, state);
  const unlocked = items.filter((it) => it.unlocked).length;
  const pct = items.length > 0 ? (unlocked / items.length) * 100 : 0;

  const top = drawPageHeader(ctx, {
    icon: '◈',
    title: 'Loot',
    completion: { count: `${unlocked}/${items.length}`, pct },
  });

  if (items.length === 0) {
    buf.text(canvasX + 1, top, 'No habitats or trinkets in this Season yet.', DIM, null);
    drawPageFooter(ctx, '0 unlockables');
    return;
  }

  const rows = buildRows(items);
  const visible = pageBodyBottom(layout) - top;
  const selectedRow = rows.findIndex((r) => r.kind === 'item' && r.idx === ui.selected);
  const scroll = clampScroll(ui.scroll, Math.max(0, selectedRow), visible, rows.length);
  ui.scroll = scroll;

  const clip = (s: string, budget: number): string => [...s].slice(0, Math.max(0, budget)).join('');

  for (let i = 0; i < visible; i++) {
    const row = rows[scroll + i];
    if (!row) break;
    const y = top + i;
    if (row.kind === 'title') {
      buf.text(canvasX + 1, y, row.label, SECTION, null);
      continue;
    }
    const it = items[row.idx];
    if (!it) continue;
    const selected = row.idx === ui.selected;
    const bg = selected ? SELECT_BG : null;
    if (selected) {
      for (let x = 0; x < canvasCols; x++) buf.set(canvasX + x, y, { ch: ' ', fg: null, bg });
    }

    buf.text(canvasX + 1, y, selected ? '›' : ' ', TEXT, bg);
    const label = it.unlocked ? it.name : '???';
    buf.text(canvasX + 3, y, clip(label, canvasCols - 20), it.unlocked ? TEXT : DIM, bg);
    if (it.active) buf.text(canvasX + canvasCols - 12, y, '● equipped', ACTIVE, bg);
    hits.add(`unlock:item:${row.idx}`, canvasX, y, canvasCols, 1);
  }

  drawPageFooter(ctx, `${unlocked}/${items.length} unlocked  ·  ↑↓ select  ·  enter equip/unequip`);
}
