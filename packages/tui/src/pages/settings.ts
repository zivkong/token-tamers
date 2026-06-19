/**
 * Settings page — a compact board of read-only facts plus the shell's editable
 * surface, grouped into labelled sections (Identity · Display · Cycle · Updates).
 *
 * Fields are declared once in {@link SECTIONS}; the renderer and the cycle/edit
 * helpers are generic over that list, so adding a setting is one array entry. The
 * flat `selected` index walks the VISIBLE fields top-to-bottom (the subscription
 * anchor is hidden under static / a single adapter). The page stays a pure render
 * of `info` (static) + `settings` (live) and registers a hit region per field row;
 * the shell owns mutation + persistence, routed by each field's `group`:
 *   identity → config.json · display → settings.json (LIVE) · cycle → config.json ·
 *   update → settings.json.
 */

import { sanitizeTamerName, TAMER_NAME_MAX } from '@token-tamers/core';
import type { Rgb } from '../terminal/ansi';
import { drawDivider, drawPageFooter, drawPageHeader, pageBodyBottom } from '../components';
import type { RenderContext, SettingsState } from './types';

const TEXT: Rgb = { r: 214, g: 220, b: 234 };
const DIM: Rgb = { r: 96, g: 100, b: 120 };
const LABEL: Rgb = { r: 150, g: 200, b: 255 };
const SELECT_BG: Rgb = { r: 40, g: 48, b: 78 };
const VALUE_SELECTED: Rgb = { r: 255, g: 224, b: 130 };

const UNKNOWN = '—';
const NO_TITLE = '— none';

/** Option lists for the choice fields, in toggle order. */
export const UPDATE_VALUES: readonly string[] = ['off', 'notify', 'auto'];
export const CYCLE_VALUES: readonly string[] = ['subscription', 'static'];
export const COLOR_VALUES: readonly string[] = ['auto', 'truecolor', '256', '8', 'none'];
export const SUBCELL_VALUES: readonly string[] = ['auto', 'octant', 'sextant', 'half'];

// ---------------------------------------------------------------------------
// Declarative field model
// ---------------------------------------------------------------------------

/** Where an edited field is persisted (the shell routes to the matching hook). */
export type FieldGroup = 'tamer' | 'display' | 'cycle' | 'update';

export interface FieldSpec {
  /** Stable key (also the SettingsState property for choice fields). */
  key: string;
  /** Row label. */
  label: string;
  /** 'text' = the handle (Enter+typing); 'choice' = a ‹ value › cycler. */
  kind: 'text' | 'choice';
  /** Persistence group. */
  group: FieldGroup;
  /** Choice cycle order (choice fields only). */
  options?: (s: SettingsState) => readonly string[];
  /** Current display value (choice fields only). */
  value?: (s: SettingsState) => string;
  /** Write a cycled value back into state (choice fields only). */
  set?: (s: SettingsState, v: string) => void;
  /** Visibility predicate (e.g. the anchor only shows under subscription + >1 adapter). */
  visible?: (s: SettingsState) => boolean;
}

/** Whether the subscription anchor field is shown (subscription + >1 adapter). */
export function anchorFieldShown(state: SettingsState): boolean {
  return state.cyclePolicy === 'subscription' && state.adapters.length > 1;
}

const SECTIONS: ReadonlyArray<{ title: string; fields: FieldSpec[] }> = [
  {
    title: 'Identity',
    fields: [
      { key: 'tamerName', label: 'Tamer', kind: 'text', group: 'tamer' },
      {
        key: 'tamerTitle',
        label: 'Title',
        kind: 'choice',
        group: 'tamer',
        options: (s) => [NO_TITLE, ...s.earnedTitles],
        value: (s) => s.tamerTitle || NO_TITLE,
        set: (s, v) => {
          s.tamerTitle = v === NO_TITLE ? '' : v;
        },
      },
    ],
  },
  {
    title: 'Display',
    fields: [
      {
        key: 'color',
        label: 'Color',
        kind: 'choice',
        group: 'display',
        options: () => COLOR_VALUES,
        value: (s) => s.color,
        set: (s, v) => {
          s.color = v;
        },
      },
      {
        key: 'subcell',
        label: 'Sprites',
        kind: 'choice',
        group: 'display',
        options: () => SUBCELL_VALUES,
        value: (s) => s.subcell,
        set: (s, v) => {
          s.subcell = v;
        },
      },
    ],
  },
  {
    title: 'Cycle',
    fields: [
      {
        key: 'cyclePolicy',
        label: 'Clock',
        kind: 'choice',
        group: 'cycle',
        options: () => CYCLE_VALUES,
        value: (s) => s.cyclePolicy,
        set: (s, v) => {
          s.cyclePolicy = v;
          // Subscription needs an anchor; seed the first adapter only when none is
          // remembered yet (a later switch back restores the player's choice).
          if (v === 'subscription' && !s.anchorAdapter) {
            s.anchorAdapter = s.adapters[0]?.provider ?? '';
          }
        },
      },
      {
        key: 'anchorAdapter',
        label: 'Anchor',
        kind: 'choice',
        group: 'cycle',
        visible: anchorFieldShown,
        options: (s) => s.adapters.map((a) => a.provider),
        value: (s) => s.anchorAdapter,
        set: (s, v) => {
          s.anchorAdapter = v;
        },
      },
    ],
  },
  {
    title: 'Updates',
    fields: [
      {
        key: 'updateMode',
        label: 'Mode',
        kind: 'choice',
        group: 'update',
        options: () => UPDATE_VALUES,
        value: (s) => s.updateMode,
        set: (s, v) => {
          s.updateMode = v;
        },
      },
    ],
  },
];

const ALL_FIELDS: readonly FieldSpec[] = SECTIONS.flatMap((sec) => sec.fields);

/** The visible fields, flat, in render order (skips a hidden anchor). */
function visibleFields(state: SettingsState): FieldSpec[] {
  return ALL_FIELDS.filter((f) => !f.visible || f.visible(state));
}

/** Number of selectable fields (drives ↑↓ bounds). */
export function settingsFieldCount(state: SettingsState): number {
  return visibleFields(state).length;
}

/** The field the flat `selected` index points at (or undefined if out of range). */
export function fieldAt(state: SettingsState): FieldSpec | undefined {
  return visibleFields(state)[state.selected];
}

/** True when the Tamer-name text field is the one currently focused. */
export function isNameFieldSelected(state: SettingsState): boolean {
  return fieldAt(state)?.key === 'tamerName';
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
  if (n === 0) return current;
  const at = values.indexOf(current);
  const base = at < 0 ? 0 : at;
  return values[(((base + delta) % n) + n) % n] ?? current;
}

/**
 * Cycle the currently-focused CHOICE field by `delta` (+1 / -1), mutating the
 * working copy in place. A text field (the handle) is a no-op here — it is edited
 * by typing. The shell calls this, then persists by the field's `group`.
 */
export function cycleSelectedField(state: SettingsState, delta: number): void {
  const f = fieldAt(state);
  if (!f || f.kind !== 'choice' || !f.options || !f.value || !f.set) return;
  f.set(state, nextValue(f.options(state), f.value(state), delta));
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export function renderSettingsPage(ctx: RenderContext): void {
  const { buf, layout, info } = ctx;
  const labelX = layout.canvasX + 1;
  const valueX = layout.canvasX + 13;
  let y = drawPageHeader(ctx, { icon: '⚙', title: 'Settings' });
  const bottom = pageBodyBottom(layout);
  const row = (label: string, value: string, valueFg: Rgb = TEXT): void => {
    if (y < bottom) {
      buf.text(labelX, y, label, LABEL, null);
      buf.text(valueX, y, value, valueFg, null);
    }
    y += 1;
  };

  // Read-only facts (Runtime removed). The player-facing era is the Season; the
  // backend pack/schema version numbers stay hidden.
  row('Version', `Token Tamers v${info?.version ?? UNKNOWN}`);
  row('Season', `Season ${ctx.pack.season}`, LABEL);
  row('Data', info?.dataDir ?? UNKNOWN, DIM);

  const s = ctx.settings;
  if (s) {
    // drawSections owns its own spacing (a blank line before AND after each section
    // title), so it starts right after the static block.
    y = drawSections(ctx, y, s);
    y += 1;
    drawAdapters(ctx, row);
  }

  drawPageFooter(
    ctx,
    s?.editingName
      ? 'type your handle   ·   Enter done   ·   Esc cancel'
      : '↑↓ select   ←→ change   ·   Enter edit name   ·   color/sprites apply live',
  );
}

/** Draw each section header + its visible fields; returns the next free row. */
function drawSections(ctx: RenderContext, startY: number, s: SettingsState): number {
  const { buf, layout } = ctx;
  const bottom = pageBodyBottom(layout);
  let y = startY;
  let index = 0;
  for (const section of SECTIONS) {
    const fields = section.fields.filter((f) => !f.visible || f.visible(s));
    if (fields.length === 0) continue;
    y += 1; // gap BEFORE the section title (separates it from the section above)
    if (y < bottom) {
      drawDivider(buf, y, {
        x: layout.canvasX + 1,
        width: layout.canvasCols - 2,
        label: section.title,
      });
    }
    y += 2; // advance past the title row + a blank gap AFTER it (divider standard)
    for (const f of fields) {
      drawField(ctx, y, f, index, s);
      index += 1;
      y += 1;
    }
  }
  return y;
}

/** Draw one field row (label + value/handle) and its hit region, bounds-guarded. */
function drawField(
  ctx: RenderContext,
  y: number,
  f: FieldSpec,
  index: number,
  s: SettingsState,
): void {
  const { buf, hits, layout, info } = ctx;
  const { canvasX, canvasCols } = layout;
  if (y >= pageBodyBottom(layout)) return;
  const selected = s.selected === index;
  if (selected) {
    for (let x = 1; x < canvasCols - 1; x++) {
      buf.set(canvasX + x, y, { ch: ' ', fg: null, bg: SELECT_BG });
    }
  }
  const bg = selected ? SELECT_BG : null;
  buf.text(canvasX + 1, y, selected ? '›' : ' ', VALUE_SELECTED, bg);
  buf.text(canvasX + 3, y, f.label, LABEL, bg);

  if (f.kind === 'text') {
    const editing = selected && s.editingName;
    const name = s.tamerName;
    const shown = editing ? `${name}_` : name || '— anonymous';
    const fg = editing ? VALUE_SELECTED : name ? TEXT : DIM;
    buf.text(canvasX + 13, y, shown, fg, bg);
  } else {
    const segment = `‹ ${f.value!(s)} ›`;
    buf.text(canvasX + 13, y, segment, selected ? VALUE_SELECTED : TEXT, bg);
    // The update-mode field appends a "· vX available" hint when a check found one.
    if (f.key === 'updateMode' && info?.updateAvailable) {
      buf.text(
        canvasX + 14 + [...segment].length,
        y,
        `· ${info.updateAvailable} available`,
        DIM,
        bg,
      );
    }
  }
  hits.add(`settings:field:${index}`, canvasX + 1, y, canvasCols - 2, 1);
}

/** Draw the read-only adapter list (data sources; managed by `tt init`). */
function drawAdapters(ctx: RenderContext, row: (l: string, v: string, fg?: Rgb) => void): void {
  const adapters = ctx.settings?.adapters ?? [];
  if (adapters.length === 0) {
    row('Adapters', 'none configured — run `tt init`', DIM);
    return;
  }
  row('Adapters', `${adapters.map((a) => a.provider).join(', ')}   (manage via \`tt init\`)`, DIM);
}
