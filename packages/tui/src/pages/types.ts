/**
 * Shared types for page renderers. A page renders into the canvas region of
 * the frame buffer, registers hit regions, and reads from a render context.
 */

import type {
  BattleResult,
  Combatant,
  ContentPack,
  GameState,
  GradeOddsPreview,
} from '@token-tamers/core';
import type { ColorMode } from '../terminal/ansi';
import type { FrameBuffer } from '../render/buffer';
import type { HitRegistry } from '../render/hit';
import type { Layout } from '../render/layout';

export type PageId =
  | 'pet'
  | 'dex'
  | 'dex-detail'
  | 'unlockables'
  | 'achievements'
  | 'settings'
  | 'battle';

/** Transient per-page UI state the shell owns (selection, scroll). */
export interface PageUiState {
  /** List selected row index (on the Dex: the star index within the House). */
  selected: number;
  /** List scroll offset (top visible row). */
  scroll: number;
  /** Dex: which House sky is shown (index into DEX_HOUSES). */
  house?: number;
  /** Dex-detail: the species being inspected (set when drilling in from the Dex). */
  speciesId?: string | null;
  /** Battle setup: the pasted-DNA-code buffer (the opponent code being typed). */
  input?: string;
  /** Battle setup: which zone is focused — your-fighter list, the paste field, or the Dex list. */
  focus?: 'fighter' | 'input' | 'list';
  /** Battle setup: selected index into your battle-ready fighter candidates (left side). */
  fighterSel?: number;
}

/**
 * A loaded battle the Battle page plays back. The simulation runs ONCE (when the
 * battle starts); the page then renders the timeline up to `cursor` as PURE
 * playback (no RNG at render time), so it is golden-frame testable. `left` is the
 * player's combatant (side 'a'), `right` the opponent (side 'b').
 */
export interface BattleView {
  left: Combatant;
  right: Combatant;
  result: BattleResult;
  /** Events applied so far, 0..timeline.length (the playback head). */
  cursor: number;
  /** Whether playback auto-advances each frame. */
  playing: boolean;
  /** Battle seed nonce; 0 for the first/canonical fight, bumped on each rematch. */
  nonce?: number;
}

/**
 * One configured adapter as shown on the Settings page. Adapters are pure data
 * sources now (read-only here) — the cycle clock is a single pet-global setting,
 * not a per-adapter toggle. Adding/removing adapters stays in `tt init`.
 */
export interface AdapterInfo {
  provider: string;
}

/**
 * Static build/config facts the cli composes once and hands to the shell for
 * the Settings page. Passed in (not read live) so the page stays deterministic
 * for golden frames — the host owns every wall-clock/process/filesystem read.
 */
export interface ShellInfo {
  /** App version, e.g. '0.1.0'. */
  version: string;
  /** Display path of the data dir, e.g. '~/.tokentamers'. */
  dataDir: string;
  /** Opt-in update mode ('off' | 'notify' | 'auto'); undefined in tests. */
  updateMode?: string;
  /** A newer version tag seen on the last opt-in check, if any (e.g. 'v1.3.0'). */
  updateAvailable?: string;
  /** The player's Tamer handle ('' = anonymous). Stamped on the codes you breed. */
  tamer?: string;
  /** The earned title the player is wearing ('' = none). */
  tamerTitle?: string;
}

/**
 * Live, editable Settings state the shell owns. The page renders a declarative
 * list of fields grouped into sections (Identity · Display · Cycle · Updates); the
 * flat `selected` index walks the VISIBLE fields top-to-bottom (the subscription
 * anchor is hidden under static / a single adapter). Edits mutate this copy and
 * persist via the shell's hooks routed by field group: identity → config.json,
 * display → settings.json (applied LIVE), cycle → config.json, update → settings.json.
 */
export interface SettingsState {
  /** Opt-in update mode: 'off' | 'notify' | 'auto'. */
  updateMode: string;
  /** Pet-global cycle policy: 'subscription' | 'static'. */
  cyclePolicy: string;
  /** Subscription anchor adapter id (the molt-clock driver); '' when static. */
  anchorAdapter: string;
  /** ANSI color preference: 'auto' | 'truecolor' | '256' | '8' | 'none' (applied live). */
  color: string;
  /** Sub-cell sprite density: 'auto' | 'octant' | 'sextant' | 'half' (applied live). */
  subcell: string;
  /** Configured adapters (read-only display). */
  adapters: AdapterInfo[];
  /** The player's Tamer handle (text-editable in place; '' = anonymous). */
  tamerName: string;
  /** The earned title the player is wearing ('' = none). */
  tamerTitle: string;
  /** Titles the player has earned and may wear (cycle through these + none). */
  earnedTitles: string[];
  /** Whether the Tamer-name field is in text-edit mode (typing appends/deletes). */
  editingName: boolean;
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
  /**
   * Seconds until the next molt-window close — the live growth / "next roll"
   * countdown. `null` when no molt is scheduled (subscription policy, pet idle);
   * undefined when the host can't compute it (the row then omits the countdown).
   */
  secsToMolt?: number | null;
  /** Seconds until the next weekly rebirth — the Apex "Reborn Now" countdown. */
  secsToRebirth?: number;
}

/** Visual emphasis for a modal dialog: a neutral confirm vs a caution warning. */
export type ModalTone = 'info' | 'warning';

/**
 * Render-only description of an open modal dialog (a centered confirm pop-up).
 * Pure data so `components/modal.drawModal` is golden-frame testable; the action
 * to run on confirm lives on the shell runtime, never in this render view.
 */
export interface ModalView {
  /** Heading line, tone-colored. */
  title: string;
  /** Body message lines, drawn one per row (already split for the layout). */
  lines: string[];
  /** Confirm button label (the affirmative / destructive action). */
  confirmLabel: string;
  /** Cancel button label (the safe dismiss). */
  cancelLabel: string;
  /** Accent: `warning` tints the title/confirm in caution colors. */
  tone: ModalTone;
  /** Which button currently has keyboard focus. */
  focus: 'confirm' | 'cancel';
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
  /** The loaded battle to play back on the Battle page (undefined ⇒ opponent picker). */
  battle?: BattleView;
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
