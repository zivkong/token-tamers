/**
 * Shared types for page renderers. A page renders into the canvas region of
 * the frame buffer, registers hit regions, and reads from a render context.
 */

import type { ContentPack, GameState } from '@token-tamers/core';
import type { ColorMode } from '../ansi';
import type { FrameBuffer } from '../buffer';
import type { HitRegistry } from '../hit';
import type { Layout } from '../layout';

export type PageId = 'pet' | 'dex' | 'archive';

/** Transient per-page UI state the shell owns (selection, scroll). */
export interface PageUiState {
  /** Dex/Archive selected row index. */
  selected: number;
  /** Dex/Archive scroll offset (top visible row). */
  scroll: number;
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
}
