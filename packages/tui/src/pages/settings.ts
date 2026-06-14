/**
 * Settings page: a board of build/config facts plus the shell's only editable
 * surface — the opt-in update mode and per-adapter `plan` / `cycle` toggles.
 * Everything else (version, runtime, display, data dir) is read-only; Token
 * Tamers is fully idle, so adding/removing adapters and editing scan paths stays
 * in `tt init`.
 *
 * Editing is keyboard/mouse driven by the shell: ↑↓ move `selected` across the
 * flat field list (index 0 = update mode, then two fields per adapter), ←→ cycle
 * the focused field's value. The page stays a pure render of `info` (static) +
 * `settings` (live) and registers a hit region per field; the shell owns mutation
 * + persistence (update mode → settings.json, adapters → config.json).
 */

import type { ColorMode, Rgb } from '../terminal/ansi';
import type { RenderContext, SettingsState } from './types';

const TEXT: Rgb = { r: 214, g: 220, b: 234 };
const DIM: Rgb = { r: 96, g: 100, b: 120 };
const HEADER: Rgb = { r: 150, g: 200, b: 255 };
const LABEL: Rgb = { r: 150, g: 200, b: 255 };
const RULE: Rgb = { r: 52, g: 58, b: 80 };
const SELECT_BG: Rgb = { r: 40, g: 48, b: 78 };
const VALUE_SELECTED: Rgb = { r: 255, g: 224, b: 130 };

const UNKNOWN = '—';

/** The cyclable values for each editable field, in toggle order. */
export const UPDATE_VALUES: readonly string[] = ['off', 'notify', 'auto'];
export const PLAN_VALUES: readonly string[] = ['subscription', 'api'];
export const POLICY_VALUES: readonly string[] = ['dynamic', 'static'];

/** Flat-list selection index of the global update-mode field (always first). */
export const UPDATE_FIELD_INDEX = 0;

/**
 * Number of editable fields: the global update mode (index 0) plus two per
 * adapter. Always ≥ 1, so the Settings page is editable even with no adapters.
 */
export function settingsFieldCount(state: SettingsState): number {
  return 1 + state.adapters.length * 2;
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
 * copy in place. Index 0 is the global update mode; thereafter even/odd offsets
 * are an adapter's plan / cycle policy. No-op when nothing is focused. The shell
 * calls this, then persists (update mode → settings.json, adapters → config.json).
 */
export function cycleSelectedField(state: SettingsState, delta: number): void {
  if (state.selected < 0 || state.selected >= settingsFieldCount(state)) return;
  if (isUpdateFieldSelected(state)) {
    state.updateMode = nextValue(UPDATE_VALUES, state.updateMode, delta);
    return;
  }
  const adapterField = state.selected - 1;
  const adapter = state.adapters[Math.floor(adapterField / 2)];
  if (!adapter) return;
  if (adapterField % 2 === 0) {
    adapter.plan = nextValue(PLAN_VALUES, adapter.plan, delta);
  } else {
    adapter.policy = nextValue(POLICY_VALUES, adapter.policy, delta);
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
  const { canvasX, canvasY, canvasCols } = layout;
  const labelX = canvasX + 1;
  const valueX = canvasX + 13;

  // Centered header + rule, mirroring the Archive page's hall-of-fame strip.
  const title = '⚙ SETTINGS';
  buf.text(
    canvasX + Math.max(1, Math.floor((canvasCols - title.length) / 2)),
    canvasY,
    title,
    HEADER,
    null,
  );
  for (let x = 1; x < canvasCols - 1; x++) {
    buf.set(canvasX + x, canvasY + 1, { ch: '─', fg: RULE, bg: null });
  }

  let y = canvasY + 2;
  const row = (label: string, value: string, valueFg: Rgb = TEXT): void => {
    buf.text(labelX, y, label, LABEL, null);
    buf.text(valueX, y, value, valueFg, null);
    y += 1;
  };

  // Static facts.
  row('Version', `Token Tamers v${info?.version ?? UNKNOWN}`);
  row('Build', `pack rev ${ctx.pack.revision} · schema v${ctx.state.schemaVersion}`);
  row('Runtime', info?.runtime ?? UNKNOWN, DIM);
  row('Display', `${colorLabel(ctx.mode)} · ${info?.fps ?? UNKNOWN} fps`);
  row('Data', info?.dataDir ?? UNKNOWN, DIM);

  // Opt-in update mode — the first EDITABLE field (off ▸ notify ▸ auto).
  y = drawUpdateField(ctx, y, row);

  // Editable adapters.
  y += 1;
  y = drawAdapters(ctx, y);

  // Controls + nav help (replaces the bottom-of-canvas line).
  y += 1;
  buf.text(labelX, y, '↑↓ select   ←→ change   ·   changes apply on restart', DIM, null);
  y += 1;
  buf.text(labelX, y, '1 Pet   2 Dex   3 Archive   4 Settings   q Quit', DIM, null);
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
  hits.add(`settings:field:${UPDATE_FIELD_INDEX}`, canvasX, y, canvasCols, 1);
  return y + 1;
}

/** Draw the editable adapter block; returns the next free canvas row. */
function drawAdapters(ctx: RenderContext, top: number): number {
  const { buf, layout, settings } = ctx;
  const labelX = layout.canvasX + 1;
  const adapters = settings?.adapters ?? [];

  buf.text(labelX, top, 'Adapters', LABEL, null);
  buf.text(
    layout.canvasX + 13,
    top,
    adapters.length === 0 ? 'none configured — run `tt init`' : `${adapters.length} configured`,
    DIM,
    null,
  );

  let y = top + 1;
  for (let ai = 0; ai < adapters.length; ai++) {
    const adapter = adapters[ai];
    if (!adapter) continue;
    drawField(ctx, y, { adapterIndex: ai, field: 'plan', provider: adapter.provider });
    y += 1;
    drawField(ctx, y, { adapterIndex: ai, field: 'cycle', provider: null });
    y += 1;
  }
  return y;
}

interface FieldOpts {
  adapterIndex: number;
  field: 'plan' | 'cycle';
  /** Provider name to print on the plan row; null on the cycle row. */
  provider: string | null;
}

/** Draw one editable field row (provider + label + ‹ value ›) and its hit region. */
function drawField(ctx: RenderContext, y: number, opts: FieldOpts): void {
  const { buf, hits, layout, settings } = ctx;
  const { canvasX, canvasCols } = layout;
  const adapter = settings?.adapters[opts.adapterIndex];
  if (!adapter) return;

  // +1: the global update-mode field occupies selection index 0.
  const index = 1 + opts.adapterIndex * 2 + (opts.field === 'plan' ? 0 : 1);
  const selected = settings?.selected === index;
  const value = opts.field === 'plan' ? adapter.plan : adapter.policy;
  const segment = `‹ ${value} ›`;

  if (selected) {
    for (let x = 1; x < canvasCols - 1; x++) {
      buf.set(canvasX + x, y, { ch: ' ', fg: null, bg: SELECT_BG });
    }
  }
  const bg = selected ? SELECT_BG : null;
  buf.text(canvasX + 1, y, selected ? '›' : ' ', VALUE_SELECTED, bg);
  if (opts.provider) buf.text(canvasX + 3, y, opts.provider, TEXT, bg);
  buf.text(canvasX + 17, y, opts.field === 'plan' ? 'plan' : 'cycle', DIM, bg);
  buf.text(canvasX + 23, y, segment, selected ? VALUE_SELECTED : TEXT, bg);
  hits.add(`settings:field:${index}`, canvasX, y, canvasCols, 1);
}
