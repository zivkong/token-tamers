/**
 * The interactive shell: a 30fps fixed-timestep loop that renders the active
 * page into the canvas, draws a clickable menu grid below it, and drives the
 * host's simulation about once per second.
 *
 * All wall-clock reads go through a single injected `now()` so golden tests can
 * fake time. All terminal output goes through one `Writer`.
 */

import { Writer, type ColorMode, type OutputSink } from './terminal/ansi';
import { FrameBuffer } from './render/buffer';
import { HitRegistry } from './render/hit';
import type { InputEvent } from './terminal/input';
import {
  defaultSize,
  defaultSizeSafe,
  enterTerminal,
  nullSource,
  sleep,
  stdinSource,
  stdoutSink,
} from './shell-io';
import { computeLayout } from './render/layout';
import { renderFrame, type FrameInput } from './render/frame';
import { menuButtonY, packMenu } from './render/menu';
import type {
  AdapterInfo,
  BattleView,
  CompletionBreakdown,
  LiveStats,
  PageId,
  PageUiState,
  ShellInfo,
  SettingsState,
} from './pages/types';
import { advanceBattlePlayback, buildBattleVsRecord, handleBattleKey } from './pages/battle';
import { applyEffects, flash } from './shell-effects';
import { buildDexRows, DEX_LIST_OFFSET } from './pages/dex';
import { ARCHIVE_LIST_OFFSET } from './pages/archive';
import { cycleSelectedField, isUpdateFieldSelected, settingsFieldCount } from './pages/settings';
import {
  isBattleReady,
  type ContentPack,
  type GameEffect,
  type GameState,
} from '@token-tamers/core';

// Re-exported shell host/options contract (kept identical to src/index.ts).
export interface ShellHost {
  pack: ContentPack;
  getState(): GameState;
  advance(now: number): GameEffect[];
  completion(): CompletionBreakdown;
  /**
   * Optional real-time token-consumption readout for the pet vitals panel,
   * derived from the engine's open window. Called once per rendered frame.
   */
  liveStats?(): LiveStats;
}

export interface ShellOptions {
  host: ShellHost;
  fps?: number;
  color?: ColorMode;
  /** Static build/config facts surfaced on the Settings page. */
  info?: ShellInfo;
  /** Configured adapters (read-only display on the Settings page). */
  adapters?: AdapterInfo[];
  /** Initial pet-global cycle policy ('subscription' | 'static'); defaults to 'static'. */
  cyclePolicy?: string;
  /** Initial subscription anchor adapter id; '' when static. */
  anchorAdapter?: string;
  /** Initial opt-in update mode ('off' | 'notify' | 'auto'); defaults to 'off'. */
  updateMode?: string;
  /** Initial page to open on; defaults to 'pet'. `tt battle` opens on 'battle'. */
  initialPage?: PageId;
  /** A battle to play back immediately (set by `tt battle <code>`); undefined ⇒ picker. */
  initialBattle?: BattleView;
  /**
   * Persist the edited pet-global cycle clock. Called on each change with the new
   * policy + anchor; the host writes config.json (applied on next launch).
   */
  onCycleChange?: (policy: string, anchorAdapter: string) => void;
  /**
   * Persist the edited opt-in update mode. Called with the new mode; the host
   * writes settings.json (applied on next launch). Off by default — the offline
   * pledge holds until the player opts in here.
   */
  onUpdateModeChange?: (mode: string) => void;
  // --- additive testing/IO hooks (all optional; defaults wire real stdio) ---
  /** Injected clock; defaults to Date.now. Single time source for the loop. */
  now?: () => number;
  /** Output sink; defaults to a process.stdout-backed sink. */
  out?: OutputSink;
  /** Async source of decoded input events; defaults to process.stdin. */
  input?: InputSource;
  /** Terminal size source; defaults to process.stdout columns/rows. */
  size?: () => { cols: number; rows: number };
  /** Install signal/raw-mode handlers; defaults true. Tests pass false. */
  manageTerminal?: boolean;
  /** Stop after this many frames (tests); undefined = run until quit. */
  maxFrames?: number;
}

/** A pull/push source of input events. */
export interface InputSource {
  /** Register a listener; returns an unsubscribe fn. */
  onEvent(cb: (ev: InputEvent) => void): () => void;
  start?(): void;
  stop?(): void;
}

const FRAME_MS = 1000 / 30;
const ADVANCE_MS = 1000;

/** Internal mutable shell runtime. */
interface ShellRuntime {
  page: PageId;
  frame: number;
  ui: Record<PageId, PageUiState>;
  flash: string | null;
  flashUntilFrame: number;
  quit: boolean;
  /** Static build/config facts for the Settings page (from options). */
  info?: ShellInfo;
  /** Live, editable adapter state for the Settings page. */
  settings: SettingsState;
  /** Persist hook for the pet-global cycle edit (from options). */
  onCycleChange?: (policy: string, anchorAdapter: string) => void;
  /** Persist hook for the opt-in update-mode edit (from options). */
  onUpdateModeChange?: (mode: string) => void;
  /** The loaded battle to play back on the Battle page (undefined ⇒ opponent picker). */
  battle?: BattleView;
}

/** Resolved loop dependencies (injected once, passed as a unit). */
interface LoopContext {
  options: ShellOptions;
  writer: Writer;
  sizeFn: () => { cols: number; rows: number };
  now: () => number;
  frameMs: number;
  /** The hit registry, shared with the input handler so clicks resolve page regions. */
  hits: HitRegistry;
}

/** Dependencies the input handler needs beyond the runtime. */
interface InputDeps {
  host: ShellHost;
  /** Last frame's hit regions (pages register clickable ids during render). */
  hits: HitRegistry;
  /** Copy text to the terminal clipboard (OSC 52). */
  copy: (text: string) => void;
}

function freshUi(): Record<PageId, PageUiState> {
  return {
    pet: { selected: 0, scroll: 0 },
    dex: { selected: 0, scroll: 0 },
    'dex-detail': { selected: 0, scroll: 0, speciesId: null },
    archive: { selected: 0, scroll: 0 },
    settings: { selected: 0, scroll: 0 },
    battle: { selected: 0, scroll: 0 },
  };
}

/**
 * Seed the editable Settings state from a working copy of the adapter configs +
 * the opt-in update mode. The update-mode field is always present (index 0), so
 * `selected` starts there and the page is editable even with no adapters.
 */
function initialSettings(options: ShellOptions): SettingsState {
  const copy = (options.adapters ?? []).map((a) => ({ ...a }));
  return {
    updateMode: options.updateMode ?? 'off',
    cyclePolicy: options.cyclePolicy ?? 'static',
    anchorAdapter: options.anchorAdapter ?? '',
    adapters: copy,
    selected: 0,
  };
}

/**
 * Run the shell. Resolves on quit (key 'q', the Quit menu, or ctrl-c). The
 * fixed-timestep accumulator decouples sim/render cadence from real frame jitter.
 */
export async function runShell(options: ShellOptions): Promise<void> {
  const fps = options.fps ?? 30;
  const frameMs = 1000 / fps;
  const color: ColorMode = options.color ?? 'truecolor';
  const now = options.now ?? Date.now;
  const manageTerminal = options.manageTerminal ?? true;

  const sink: OutputSink = options.out ?? stdoutSink();
  const writer = new Writer(sink, color);
  const sizeFn = options.size ?? defaultSize;

  const rt: ShellRuntime = {
    page: options.initialPage ?? 'pet',
    frame: 0,
    ui: freshUi(),
    flash: null,
    flashUntilFrame: 0,
    quit: false,
    info: options.info,
    settings: initialSettings(options),
    onCycleChange: options.onCycleChange,
    onUpdateModeChange: options.onUpdateModeChange,
    battle: options.initialBattle,
  };

  // Shared with the loop's renderer so a click resolves the regions pages drew.
  const hits = new HitRegistry();
  const deps: InputDeps = {
    host: options.host,
    hits,
    copy: (text) => writer.copyToClipboard(text),
  };

  const inputSource = options.input ?? (manageTerminal ? stdinSource() : nullSource());
  const unsubscribe = inputSource.onEvent((ev) => handleEvent(rt, ev, deps));

  const cleanup = manageTerminal ? enterTerminal(writer) : () => {};

  try {
    inputSource.start?.();
    const ctx: LoopContext = { options, writer, sizeFn, now, frameMs, hits };
    await loop(rt, ctx);
  } finally {
    unsubscribe();
    inputSource.stop?.();
    cleanup();
    writer.restore();
  }
}

async function loop(rt: ShellRuntime, ctx: LoopContext): Promise<void> {
  const { options, writer, sizeFn, now, frameMs, hits } = ctx;
  const host = options.host;
  let last = now();
  let renderAcc = 0;
  let advanceAcc = 0;
  let frames = 0;

  let curSize = sizeFn();
  // Force a full first paint with a fresh buffer.
  let buf = new FrameBuffer(curSize.cols, curSize.rows);

  while (!rt.quit) {
    const t = now();
    const dt = Math.max(0, t - last);
    last = t;
    renderAcc += dt;
    advanceAcc += dt;

    // Advance the sim ~1/sec.
    while (advanceAcc >= ADVANCE_MS) {
      const effects = host.advance(now());
      applyEffects(rt, effects);
      advanceAcc -= ADVANCE_MS;
    }

    // Render at the fixed frame cadence (catch up, but cap to avoid spirals).
    let steps = 0;
    while (renderAcc >= frameMs && steps < 5) {
      // Resize handling: rebuild buffer on size change.
      const size = sizeFn();
      if (size.cols !== curSize.cols || size.rows !== curSize.rows) {
        curSize = size;
        buf = new FrameBuffer(size.cols, size.rows);
      }
      renderOnce(rt, host, writer, buf, hits);
      rt.frame++;
      frames++;
      renderAcc -= frameMs;
      steps++;
      if (options.maxFrames !== undefined && frames >= options.maxFrames) {
        rt.quit = true;
        break;
      }
    }

    if (rt.quit) break;
    await sleep(frameMs);
  }
}

function renderOnce(
  rt: ShellRuntime,
  host: ShellHost,
  writer: Writer,
  buf: FrameBuffer,
  hits: HitRegistry,
): void {
  if (rt.flash && rt.frame >= rt.flashUntilFrame) {
    rt.flash = null;
  }
  if (rt.page === 'battle' && rt.battle) advanceBattlePlayback(rt.battle, rt.frame);
  const input: FrameInput = {
    page: rt.page,
    state: host.getState(),
    pack: host.pack,
    mode: writer.color,
    frame: rt.frame,
    ui: rt.ui[rt.page],
    completion: host.completion(),
    flash: rt.flash,
    info: rt.info,
    settings: rt.settings,
    live: host.liveStats?.(),
    battle: rt.battle,
  };
  renderFrame(buf, hits, input);
  buf.flush(writer);
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

function handleEvent(rt: ShellRuntime, ev: InputEvent, deps: InputDeps): void {
  if (ev.type === 'key') {
    handleKey(rt, ev.name, deps.host);
    return;
  }
  handleMouse(rt, ev, deps);
}

function handleKey(rt: ShellRuntime, name: string, host: ShellHost): void {
  // Battle-page nav (scrub/play/pick) is owned by the battle module; global
  // hotkeys below still win (they aren't battle-nav names), so order is safe.
  if (handleBattleKey(rt, host, name)) return;
  switch (name) {
    case 'ctrl-c':
    case 'q':
      rt.quit = true;
      return;
    case '1':
      rt.page = 'pet';
      return;
    case '2':
      rt.page = 'dex';
      return;
    case '3':
      rt.page = 'archive';
      return;
    case '4':
      rt.page = 'settings';
      return;
    case 'b':
      // From the Archive, battle the live pet against the selected record.
      if (rt.page === 'archive') startBattleFromArchive(rt, host);
      return;
    case 'up':
      moveSelection(rt, host, -1);
      return;
    case 'down':
      moveSelection(rt, host, +1);
      return;
    case 'left':
      adjustSetting(rt, -1);
      return;
    case 'right':
      adjustSetting(rt, +1);
      return;
    case 'enter':
      if (rt.page === 'dex') openDexDetail(rt, host);
      return;
    case 'escape':
      if (rt.page === 'dex-detail') rt.page = 'dex';
      return;
    default:
      return;
  }
}

/** Drill into the Dex detail view for the currently selected (discovered) row. */
function openDexDetail(rt: ShellRuntime, host: ShellHost): void {
  const ctx = {
    pack: host.pack,
    state: host.getState(),
  } as unknown as Parameters<typeof buildDexRows>[0];
  const row = buildDexRows(ctx)[rt.ui.dex.selected];
  if (!row || !row.owned || !row.speciesId) return;
  const detail = rt.ui['dex-detail'];
  detail.speciesId = row.speciesId;
  detail.selected = 0;
  detail.scroll = 0;
  rt.page = 'dex-detail';
}

/** Battle the live pet against the selected Archive record; open the Battle page on success. */
function startBattleFromArchive(rt: ShellRuntime, host: ShellHost): void {
  const view = buildBattleVsRecord(host, rt.ui.archive.selected);
  if (view) {
    rt.battle = view;
    rt.page = 'battle';
    return;
  }
  // Tell the player WHY nothing happened — both sides must reach the Evolved gate.
  flash(
    rt,
    isBattleReady(host.getState().pet)
      ? 'That record is sealed — opponents must reach Evolved.'
      : 'Your pet is sealed — battles unlock at Evolved.',
  );
}

/** Cycle the focused Settings field and persist (no-op off the Settings page). */
function adjustSetting(rt: ShellRuntime, delta: number): void {
  if (rt.page !== 'settings') return;
  // The update-mode field persists to settings.json; the cycle fields to config.json.
  const updateField = isUpdateFieldSelected(rt.settings);
  cycleSelectedField(rt.settings, delta);
  if (updateField) {
    rt.onUpdateModeChange?.(rt.settings.updateMode);
  } else {
    // The anchor is only meaningful under subscription; persist '' for static so a
    // remembered anchor (kept in-memory for round-trips) never lands in config.json.
    const anchor = rt.settings.cyclePolicy === 'subscription' ? rt.settings.anchorAdapter : '';
    rt.onCycleChange?.(rt.settings.cyclePolicy, anchor);
  }
}

function handleMouse(
  rt: ShellRuntime,
  ev: Extract<InputEvent, { type: 'mouse' }>,
  deps: InputDeps,
): void {
  const host = deps.host;
  if (ev.action === 'wheel-up') {
    moveSelection(rt, host, -1);
    return;
  }
  if (ev.action === 'wheel-down') {
    moveSelection(rt, host, +1);
    return;
  }
  if (ev.action !== 'press') return;

  // Re-derive hit regions for the current frame size to resolve the click.
  const size = defaultSizeSafe();
  const layout = computeLayout(size.cols, size.rows);
  // SGR mouse is 1-based; convert to 0-based cell coords.
  const cx = ev.x - 1;
  const cy = ev.y - 1;

  // Menu clicks: hit-test the same equal-width button grid the renderer drew.
  for (const btn of packMenu(layout.termCols).buttons) {
    const y = layout.menuY + menuButtonY(btn.row, layout.menuBtnH);
    if (cx >= btn.x && cx < btn.x + btn.w && cy >= y && cy < y + layout.menuBtnH) {
      activate(rt, btn.id);
      return;
    }
  }

  // Page-registered regions (e.g. the Dex-detail DNA code → copy to clipboard).
  const region = deps.hits.hit(cx, cy);
  if (region?.startsWith('copy:')) {
    deps.copy(region.slice('copy:'.length));
    flash(rt, 'DNA code copied ✓');
    return;
  }

  // A click anywhere on the detail page (outside the menu / a copy region) returns to the Dex.
  if (rt.page === 'dex-detail' && cy < layout.menuDividerY) {
    rt.page = 'dex';
    return;
  }

  // List-row clicks (Dex/Archive): map by canvas geometry, ignoring the menu.
  if ((rt.page === 'dex' || rt.page === 'archive') && cy < layout.menuDividerY) {
    handleListRowClick(rt, host, cy - (layout.canvasY + listOffset(rt.page)));
  }
}

/** First-visible-row offset for the list page, shared with the renderer. */
function listOffset(page: PageId): number {
  return page === 'dex' ? DEX_LIST_OFFSET : ARCHIVE_LIST_OFFSET;
}

/** Select (and on the Dex, drill into) the list row `idxOnScreen` cells below the list top. */
function handleListRowClick(rt: ShellRuntime, host: ShellHost, idxOnScreen: number): void {
  if (idxOnScreen < 0) return;
  const ui = rt.ui[rt.page];
  const target = ui.scroll + idxOnScreen;
  if (target < 0 || target > rowCount(rt, host) - 1) return;
  ui.selected = target;
  // On the Dex, a click on a discovered species drills into its detail.
  if (rt.page === 'dex') openDexDetail(rt, host);
}

function activate(rt: ShellRuntime, id: PageId | 'quit'): void {
  if (id === 'quit') {
    rt.quit = true;
    return;
  }
  rt.page = id;
}

function moveSelection(rt: ShellRuntime, host: ShellHost, delta: number): void {
  if (rt.page === 'settings') {
    // settingsFieldCount is always >= 2 (update mode + cycle policy), so max >= 1.
    const max = settingsFieldCount(rt.settings) - 1;
    rt.settings.selected = Math.max(0, Math.min(max, rt.settings.selected + delta));
    return;
  }
  if (rt.page !== 'dex' && rt.page !== 'archive') return;
  const ui = rt.ui[rt.page];
  const max = rowCount(rt, host) - 1;
  ui.selected = Math.max(0, Math.min(max, ui.selected + delta));
}

function rowCount(rt: ShellRuntime, host: ShellHost): number {
  const state = host.getState();
  if (rt.page === 'archive') return state.dexRecords.length;
  if (rt.page === 'dex') {
    // Build minimal context for counting Dex rows.
    const ctx = {
      pack: host.pack,
      state,
    } as unknown as Parameters<typeof buildDexRows>[0];
    return buildDexRows(ctx).length;
  }
  return 0;
}

export { FRAME_MS, ADVANCE_MS };
