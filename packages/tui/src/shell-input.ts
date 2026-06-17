/**
 * Shell input handling: translate decoded key/mouse events into page navigation,
 * list selection, settings edits, battle launches, and clipboard copies. Split out
 * of `shell.ts` to keep that file (the loop + render wiring) under the line ceiling.
 *
 * All functions mutate the shared `ShellRuntime`; none read the wall clock or do
 * I/O beyond the injected `InputDeps` (the host, the last frame's hit regions, and
 * a clipboard callback).
 */

import { bestSpeciesRecords } from '@token-tamers/core';
import type { InputEvent } from './terminal/input';
import { defaultSizeSafe } from './shell-io';
import { computeLayout } from './render/layout';
import { menuButtonY, packMenu } from './render/menu';
import { buildHouseNodes, houseNodeCount, DEX_HOUSES } from './pages/dex';
import { ARCHIVE_LIST_OFFSET } from './pages/archive';
import { cycleSelectedField, isUpdateFieldSelected, settingsFieldCount } from './pages/settings';
import { battleBlockReason, buildBattleVsRecord, handleBattleKey } from './pages/battle';
import { flash } from './shell-effects';
import type { PageId } from './pages/types';
import type { InputDeps, ShellHost, ShellRuntime } from './shell';

export function handleEvent(rt: ShellRuntime, ev: InputEvent, deps: InputDeps): void {
  if (ev.type === 'key') handleKey(rt, ev.name, deps.host);
  else handleMouse(rt, ev, deps);
}

/** Number-key → page jumps (the visible menu hotkeys). */
const PAGE_HOTKEYS: Record<string, PageId> = {
  '1': 'pet',
  '2': 'dex',
  '3': 'archive',
  '4': 'settings',
};

function handleKey(rt: ShellRuntime, name: string, host: ShellHost): void {
  // Battle-page nav (scrub/play/pick) is owned by the battle module; global
  // hotkeys below still win (they aren't battle-nav names), so order is safe.
  if (handleBattleKey(rt, host, name)) return;
  const navTarget = PAGE_HOTKEYS[name];
  if (navTarget) {
    rt.page = navTarget;
    return;
  }
  switch (name) {
    case 'ctrl-c':
    case 'q':
      rt.quit = true;
      return;
    case 'b':
      // From the Archive, battle the live pet against the selected record.
      if (rt.page === 'archive') startBattleFromArchive(rt, host);
      return;
    case 'up':
      moveSelection(rt, host, -1);
      return;
    case 'down':
      moveSelection(rt, host, +1);
      return;
    case 'left':
      if (rt.page === 'dex') panHouse(rt, -1);
      else adjustSetting(rt, -1);
      return;
    case 'right':
      if (rt.page === 'dex') panHouse(rt, +1);
      else adjustSetting(rt, +1);
      return;
    case 'enter':
      if (rt.page === 'dex') openDexDetail(rt, host);
      return;
    case 'escape':
      if (rt.page === 'dex-detail') rt.page = 'dex';
      return;
    default:
      return;
  }
}

/** The minimal render-context shape the Dex node builder reads (pack + state). */
function dexCtx(host: ShellHost): Parameters<typeof buildHouseNodes>[0] {
  return {
    pack: host.pack,
    state: host.getState(),
  } as unknown as Parameters<typeof buildHouseNodes>[0];
}

/** Pan to the previous/next House sky (wraps), resetting the star selection. */
function panHouse(rt: ShellRuntime, delta: number): void {
  const n = DEX_HOUSES.length;
  const cur = rt.ui.dex.house ?? 0;
  rt.ui.dex.house = (((cur + delta) % n) + n) % n;
  rt.ui.dex.selected = 0;
}

/** Drill into the Dex detail view for the currently selected (discovered) star. */
function openDexDetail(rt: ShellRuntime, host: ShellHost): void {
  const node = buildHouseNodes(dexCtx(host), rt.ui.dex.house ?? 0)[rt.ui.dex.selected];
  if (!node || !node.owned) return;
  const detail = rt.ui['dex-detail'];
  detail.speciesId = node.speciesId;
  detail.selected = 0;
  detail.scroll = 0;
  rt.page = 'dex-detail';
}

/** Battle the live pet against the selected Archive record; open the Battle page on success. */
function startBattleFromArchive(rt: ShellRuntime, host: ShellHost): void {
  const idx = rt.ui.archive.selected;
  const view = buildBattleVsRecord(host, idx);
  if (view) {
    rt.battle = view;
    rt.page = 'battle';
    return;
  }
  // Explain why nothing happened (sealed pet/record, or a same-species mirror match).
  const snap = bestSpeciesRecords(host.getState().dexRecords)[idx];
  const reason = snap ? battleBlockReason(host.getState().pet, snap) : null;
  flash(rt, reason ?? (snap ? 'No opponent available.' : 'No record to battle.'));
}

/** Cycle the focused Settings field and persist (no-op off the Settings page). */
function adjustSetting(rt: ShellRuntime, delta: number): void {
  if (rt.page !== 'settings') return;
  // The update-mode field persists to settings.json; the cycle fields to config.json.
  const updateField = isUpdateFieldSelected(rt.settings);
  cycleSelectedField(rt.settings, delta);
  if (updateField) {
    rt.onUpdateModeChange?.(rt.settings.updateMode);
  } else {
    // The anchor is only meaningful under subscription; persist '' for static so a
    // remembered anchor (kept in-memory for round-trips) never lands in config.json.
    const anchor = rt.settings.cyclePolicy === 'subscription' ? rt.settings.anchorAdapter : '';
    rt.onCycleChange?.(rt.settings.cyclePolicy, anchor);
  }
}

function handleMouse(
  rt: ShellRuntime,
  ev: Extract<InputEvent, { type: 'mouse' }>,
  deps: InputDeps,
): void {
  const host = deps.host;
  if (ev.action === 'wheel-up') {
    moveSelection(rt, host, -1);
    return;
  }
  if (ev.action === 'wheel-down') {
    moveSelection(rt, host, +1);
    return;
  }
  if (ev.action !== 'press') return;

  // Re-derive hit regions for the current frame size to resolve the click.
  const size = defaultSizeSafe();
  const layout = computeLayout(size.cols, size.rows);
  // SGR mouse is 1-based; convert to 0-based cell coords.
  const cx = ev.x - 1;
  const cy = ev.y - 1;

  // Menu clicks: hit-test the same button grid/rail the renderer drew (offset to
  // the menu region's origin so it works for both the bottom band and the rail).
  for (const btn of packMenu(layout.menuRect.cols).buttons) {
    const bx = layout.menuRect.x + btn.x;
    const y = layout.menuRect.y + menuButtonY(btn.row, layout.menuBtnH);
    if (cx >= bx && cx < bx + btn.w && cy >= y && cy < y + layout.menuBtnH) {
      activate(rt, btn.id);
      return;
    }
  }

  // Page-registered regions: DNA copy, Dex House tab, Dex star.
  const region = deps.hits.hit(cx, cy);
  if (region && handleRegionClick(rt, host, deps, region)) return;

  // A click anywhere on the detail page body (outside the menu / a copy region)
  // returns to the Dex.
  if (rt.page === 'dex-detail' && inContentRegion(layout, cx, cy)) {
    rt.page = 'dex';
    return;
  }

  // Archive row clicks: map by canvas geometry, ignoring the menu.
  if (rt.page === 'archive' && inContentRegion(layout, cx, cy)) {
    handleListRowClick(rt, host, cy - (layout.canvasY + ARCHIVE_LIST_OFFSET));
  }
}

/** True when a cell is inside the page content region (not the menu band/rail). */
function inContentRegion(
  layout: ReturnType<typeof computeLayout>,
  cx: number,
  cy: number,
): boolean {
  return (
    cx >= layout.canvasX &&
    cx < layout.canvasX + layout.canvasCols &&
    cy >= layout.canvasY &&
    cy < layout.canvasY + layout.canvasRows
  );
}

/** Resolve a page-registered region click (DNA copy, Dex House tab / star). */
function handleRegionClick(
  rt: ShellRuntime,
  host: ShellHost,
  deps: InputDeps,
  region: string,
): boolean {
  if (region.startsWith('copy:')) {
    deps.copy(region.slice('copy:'.length));
    flash(rt, 'DNA code copied ✓');
    return true;
  }
  if (region.startsWith('dex:house:')) {
    rt.ui.dex.house = Number(region.slice('dex:house:'.length)) || 0;
    rt.ui.dex.selected = 0;
    return true;
  }
  if (region.startsWith('dex:star:')) {
    rt.ui.dex.selected = Number(region.slice('dex:star:'.length)) || 0;
    openDexDetail(rt, host);
    return true;
  }
  return false;
}

function activate(rt: ShellRuntime, id: PageId | 'quit'): void {
  if (id === 'quit') {
    rt.quit = true;
    return;
  }
  rt.page = id;
}

/** Select the Archive row `idxOnScreen` cells below the list top. */
function handleListRowClick(rt: ShellRuntime, host: ShellHost, idxOnScreen: number): void {
  if (idxOnScreen < 0) return;
  const ui = rt.ui.archive;
  const target = ui.scroll + idxOnScreen;
  if (target < 0 || target > rowCount(rt, host) - 1) return;
  ui.selected = target;
}

function moveSelection(rt: ShellRuntime, host: ShellHost, delta: number): void {
  if (rt.page === 'settings') {
    // settingsFieldCount is always >= 2 (update mode + cycle policy), so max >= 1.
    const max = settingsFieldCount(rt.settings) - 1;
    rt.settings.selected = Math.max(0, Math.min(max, rt.settings.selected + delta));
    return;
  }
  if (rt.page === 'dex') {
    // The sky draws apex at the TOP but nodes are ordered tier-ascending (apex
    // last), so the screen axis runs opposite the index axis: invert the step so
    // ↑/wheel-up climbs toward the apex and ↓ descends toward the sprite/Mote.
    const max = houseNodeCount(dexCtx(host), rt.ui.dex.house ?? 0) - 1;
    rt.ui.dex.selected = Math.max(0, Math.min(max, rt.ui.dex.selected - delta));
    return;
  }
  if (rt.page !== 'archive') return;
  const ui = rt.ui.archive;
  const max = rowCount(rt, host) - 1;
  ui.selected = Math.max(0, Math.min(max, ui.selected + delta));
}

function rowCount(rt: ShellRuntime, host: ShellHost): number {
  if (rt.page === 'archive') return host.getState().dexRecords.length;
  return 0;
}
