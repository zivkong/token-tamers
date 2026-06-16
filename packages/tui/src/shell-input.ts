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
import { buildDexRows, DEX_LIST_OFFSET } from './pages/dex';
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
      adjustSetting(rt, -1);
      return;
    case 'right':
      adjustSetting(rt, +1);
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

/** Drill into the Dex detail view for the currently selected (discovered) row. */
function openDexDetail(rt: ShellRuntime, host: ShellHost): void {
  const ctx = {
    pack: host.pack,
    state: host.getState(),
  } as unknown as Parameters<typeof buildDexRows>[0];
  const row = buildDexRows(ctx)[rt.ui.dex.selected];
  if (!row || !row.owned || !row.speciesId) return;
  const detail = rt.ui['dex-detail'];
  detail.speciesId = row.speciesId;
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

  // Menu clicks: hit-test the same equal-width button grid the renderer drew.
  for (const btn of packMenu(layout.termCols).buttons) {
    const y = layout.menuY + menuButtonY(btn.row, layout.menuBtnH);
    if (cx >= btn.x && cx < btn.x + btn.w && cy >= y && cy < y + layout.menuBtnH) {
      activate(rt, btn.id);
      return;
    }
  }

  // Page-registered regions (e.g. the Dex-detail DNA code → copy to clipboard).
  const region = deps.hits.hit(cx, cy);
  if (region?.startsWith('copy:')) {
    deps.copy(region.slice('copy:'.length));
    flash(rt, 'DNA code copied ✓');
    return;
  }

  // A click anywhere on the detail page (outside the menu / a copy region) returns to the Dex.
  if (rt.page === 'dex-detail' && cy < layout.menuDividerY) {
    rt.page = 'dex';
    return;
  }

  // List-row clicks (Dex/Archive): map by canvas geometry, ignoring the menu.
  if ((rt.page === 'dex' || rt.page === 'archive') && cy < layout.menuDividerY) {
    handleListRowClick(rt, host, cy - (layout.canvasY + listOffset(rt.page)));
  }
}

/** First-visible-row offset for the list page, shared with the renderer. */
function listOffset(page: PageId): number {
  return page === 'dex' ? DEX_LIST_OFFSET : ARCHIVE_LIST_OFFSET;
}

/** Select (and on the Dex, drill into) the list row `idxOnScreen` cells below the list top. */
function handleListRowClick(rt: ShellRuntime, host: ShellHost, idxOnScreen: number): void {
  if (idxOnScreen < 0) return;
  const ui = rt.ui[rt.page];
  const target = ui.scroll + idxOnScreen;
  if (target < 0 || target > rowCount(rt, host) - 1) return;
  ui.selected = target;
  // On the Dex, a click on a discovered species drills into its detail.
  if (rt.page === 'dex') openDexDetail(rt, host);
}

function activate(rt: ShellRuntime, id: PageId | 'quit'): void {
  if (id === 'quit') {
    rt.quit = true;
    return;
  }
  rt.page = id;
}

function moveSelection(rt: ShellRuntime, host: ShellHost, delta: number): void {
  if (rt.page === 'settings') {
    // settingsFieldCount is always >= 2 (update mode + cycle policy), so max >= 1.
    const max = settingsFieldCount(rt.settings) - 1;
    rt.settings.selected = Math.max(0, Math.min(max, rt.settings.selected + delta));
    return;
  }
  if (rt.page !== 'dex' && rt.page !== 'archive') return;
  const ui = rt.ui[rt.page];
  const max = rowCount(rt, host) - 1;
  ui.selected = Math.max(0, Math.min(max, ui.selected + delta));
}

function rowCount(rt: ShellRuntime, host: ShellHost): number {
  const state = host.getState();
  if (rt.page === 'archive') return state.dexRecords.length;
  if (rt.page === 'dex') {
    // Build minimal context for counting Dex rows.
    const ctx = {
      pack: host.pack,
      state,
    } as unknown as Parameters<typeof buildDexRows>[0];
    return buildDexRows(ctx).length;
  }
  return 0;
}
