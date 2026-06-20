/**
 * Reusable modal dialog — a centered pop-up that overlays the page with a title,
 * a few message lines, and two buttons (Confirm / Cancel). Drawn LAST in the frame
 * so it sits on top of everything, and it registers `modal:confirm` / `modal:cancel`
 * hit regions for mouse parity. Pure: a function of the `ModalView` + the layout's
 * canvas rect, so it is golden-frame testable. The action to run on confirm lives
 * on the shell runtime (`ShellRuntime.modal.onConfirm`), never in this view.
 *
 * Reuse it for ANY confirm/cancel decision — open one via the shell's
 * `openConfirmModal(rt, {...})` helper and the input layer drives focus + dispatch.
 */

import type { Rgb } from '../terminal/ansi';
import type { ModalView, RenderContext } from '../pages/types';

const PANEL_BG: Rgb = { r: 28, g: 32, b: 46 };
const BORDER: Rgb = { r: 104, g: 112, b: 140 };
const TITLE_INFO: Rgb = { r: 206, g: 213, b: 230 };
const TITLE_WARN: Rgb = { r: 240, g: 176, b: 96 };
const BODY: Rgb = { r: 206, g: 212, b: 228 };
const BTN_FG: Rgb = { r: 198, g: 205, b: 222 };
const BTN_BG: Rgb = { r: 46, g: 52, b: 70 };
/** Focused-button fill: amber for a neutral confirm, caution red for a warning. */
const FOCUS_FG: Rgb = { r: 18, g: 16, b: 10 };
const FOCUS_INFO_BG: Rgb = { r: 240, g: 196, b: 110 };
const FOCUS_WARN_BG: Rgb = { r: 232, g: 116, b: 116 };

/** Horizontal padding inside the border; vertical: title row, gap, lines, gap, buttons. */
const PAD_X = 2;
const GAP = 2; // cells between the two buttons

function clip(s: string, max: number): string {
  return [...s].slice(0, Math.max(0, max)).join('');
}

function btnText(label: string): string {
  return `[ ${label} ]`;
}

/** Total width the two buttons + their gap occupy. */
function buttonsWidth(view: ModalView): number {
  return [...btnText(view.confirmLabel)].length + GAP + [...btnText(view.cancelLabel)].length;
}

/** Draw the box border (corners + edges) over an already-filled panel rect. */
function drawBorder(ctx: RenderContext, x: number, y: number, w: number, h: number): void {
  const { buf } = ctx;
  const right = x + w - 1;
  const bottom = y + h - 1;
  for (let i = 0; i < w; i++) {
    const top = i === 0 ? '┌' : i === w - 1 ? '┐' : '─';
    const bot = i === 0 ? '└' : i === w - 1 ? '┘' : '─';
    buf.set(x + i, y, { ch: top, fg: BORDER, bg: PANEL_BG });
    buf.set(x + i, bottom, { ch: bot, fg: BORDER, bg: PANEL_BG });
  }
  for (let r = 1; r < h - 1; r++) {
    buf.set(x, y + r, { ch: '│', fg: BORDER, bg: PANEL_BG });
    buf.set(right, y + r, { ch: '│', fg: BORDER, bg: PANEL_BG });
  }
}

/** Draw the Confirm/Cancel buttons centered on `row`, registering their hit regions. */
function drawButtons(ctx: RenderContext, view: ModalView, x: number, row: number, w: number): void {
  const { buf, hits } = ctx;
  const focusBg = view.tone === 'warning' ? FOCUS_WARN_BG : FOCUS_INFO_BG;
  const confirm = btnText(view.confirmLabel);
  const cancel = btnText(view.cancelLabel);
  let cx = x + Math.max(0, Math.floor((w - buttonsWidth(view)) / 2));

  for (const [id, text] of [
    ['confirm', confirm],
    ['cancel', cancel],
  ] as const) {
    const focused = view.focus === id;
    buf.text(cx, row, text, focused ? FOCUS_FG : BTN_FG, focused ? focusBg : BTN_BG);
    hits.add(`modal:${id}`, cx, row, [...text].length, 1);
    cx += [...text].length + GAP;
  }
}

/** Draw the modal centered in the canvas region. Call this LAST in the frame. */
export function drawModal(ctx: RenderContext, view: ModalView): void {
  const { buf, layout } = ctx;
  const inner = Math.max(
    [...view.title].length,
    buttonsWidth(view),
    ...view.lines.map((l) => [...l].length),
  );
  const w = Math.min(layout.canvasCols, inner + PAD_X * 2 + 2);
  const h = Math.min(layout.canvasRows, view.lines.length + 6);
  const x = layout.canvasX + Math.max(0, Math.floor((layout.canvasCols - w) / 2));
  const y = layout.canvasY + Math.max(0, Math.floor((layout.canvasRows - h) / 2));
  const textMax = w - PAD_X * 2;

  buf.fillRect(x, y, w, h, { ch: ' ', fg: null, bg: PANEL_BG });
  drawBorder(ctx, x, y, w, h);
  buf.textBold(
    x + PAD_X,
    y + 1,
    clip(view.title, textMax),
    view.tone === 'warning' ? TITLE_WARN : TITLE_INFO,
    PANEL_BG,
  );
  view.lines.forEach((line, i) => {
    buf.text(x + PAD_X, y + 3 + i, clip(line, textMax), BODY, PANEL_BG);
  });
  drawButtons(ctx, view, x, y + h - 2, w);
}
