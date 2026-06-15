/**
 * Shared types for page renderers. A page renders into the canvas region of
 * the frame buffer, registers hit regions, and reads from a render context.
 */

import type { ContentPack, GameState, GradeOddsPreview } from '@token-tamers/core';
import type { ColorMode } from '../terminal/ansi';
import type { FrameBuffer } from '../render/buffer';
import type { HitRegistry } from '../render/hit';
import type { Layout } from '../render/layout';

export type PageId = 'pet' | 'dex' | 'dex-detail' | 'archive' | 'settings';

/** Transient per-page UI state the shell owns (selection, scroll). */
export interface PageUiState {
  /** Dex/Archive selected row index. */
  selected: number;
  /** Dex/Archive scroll offset (top visible row). */
  scroll: number;
  /** Dex-detail: the species being inspected (set when drilling in from the Dex). */
  speciesId?: string | null;
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
  /** Opt-in update mode ('off' | 'notify' | 'auto'); undefined in tests. */
  updateMode?: string;
  /** A newer version tag seen on the last opt-in check, if any (e.g. 'v1.3.0'). */
  updateAvailable?: string;
}

/**
 * Live, editable Settings state the shell owns: the opt-in update mode plus a
 * working copy of the adapter configs, and which editable field is focused. The
 * flat field list is `[updateMode, (adapter0 plan, adapter0 cycle), …]`: index 0
 * is always the update mode, then each adapter contributes two fields — so
 * `selected` ranges over `1 + adapters.length * 2`. Edits mutate this copy and
 * persist via the shell's hooks (`onUpdateModeChange` → settings.json,
 * `onAdaptersChange` → config.json); both take effect on the next launch, never
 * mid-session (cycle policy reshapes molt windows, which must not shift under a
 * running pet).
 */
export interface SettingsState {
  /** Opt-in update mode: 'off' | 'notify' | 'auto'. */
  updateMode: string;
  adapters: AdapterInfo[];
  selected: number;
}

/**
 * Live, real-time token-consumption readout for the pet's vitals panel. Derived
 * by the host each frame from the engine's OPEN window (`pendingEvents`) plus the
 * per-adapter baselines, so the player sees usage feed the pet as it happens.
 * Undefined in golden tests (the panel falls back to a static baseline summary).
 */
export interface LiveStats {
  /** Raw tokens (in+out+cache+reasoning) accumulated in the open window so far. */
  windowTokens: number;
  /** Cache-weighted essence of the open window so far (the engine's feed metric). */
  windowEssence: number;
  /** Rolling baseline mean essence per window — the pet's normal appetite. */
  baselineEssence: number;
  /** Closed windows observed across the pet's life (lifetime feedings). */
  windowsObserved: number;
  /**
   * Forecast of the next grade roll from the open window (the `Odds` row), or
   * null at the S cap (no further rolls). Undefined when the host can't compute
   * it; the panel then falls back to the published base odds from GameState.
   */
  nextGrade?: GradeOddsPreview | null;
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
  /** Real-time token-consumption readout for the pet page (undefined in tests). */
  live?: LiveStats;
  /** Completion breakdown (0..100 each); each page surfaces its own slice. */
  completion: CompletionBreakdown;
}

/**
 * Completion meter breakdown — each field is a percent (0..100). Pages show the
 * slice they own: Dex → `dex`, Archive → its records coverage, etc. Mirrors the
 * engine's completion result (weighted 40/40/10/10 for `overall`).
 */
export interface CompletionBreakdown {
  overall: number;
  dex: number;
  achievements: number;
  habitats: number;
  trinkets: number;
}
