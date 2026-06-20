/**
 * Modal dialog input handling for the shell — the reusable confirm/cancel pop-up.
 * Split out of `shell-input.ts` to keep that file under the line ceiling.
 *
 * `openConfirmModal` opens one; while a modal is open the shell routes ALL input
 * here (see `handleEvent` in shell-input), so the page behind it stops reacting
 * until the player confirms (runs `onConfirm`) or cancels. Pure aside from mutating
 * the shared `ShellRuntime`.
 */

import type { InputEvent } from './terminal/input';
import type { ModalTone } from './pages/types';
import type { InputDeps, ShellRuntime } from './shell';

/**
 * Open a reusable confirm/cancel modal. Focus starts on Cancel so a destructive
 * default is never one stray Enter away. Reuse this for any decision — the reborn
 * warning is just the first caller.
 */
export function openConfirmModal(
  rt: ShellRuntime,
  opts: {
    title: string;
    lines: string[];
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: ModalTone;
    onConfirm: () => void;
  },
): void {
  rt.modal = {
    view: {
      title: opts.title,
      lines: opts.lines,
      confirmLabel: opts.confirmLabel ?? 'Confirm',
      cancelLabel: opts.cancelLabel ?? 'Cancel',
      tone: opts.tone ?? 'info',
      focus: 'cancel',
    },
    onConfirm: opts.onConfirm,
  };
}

/** Route an input event to the open modal. Only called when `rt.modal` is set. */
export function handleModalEvent(rt: ShellRuntime, ev: InputEvent, deps: InputDeps): void {
  if (ev.type === 'key') handleModalKey(rt, ev.name);
  else if (ev.action === 'press') handleModalClick(rt, ev, deps);
}

/** Keys while a modal is open: ←/→/Tab move focus, Enter activates it, y/n/Esc shortcut. */
function handleModalKey(rt: ShellRuntime, name: string): void {
  const m = rt.modal;
  if (!m) return;
  switch (name) {
    case 'ctrl-c':
      rt.quit = true;
      return;
    case 'left':
    case 'right':
    case 'tab':
      m.view.focus = m.view.focus === 'confirm' ? 'cancel' : 'confirm';
      return;
    case 'y':
      confirmModal(rt);
      return;
    case 'n':
    case 'escape':
      rt.modal = undefined;
      return;
    case 'enter':
      if (m.view.focus === 'confirm') confirmModal(rt);
      else rt.modal = undefined;
      return;
    default:
      return; // swallow everything else — the modal blocks the page
  }
}

/** Clicks while a modal is open resolve ONLY its two buttons; elsewhere is ignored. */
function handleModalClick(
  rt: ShellRuntime,
  ev: Extract<InputEvent, { type: 'mouse' }>,
  deps: InputDeps,
): void {
  const id = deps.hits.hit(ev.x - 1, ev.y - 1);
  if (id === 'modal:confirm') confirmModal(rt);
  else if (id === 'modal:cancel') rt.modal = undefined;
}

/** Close the modal and run its confirm action (cleared first so re-entrancy is safe). */
function confirmModal(rt: ShellRuntime): void {
  const m = rt.modal;
  if (!m) return;
  rt.modal = undefined;
  m.onConfirm();
}
