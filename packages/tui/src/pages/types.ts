/**
 * Shared types for page renderers. A page renders into the canvas region of
 * the frame buffer, registers hit regions, and reads from a render context.
 */

import type { ContentPack, GameState } from '@token-tamers/core';
import type { ColorMode } from '../terminal/ansi';
import type { FrameBuffer } from '../render/buffer';
import type { HitRegistry } from '../render/hit';
import type { Layout } from '../render/layout';

export type PageId = 'pet' | 'dex' | 'archive' | 'settings';

/** Transient per-page UI state the shell owns (selection, scroll). */
export interface PageUiState {
  /** Dex/Archive selected row index. */
  selected: number;
  /** Dex/Archive scroll offset (top visible row). */
  scroll: number;
}

/** One configured adapter as shown (and edited) on the Settings page. */
export interface AdapterInfo {
  provider: string;
  /** Editable: 'subscription' | 'api'. */
  plan: string;
  /** Editable cycle policy kind: 'dynamic' | 'static'. */
  policy: string;
}

/**
 * Static build/config facts the cli composes once and hands to the shell for
 * the Settings page. Passed in (not read live) so the page stays deterministic
 * for golden frames — the host owns every wall-clock/process/filesystem read.
 */
export interface ShellInfo {
  /** App version, e.g. '0.1.0'. */
  version: string;
  /** Runtime banner, e.g. 'node v22.11.0'. */
  runtime: string;
  /** Configured render fps. */
  fps: number;
  /** Display path of the data dir, e.g. '~/.tokentamers'. */
  dataDir: string;
}

/**
 * Live, editable Settings state the shell owns: a working copy of the adapter
 * configs plus which editable field is focused. Each adapter contributes two
 * fields (plan, then cycle policy), so `selected` indexes a flat list of length
 * `adapters.length * 2`; it is -1 when there is nothing to edit. Edits mutate
 * this copy and are persisted via the shell's `onAdaptersChange` hook — they
 * take effect on the next launch, never mid-session (cycle policy reshapes molt
 * windows, which must not shift under a running pet).
 */
export interface SettingsState {
  adapters: AdapterInfo[];
  selected: number;
}

export interface RenderContext {
  buf: FrameBuffer;
  hits: HitRegistry;
  layout: Layout;
  state: GameState;
  pack: ContentPack;
  mode: ColorMode;
  /** Animation frame counter (advances at the render fps). */
  frame: number;
  ui: PageUiState;
  /** A short transient banner line (e.g. gradeshift flash), or null. */
  flash: string | null;
  /** Static build/config facts for the Settings page (undefined in tests). */
  info?: ShellInfo;
  /** Live, editable adapter state for the Settings page (undefined in tests). */
  settings?: SettingsState;
}
