/**
 * Settings page: a board of build/config facts plus the only editable surface in
 * the shell — per-adapter `plan` and `cycle` toggles. Everything else (version,
 * runtime, display, data dir) is read-only; Token Tamers is fully idle, so adding
 * or removing adapters and editing scan paths stays in `tt init`.
 *
 * Editing is keyboard/mouse driven by the shell: ↑↓ move `selected` across the
 * flat field list (two fields per adapter), ←→ cycle the focused field's value.
 * The page itself stays a pure render of `info` (static) + `settings` (live) and
 * registers a hit region per field; the shell owns mutation + persistence.
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

/** The cyclable values for each editable adapter field, in toggle order. */
export const PLAN_VALUES: readonly string[] = ['subscription', 'api'];
export const POLICY_VALUES: readonly string[] = ['dynamic', 'static'];

/** Number of editable fields in the Settings state (two per adapter). */
export function settingsFieldCount(state: SettingsState): number {
  return state.adapters.length * 2;
}

/** Wrap a value to the next/previous entry in its option list. */
function nextValue(values: readonly string[], current: string, delta: number): string {
  const n = values.length;
  const at = values.indexOf(current);
  const base = at < 0 ? 0 : at;
  return values[(((base + delta) % n) + n) % n] ?? current;
}

/**
 * Cycle the currently-focused field by `delta` (+1 / -1), mutating the working
 * copy in place. Even indices are an adapter's plan; odd indices its cycle policy.
 * No-op when nothing is focused. The shell calls this, then persists.
 */
export function cycleSelectedField(state: SettingsState, delta: number): void {
  if (state.selected < 0 || state.selected >= settingsFieldCount(state)) return;
  const adapter = state.adapters[Math.floor(state.selected / 2)];
  if (!adapter) return;
  if (state.selected % 2 === 0) {
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
  // Opt-in update status: the mode, plus a 'vX available' hint after a check.
  const updates = info?.updateAvailable
    ? `${info.updateMode ?? 'off'} · ${info.updateAvailable} available`
    : (info?.updateMode ?? UNKNOWN);
  row('Updates', updates, info?.updateAvailable ? VALUE_SELECTED : DIM);

  // Editable adapters.
  y += 1;
  y = drawAdapters(ctx, y);

  // Controls + nav help (replaces the bottom-of-canvas line).
  y += 1;
  buf.text(labelX, y, '↑↓ select   ←→ change   ·   changes apply on restart', DIM, null);
  y += 1;
  buf.text(labelX, y, '1 Pet   2 Dex   3 Archive   4 Settings   q Quit', DIM, null);
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

  const index = opts.adapterIndex * 2 + (opts.field === 'plan' ? 0 : 1);
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
