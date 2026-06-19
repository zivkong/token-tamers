/**
 * Settings page: a board of build/config facts plus the shell's only editable
 * surface — the opt-in update mode and the pet-global cycle clock (policy + the
 * subscription anchor adapter). Everything else (version, runtime, display, data
 * dir, the adapter list) is read-only; Token Tamers is fully idle, so adding/
 * removing adapters and editing scan paths stays in `tt init`.
 *
 * Editing is keyboard/mouse driven by the shell: ↑↓ move `selected` across the
 * flat field list (0 = update mode, 1 = cycle policy, 2 = anchor when shown), ←→
 * cycle the focused field's value. The page stays a pure render of `info` (static)
 * + `settings` (live) and registers a hit region per field; the shell owns
 * mutation + persistence (update mode → settings.json, cycle → config.json).
 */

import { sanitizeTamerName, TAMER_NAME_MAX } from '@token-tamers/core';
import type { ColorMode, Rgb } from '../terminal/ansi';
import { drawPageFooter, drawPageHeader, pageBodyBottom } from '../components';
import type { RenderContext, SettingsState } from './types';

/** The title options the player can wear: "none" first, then each earned title. */
const NO_TITLE = '— none';
function titleOptions(state: SettingsState): string[] {
  return [NO_TITLE, ...state.earnedTitles];
}

const TEXT: Rgb = { r: 214, g: 220, b: 234 };
const DIM: Rgb = { r: 96, g: 100, b: 120 };
const LABEL: Rgb = { r: 150, g: 200, b: 255 };
const SELECT_BG: Rgb = { r: 40, g: 48, b: 78 };
const VALUE_SELECTED: Rgb = { r: 255, g: 224, b: 130 };

const UNKNOWN = '—';

/** The cyclable values for each editable field, in toggle order. */
export const UPDATE_VALUES: readonly string[] = ['off', 'notify', 'auto'];
export const CYCLE_VALUES: readonly string[] = ['subscription', 'static'];

/** Flat-list selection indices of the global editable fields. */
export const UPDATE_FIELD_INDEX = 0;
export const CYCLE_FIELD_INDEX = 1;
export const ANCHOR_FIELD_INDEX = 2;

/** Whether the subscription anchor field is shown (subscription + >1 adapter). */
export function anchorFieldShown(state: SettingsState): boolean {
  return state.cyclePolicy === 'subscription' && state.adapters.length > 1;
}

/**
 * Selection index of the Tamer-name field. The identity fields (name, then title)
 * sit AFTER the cycle block, so the name index slides by one when the optional
 * subscription anchor field is showing.
 */
export function nameFieldIndex(state: SettingsState): number {
  return anchorFieldShown(state) ? 3 : 2;
}

/** Selection index of the Tamer-title field (immediately after the name). */
export function titleFieldIndex(state: SettingsState): number {
  return nameFieldIndex(state) + 1;
}

/**
 * Number of editable fields: update mode (0) + cycle policy (1) are always present;
 * the subscription anchor (2) appears only under subscription with >1 adapter; the
 * Tamer name + title always follow.
 */
export function settingsFieldCount(state: SettingsState): number {
  return (anchorFieldShown(state) ? 3 : 2) + 2;
}

/** True when the Tamer-name field is the one currently focused. */
export function isNameFieldSelected(state: SettingsState): boolean {
  return state.selected === nameFieldIndex(state);
}

/** Append a printable char to the handle (capped); used while editing the name. */
export function appendNameChar(state: SettingsState, ch: string): void {
  state.tamerName = sanitizeTamerName(state.tamerName + ch, TAMER_NAME_MAX);
}

/** Delete the last char of the handle; used while editing the name. */
export function backspaceName(state: SettingsState): void {
  state.tamerName = state.tamerName.slice(0, -1);
}

/** Wrap a value to the next/previous entry in its option list. */
function nextValue(values: readonly string[], current: string, delta: number): string {
  const n = values.length;
  const at = values.indexOf(current);
  const base = at < 0 ? 0 : at;
  return values[(((base + delta) % n) + n) % n] ?? current;
}

/** True when the update-mode field is the one currently focused. */
export function isUpdateFieldSelected(state: SettingsState): boolean {
  return state.selected === UPDATE_FIELD_INDEX;
}

/**
 * Cycle the currently-focused field by `delta` (+1 / -1), mutating the working
 * copy in place. Index 0 = update mode, 1 = cycle policy, 2 = subscription anchor.
 * No-op when nothing is focused. The shell calls this, then persists (update mode
 * → settings.json, cycle → config.json).
 */
export function cycleSelectedField(state: SettingsState, delta: number): void {
  if (state.selected < 0 || state.selected >= settingsFieldCount(state)) return;
  if (state.selected === UPDATE_FIELD_INDEX) {
    state.updateMode = nextValue(UPDATE_VALUES, state.updateMode, delta);
    return;
  }
  if (state.selected === CYCLE_FIELD_INDEX) {
    state.cyclePolicy = nextValue(CYCLE_VALUES, state.cyclePolicy, delta);
    // Subscription needs an anchor; seed the first adapter only when none is
    // remembered yet. Switching to static KEEPS the remembered anchor (the field
    // just hides via settingsFieldCount, and persistence drops the anchor under
    // static) so a later switch back restores the player's chosen adapter rather
    // than silently snapping to the first one.
    if (state.cyclePolicy === 'subscription' && !state.anchorAdapter) {
      state.anchorAdapter = state.adapters[0]?.provider ?? '';
    }
    return;
  }
  // Anchor field: cycle through the configured adapter ids.
  if (state.selected === ANCHOR_FIELD_INDEX && anchorFieldShown(state)) {
    const ids = state.adapters.map((a) => a.provider);
    state.anchorAdapter = nextValue(ids, state.anchorAdapter, delta);
    return;
  }
  // Title field: cycle through "none" + the earned titles. (The name field is
  // text-edited by typing, not cycled, so ←→ is a no-op there.)
  if (state.selected === titleFieldIndex(state)) {
    const opts = titleOptions(state);
    const current = state.tamerTitle || NO_TITLE;
    const next = nextValue(opts, current, delta);
    state.tamerTitle = next === NO_TITLE ? '' : next;
  }
}

/** Human label for the active color mode (drawn from the live writer mode). */
function colorLabel(mode: ColorMode): string {
  switch (mode) {
    case 'truecolor':
      return 'truecolor';
    case '256':
      return '256-color';
    case '8':
      return '8-color';
    case 'none':
      return 'monochrome';
  }
}

export function renderSettingsPage(ctx: RenderContext): void {
  const { buf, layout, info } = ctx;
  const labelX = layout.canvasX + 1;
  const valueX = layout.canvasX + 13;

  // Standard page header (no completion readout — Settings tracks nothing).
  // Returns the first body row.
  let y = drawPageHeader(ctx, { icon: '⚙', title: 'Settings' });
  // Body rows stop above the footer clearance gap so nothing collides with the
  // footer on a short horizontal dock (excess static rows degrade gracefully).
  const bodyBottom = pageBodyBottom(layout);
  const row = (label: string, value: string, valueFg: Rgb = TEXT): void => {
    if (y < bodyBottom) {
      buf.text(labelX, y, label, LABEL, null);
      buf.text(valueX, y, value, valueFg, null);
    }
    y += 1;
  };

  // Static facts. The player-facing content era is the Season; the backend
  // pack/schema version numbers are intentionally NOT shown here.
  row('Version', `Token Tamers v${info?.version ?? UNKNOWN}`);
  row('Season', `Season ${ctx.pack.season}`, LABEL);
  row('Runtime', info?.runtime ?? UNKNOWN, DIM);
  row('Display', `${colorLabel(ctx.mode)} · ${info?.fps ?? UNKNOWN} fps`);
  row('Data', info?.dataDir ?? UNKNOWN, DIM);

  // Opt-in update mode — the first EDITABLE field (off ▸ notify ▸ auto).
  y = drawUpdateField(ctx, y, row);

  // Pet-global cycle clock — editable: policy (▸ anchor when subscription).
  y = drawCycleFields(ctx, y);

  // Tamer identity — your handle (text-edit) + the title you wear (cycle earned).
  y = drawTamerFields(ctx, y, row);

  // Read-only adapter list (data sources only; managed by `tt init`).
  y += 1;
  drawAdapters(ctx, row);

  // Standard footer: the editing-controls hint (the name field has its own typing
  // mode). The nav legend is intentionally gone — the global "── Menu ──" buttons
  // below already provide page navigation.
  drawPageFooter(
    ctx,
    ctx.settings?.editingName
      ? 'type your handle   ·   Enter done   ·   Esc cancel'
      : '↑↓ select   ←→ change   ·   Enter edit name   ·   changes apply on restart',
  );
}

/**
 * Draw the Tamer identity fields: the handle (a text-edit field — Enter toggles
 * typing, see shell-input) and the worn title (cycle through earned titles).
 * Read-only fallback to static `info` when there is no live settings state.
 */
function drawTamerFields(
  ctx: RenderContext,
  y: number,
  row: (label: string, value: string, valueFg?: Rgb) => void,
): number {
  const { settings, info } = ctx;
  if (!settings) {
    row('Tamer', info?.tamer || 'Anonymous Tamer', info?.tamer ? TEXT : DIM);
    row('Title', info?.tamerTitle || UNKNOWN, DIM);
    return y + 2;
  }
  drawNameField(ctx, y, settings);
  const titleY = y + 1;
  drawEditableField(ctx, titleY, {
    index: titleFieldIndex(settings),
    label: 'Title',
    value: settings.tamerTitle || NO_TITLE,
  });
  return titleY + 1;
}

/** Draw the editable Tamer-name field: the handle text + a caret while editing. */
function drawNameField(ctx: RenderContext, y: number, settings: SettingsState): void {
  const { buf, hits, layout } = ctx;
  const { canvasX, canvasCols } = layout;
  if (y >= pageBodyBottom(layout)) return;
  const idx = nameFieldIndex(settings);
  const selected = settings.selected === idx;
  const editing = selected && settings.editingName;
  if (selected) {
    for (let x = 1; x < canvasCols - 1; x++) {
      buf.set(canvasX + x, y, { ch: ' ', fg: null, bg: SELECT_BG });
    }
  }
  const bg = selected ? SELECT_BG : null;
  const name = settings.tamerName;
  const shown = editing ? `${name}_` : name || '— anonymous';
  const fg = editing ? VALUE_SELECTED : name ? TEXT : DIM;
  buf.text(canvasX + 1, y, selected ? '›' : ' ', VALUE_SELECTED, bg);
  buf.text(canvasX + 3, y, 'Tamer', LABEL, bg);
  buf.text(canvasX + 13, y, shown, fg, bg);
  hits.add(`settings:field:${idx}`, canvasX + 1, y, canvasCols - 2, 1);
}

/**
 * Draw the editable update-mode field (selection index 0) + its hit region, and
 * return the next free row. Falls back to a read-only row when there is no live
 * settings state (golden frames that pass only `info`). The `‹ value ›` cycles
 * off ▸ notify ▸ auto; an opt-in check may append a `· vX available` hint.
 */
function drawUpdateField(
  ctx: RenderContext,
  y: number,
  row: (label: string, value: string, valueFg?: Rgb) => void,
): number {
  const { buf, hits, layout, settings, info } = ctx;
  const { canvasX, canvasCols } = layout;
  // Never draw/register a hit on or below the footer clearance gap.
  if (y >= pageBodyBottom(layout)) return y + 1;
  const hint = info?.updateAvailable ? ` · ${info.updateAvailable} available` : '';

  // No live state (tests passing only `info`): keep the prior read-only row.
  if (!settings) {
    row(
      'Updates',
      `${info?.updateMode ?? UNKNOWN}${hint}`,
      info?.updateAvailable ? VALUE_SELECTED : DIM,
    );
    return y + 1;
  }

  const selected = settings.selected === UPDATE_FIELD_INDEX;
  if (selected) {
    for (let x = 1; x < canvasCols - 1; x++) {
      buf.set(canvasX + x, y, { ch: ' ', fg: null, bg: SELECT_BG });
    }
  }
  const bg = selected ? SELECT_BG : null;
  const segment = `‹ ${settings.updateMode} ›`;
  buf.text(canvasX + 1, y, selected ? '›' : ' ', VALUE_SELECTED, bg);
  buf.text(canvasX + 3, y, 'Updates', LABEL, bg);
  buf.text(canvasX + 13, y, segment, selected ? VALUE_SELECTED : TEXT, bg);
  if (hint) buf.text(canvasX + 14 + [...segment].length, y, hint.trimStart(), DIM, bg);
  // Hit region matches the highlight fill (cols 1..canvasCols-1), not col 0.
  hits.add(`settings:field:${UPDATE_FIELD_INDEX}`, canvasX + 1, y, canvasCols - 2, 1);
  return y + 1;
}

/**
 * Draw the editable cycle fields: the policy (index 1) and, when subscription is
 * active with more than one adapter, the anchor adapter (index 2). Returns the
 * next free canvas row. Read-only fallback when there is no live settings state.
 */
function drawCycleFields(ctx: RenderContext, y: number): number {
  const { settings } = ctx;
  if (!settings) {
    if (y < pageBodyBottom(ctx.layout)) {
      ctx.buf.text(ctx.layout.canvasX + 1, y, 'Cycle', LABEL, null);
      ctx.buf.text(ctx.layout.canvasX + 13, y, UNKNOWN, DIM, null);
    }
    return y + 1;
  }
  drawEditableField(ctx, y, {
    index: CYCLE_FIELD_INDEX,
    label: 'Cycle',
    value: settings.cyclePolicy,
  });
  let next = y + 1;
  if (anchorFieldShown(settings)) {
    drawEditableField(ctx, next, {
      index: ANCHOR_FIELD_INDEX,
      label: 'Anchor',
      value: settings.anchorAdapter,
    });
    next += 1;
  }
  return next;
}

interface EditableField {
  index: number;
  label: string;
  value: string;
}

/** Draw one global editable field row (label + ‹ value ›) and its hit region. */
function drawEditableField(ctx: RenderContext, y: number, f: EditableField): void {
  const { buf, hits, layout, settings } = ctx;
  const { canvasX, canvasCols } = layout;
  // Stay above the footer clearance gap — never draw OR register a hit on/below
  // the footer row (a short dock would otherwise put a live hit under the footer).
  if (y >= pageBodyBottom(layout)) return;
  const selected = settings?.selected === f.index;
  const segment = `‹ ${f.value} ›`;

  if (selected) {
    for (let x = 1; x < canvasCols - 1; x++) {
      buf.set(canvasX + x, y, { ch: ' ', fg: null, bg: SELECT_BG });
    }
  }
  const bg = selected ? SELECT_BG : null;
  buf.text(canvasX + 1, y, selected ? '›' : ' ', VALUE_SELECTED, bg);
  buf.text(canvasX + 3, y, f.label, LABEL, bg);
  buf.text(canvasX + 13, y, segment, selected ? VALUE_SELECTED : TEXT, bg);
  // Hit region matches the highlight fill (cols 1..canvasCols-1), not col 0.
  hits.add(`settings:field:${f.index}`, canvasX + 1, y, canvasCols - 2, 1);
}

/** Draw the read-only adapter list (data sources; managed by `tt init`). */
function drawAdapters(ctx: RenderContext, row: (l: string, v: string, fg?: Rgb) => void): void {
  const adapters = ctx.settings?.adapters ?? [];
  if (adapters.length === 0) {
    row('Adapters', 'none configured — run `tt init`', DIM);
    return;
  }
  row('Adapters', adapters.map((a) => a.provider).join(', '), DIM);
}
